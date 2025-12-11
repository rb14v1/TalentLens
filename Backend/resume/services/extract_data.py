# extract_data.py  (FINAL STRICT VERSION)
 
import fitz
from docx import Document
import re
from typing import Dict, List
import os
import logging
 
from .llama3_service import invoke_llama3_model
 
logger = logging.getLogger(__name__)
 
# ======================================================================
#                           FILE EXTRACTOR
# ======================================================================
 
def extract_file_content(file_obj) -> str:
    file_type = (file_obj.name or "").split(".")[-1].lower()
 
    try:
        file_obj.seek(0)
    except:
        pass
 
    # ---- PDF ----
    if file_type == "pdf":
        try:
            doc = fitz.open(stream=file_obj.read(), filetype="pdf")
            full_text = ""
            for page in doc:
                txt = page.get_text("text")
                if txt:
                    full_text += txt + "\n"
            return full_text.strip()
        except:
            return ""
 
    # ---- DOCX ----
    elif file_type == "docx":
        try:
            file_obj.seek(0)
            doc = Document(file_obj)
            return "\n".join(p.text for p in doc.paragraphs)
        except:
            return ""
 
    # ---- TXT ----
    else:
        try:
            file_obj.seek(0)
            raw = file_obj.read()
            if isinstance(raw, bytes):
                return raw.decode("utf-8", errors="ignore")
            return str(raw)
        except:
            return ""
 
# ======================================================================
#                           SKILL CLEANING
# ======================================================================
 
STOPWORDS = {
    "and","or","the","a","an","services","courses","certificate","certified",
    "certification","science","team","teams","modern","cd","resume","contact",
    "email","phone","linkedin","address","date","dob","unknown","name",
    "candidate","manager","junior","senior","lead","maintenance","platform",
    "responsibilities", "requirements", "outcomes", "behaviors", "duties",
    "expected", "experience", "knowledge", "skills", "ability", "proficient",
    "strong", "good", "excellent", "familiarity", "understanding", "plus",
    "nice", "have", "must", "work", "with", "years", "degree", "bachelor",
    "master", "description", "summary", "profile", "objective"
}
 
SHORT_ALLOW = {"c#", "c++", "go", "r", "js", "sql", "aws"}
 
def normalize_token(tok: str) -> str:
    tok = tok.strip()
    tok = re.sub(r"[^\w\+\#\.\- ]", "", tok)
    tok = " ".join(tok.split())
    return tok
 
def is_sentence_like(s: str) -> bool:
    if len(s.split()) > 3:
        return True
    if re.search(r"\d{4}", s):
        return True
    if "(" in s or ")" in s:
        return True
    if re.search(r"[A-Z][a-z]+\s[A-Z][a-z]+", s):
        return True
    if re.search(r"[.!?]", s):
        return True
    return False
 
def looks_like_tech(tok: str) -> bool:
    if not tok:
        return False
 
    low = tok.lower()
 
    if low in STOPWORDS:
        return False
 
    if len(tok.split()) > 3:
        return False
 
    if low in SHORT_ALLOW:
        return True
 
    if re.search(r"[\.#\+\/]", tok):
        return True
 
    if tok[0].isupper():
        return True
 
    if re.search(r"[a-z]", low) and not low.isalpha():
        return True
 
    if len(tok.split()) <= 2:
        return True
 
    return False
 
def clean_skills(raw_skills: List[str]) -> List[str]:
    cleaned = []
    seen = set()
 
    for s in raw_skills:
        if not s or not isinstance(s, str):
            continue
 
        s = normalize_token(s)
        parts = [p.strip() for p in re.split(r"[;,]| and ", s) if p.strip()]
 
        for part in parts:
            part = re.sub(r"^[\-\•\d\.\)\s]+", "", part)
 
            if part and looks_like_tech(part):
                key = part.lower()
                if key not in seen:
                    cleaned.append(part)
                    seen.add(key)
 
    return cleaned
 
# ======================================================================
#                ADVANCED DEPENDENCY GRAPH (BIDIRECTIONAL)
# ======================================================================
 
ADVANCED_SKILL_GRAPH = {
    "python":{"django":3,"flask":3,"fastapi":3,"numpy":3,"pandas":3,"pytorch":3,"tensorflow":3},
    "django":{"python":3,"rest":2,"web":1},
    "flask":{"python":3},
    "fastapi":{"python":3},
    "numpy":{"python":3},
    "pandas":{"python":3},
 
    "javascript":{"react":3,"angular":3,"node.js":3,"typescript":3},
    "react":{"javascript":3},
    "angular":{"javascript":3},
    "node.js":{"javascript":3},
    "typescript":{"javascript":3},
 
    "java":{"spring":3,"spring boot":3},
    "spring":{"java":3},
    "spring boot":{"java":3},
 
    "sql":{"mysql":3,"postgresql":3},
    "mysql":{"sql":3},
    "postgresql":{"sql":3},
 
    "aws":{"cloud":3,"ec2":2,"s3":2,"lambda":2},
    "azure":{"cloud":3},
    "gcp":{"cloud":3},
    "cloud":{"aws":3,"azure":3,"gcp":3},
 
    "docker":{"linux":2,"devops":2},
    "kubernetes":{"linux":2,"devops":2},
    "linux":{"docker":2,"kubernetes":2,"bash":2,"shell":2,"ssh":1},
}
 
