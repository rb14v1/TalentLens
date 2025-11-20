"""
SkillNER Service (Mode C - Strict Technical + Skills-Section Soft Skills)
 
Usage:
  from skillner_service import extract_skills, reload_skills, load_ner_model
 
Notes:
  - Place skills_dictionary.json next to this file (JSON array of strings).
  - Soft skills list is embedded in SOFT_SKILLS_LIST below (Option A).
  - Optional local NER: set SKILLNER_LOCAL_DIR env var to a local transformers-compatible model directory.
  - No HuggingFace tokens or remote calls are made by this module by default.
"""
 
import os
import re
import json
import traceback
from typing import List, Dict, Tuple, Optional
 
# Optional packages
try:
    from wordfreq import zipf_frequency
    _WORDFREQ_AVAILABLE = True
except Exception:
    _WORDFREQ_AVAILABLE = False
 
try:
    import nltk
    nltk.download("stopwords", quiet=True)
    from nltk.corpus import stopwords
    _NLTK_STOPWORDS = set(stopwords.words("english"))
except Exception:
    _NLTK_STOPWORDS = set()
 
try:
    from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline
    _TRANSFORMERS_AVAILABLE = True
except Exception:
    _TRANSFORMERS_AVAILABLE = False
 
# ---------------------------------------------------------------------
# Embedded Soft Skills list (Option A)
# Add items here; user said they'll add more later.
# These are lowercase-normalized values used for strict matching.
# ---------------------------------------------------------------------
SOFT_SKILLS_LIST = [
    "communication",
    "leadership",
    "teamwork",
    "problem solving",
    "time management",
    "adaptability",
    "critical thinking",
    "presentation",
    "mentoring",
    "collaboration",
    "public speaking",
    "negotiation",
    "analytical skills",
]
SOFT_SKILLS_SET = set([s.strip().lower() for s in SOFT_SKILLS_LIST if s and s.strip()])
 
# ---------------------------------------------------------------------
# Paths & load skills dictionary
# ---------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SKILLS_JSON_PATH = os.path.join(BASE_DIR, "skills_dictionary.json")
 
RAW_SKILLS: List[str] = []
SKILL_CANONICAL: Dict[str, str] = {}
SKILL_SET: set = set()
SORTED_SKILLS: List[str] = []
 
def _normalize_skill_key(s: str) -> str:
    if not s:
        return ""
    t = str(s).strip().lower()
    # normalize common punctuation to spaces except keep + # . inside tokens
    t = t.replace("_", " ").replace("/", " ").replace("\\", " ")
    # collapse whitespace
    t = " ".join(t.split())
    return t
 
def _load_skills():
    global RAW_SKILLS, SKILL_CANONICAL, SKILL_SET, SORTED_SKILLS
    try:
        with open(SKILLS_JSON_PATH, "r", encoding="utf-8") as f:
            RAW_SKILLS = json.load(f)
    except Exception:
        RAW_SKILLS = []
    SKILL_CANONICAL = {}
    for raw in RAW_SKILLS:
        norm = _normalize_skill_key(raw)
        if norm:
            if norm not in SKILL_CANONICAL:
                SKILL_CANONICAL[norm] = str(raw)
    SKILL_SET = set(SKILL_CANONICAL.keys())
    # sort by length desc to prefer multi-word matches
    SORTED_SKILLS = sorted(list(SKILL_SET), key=lambda x: -len(x))
 
# initial load
_load_skills()
 
def reload_skills():
    """Reload skills_dictionary.json at runtime."""
    _load_skills()
 
# ---------------------------------------------------------------------
# Small heuristics: garbage detection using wordfreq or nltk stopwords
# ---------------------------------------------------------------------
ZIPF_GARBAGE_THRESHOLD = 5.0  # tokens with zipf >= 5 are very common words
 
def _is_common_english_word(token: str) -> bool:
    t = token.strip().lower()
    if not t:
        return True
    # preserve tokens with tech punctuation or digits+letters
    if any(ch in t for ch in (".", "+", "#")):
        return False
    if any(ch.isdigit() for ch in t) and any(ch.isalpha() for ch in t):
        return False
    if _WORDFREQ_AVAILABLE:
        try:
            return zipf_frequency(t, "en") >= ZIPF_GARBAGE_THRESHOLD
        except Exception:
            pass
    if _NLTK_STOPWORDS:
        return t in _NLTK_STOPWORDS
    # conservative fallback
    return t in {"to","in","on","for","of","and","the","a","an","with","is","are","was","were","by","at","from"}
 
