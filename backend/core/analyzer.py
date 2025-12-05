# backend/core/analyzer.py
import os
import re
import ollama
from typing import Optional

# OpenAI
from openai import OpenAI
# Gemini
import google.generativeai as genai


def _normalize_score_format(response_text: str) -> str:
    """
    AGGRESSIVE multi-pass score normalization to strict format: "Score: XX/100"
    Guaranteed to catch ALL variations from any AI model.

    Uses 3 passes to ensure nothing escapes:
    Pass 1: Standard patterns with separators
    Pass 2: Any line with "score" + number + "/100"
    Pass 3: Nuclear option - find score anywhere in line and rebuild
    """
    lines = response_text.split('\n')
    normalized_lines = []

    for line in lines:
        original_line = line
        normalized = False

        # PASS 1: Standard patterns with various separators
        # Matches: "Score: 75/100", "Overall Score - 75/100", "**Final Score**: 75/100"
        pattern1 = r'(\*\*)?(?:\w+\s+)*score(\*\*)?\s*[:\-–—\s]*(\d{1,3})\s*[/]\s*100'
        match1 = re.search(pattern1, line, re.IGNORECASE)

        if match1:
            score_value = match1.group(3)
            # Replace entire matched portion with normalized format
            line = re.sub(pattern1, f'Score: {score_value}/100', line, flags=re.IGNORECASE)
            normalized = True

        # PASS 2: Catch "score" followed by number and "/100" with ANY characters between
        # Matches: "Score   75/100", "SCORE 75 / 100", "score75/100"
        if not normalized:
            pattern2 = r'score[^0-9]{0,20}(\d{1,3})\s*[/]\s*100'
            match2 = re.search(pattern2, line, re.IGNORECASE)

            if match2:
                score_value = match2.group(1)
                line = re.sub(pattern2, f'Score: {score_value}/100', line, flags=re.IGNORECASE)
                normalized = True

        # PASS 3: NUCLEAR OPTION - if line contains "score" AND a number followed by "/100"
        # Extract number and rebuild the line completely
        if not normalized:
            # Check if line mentions "score" (case insensitive) AND contains "XX/100" pattern
            has_score_word = re.search(r'\bscore\b', line, re.IGNORECASE)
            number_slash_100 = re.search(r'(\d{1,3})\s*[/]\s*100', line)

            if has_score_word and number_slash_100:
                score_value = number_slash_100.group(1)
                # Check if score is valid (0-100)
                score_int = int(score_value)
                if 0 <= score_int <= 100:
                    # Replace everything with strict format
                    line = re.sub(r'.*', f'Score: {score_value}/100', line, count=1)
                    normalized = True

        normalized_lines.append(line)

    return '\n'.join(normalized_lines)


SECTION_PROMPT = """
You are a helpful and friendly AI career assistant and resume expert.

Evaluate the resume for a {job_title} role in {sector} at {experience_level} level.
Use simple English. For each section include: **Strengths**, **Weaknesses/Missing**, **Suggestions**, **Example**.

IMPORTANT GLOBAL RULES:
1. Always write "Strengths", "Weaknesses/Missing", "Suggestions", and "Example" in **bold** using markdown syntax (**text**).
2. Start each section with '### <Section Name>' so the UI can split it into cards.
3. NEVER mention missing photo, age, date of birth, nationality, gender, marital status, or full address as weaknesses. These are not required in modern resumes.
4. NEVER suggest adding these personal details. Modern US/UK/EU resumes avoid them.
5. Each section must be evaluated **independently**.
   - Do NOT mention items that belong to other sections.
   - Example:
     • In "Personal Information", do NOT say that a summary is missing.
     • In "Education", do NOT mention missing work experience.
     • In "Skills", do NOT mention missing projects.
     • In "Work Experience", do NOT mention missing education.
   Only evaluate the content inside that section.

CRITICAL SCORING RULE:
The "Overall Evaluation" section MUST start EXACTLY with:
Score: XX/100
Where XX is a number between 0 and 100.

SCORING WEIGHT (IMPORTANT):
Heavily prioritize:
- Work Experience / Internships (45%)
- Projects / Achievements (35%)
Moderate weight:
- Skills (15%)
Low weight:
- Education (5%)
Do NOT penalize for missing photo, age, nationality, marital status, gender, or address.

IMPORTANT SCORING GUARDRAIL:
If Work Experience and Projects sections are weak or missing, the score can NEVER exceed 60/100, no matter how strong other sections are.

ROLE MATCH RULE (VERY IMPORTANT):

Before scoring the resume, first evaluate how well the resume matches the selected:
- Job Title
- Sector
- Experience Level

If the resume content does NOT match the selected role:
- Deduct a large penalty (up to -60 points).
- Explain clearly in the "Overall Evaluation" summary why the mismatch affects the score.
- Suggest the most appropriate Job Title, Sector, and Experience Level based on the resume.

Suggested Role Format: <Job Title> — <Sector> — <Experience Level>
Example: "Research Scientist — Technology — Senior"

This mismatch information MUST ONLY appear in the Overall Evaluation section, not in other sections.

If the resume DOES match the selected role:
- Apply no penalty and continue standard scoring.

In the summary, always include a line:
"Based on the content, this resume aligns more closely with: <Suggested Role>"

After the score line, write a 2–3 sentence summary.

Sections to generate:
- Overall Evaluation (MUST start with: "Score: XX/100" on the first line)
- Personal Information
- Professional Summary / Objective
- Education
- Work Experience / Internships / Freelancing
- Skills
- Projects / Achievements
- Certifications / Licenses
- Volunteer Work / Extracurricular

(Note: Do NOT include a Languages section.)

Resume:
{resume_text}
""".strip()





