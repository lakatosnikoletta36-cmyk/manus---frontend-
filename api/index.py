from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

genai.configure(api_key=os.environ.get("GEMINI_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

@app.post("/api/chat")
@app.post("/api/chat/send")
async def chat(request: Request):
    try:
        data = await request.json()
        user_msg = data.get("text", "Szia")
        res = model.generate_content(f"Te vagy MANUS. Válaszolj röviden: {user_msg}")
        return {
            "speech": res.text,
            "mood": {"joy": 0.5, "calm": 0.8},
            "status_events": [{"type": "thinking", "label": "MANUS válaszol..."}]
        }
    except Exception as e:
        return {"speech": "Hiba történt az agyamban.", "error": str(e)}

@app.get("/api/health")
def health():
    return {"status": "online"}
