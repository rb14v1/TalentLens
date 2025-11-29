# Backend/resume/services/matching_service.py
 
from typing import List, Dict, Any
import numpy as np
import re
from difflib import SequenceMatcher
 
# IMPORTANT: only import what exists now
from .extract_data import extract_skills_with_llama3, expand_skill
from .embedding_service import get_text_embedding
 
 
# ---------------------------------------------
# NEW HELPERS: JD keyword extraction + matching
# ---------------------------------------------
 
def extract_keywords_from_jd(jd_text: str) -> List[str]:
    """Extract clean keywords from job description text."""
    if not jd_text:
        return []
    words = re.findall(r"[a-zA-Z0-9\+\#\.]+", jd_text.lower())
    return list(set(words))
 
 
def exact_keyword_match(candidate_skills: List[str], job_keywords: List[str]) -> List[str]:
    """Exact matches (case-insensitive)."""
    candidate_set = {s.lower() for s in candidate_skills}
    job_set = {kw.lower() for kw in job_keywords}
    return list(candidate_set.intersection(job_set))
 
 
def fuzzy_ratio(a: str, b: str) -> float:
    """Fuzzy matching helper."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()
 
 
def fuzzy_skill_match(candidate_skills: List[str], job_keywords: List[str]) -> List[str]:
    """Smart fuzzy matching like python ↔ python3."""
    matches = []
    for skill in candidate_skills:
        for kw in job_keywords:
            if fuzzy_ratio(skill, kw) >= 0.78:
                matches.append(skill.lower())
                break
    return matches
 
 
# ================================================================
# ORIGINAL MATCHING SERVICE + Updated integration
# ================================================================
class MatchingService:
 
    # -------------------------------
    # Extract JD skills using LLaMA
    # -------------------------------
    @staticmethod
    def extract_jd_skills(jd_text: str) -> Dict[str, List[str]]:
        try:
            technical = extract_skills_with_llama3(jd_text or "")
        except Exception:
            technical = []
 
        display = list(dict.fromkeys(technical))
        normalized = sorted({s.lower() for s in technical})
 
        return {
            "skills": normalized,
            "display_skills": display
        }
 
    # -------------------------------
    # EXPAND using new expand_skill()
    # -------------------------------
    @staticmethod
    def expand_related_keywords(keywords: List[str]) -> List[str]:
        expanded = set()
 
        for sk in keywords:
            sk = sk.lower()
            expanded.add(sk)
 
            try:
                related = expand_skill(sk)
                for r in related:
                    expanded.add(r.lower())
            except Exception:
                pass
 
        return list(expanded)
 
    # -------------------------------
    # Embedding helpers
    # -------------------------------
    @staticmethod
    def embed_single_text(text: str) -> List[float]:
        try:
            emb = get_text_embedding(text or "")
            return emb if isinstance(emb, list) else emb.tolist()
        except:
            return [0.0] * 384
 
    # -------------------------------
    # Pure keyword matching
    # -------------------------------
    @staticmethod
    def compute_skill_match(resume_skills: List[str], jd_keywords: List[str]) -> Dict[str, Any]:
        resume_norm = [s.lower() for s in resume_skills]
        jd_norm = [k.lower() for k in jd_keywords]
 
        matched = set()
        missing = set()
 
        for jd in jd_norm:
            found = any(jd in rs or rs in jd for rs in resume_norm)
            if found:
                matched.add(jd)
            else:
                missing.add(jd)
 
        total = len(jd_norm)
        percentage = round((len(matched) / total) * 100, 2) if total else 0.0
 
        return {
            "matched": sorted(matched),
            "missing": sorted(missing),
            "match_percentage": percentage
        }
 
 
# ====================================================
# Relevance logic
# ====================================================
def compute_relevance(resume_skills, query_keywords):
    resume_norm = [s.lower() for s in (resume_skills or [])]
    query_norm = [q.lower() for q in (query_keywords or [])]
 
    matched = []
    missing = []
    relevant = []
 
    for q in query_norm:
        if any(q in r or r in q for r in resume_norm):
            matched.append(q)
            relevant.append(q)
        else:
            missing.append(q)
 
    total = len(query_norm)
    percent = round((len(matched) / total) * 100, 2) if total else 0.0
 
    return {
        "match_percentage": percent,
        "matched_skills": matched,
        "missing_skills": missing,
        "relevant_skills": relevant,
    }
 
 
# ====================================================
# Cosine similarity helper
# ====================================================
def cosine_similarity(a, b):
    try:
        a = np.array(a)
        b = np.array(b)
        n = min(len(a), len(b))
        a = a[:n]
        b = b[:n]
        denom = (np.linalg.norm(a) * np.linalg.norm(b))
        if denom == 0:
            return 0.0
        return float(np.dot(a, b) / denom)
    except:
        return 0.0
 
 