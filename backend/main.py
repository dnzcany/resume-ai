# backend/main.py
from fastapi import FastAPI, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
import os
import uuid
from pathlib import Path
from core.parser import extract_text
from core.analyzer import analyze_resume_multi

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  
)

@app.get("/ping")
def ping():
    return {"message": "pong"}

@app.post("/analyze")
async def analyze_resume_endpoint(
    job_title: str = Form(...),
    sector: str = Form(...),
    experience_level: str = Form(...),
    provider: str = Form(...),                   #
    api_key: str | None = Form(default=None),    # for openAI/Gemini
    file: UploadFile = File(...),
):
    # SECURITY FIX: Use UUID to prevent path traversal attacks
    original_extension = os.path.splitext(file.filename)[1]
    secure_filename = f"temp_{uuid.uuid4()}{original_extension}"
    temp_path = Path("temp_uploads") / secure_filename

    # Create temp directory if it doesn't exist
    temp_path.parent.mkdir(exist_ok=True)

    # Verify the resolved path is within our temp directory (defense in depth)
    temp_dir = Path("temp_uploads").resolve()
    if not temp_path.resolve().is_relative_to(temp_dir):
        return {"status": "error", "message": "Invalid file path"}

    # Write uploaded file securely
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    text = extract_text(str(temp_path))
    os.remove(temp_path)

    try:
        analysis = analyze_resume_multi(
            provider=provider,
            resume_text=text,
            job_title=job_title,
            sector=sector,
            experience_level=experience_level,
            api_key=api_key,  # local None, OpenAI/Gemini full
        )
        return {"status": "ok", "provider": provider, "analysis": analysis}
    except Exception as e:
        return {"status": "error", "provider": provider, "message": str(e)}

@app.get("/api/check-ollama")
def check_ollama():
    """
    Check if Ollama is installed and running.
    This endpoint is the single source of truth for Ollama detection.
    Works reliably in dev mode, EXE, and all environments.
    """
    import requests
    try:
        # Try to connect to Ollama's API
        r = requests.get("http://127.0.0.1:11434/api/tags")
        if r.status_code == 200:
            return {"installed": True}
        return {"installed": False}
    except:
        return {"installed": False}


@app.post("/ai/test")
def ai_test(provider: str = Form(...), api_key: str | None = Form(default=None)):
    try:
        if provider == "openai":
            from openai import OpenAI
            OpenAI(api_key=api_key).models.list()
        elif provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            genai.list_models()
        elif provider == "ollama":
            import ollama
            ollama.list()
        else:
            return {"ok": False, "message": "Unknown provider"}
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "message": str(e)}
    


print("Loaded endpoints:", [route.path for route in app.routes])
