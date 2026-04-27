from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

genai.configure(api_key=os.environ.get("GEMINI_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

@app.post("/api/chat")
async def chat(request: Request):
    data = await request.json()
    user_msg = data.get("text", "Szia")
    
    # Gemini hívás
    response = model.generate_content(f"Te vagy MANUS, egy AI. Válaszolj röviden: {user_msg}")
    
    # Ez az a formátum, amitől a gömb mozogni fog és beszélni fog
    return {
        "speech": response.text,
        "mood": {"joy": 0.8, "calm": 0.5, "energy": 0.7},
        "status_events": [{"type": "thinking", "label": "MANUS válaszol..."}]
    }

@app.get("/api/health")
def health():
    return {"status": "ok"}
