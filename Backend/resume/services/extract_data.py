# extract_data.py
import fitz
from docx import Document
import re
from typing import Dict, List, Tuple
import os
import json
import io
import traceback
 
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SKILLS_JSON_PATH = os.path.join(BASE_DIR, "skills_dictionary.json")
 
# -----------------------------------------------------------
# Load skills dictionary
# -----------------------------------------------------------
try:
    with open(SKILLS_JSON_PATH, "r", encoding="utf-8") as f:
        RAW_SKILLS = json.load(f)
 
    def _normalize_skill_key(s: str) -> str:
        t = s.lower().strip()
        t = t.replace("_", " ").replace("/", " ").replace("\\", " ")
        return " ".join(t.split())
 
    SKILL_CANONICAL = {}
    for raw in RAW_SKILLS:
        norm = _normalize_skill_key(raw)
        if norm and norm not in SKILL_CANONICAL:
            SKILL_CANONICAL[norm] = raw
 
    SKILL_SET = set(SKILL_CANONICAL.keys())
    SORTED_SKILLS = sorted(SKILL_SET, key=lambda x: -len(x))
 
except Exception as e:
    print("❌ Could not load skills dictionary:", e)
    SKILL_CANONICAL = {}
    SKILL_SET = set()
    SORTED_SKILLS = []
 
# -----------------------------------------------------------
# Import SkillNER — FINAL FIX
# -----------------------------------------------------------
try:
    from resume.services.skillner_service import extract_skills as real_extract_skills
    print("✔ SkillNER imported successfully")
except Exception as e:
    print("❌ SkillNER import FAILED:", e)
    real_extract_skills = None
 
 
# -----------------------------
# RESUME TEXT EXTRACTION
# -----------------------------
def extract_file_content(file_obj) -> str:
    try:
        file_obj.seek(0)
    except:
        pass
 
    try:
        content = file_obj.read()
    except:
        content = file_obj
 
    filename = getattr(file_obj, "name", "")
    ext = filename.lower().split(".")[-1] if "." in filename else ""
 
    if ext == "pdf" or content[:4] == b"%PDF":
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            pages = [page.get_text() for page in doc]
            return "\n".join(pages)
        except:
            return ""
 
    if ext == "docx":
        try:
            doc = Document(io.BytesIO(content))
            return "\n".join([p.text for p in doc.paragraphs])
        except:
            return ""
 
    try:
        return content.decode("utf-8", errors="ignore")
    except:
        return ""
 
 
# -----------------------------
# CPD level
# -----------------------------
def calculate_cpd_level(years):
    try:
        y = int(years)
    except:
        return 1
 
    if y <= 1: return 1
    if y <= 3: return 2
    if y <= 5: return 3
    if y <= 8: return 4
    if y <= 12: return 5
    return 6
 
 
EMAIL_PATTERN = re.compile(r"[\w\.-]+@[\w\.-]+")
PHONE_PATTERN = re.compile(r"\+?\d[\d\s\-]{7,14}")
 
 
# -----------------------------------------------------------
# MASTER FIELD EXTRACTION
# -----------------------------------------------------------
def extract_fields(file_obj) -> Dict:
    text = extract_file_content(file_obj) or ""
 
    # NAME
    candidate_name = "Unknown"
    name_match = re.search(r"^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+)", text, re.MULTILINE)
    if name_match:
        candidate_name = name_match.group(1)
 
    # EMAIL
    email_match = EMAIL_PATTERN.search(text)
    email = email_match.group(0).lower() if email_match else ""
 
    # EXPERIENCE
    experience_years = 0
    exp = re.search(r"(\d+)\s*years?", text, re.IGNORECASE)
    if exp:
        try: experience_years = int(exp.group(1))
        except: pass
 
    # CPD
    cpd_level = calculate_cpd_level(experience_years)
 
    # SKILLS — ONLY SkillNER
    if real_extract_skills:
        skills = real_extract_skills(text)
    else:
        skills = []
 
    return {
        "candidate_name": candidate_name,
        "email": email,
        "experience_years": experience_years,
        "cpd_level": cpd_level,
        "skills": skills,  # <- CLEAN SKILLNER ONLY
        "resume_text": text
    }
 
 