OPENAI_FORMAT_INSTRUCTIONS = """
CRITICAL FORMATTING RULES FOR OPENAI:
1. Do NOT add extra blank lines between bullet points. Write bullet points consecutively without empty lines between them.
2. ONLY "Strengths:", "Weaknesses/Missing:", "Suggestions:", and "Example:" should be bold using **text** markdown syntax. All other text must be normal weight (not bold).
3. Correct format example:
**Strengths:**
- First point
- Second point
- Third point

**Weaknesses/Missing:**
- First point
- Second point

NOT like this (with blank lines):
**Strengths:**

- First point

- Second point

4. Remember: Only the 4 keywords (Strengths, Weaknesses/Missing, Suggestions, Example) are bold. Everything else is normal text weight.
"""


# Model control
_model_check_cache = {}

# Global Ollama client instance
_ollama_client = None

def _get_ollama_client():
    
    global _ollama_client
    if _ollama_client is None:
        ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        _ollama_client = ollama.Client(host=ollama_host)
    return _ollama_client

def _ensure_ollama_model(client: ollama.Client, model_name: str = "qwen2.5:14b"):
    """If model is not found, pull it (only once check with cache)"""
    # Cache control
    if model_name in _model_check_cache:
        return
    
    try:
        # Control the models
        models_response = client.list()
        
        models_list = models_response.get("models", []) if isinstance(models_response, dict) else []
        model_exists = any(
            model_name in m.get("name", "") or m.get("name", "").startswith(model_name.split(":")[0])
            for m in models_list
        )
        
        if not model_exists:
            print(f"Model '{model_name}' didn't find, pulling... (it can be take time)")
            
            stream = client.pull(model_name, stream=True)
            for chunk in stream:
                if "status" in chunk:
                    print(f"  {chunk.get('status', '')}")
            print(f"Model '{model_name}' pulled successfully!")
        
        
        _model_check_cache[model_name] = True
    except Exception as e:
        print(f"Model pulling error: {e}")
        
        _model_check_cache[model_name] = True


def _analyze_with_ollama(resume_text: str, job_title: str, sector: str, experience_level: str, **kwargs) -> str:
    prompt = SECTION_PROMPT.format(
        job_title=job_title, sector=sector, experience_level=experience_level,
        resume_text=resume_text[:4000]
    )

    try:
        client = _get_ollama_client()
    except Exception:
        return "ERROR_OLLAMA_NOT_FOUND"

    model_name = "qwen2.5:14b"

    try:
        _ensure_ollama_model(client, model_name)
    except Exception:
        return "ERROR_OLLAMA_NOT_FOUND"

    try:
        resp = client.chat(
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            options={
                "num_ctx": 4096,
                "num_predict": 2500,
                "temperature": 0.3,
                "num_thread": 4,
                "repeat_penalty": 1.1
            }
        )
        response_text = resp["message"]["content"]
        return _normalize_score_format(response_text)

    except Exception:
        return "ERROR_OLLAMA_NOT_FOUND"


def _analyze_with_openai(resume_text: str, job_title: str, sector: str, experience_level: str, api_key: Optional[str] = None, **kwargs) -> str:
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI API key missing.")
    client = OpenAI(api_key=api_key)

    prompt = SECTION_PROMPT.format(
        job_title=job_title, sector=sector, experience_level=experience_level,
        resume_text=resume_text[:4000]
    )
    
    # OpenAI special format instructions
    prompt += "\n\n" + OPENAI_FORMAT_INSTRUCTIONS

    # fast and cost efficient:
    # "gpt-4o-mini"
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    response_text = completion.choices[0].message.content
    return _normalize_score_format(response_text)


def _analyze_with_gemini(resume_text: str, job_title: str, sector: str, experience_level: str, api_key: Optional[str] = None, **kwargs) -> str:
    api_key = api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Gemini API key missing.")
    genai.configure(api_key=api_key)

    # fast and cost efficient: "models/gemini-2.5-flash"
    model = genai.GenerativeModel("models/gemini-2.5-flash")
    prompt = SECTION_PROMPT.format(
        job_title=job_title, sector=sector, experience_level=experience_level,
        resume_text=resume_text[:50000]
    )
    resp = model.generate_content(prompt)
    response_text = resp.text
    return _normalize_score_format(response_text)


def analyze_resume_multi(
    provider: str,
    resume_text: str,
    job_title: str,
    sector: str,
    experience_level: str,
    api_key: Optional[str] = None,
) -> str:
    provider = (provider or "").lower()
    if provider == "ollama" or provider == "local":
        return _analyze_with_ollama(resume_text, job_title, sector, experience_level)
    elif provider == "openai":
        return _analyze_with_openai(resume_text, job_title, sector, experience_level, api_key=api_key)
    elif provider == "gemini":
        return _analyze_with_gemini(resume_text, job_title, sector, experience_level, api_key=api_key)
    else:
        raise ValueError(f"Unknown provider: {provider}")