# ---------------------------------------------------------------------
# Normalization utilities (handle camelCase, punctuation, variants)
# ---------------------------------------------------------------------
_CAMEL_SPLIT_RE = re.compile(r'(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])')
 
def _split_camel_case(token: str) -> str:
    if not token:
        return token
    parts = _CAMEL_SPLIT_RE.split(token)
    return " ".join(parts)
 
def _normalize_token_for_matching(token: str) -> str:
    if not token:
        return ""
    t = str(token).strip()
    t = _split_camel_case(t)
    t = t.replace("_", " ").replace("/", " ").replace("\\", " ")
    t = re.sub(r'[-]+', ' ', t)  # hyphens -> spaces
    t = re.sub(r'\s+', ' ', t).strip().lower()
    return t
 
def _generate_variants(phrase: str) -> List[str]:
    # produce useful variations: dots removed, spaces removed, plus/shifted forms
    out = []
    base = _normalize_token_for_matching(phrase)
    if not base:
        return out
    out.append(base)
    no_dots = base.replace('.', '')
    if no_dots != base:
        out.append(no_dots)
        out.append(base.replace('.', ' '))
    nospace = base.replace(' ', '')
    if nospace not in out:
        out.append(nospace)
    if '++' in base:
        out.append(base.replace('++', 'plusplus'))
        out.append(base.replace('++', ' plus plus'))
    if '#' in base:
        out.append(base.replace('#', 'sharp'))
    # dedupe while preserving order
    seen = set()
    uniq = []
    for v in out:
        v2 = re.sub(r'\s+', ' ', v).strip()
        if v2 and v2 not in seen:
            seen.add(v2)
            uniq.append(v2)
    return uniq
 
# ---------------------------------------------------------------------
# Core matching: longest-first phrase matching (dictionary-only)
# ---------------------------------------------------------------------
def _find_skills_longest_first(text: str) -> List[str]:
    found: List[str] = []
    if not text:
        return found
    lowered = text.lower()
    matched_spans: List[Tuple[int,int]] = []
    for skill_norm in SORTED_SKILLS:
        if not skill_norm:
            continue
        esc = re.escape(skill_norm)
        esc = esc.replace(r'\ ', r'\s+')
        pattern = re.compile(r'(?<![\w#\+\.])' + esc + r'(?![\w#\+\.])', flags=re.IGNORECASE)
        for m in pattern.finditer(lowered):
            s,e = m.start(), m.end()
            overlap = False
            for a,b in matched_spans:
                if not (e <= a or s >= b):
                    overlap = True
                    break
            if overlap:
                continue
            matched_spans.append((s,e))
            found.append(skill_norm)
    return found
 
# ---------------------------------------------------------------------
# Token fallback (dictionary-only)
# ---------------------------------------------------------------------
_TOKEN_RE = re.compile(r'[A-Za-z0-9\+\#\.]+(?:-[A-Za-z0-9\+\#\.]+)?')
 
def _find_skills_token_fallback(text: str, existing: List[str]) -> List[str]:
    found: List[str] = []
    tokens = _TOKEN_RE.findall(text)
    for tok in tokens:
        norm = _normalize_token_for_matching(tok)
        if not norm:
            continue
        # generate variants and match against SKILL_SET
        variants = _generate_variants(norm)
        matched = False
        for v in variants:
            if v in SKILL_SET and v not in existing and v not in found:
                found.append(v)
                matched = True
                break
        if not matched:
            if norm in SKILL_SET and norm not in existing and norm not in found:
                found.append(norm)
    return found
 
# ---------------------------------------------------------------------
# Extract explicit 'Skills' section items (we'll use this to control soft skills)
# ---------------------------------------------------------------------
def _extract_skills_section_items(text: str) -> List[str]:
    """
    Heuristic: find 'skills' heading and capture the following block (up to some length).
    Returns raw items (untouched strings) that appear under the 'Skills' area.
    """
    lowered = text.lower()
    section_patterns = [
        r'(skills(?:\s*&\s*tools|\s*:)?\s*)(?:\n+)([\s\S]{1,600})',
        r'(technical skills(?:\s*:)?\s*)(?:\n+)([\s\S]{1,600})',
        r'(soft skills(?:\s*:)?\s*)(?:\n+)([\s\S]{1,600})',
        r'(skills(?:\s*:)?\s*)([\S\s]{1,600})'
    ]
    candidates: List[str] = []
    for pat in section_patterns:
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            block = m.group(2)
            # stop at next double newline or next header-like line (ALL CAPS)
            block = re.split(r'\n\s*\n', block)[0]
            lines = block.splitlines()[:12]
            block_short = " ".join(lines)
            # split by common separators: comma, semicolon, pipe, bullets, newline, dash
            items = re.split(r"[;,•\u2022\|\n\-]{1,}", block_short)
            for it in items:
                tok = it.strip()
                if not tok:
                    continue
                tok = re.sub(r"[:\u2022•]+$", "", tok).strip()
                if tok:
                    candidates.append(tok)
            if candidates:
                return candidates
    return candidates
 
