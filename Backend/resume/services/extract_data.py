# extract_data.py  (FINAL COMPLETE VERSION — with advanced dependency mapping)
 
import fitz
from docx import Document
import re
from typing import Dict, List
import os
import numpy as np
from sklearn.neighbors import NearestNeighbors
import logging
import json
import boto3
 
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
 
    if file_type == "pdf":
        try:
            doc = fitz.open(stream=file_obj.read(), filetype="pdf")
            full_text = ""
            for page in doc:
                txt = page.get_text("text")
                if txt and txt.strip():
                    full_text += txt + "\n"
            return full_text.strip()
        except Exception:
            return ""
 
    elif file_type == "docx":
        try:
            file_obj.seek(0)
            doc = Document(file_obj)
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception:
            return ""
 
    else:
        try:
            file_obj.seek(0)
            raw = file_obj.read()
            if isinstance(raw, bytes):
                return raw.decode("utf-8", errors="ignore")
            return str(raw)
        except Exception:
            return ""
 
 
# ======================================================================
#                           SKILL CLEANING
# ======================================================================
 
STOPWORDS = {
    "and","or","the","a","an","services","courses","certificate","certified",
    "certification","science","team","teams","modern","cd","resume","contact",
    "email","phone","linkedin","address","date","dob","unknown","name",
    "candidate","manager","junior","senior","lead"
}
 
SHORT_ALLOW = {"c#", "c++", "go", "r", "js", "sql", "bash", "html", "css", "ui", "ux", "aws"}
 
TECH_HINTS = {
    "javascript","java","python","react","angular","node","node.js","nodejs",
    "redis","postgresql","mysql","mongodb","css","html","rest","json","graphql",
    "docker","kubernetes","aws","azure","gcp","git","linux","typescript","c++",
    "c#","go","flutter","dart","django","spring","express"
}
 
def normalize_token(tok: str) -> str:
    tok = tok.strip()
    tok = re.sub(r"^[\"'`]+|[\"'`]+$", "", tok)
    tok = " ".join(tok.split())
    return tok
 
def looks_like_tech(tok: str) -> bool:
    if not tok:
        return False
    low = tok.lower()
    if low in STOPWORDS: return False
    if low in SHORT_ALLOW: return True
    if any(h in low for h in TECH_HINTS): return True
    if re.search(r"[\.#\+\/]", tok): return True
    if re.search(r"\d", tok): return True
    return False
 
def clean_skills(raw_skills: List[str]) -> List[str]:
    cleaned = []
    seen = set()
 
    for s in raw_skills:
        if not s or not isinstance(s, str):
            continue
 
        s = normalize_token(s)
        parts = [p.strip() for p in re.split(r"[;,/]| and | & ", s) if p.strip()]
 
        for part in parts:
            part = re.sub(r"^[\-\•\d\.\)\s]+", "", part.strip())
            if part and looks_like_tech(part):
                key = part.lower()
                if key not in seen:
                    cleaned.append(part)
                    seen.add(key)
 
    return cleaned
 
 
# ======================================================================
#                ADVANCED DEPENDENCY SKILL GRAPH
# ======================================================================
 
ADVANCED_SKILL_GRAPH = {
    # ENGINEERING / IT
    "python": {"django":3,"flask":3,"fastapi":3,"numpy":3,"pandas":3,"pytorch":3,"tensorflow":3,"backend":2},
    "django": {"python":3,"backend":2,"rest":2,"web":1},
    "flask": {"python":3,"backend":2},
    "fastapi": {"python":3,"backend":2},
    "numpy": {"python":3},
    "pandas": {"python":3},
 
    "javascript": {"react":3,"angular":3,"node.js":3,"typescript":3,"frontend":2},
    "react": {"javascript":3,"frontend":2},
    "angular": {"javascript":3},
    "node.js": {"javascript":3,"backend":2},
    "typescript": {"javascript":3},
 
    "java": {"spring":3,"spring boot":3,"backend":2},
    "spring": {"java":3},
    "spring boot": {"java":3},
 
    "sql": {"mysql":3,"postgresql":3,"database":3},
    "mysql": {"sql":3,"database":3},
    "postgresql": {"sql":3,"database":3},
    "database": {"sql":3},
 
    "linux": {
        "ubuntu":3,"redhat":3,"bash":3,"shell":3,"docker":2,"kubernetes":2,
        "ssh":2,"devops":2,"sysadmin":2
    },
    "docker": {"linux":2,"devops":3},
    "kubernetes": {"linux":2,"devops":3},
 
    "aws": {"cloud":3,"lambda":2,"ec2":2,"s3":2,"devops":2},
    "azure": {"cloud":3},
    "gcp": {"cloud":3},
    "cloud": {"aws":3,"azure":3,"gcp":3},
 
    # HR
    "hr": {"recruitment":3,"onboarding":2,"payroll":2},
    "recruitment": {"sourcing":3,"interviewing":3,"hiring":3},
 
    # SALES / MARKETING
    "sales": {"crm":3,"lead generation":3,"cold calling":2},
    "crm": {"salesforce":3,"hubspot":3},
    "marketing": {"seo":3,"campaigns":2},
 
    # FINANCE
    "finance":{"budgeting":3,"forecasting":3,"audit":2},
    "accounting":{"tally":3,"bookkeeping":3,"audit":2},
}
 
