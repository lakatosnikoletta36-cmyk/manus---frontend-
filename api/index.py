from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Gemini konfigurálás hibakezeléssel
api_key = os.environ.get("GEMINI_KEY")
if api_key:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
else:
    model = None

@app.post("/api/chat")
async def chat(request: Request):
    if not model:
        return {"speech": "Hiba: Hiányzik a Gemini API kulcs!", "mood": {"joy": 0}}
    
    data = await request.json()
    user_text = data.get("text", "Szia")
    
    try:
        response = model.generate_content(f"Te vagy MANUS, az AI. Válaszolj röviden: {user_text}")
        return {
            "speech": response.text,
            "mood": {"joy": 0.8, "calm": 0.5},
            "status_events": [{"type": "thinking", "label": "MANUS válaszol..."}]
        }
    except Exception as e:
        return {"speech": f"Szerver hiba: {str(e)}", "mood": {"joy": 0}}

@app.get("/api/health")
def health():
    return {"status": "ok", "api_key_set": api_key is not None}