# ---------------------------------------------------------------------
# Optional local NER using a SkillNER-style model (local only)
# ---------------------------------------------------------------------
_NER_PIPELINE = None
_NER_LOADED = False
 
def load_ner_model(local_dir: Optional[str] = None) -> bool:
    """
    Load a local NER model (transformers) if you have one locally.
    Provide local_dir or set SKILLNER_LOCAL_DIR env var.
    Returns True on success.
    """
    global _NER_PIPELINE, _NER_LOADED
    if _NER_LOADED:
        return True
    if not _TRANSFORMERS_AVAILABLE:
        return False
    try:
        model_dir = local_dir or os.getenv("SKILLNER_LOCAL_DIR")
        if not model_dir:
            return False
        tokenizer = AutoTokenizer.from_pretrained(model_dir, use_fast=True)
        model = AutoModelForTokenClassification.from_pretrained(model_dir)
        _NER_PIPELINE = pipeline("token-classification", model=model, tokenizer=tokenizer, aggregation_strategy="simple")
        _NER_LOADED = True
        return True
    except Exception:
        _NER_PIPELINE = None
        _NER_LOADED = False
        traceback.print_exc()
        return False
 
def _extract_via_ner(text: str, max_chunks: int = 30) -> List[str]:
    if not text:
        return []
    if not _NER_LOADED:
        if not load_ner_model():
            return []
    if not _NER_PIPELINE:
        return []
    sentences = re.split(r'(?<=[\.\!\?\n])\s+', text)
    chunks = []
    cur = ""
    for s in sentences:
        if len(cur) + len(s) < 700:
            cur += " " + s
        else:
            if cur.strip():
                chunks.append(cur.strip())
            cur = s
        if len(chunks) >= max_chunks:
            break
    if cur.strip() and len(chunks) < max_chunks:
        chunks.append(cur.strip())
    ner_found = []
    try:
        for chunk in chunks:
            try:
                preds = _NER_PIPELINE(chunk)
            except Exception:
                continue
            for p in preds:
                ent_text = p.get("word") or p.get("entity") or p.get("entity_group") or ""
                if not ent_text:
                    continue
                ent_norm = _normalize_token_for_matching(ent_text)
                if ent_norm:
                    ner_found.append(ent_norm)
    except Exception:
        traceback.print_exc()
    # dedupe preserving order
    seen = set()
    out = []
    for n in ner_found:
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out
 
