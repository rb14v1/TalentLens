import fitz
from docx import Document
import re
from typing import Dict, List
import google.generativeai as genai
import os
 
# -----------------------------
# Gemini setup
# -----------------------------
API_KEY = (
    os.getenv("GENAI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or os.getenv("GEMINI_KEY")
)
 
if API_KEY:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel("models/gemini-2.5-flash")
else:
    model = None
 
 
# -----------------------------------------------------------
# Stronger text extraction with fallback
# -----------------------------------------------------------
def extract_file_content(file_obj) -> str:
    file_type = file_obj.name.split(".")[-1].lower()
    file_obj.seek(0)
 
    # ---------- PDF Extraction ----------
    if file_type == "pdf":
        try:
            doc = fitz.open(stream=file_obj.read(), filetype="pdf")
            full_text = ""
 
            for page in doc:
                # Strongest text extraction available
                text = page.get_text("text")
                if text.strip():
                    full_text += text + "\n"
 
            if full_text.strip():
                return full_text
 
        except Exception as e:
            print("⚠️ PDF extract failed:", e)
 
        # ---------- Optional OCR fallback ----------
        try:
            import pytesseract
            from PIL import Image
 
            doc = fitz.open(stream=file_obj.read(), filetype="pdf")
            ocr_text = ""
 
            for page in doc:
                pix = page.get_pixmap()
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                ocr_text += pytesseract.image_to_string(img)
 
            return ocr_text
 
        except Exception as e:
            print("⚠️ OCR fallback failed:", e)
            return ""
 
    # ---------- DOCX Extraction ----------
    elif file_type == "docx":
        try:
            doc = Document(file_obj)
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception:
            return ""
 
    # ---------- TXT or fallback ----------
    else:
        try:
            file_obj.seek(0)
            return file_obj.read().decode("utf-8", errors="ignore")
        except Exception:
            return ""
 
 
# -----------------------------------------------------------
# Skill cleaning helper (central)
# -----------------------------------------------------------
# This uses heuristic rules to keep likely technical skills and remove noise.
STOPWORDS = {
    # generic words that sometimes appear in resumes but aren't technical skills
    "and",
    "or",
    "the",
    "a",
    "an",
    "services",
    "courses",
    "certificate",
    "certified",
    "certification",
    "science",
    "team",
    "teams",
    "modern",
    "cd",  # rarely a skill (exclude unless you want 'CD' as domain)
    "resume",
    "contact",
    "email",
    "phone",
    "linkedin",
    "address",
    "date",
    "dob",
    "unknown",
    "name",
    "candidate",
    "manager",
    "junior",
    "senior",
    "lead",
    # add more common non-skills as needed
}
 
# Some short tokens are valid techs; keep a small allowlist for short ones
SHORT_ALLOW = {"c#", "c++", "go", "r", "js", "sql", "bash", "html", "css", "ui", "ux", "aws"}
 
# Pattern to detect dates like Jul-14-2022 or 2022/07/14 etc.
DATE_RE = re.compile(
    r"(\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b)|"  # 2022-07-14
    r"(\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b)|"  # 14-07-2022 or 14/7/22
    r"([A-Za-z]{3,9}\s*\-?\s*\d{1,2},?\s*\d{0,4})"  # Jul 14 2022, July-14-2022
)
 
# A small list of commonly used technology keywords to help allow multiword terms.
# This is intentionally small — add more as you see false negatives.
TECH_HINTS = {
    "javascript",
    "java",
    "python",
    "react",
    "angular",
    "node",
    "node.js",
    "nodejs",
    "redis",
    "postgresql",
    "mysql",
    "mongodb",
    "css",
    "html",
    "rest",
    "json",
    "graphql",
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "git",
    "linux",
    "typescript",
    "c++",
    "c#",
    "go",
    "flutter",
    "dart",
    "django",
    "spring",
    "express",
}
 
def normalize_token(tok: str) -> str:
    tok = tok.strip()
    # remove surrounding punctuation
    tok = re.sub(r"^[\"'`]+|[\"'`]+$", "", tok)
    # collapse multiple spaces
    tok = " ".join(tok.split())
    return tok
 
def looks_like_tech(tok: str) -> bool:
    """Heuristic checks whether token is a technology/skill."""
    if not tok:
        return False
 
    low = tok.lower()
 
    # remove pure dates or tokens that match date patterns
    if DATE_RE.search(tok):
        return False
 
    # drop tokens that are obviously stopwords
    if low in STOPWORDS:
        return False
 
    # allow very common short tech tokens
    if low in SHORT_ALLOW:
        return True
 
    # allow tokens that contain typical tech characters (. , + # /)
    if re.search(r"[\.#\+\/]", tok):
        return True
 
    # allow tokens containing digits (e.g., python3, node14)
    if re.search(r"\d", tok):
        return True
 
    # allow multi-word tokens that include a tech hint (e.g., 'PostgreSQL', 'React Native')
    for hint in TECH_HINTS:
        if hint in low:
            return True
 
    # allow tokens that are alphabetic and reasonably long and not English stopwords
    if re.match(r"^[A-Za-z][A-Za-z\-\s]+[A-Za-z]$", tok) and len(low) >= 3:
        # filter out plain English words that are generic (some of these are in STOPWORDS)
        if low in STOPWORDS:
            return False
        # also reject single generic adjectives
        generic_adjectives = {"modern", "scalable", "robust", "experienced"}
        if low in generic_adjectives:
            return False
        return True
 
    return False
 
def clean_skills(raw_skills: List[str]) -> List[str]:
    """Take raw skill candidates and return a cleaned, deduped list of likely technical skills."""
    cleaned = []
    seen = set()
    for s in raw_skills:
        if not s or not isinstance(s, str):
            continue
        s = normalize_token(s)
        # If comma-separated items accidentally passed in a single entry, split them
        parts = [p.strip() for p in re.split(r"[;,/]| and | & ", s) if p.strip()]
        for part in parts:
            part_norm = part.strip()
            # remove stray bullets or numbering
            part_norm = re.sub(r"^[\-\•\d\.\)\s]+", "", part_norm)
            if not part_norm:
                continue
            if looks_like_tech(part_norm):
                # standardize common forms (e.g., Node.js -> Node.js)
                # but keep original capitalization where useful
                key = part_norm.lower()
                if key not in seen:
                    cleaned.append(part_norm)
                    seen.add(key)
    return cleaned
 
 
# -----------------------------------------------------------
# Gemini skill extraction
# -----------------------------------------------------------
def extract_skills_with_gemini(resume_text: str) -> list:
    if not resume_text:
        return []
 
    if model is None:
        # fallback: use safer tokenization (words and common multiword tech terms)
        tokens = re.findall(r"[A-Za-z0-9\+\#\-\_\.]{2,}(?:\s+[A-Za-z0-9\+\#\-\_\.]{2,})?", resume_text)
        # take top unique tokens but clean with our filter
        tokens = list(dict.fromkeys(tokens))  # preserve order, dedupe
        return clean_skills(tokens)[:40]
 
    try:
        prompt = f"""
        Extract only technical skills from this resume text.
        Include: languages, frameworks, cloud, databases, devops, tools.
        Exclude: soft skills, company names, job titles, education.
 
        Resume:
        {resume_text[:2500]}
 
        Output ONLY comma-separated skills. No explanations.
        """
        response = model.generate_content(prompt)
        skills_text = response.text.strip()
 
        # parse the comma-separated output and clean it
        skills = [s.strip() for s in re.split(r",|\n|;", skills_text) if s.strip()]
        skills = clean_skills(skills)
        return skills[:40] if skills else []
 
    except Exception as e:
        print("⚠️ Gemini skill extraction failed:", e)
        # fallback to safer tokenization if Gemini fails
        tokens = re.findall(r"[A-Za-z0-9\+\#\-\_\.]{2,}(?:\s+[A-Za-z0-9\+\#\-\_\.]{2,})?", resume_text)
        tokens = list(dict.fromkeys(tokens))
        return clean_skills(tokens)[:40]
 
 
# -----------------------------------------------------------
# CPD Level Calculation
# -----------------------------------------------------------
def calculate_cpd_level(years: int) -> int:
    if years <= 1:
        return 1
    elif years <= 3:
        return 2
    elif years <= 5:
        return 3
    elif years <= 8:
        return 4
    elif years <= 12:
        return 5
    return 6
 
 
# -----------------------------------------------------------
# Field Extraction Master Function
# -----------------------------------------------------------
def extract_fields(file_obj) -> Dict:
    text = extract_file_content(file_obj)
 
    # ---------------------------------
    # NAME extraction (improved)
    # ---------------------------------
    candidate_name = None
 
    name_patterns = [
        r"Name:\s*([A-Za-z][A-Za-z\s]+?)(?=\s+(?:Email|Phone|Contact|$))",
        r"Candidate:\s*([A-Za-z][A-Za-z\s]+?)(?=\s+(?:Email|Phone|Contact|$))",
        r"Full Name:\s*([A-Za-z][A-Za-z\s]+)",
        r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",  # First line full name
    ]
 
    for pattern in name_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            extracted = match.group(1).strip()
            extracted = re.sub(r"\S+@\S+", "", extracted)
            extracted = " ".join(extracted.split())
 
            if len(extracted.split()) >= 2 and len(extracted) < 80:
                candidate_name = extracted
                break
 
    # Backup name using email line
    if not candidate_name:
        email_match = re.search(r"[\w\.-]+@[\w\.-]+", text)
        if email_match:
            lines = text.split("\n")
            idx = next(
                (i for i, line in enumerate(lines) if email_match.group(0) in line),
                0,
            )
            for line in lines[max(0, idx - 3) : idx + 1]:
                nm = re.search(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", line)
                if nm:
                    candidate_name = nm.group(1).strip()
                    break
 
    if not candidate_name:
        candidate_name = "Unknown"
 
    # ---------------------------------
    # EMAIL extraction
    # ---------------------------------
    email_match = re.search(r"[\w\.-]+@[\w\.-]+", text)
    email = email_match.group(0).strip().lower() if email_match else ""
 
    # ---------------------------------
    # EXPERIENCE extraction
    # ---------------------------------
    experience_years = 0
    exp_match = re.search(r"(\d{1,2})\s*(?:years?|yrs?)", text, re.IGNORECASE)
    if exp_match:
        try:
            experience_years = int(exp_match.group(1))
        except:
            experience_years = 0
 
    # ---------------------------------
    # CPD Level
    # ---------------------------------
    cpd_level = None
    cpd_patterns = [
        r"CPD\s*Level[:\s]+(\d)",
        r"CPD[:\s]+(\d)",
        r"Level[:\s]+(\d)\s+CPD",
    ]
 
    for pattern in cpd_patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            try:
                extracted = int(m.group(1))
                if 1 <= extracted <= 6:
                    cpd_level = extracted
                    break
            except:
                pass
 
    if cpd_level is None:
        cpd_level = calculate_cpd_level(experience_years)
 
    # ---------------------------------
    # SKILLS extraction
    # ---------------------------------
    skills = extract_skills_with_gemini(text)
 
    # ---------------------------------
    # FINAL RETURN STRUCTURE
    # ---------------------------------
    return {
        "candidate_name": candidate_name,
        "email": email,
        "experience_years": experience_years,
        "cpd_level": cpd_level,
        "skills": skills,
        "resume_text": text or "",
    }
 
 