def build_bidirectional_graph(graph):
    final = {}
    for skill, edges in graph.items():
        s = skill.lower()
        final.setdefault(s, {})
        for related, weight in edges.items():
            r = related.lower()
            final[s][r] = weight
            final.setdefault(r, {})
            final[r][s] = weight
    return final
 
FULL_SKILL_GRAPH = build_bidirectional_graph(ADVANCED_SKILL_GRAPH)
 
 
def expand_skill(skill: str, max_depth=2) -> List[str]:
    """Return recursive related skill expansion."""
    skill = skill.lower()
    visited = set([skill])
    queue = [(skill, 0)]
 
    while queue:
        current, depth = queue.pop(0)
        if depth >= max_depth:
            continue
 
        if current in FULL_SKILL_GRAPH:
            for nxt in FULL_SKILL_GRAPH[current].keys():
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append((nxt, depth + 1))
 
    return list(visited)
 
 
# ======================================================================
#                STRICT SKILL EXTRACTION (LLaMA3)
# ======================================================================
 
def extract_skills_with_llama3(text: str) -> List[str]:
    try:
        prompt = f"""
Extract ONLY technical skills from this resume.
 
STRICT RULES:
- comma-separated ONLY
- no sentences
- no soft skills
- max 3 words per skill
 
Resume:
{text[:4000]}
"""
        resp = invoke_llama3_model(prompt)
        if not resp:
            return []
 
        raw_items = [x.strip() for x in re.split(r",|;|\n", resp) if x.strip()]
        return [s for s in raw_items if looks_like_tech(s)][:80]
 
    except Exception:
        return []
 
 
# ======================================================================
#                  EXPERIENCE → CPD LEVEL
# ======================================================================
 
def calculate_cpd_level(years: int) -> int:
    if years <= 1: return 1
    if years <= 3: return 2
    if years <= 5: return 3
    if years <= 8: return 4
    if years <= 12: return 5
    return 6
 
 
# ======================================================================
#                      MAIN EXTRACTION FUNCTION
# ======================================================================
 
def extract_fields(file_obj, build_index_flag=True) -> Dict:
    text = extract_file_content(file_obj) or ""
 
    raw_filename = os.path.basename(file_obj.name or "")
    file_name = raw_filename
    readable_file_name = raw_filename
 
    # NAME
    candidate_name = "Unknown"
    email_match_first = re.search(r"[\w\.-]+@[\w\.-]+", text)
    email_local_part = ""
    if email_match_first:
        email_local_part = email_match_first.group(0).split("@")[0]
 
    try:
        name_prompt = f"""
Extract ONLY the candidate name (1–2 words max). No titles.
 
{text[:1500]}
"""
        raw = invoke_llama3_model(name_prompt) or ""
        cleaned = re.sub(r"[^A-Za-z\s]", "", raw).strip()
        cleaned = re.sub(r"\s+", " ", cleaned)
        parts = cleaned.split()
 
        if 1 <= len(parts) <= 2:
            candidate_name = cleaned
 
    except:
        pass
 
    if candidate_name == "Unknown" and email_local_part:
        parts = re.split(r"[._\-]", email_local_part)
        parts = [p.capitalize() for p in parts if p.isalpha()]
        if parts:
            candidate_name = " ".join(parts[:2])
 
    # EMAIL
    email = ""
    m2 = re.search(r"[\w\.-]+@[\w\.-]+", text)
    if m2:
        email = m2.group(0).lower()
 
    # EXPERIENCE
    exp = 0
    m3 = re.search(r"(\d{1,2})\s*(years|year|yrs?)", text, re.I)
    if m3:
        try:
            exp = int(m3.group(1))
        except:
            pass
 
    cpd_level = calculate_cpd_level(exp)
 
    # SKILLS
    raw_skills = extract_skills_with_llama3(text)
    cleaned = clean_skills(raw_skills)
 
    expanded = set(cleaned)
    for sk in cleaned:
        expanded.update(expand_skill(sk))
 
    normalized = sorted({x.lower() for x in expanded})
 
    return {
        "candidate_name": candidate_name,
        "email": email,
        "experience_years": exp,
        "cpd_level": cpd_level,
        "skills": normalized,
        "display_skills": list(expanded),
        "resume_text": text,
        "file_name": file_name,
        "readable_file_name": readable_file_name
    }
 
 