# ---------------------------------------------------------------------
# Canonicalize + filter (strict: only items that map to SKILL_CANONICAL OR allowed soft skills)
# ---------------------------------------------------------------------
def _clean_and_canonicalize(norm_list: List[str], preserve_raw: List[str] = []) -> List[str]:
    """
    norm_list: normalized tokens/phrases (dictionary-normalized forms)
    preserve_raw: raw strings from skills section (to allow soft skills)
    Returns canonicalized list of strings to display.
    """
    result: List[str] = []
    seen = set()
    # prepare preserved_norms (normalized forms of raw items from skills section)
    preserved_norms = [_normalize_token_for_matching(x) for x in preserve_raw if x]
 
    # We'll only include:
    # - items that match SKILL_CANONICAL (technical skills)
    # - OR items from preserved_norms that are in SOFT_SKILLS_SET (soft skills)
    for norm in norm_list + preserved_norms:
        if not norm:
            continue
 
        # Avoid duplicates
        if norm in seen:
            continue
 
        # ───────────────────────────────
        # HARD FILTERS – remove guaranteed garbage
        # ───────────────────────────────
 
        # 1) Remove emails / domains
        if "@" in norm or re.search(r"\.\w{2,4}$", norm):
            continue
 
        # 2) Remove pure numbers or year-like tokens
        if norm.isdigit():
            continue
        if re.fullmatch(r"(19|20)\d{2}", norm):
            continue
 
        # 3) Remove tokens like "experience", "summary", "skills", “personal”, etc.
        BAD_HEADINGS = {
            "experience", "exp", "summary", "objective", "profile",
            "projects", "project", "education", "certifications",
            "certification", "contact", "personal", "details",
            "skills", "skill", "resume"
        }
        if norm in BAD_HEADINGS:
            continue
 
        # 4) Remove common English words (NOT in dictionary)
        if _is_common_english_word(norm) and norm not in SKILL_CANONICAL:
            continue
 
        # 5) Remove name-like tokens (charitha, anusha, rahul, etc.)
        # Only skip if NOT part of skill dictionary
        if re.fullmatch(r"[A-Za-z]{3,20}", norm) and norm not in SKILL_CANONICAL:
            continue
 
        # ───────────────────────────────
        # KEEP ONLY VALID SKILLS
        # ───────────────────────────────
 
        # TECHNICAL SKILLS – dictionary-based
        if norm in SKILL_CANONICAL:
            seen.add(norm)
            result.append(SKILL_CANONICAL[norm])
            continue
 
        # SOFT SKILLS – ONLY keep if:
        #  - The user wrote them inside a Skills section
        #  - AND they appear in the defined soft-skill list
        if norm in preserved_norms:
            if norm in SOFT_SKILLS_SET:
                seen.add(norm)
                # Use original casing from soft-skill list
                pretty = next((s for s in SOFT_SKILLS_LIST
                               if _normalize_token_for_matching(s) == norm), None)
                if pretty:
                    result.append(pretty)
                else:
                    result.append(norm.title())
            continue
 
        # OTHERWISE: skip everything else
 
    return result
 
# ---------------------------------------------------------------------
# Public API: extract_skills(text)
# ---------------------------------------------------------------------
def extract_skills(text: str) -> List[str]:
    """
    Mode C master pipeline:
      - Remove emails & phones
      - Extract explicit skills-section items (raw)
      - Longest-first dictionary matching (technical skills only)
      - Optional NER (local, best-effort)
      - Token fallback (dictionary only)
      - Combine and canonicalize, but include soft skills ONLY if they appear in the Skills section AND in the embedded SOFT_SKILLS_LIST
    Returns: list of canonical skill strings.
    """
    if not text:
        return []
    # remove emails & phones to reduce noise
    text_no_email = re.sub(r'[\w\.-]+@[\w\.-]+', ' ', text)
    text_no_phone = re.sub(r'(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}', ' ', text_no_email)
 
    # 1) skills section (raw items). We'll use this to allow soft skills only from here.
    skills_section_items = _extract_skills_section_items(text_no_phone)
    # normalized versions of section items (for dedupe & matching)
    skills_section_norms = [_normalize_token_for_matching(x) for x in skills_section_items if x and x.strip()]
 
    # 2) longest-first dictionary matching across whole text (technical skills only)
    long_matches = _find_skills_longest_first(text_no_phone)
 
    # 3) optional local NER (may catch variants); results are normalized tokens
    ner_matches = _extract_via_ner(text_no_phone)
 
    # 4) token-level fallback (dictionary-only)
    token_matches = _find_skills_token_fallback(text_no_phone, existing=long_matches + ner_matches)
 
    # combine respecting priority: long_matches first, then token, then ner
    combined_norms: List[str] = []
    for lst in (long_matches, token_matches, ner_matches):
        for n in lst:
            if n and n not in combined_norms:
                combined_norms.append(n)
 
    # Append explicit skills-section normalized items at the end (they might be soft skills)
    for sec in skills_section_norms:
        if sec not in combined_norms:
            combined_norms.append(sec)
 
    # canonicalize + filter strictly (include soft skills only if in skills section & in SOFT_SKILLS_LIST)
    cleaned = _clean_and_canonicalize(combined_norms, preserve_raw=skills_section_items)
 
    return cleaned
 
# ---------------------------------------------------------------------
# Small test if run directly
# ---------------------------------------------------------------------
if __name__ == "__main__":
    sample = """
    John Doe
    Skills:
    Python, Machine Learning, react.js, Next.js, Docker, Kubernetes, c++, C#, data analysis, teamwork, communication, leadership
    Experience: 4+ years
    """
    print("Loaded skills:", len(SKILL_SET))
    print("Soft skills embedded:", sorted(list(SOFT_SKILLS_SET)))
    print("Extracted:", extract_skills(sample))
 
 