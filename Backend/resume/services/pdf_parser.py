import fitz  # PyMuPDF
import re
from typing import List, Dict
import io
import os

# Optional Gemini usage is handled in extract_data if desired.
# Keep the basic parsing utilities here for backward compatibility.

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text("text"))
        return "\n".join(text_parts)
    finally:
        doc.close()

def _split_skills_simple(lines: List[str]) -> List[str]:
    items = []
    for line in lines:
        line = str(line)
        tokens = re.split(r"[,;/|]", line)
        for token in tokens:
            s = token.strip()
            if s:
                items.append(s)
    # dedupe preserving order (case-insensitive)
    seen = set()
    out = []
    for skill in items:
        key = skill.lower()
        if key not in seen:
            seen.add(key)
            out.append(skill)
    return out

def parse_resume(text: str) -> Dict:
    """
    Lightweight parser: name, CPD Level, skills (simple), experience band.
    This is kept for compatibility and for use by the legacy endpoints.
    """
    name = None
    name_patterns = [
        r"Name:\s*([A-Za-z][A-Za-z\s]+?)(?=\s+(?:Email|E-mail|Phone|Contact|$))",
        r"Candidate:\s*([A-Za-z][A-Za-z\s]+?)(?=\s+(?:Email|E-mail|Phone|Contact|$))",
        r"Employee:\s*([A-Za-z][A-Za-z\s]+?)(?=\s+(?:Email|E-mail|Phone|Contact|$))",
        r"Full Name:\s*([A-Za-z][A-Za-z\s]+?)(?=\s+(?:Email|E-mail|Phone|Contact|$))",
        r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
    ]

    for pattern in name_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            raw_name = match.group(1).strip()
            raw_name = re.sub(r'\S+@\S+\.\S+', '', raw_name)
            raw_name = re.sub(r'\b(?:Email|E-mail|Phone|Contact)\b', '', raw_name, flags=re.IGNORECASE)
            name = " ".join(raw_name.split())
            break

    cpd_level_match = re.search(r"CPD Level:\s*([A-Za-z0-9+\-\. ]+)", text, re.IGNORECASE)
    cpd_level = cpd_level_match.group(1).strip() if cpd_level_match else None

    skills_lines = re.findall(r"Skills:\s*(.+)", text, re.IGNORECASE)
    skills = _split_skills_simple(skills_lines) if skills_lines else []

    experience_match = re.search(r"Experience:\s*([0-9]+(?:\+)?|[0-9]+-[0-9]+)\s*(?:years?)?", text, re.IGNORECASE)
    experience_band = "Unknown"
    if experience_match:
        token = experience_match.group(1)
        if "-" in token or token.endswith("+"):
            experience_band = token
        else:
            try:
                y = int(token)
                if y <= 2:
                    experience_band = "0-2 years"
                elif y <= 5:
                    experience_band = "2-5 years"
                elif y <= 10:
                    experience_band = "5-10 years"
                else:
                    experience_band = "10+ years"
            except Exception:
                experience_band = token

    return {
        "name": name,
        "cpd_level": cpd_level,
        "skills": skills,
        "experience": experience_band,
    }