def build_bidirectional(graph):
    g = {}
    for a, rels in graph.items():
        g.setdefault(a, {})
        for b, w in rels.items():
            g[a][b] = w
            g.setdefault(b, {})
            g[b][a] = w
    return g
 
FULL_SKILL_GRAPH = build_bidirectional(ADVANCED_SKILL_GRAPH)
 
def expand_skill(skill: str, depth=2):
    skill = skill.lower()
    visited = set([skill])
    queue = [(skill, 0)]
 
    while queue:
        current, d = queue.pop(0)
        if d >= depth:
            continue
 
        if current in FULL_SKILL_GRAPH:
            for nxt in FULL_SKILL_GRAPH[current].keys():
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append((nxt, d + 1))
 
    return list(visited)
 
# ======================================================================
#                STRICT SKILL EXTRACTION USING LLAMA 3
# ======================================================================
 
def extract_skills_with_llama3(text: str) -> List[str]:
    try:
        prompt = f"""
You are an AI that extracts ALL technical skills from resumes.
 
EXTRACTION RULES (VERY STRICT):
- Output MUST be ONLY a comma-separated list.
- Include ALL programming languages, frameworks, libraries, tools, cloud platforms, DevOps tools, CI/CD tools, databases.
- Include multi-word tech (max 3 words).
- DO NOT include soft skills.
- DO NOT include titles.
- DO NOT include versions.
- Extract each skill ONLY once (no duplicates).
 
Resume:
{text[:4000]}
 
Return ONLY the comma-separated skills list.
"""
 
        resp = invoke_llama3_model(prompt)
        if not resp:
            return []
 
        raw = [x.strip() for x in re.split(r",|;|\n", resp) if x.strip()]
        return [s for s in raw if looks_like_tech(s)]
 
    except:
        return []
 
# ======================================================================
#                EXPERIENCE → CPD LEVEL
# ======================================================================
 
def calculate_cpd_level(years: int) -> int:
    if years <= 1: return 1
    if years <= 3: return 2
    if years <= 5: return 3
    if years <= 8: return 4
    if years <= 12: return 5
    return 6
 
# ======================================================================
#                MAIN EXTRACTION FUNCTION
# ======================================================================
 
# 🔥 UPDATED NAME VALIDATOR
BAD_NAME_HINTS = {"output", "result", "generated", "assistant", "model"}
 
def is_valid_name(name):
    parts = name.split()
    if not (1 <= len(parts) <= 2):
        return False
    if any(p.lower() in BAD_NAME_HINTS for p in parts):
        return False
    return True
 
def extract_fields(file_obj) -> Dict:
    text = extract_file_content(file_obj)
    raw_filename = os.path.basename(file_obj.name or "")
 
    # ---------------- NAME ----------------
    candidate_name = "Unknown"
 
    email_match = re.search(r"[\w\.-]+@[\w\.-]+", text)
    email_local = email_match.group(0).split("@")[0] if email_match else ""
 
    try:
        name_prompt = f"""
Extract ONLY the candidate's real name (1–2 words). No titles.
 
{text[:1200]}
"""
 
        raw = invoke_llama3_model(name_prompt) or ""
        raw = re.sub(r"[^A-Za-z\s]", "", raw).strip()
 
        # NEW VALIDATION
        if is_valid_name(raw):
            candidate_name = raw
 
    except:
        pass
 
    # Fallback to email username
    if candidate_name == "Unknown" and email_local:
        parts = re.split(r"[._\-]", email_local)
        parts = [p.capitalize() for p in parts if p.isalpha()]
        if parts:
            candidate_name = " ".join(parts[:2])
 
    # ---------------- EMAIL ----------------
    email = email_match.group(0).lower() if email_match else ""
 
    # ---------------- EXPERIENCE ----------------
    exp = 0
    m = re.search(r"(\d{1,2})\s*(years|year|yrs?)", text, re.I)
    if m:
        try:
            exp = int(m.group(1))
        except:
            pass
 
    # ---------------- SKILLS ----------------
    raw = extract_skills_with_llama3(text)
    cleaned = clean_skills(raw)
 
    expanded = cleaned[:]  
 
    normalized = sorted({x.lower() for x in expanded})
 
    return {
        "candidate_name": candidate_name,
        "email": email,
        "experience_years": exp,
        "cpd_level": calculate_cpd_level(exp),
        "skills": normalized,
        "display_skills": sorted(expanded),
        "resume_text": text,
        "file_name": raw_filename,
        "readable_file_name": raw_filename
    }
 
 