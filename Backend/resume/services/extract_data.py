import fitz
from docx import Document
import re
from typing import Dict
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
# Gemini skill extraction
# -----------------------------------------------------------
def extract_skills_with_gemini(resume_text: str) -> list:
    if not resume_text:
        return []

    if model is None:
        tokens = re.findall(r"[A-Za-z0-9\+\#\-\+\.]{2,}", resume_text)
        return list(set(tokens))[:20]

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

        skills = [s.strip() for s in skills_text.split(",") if s.strip()]
        return skills[:40] if skills else []

    except Exception as e:
        print("⚠️ Gemini skill extraction failed:", e)
        return []


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
