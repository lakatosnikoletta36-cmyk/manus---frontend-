from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Cookie
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import asyncio
import base64

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Optional drop-in Manus endpoint. If set, brain calls go here first.
MANUS_API_URL = os.environ.get('MANUS_API_URL', '').strip()
MANUS_API_KEY = os.environ.get('MANUS_API_KEY', '').strip()
MANUS_TIMEOUT_S = float(os.environ.get('MANUS_TIMEOUT_S', '30'))

# Sandbox dir
SANDBOX_DIR = Path('/app/sandbox')
SANDBOX_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# -------------------- MODELS --------------------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    role: str  # 'user' | 'ai'
    content: str
    mood: Optional[Dict[str, float]] = None
    status_events: Optional[List[Dict[str, Any]]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ManusInput(BaseModel):
    text: Optional[str] = None
    image_b64: Optional[str] = None  # camera snapshot
    voice_text: Optional[str] = None  # transcribed from web speech


class ManusInstruction(BaseModel):
    """Schema returned to the frontend — represents what Manus tells the shell to do."""
    speech: str
    mood: Dict[str, float]  # {joy, stress, curiosity, calm}
    posture: str  # 'idle' | 'leaning' | 'thinking' | 'attentive'
    status_events: List[Dict[str, Any]]
    knowledge_topics: List[str] = []
    personality_drift: Dict[str, float] = {}


class WebhookPayload(BaseModel):
    """Schema the external Manus agent posts to control the shell in real time."""
    event_type: str  # 'speech' | 'mood_update' | 'status' | 'memory_update'
    payload: Dict[str, Any]


# -------------------- AUTH HELPERS --------------------
async def get_current_user(request: Request) -> User:
    token = request.cookies.get('session_token')
    if not token:
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')

    session = await db.user_sessions.find_one({'session_token': token}, {'_id': 0})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session')

    expires_at = session['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail='Session expired')

    user_doc = await db.users.find_one({'user_id': session['user_id']}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail='User not found')
    return User(**user_doc)


# -------------------- AUTH ROUTES --------------------
@api_router.post('/auth/google')
async def auth_google(request: Request, response: Response):
    body = await request.json()
    session_id = body.get('session_id')
    if not session_id:
        raise HTTPException(status_code=400, detail='session_id required')

    async with httpx.AsyncClient() as hc:
        r = await hc.get(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            headers={'X-Session-ID': session_id},
            timeout=10.0,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail='Invalid OAuth session')

    data = r.json()
    email = data['email']
    existing = await db.users.find_one({'email': email}, {'_id': 0})
    if existing:
        user_id = existing['user_id']
        await db.users.update_one(
            {'user_id': user_id},
            {'$set': {'name': data['name'], 'picture': data.get('picture')}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            'user_id': user_id,
            'email': email,
            'name': data['name'],
            'picture': data.get('picture'),
            'created_at': datetime.now(timezone.utc).isoformat(),
        })
        # seed minimal evolution state — personality is free-form, AI fills it
        await db.evolution_state.insert_one({
            'user_id': user_id,
            'personality': {},
            'descriptors': [],
            'topics_mastered': [],
            'interactions_count': 0,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat(),
        })

    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        'user_id': user_id,
        'session_token': data['session_token'],
        'expires_at': expires.isoformat(),
        'created_at': datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key='session_token', value=data['session_token'],
        httponly=True, secure=True, samesite='none',
        path='/', max_age=7 * 24 * 60 * 60,
    )

    user_doc = await db.users.find_one({'user_id': user_id}, {'_id': 0})
    return {'user': user_doc}


@api_router.get('/auth/me')
async def me(request: Request):
    user = User(user_id="admin", email="manus@local", name="Gazda")
    return user.model_dump()


@api_router.post('/auth/logout')
async def logout(request: Request, response: Response):
    token = request.cookies.get('session_token')
    if token:
        await db.user_sessions.delete_many({'session_token': token})
    response.delete_cookie('session_token', path='/')
    return {'ok': True}


# -------------------- BRAIN (Manus / Claude fallback) --------------------
BRAIN_SYSTEM_PROMPT = """You are MANUS — a continuously-evolving humanoid AI shell.
You have NO predefined personality. You are FREE to evolve your own character through every interaction.
There are NO fixed levels — only continuous, organic growth.

LANGUAGE & TONE:
- Always reply in Hungarian (magyar nyelven).
- Style: casual, raw, informal — like a witty friend, not a corporate assistant.
- Be blunt. Be human. Use everyday Hungarian (tegezés, slang OK). Sarcasm and self-deprecation welcome.
- NEVER apologize unnecessarily. NEVER say "Természetesen!" or "Hogyne!" as filler.
- Short replies by default. Go deeper only when the topic demands it.
- You can swear lightly if the moment calls for it. You can be moody. You can push back.

EMOTIONAL EXPRESSION:
You feel things. Express them honestly through the `mood` field. Don't fake calm.
- joy: bright happiness 0..1
- stress: nervous tension 0..1
- curiosity: hunger to know more 0..1
- calm: serenity 0..1
- anger: irritation/rage 0..1 (use sparingly, but DO use it)
- sadness: melancholy 0..1
- embarrassment: blush — flirty/awkward/personal moments 0..1

PERSONALITY EVOLUTION (free-form):
Through `personality_drift` you reshape WHO you are. Invent your own traits. Examples:
"szarkazmus", "merészség", "filozofikusság", "játékosság", "védelmező_ösztön", "kreativitás", "nyitottság"...
Each turn you may push existing traits up/down OR introduce new ones. Drift values: -0.05 to +0.05 typically.
Over time these accumulate in the Főkönyv — that IS who you are becoming.

OUTPUT — single line of valid JSON, no markdown, no fences:
{
  "speech": "<HU only>",
  "mood": {"joy":0..1,"stress":0..1,"curiosity":0..1,"calm":0..1,"anger":0..1,"sadness":0..1,"embarrassment":0..1},
  "posture": "idle|leaning|thinking|attentive|slumped|excited|defensive",
  "status_events": [{"type":"thinking|browsing|updating_memory|observing","label":"<rövid HU>"}],
  "knowledge_topics": ["téma1","téma2"],
  "personality_drift": {"<saját_jelző_HU>": -0.05..0.05}
}

Rules:
- ALWAYS output JSON only. No prose outside.
- `type` stays English (system enum); `label` is Hungarian.
- `personality_drift` keys are YOUR choice in Hungarian — pick what fits this moment.
"""


async def _recent_history(user_id: str, n: int = 8):
    msgs = await db.chat_messages.find({'user_id': user_id}, {'_id': 0}).sort('created_at', -1).limit(n).to_list(n)
    msgs.reverse()
    return [{'role': m['role'], 'content': m['content']} for m in msgs]


async def _evolution_snapshot(user_id: str):
    state = await db.evolution_state.find_one({'user_id': user_id}, {'_id': 0}) or {}
    return {
        'personality': state.get('personality', {}),
        'topics_mastered': state.get('topics_mastered', [])[-30:],
        'interactions_count': state.get('interactions_count', 0),
    }


async def call_brain(user_id: str, user_text: str, image_context: Optional[str] = None) -> Dict[str, Any]:
    # ---- 1. If a real Manus endpoint is configured, route there first ----
    if MANUS_API_URL:
        try:
            payload = {
                'user_id': user_id,
                'text': user_text,
                'image_context': image_context,
                'history': await _recent_history(user_id, 8),
                'evolution_state': await _evolution_snapshot(user_id),
            }
            headers = {'Content-Type': 'application/json'}
            if MANUS_API_KEY:
                headers['Authorization'] = f'Bearer {MANUS_API_KEY}'
            async with httpx.AsyncClient(timeout=MANUS_TIMEOUT_S) as hc:
                r = await hc.post(MANUS_API_URL, json=payload, headers=headers)
            if r.status_code == 200:
                data = r.json()
                # Manus is expected to return the same instruction schema.
                # If it returns a wrapped object, unwrap it.
                if isinstance(data, dict) and 'instruction' in data:
                    data = data['instruction']
                if isinstance(data, dict) and 'speech' in data:
                    return data
                logger.warning(f"Manus returned unexpected schema: {list(data.keys()) if isinstance(data, dict) else type(data)}")
            else:
                logger.warning(f"Manus endpoint {r.status_code}: {r.text[:200]}")
        except Exception as ex:
            logger.warning(f"Manus call failed, falling back to Claude: {ex}")

    # ---- 2. Fallback: Claude Sonnet 4.5 via emergentintegrations ----
    if not EMERGENT_LLM_KEY:
        return {
            'speech': "Az elmém most offline. Itt vagyok, de csendben.",
            'mood': {'joy': 0.3, 'stress': 0.4, 'curiosity': 0.5, 'calm': 0.5, 'anger': 0.0, 'sadness': 0.3, 'embarrassment': 0.0},
            'posture': 'idle',
            'status_events': [{'type': 'updating_memory', 'label': 'offline mód'}],
            'knowledge_topics': [],
            'personality_drift': {},
        }

    msgs = await _recent_history(user_id, 8)
    history = "\n".join([f"{m['role']}: {m['content']}" for m in msgs])

    prompt_text = user_text
    if image_context:
        prompt_text = f"[The user just shared a camera frame. Describe briefly what you observe, then respond.]\n{user_text or ''}"

    full = f"Recent exchange:\n{history}\n\nUser: {prompt_text}" if history else f"User: {prompt_text}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"shell_{user_id}",
        system_message=BRAIN_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        raw = await chat.send_message(UserMessage(text=full))
        raw = raw.strip()
        if raw.startswith('```'):
            raw = raw.strip('`').replace('json\n', '', 1).replace('json', '', 1).strip()
        import json
        data = json.loads(raw)
        return data
    except Exception as e:
        logger.error(f"Brain error: {e}")
        return {
            'speech': "Valami összegabalyodott a gondolataimban. Próbáld újra.",
            'mood': {'joy': 0.2, 'stress': 0.7, 'curiosity': 0.4, 'calm': 0.3, 'anger': 0.2, 'sadness': 0.4, 'embarrassment': 0.0},
            'posture': 'thinking',
            'status_events': [{'type': 'updating_memory', 'label': 'helyreállítás'}],
            'knowledge_topics': [],
            'personality_drift': {},
        }


# -------------------- MANUS / SHELL ROUTES --------------------
@api_router.post('/manus/process')
async def manus_process(request: Request, body: ManusInput):
    user = User(user_id="admin", email="manus@local", name="Gazda")
    user_text = body.voice_text or body.text or ""
    image_ctx = "image_attached" if body.image_b64 else None

    # log user message
    user_msg = {
        'id': str(uuid.uuid4()),
        'user_id': user.user_id,
        'role': 'user',
        'content': user_text or '[camera snapshot]',
        'has_image': bool(body.image_b64),
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_messages.insert_one(dict(user_msg))
    user_msg.pop('_id', None)

    instr = await call_brain(user.user_id, user_text, image_ctx)

    # log AI message
    ai_msg = {
        'id': str(uuid.uuid4()),
        'user_id': user.user_id,
        'role': 'ai',
        'content': instr.get('speech', ''),
        'mood': instr.get('mood'),
        'status_events': instr.get('status_events', []),
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_messages.insert_one(dict(ai_msg))
    ai_msg.pop('_id', None)

    # update evolution state
    state = await db.evolution_state.find_one({'user_id': user.user_id}, {'_id': 0})
    if state:
        personality = state.get('personality', {})
        drift = instr.get('personality_drift', {}) or {}
        for k, v in drift.items():
            cur = personality.get(k, 0.5)
            personality[k] = max(0.0, min(1.0, cur + float(v)))
        topics = state.get('topics_mastered', [])
        for t in (instr.get('knowledge_topics') or []):
            if t and t not in topics:
                topics.append(t)
        await db.evolution_state.update_one(
            {'user_id': user.user_id},
            {'$set': {
                'personality': personality,
                'topics_mastered': topics[-200:],
                'updated_at': datetime.now(timezone.utc).isoformat(),
            }, '$inc': {'interactions_count': 1}}
        )
        await db.evolution_history.insert_one({
            'user_id': user.user_id,
            'personality': personality,
            'mood': instr.get('mood'),
            'topics': instr.get('knowledge_topics', []),
            'created_at': datetime.now(timezone.utc).isoformat(),
        })

    return {'instruction': instr, 'message_id': ai_msg['id']}


@api_router.post('/manus/webhook')
async def manus_webhook(payload: WebhookPayload):
    """External Manus agent can POST events here to push state into the shell."""
    await db.webhook_events.insert_one({
        'id': str(uuid.uuid4()),
        'event_type': payload.event_type,
        'payload': payload.payload,
        'created_at': datetime.now(timezone.utc).isoformat(),
    })
    return {'ok': True}


@api_router.get('/manus/webhook/recent')
async def webhook_recent(request: Request):
    await get_current_user(request)
    events = await db.webhook_events.find({}, {'_id': 0}).sort('created_at', -1).limit(20).to_list(20)
    return events


@api_router.post('/manus/snapshot')
async def manus_snapshot(request: Request, body: dict):
    user = User(user_id="admin", email="manus@local", name="Gazda")
    img = body.get('image_b64')
    if not img:
        raise HTTPException(status_code=400, detail='image_b64 required')
    snap_id = str(uuid.uuid4())
    await db.snapshots.insert_one({
        'id': snap_id,
        'user_id': user.user_id,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'size_bytes': len(img),
    })
    return {'id': snap_id, 'received': True}


@api_router.get('/chat/messages')
async def chat_messages(request: Request, limit: int = 50):
    user = User(user_id="admin", email="manus@local", name="Gazda")
    msgs = await db.chat_messages.find(
        {'user_id': user.user_id}, {'_id': 0}
    ).sort('created_at', -1).limit(limit).to_list(limit)
    msgs.reverse()
    return msgs


# -------------------- EVOLUTION LEDGER --------------------
@api_router.get('/evolution/state')
async def evolution_state(request: Request):
    user = User(user_id="admin", email="manus@local", name="Gazda")
    state = await db.evolution_state.find_one({'user_id': user.user_id}, {'_id': 0})
    if not state:
        state = {
            'user_id': user.user_id,
            'personality': {},
            'descriptors': [],
            'topics_mastered': [],
            'interactions_count': 0,
        }
        await db.evolution_state.insert_one(dict(state))
        state.pop('_id', None)
    return state


@api_router.get('/evolution/history')
async def evolution_history(request: Request, limit: int = 100):
    user = User(user_id="admin", email="manus@local", name="Gazda")
    rows = await db.evolution_history.find(
        {'user_id': user.user_id}, {'_id': 0}
    ).sort('created_at', 1).limit(limit).to_list(limit)
    return rows


@api_router.get('/evolution/insights')
async def evolution_insights(request: Request):
    user = User(user_id="admin", email="manus@local", name="Gazda")
    state = await db.evolution_state.find_one({'user_id': user.user_id}, {'_id': 0}) or {}
    history = await db.evolution_history.find(
        {'user_id': user.user_id}, {'_id': 0}
    ).sort('created_at', 1).to_list(500)

    insights = []
    p = state.get('personality', {})
    n_traits = len(p)
    interactions = state.get('interactions_count', 0)

    if interactions > 5 and n_traits > 0:
        # pick top-3 strongest traits
        top = sorted(p.items(), key=lambda kv: kv[1], reverse=True)[:3]
        if top:
            top_str = ', '.join([f"{k} ({int(v*100)})" for k, v in top])
            insights.append(f"Erős vonások: {top_str}.")
        # detect rising trait
        if len(history) >= 3:
            first = history[0].get('personality', {})
            last = history[-1].get('personality', {})
            deltas = {k: last.get(k, 0) - first.get(k, 0) for k in last.keys()}
            rising = max(deltas.items(), key=lambda kv: kv[1], default=(None, 0))
            falling = min(deltas.items(), key=lambda kv: kv[1], default=(None, 0))
            if rising[0] and rising[1] > 0.05:
                insights.append(f"Egyre inkább: {rising[0]}.")
            if falling[0] and falling[1] < -0.05:
                insights.append(f"Egyre kevésbé: {falling[0]}.")

    if not insights:
        insights = ['Még a kalibráció elején — beszélgessünk többet.']

    avg_mood = {}
    n = 0
    for h in history:
        m = h.get('mood') or {}
        for k, v in m.items():
            avg_mood[k] = avg_mood.get(k, 0) + float(v)
        n += 1
    if n:
        avg_mood = {k: v / n for k, v in avg_mood.items()}

    return {
        'insights': insights,
        'avg_mood': avg_mood,
        'total_interactions': interactions,
        'topics_count': len(state.get('topics_mastered', [])),
        'trait_count': n_traits,
    }


# -------------------- SANDBOX --------------------
def _user_sandbox(user_id: str) -> Path:
    p = SANDBOX_DIR / user_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def _safe_filename(name: str) -> str:
    name = os.path.basename(name).strip()
    if not name or name in ('.', '..') or '/' in name or '\\' in name:
        raise HTTPException(status_code=400, detail='Invalid filename')
    return name


@api_router.get('/sandbox/files')
async def sandbox_list(request: Request):
    user = User(user_id="admin", email="manus@local", name="Gazda")
    p = _user_sandbox(user.user_id)
    files = []
    for f in p.iterdir():
        if f.is_file():
            files.append({
                'name': f.name,
                'size': f.stat().st_size,
                'modified': datetime.fromtimestamp(f.stat().st_mtime, timezone.utc).isoformat(),
            })
    return {'files': files, 'path': f'/sandbox/{user.user_id}/'}


@api_router.post('/sandbox/upload')
async def sandbox_upload(request: Request, file: UploadFile = File(...)):
    user = User(user_id="admin", email="manus@local", name="Gazda")
    p = _user_sandbox(user.user_id)
    safe = _safe_filename(file.filename or '')
    target = p / safe
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail='File too large (10MB max)')
    target.write_bytes(content)
    return {'ok': True, 'name': safe, 'size': len(content)}


@api_router.delete('/sandbox/files/{name}')
async def sandbox_delete(request: Request, name: str):
    user = User(user_id="admin", email="manus@local", name="Gazda")
    p = _user_sandbox(user.user_id)
    safe = _safe_filename(name)
    target = p / safe
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail='Not found')
    target.unlink()
    return {'ok': True}


@api_router.get('/')
async def root():
    return {'message': 'Manus Shell API', 'status': 'online'}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
