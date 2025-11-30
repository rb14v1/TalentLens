# Backend/resume/services/jd_keyword_service.py

import re
from typing import List, Dict
from .llama3_service import invoke_llama3_model
from .extract_data import looks_like_tech, clean_skills, TECH_HINTS

def extract_jd_keywords(jd_text: str, top_k: int = 30) -> List[str]:
    """
    Extract ACTUAL technical skills mentioned in the JD using LLaMA3.
    Same extraction logic as resume skills for consistency.
    """
    if not jd_text or len(jd_text.strip()) < 50:
        return []
    
    try:
        # ✅ USE LLAMA3 TO EXTRACT SKILLS FROM JD (same as resume)
        prompt = f"""
Extract ONLY technical skills, tools, and technologies from this Job Description.

STRICT RULES:
- Return comma-separated list ONLY
- No sentences, no explanations
- Include: programming languages, frameworks, tools, databases, cloud platforms
- Exclude: soft skills, job requirements, company names
- Max 3 words per skill

Job Description:
{jd_text[:4000]}

Technical Skills:"""

        response = invoke_llama3_model(prompt)
        
        if not response:
            print("⚠️ LLaMA3 returned empty response for JD")
            return []
        
        # Parse comma/semicolon separated skills
        raw_skills = [x.strip() for x in re.split(r',|;|\n', response) if x.strip()]
        
        # Filter to keep only technical skills
        technical_skills = []
        for skill in raw_skills:
            skill_clean = skill.lower().strip()
            
            # Remove bullet points, numbers, etc.
            skill_clean = re.sub(r'^[\-\•\d\.\)\s]+', '', skill_clean)
            
            if skill_clean and looks_like_tech(skill_clean):
                technical_skills.append(skill_clean)
        
        # Remove duplicates while preserving order
        result = list(dict.fromkeys(technical_skills))[:top_k]
        
        print(f"✅ Extracted {len(result)} JD skills: {result}")
        return result
        
    except Exception as e:
        print(f"❌ Error extracting JD keywords: {e}")
        import traceback
        traceback.print_exc()
        return []


def match_resume_to_jd(resume_skills: List[str], jd_keywords: List[str]) -> Dict:
    """
    Match resume skills against JD keywords with smart fuzzy matching.
    Handles: python ↔ python3, react ↔ reactjs, spring boot ↔ spring/boot
    """
    resume_skills_lower = [s.lower().strip() for s in resume_skills]
    jd_keywords_lower = [k.lower().strip() for k in jd_keywords]
    
    matched = set()
    missing = []
    
    for jd_kw in jd_keywords_lower:
        found = False
        
        # Split multi-word skills (e.g., "spring boot" -> ["spring", "boot"])
        jd_parts = jd_kw.split()
        
        for rs in resume_skills_lower:
            rs_parts = rs.split()
            
            # Method 1: Exact match
            if jd_kw == rs:
                matched.add(jd_kw)
                found = True
                break
            
            # Method 2: Substring match (bidirectional)
            if jd_kw in rs or rs in jd_kw:
                matched.add(jd_kw)
                found = True
                break
            
            # Method 3: Multi-word skill matching
            # If JD skill has multiple words, check if resume has all parts
            if len(jd_parts) > 1:
                if all(any(part in rs_part or rs_part in part for rs_part in rs_parts) for part in jd_parts):
                    matched.add(jd_kw)
                    found = True
                    break
            
            # Method 4: Partial word matching for compound skills
            # e.g., "reactjs" matches "react", "nodejs" matches "node"
            if any(part in jd_kw for part in rs_parts if len(part) > 2):
                matched.add(jd_kw)
                found = True
                break
        
        if not found:
            missing.append(jd_kw)
    
    # Calculate percentage
    match_percentage = 0
    if jd_keywords_lower:
        match_percentage = round((len(matched) / len(jd_keywords_lower)) * 100, 2)
    
    return {
        'matched': sorted(list(matched)),
        'missing': sorted(missing),
        'match_count': len(matched),
        'total_required': len(jd_keywords_lower),
        'match_percentage': match_percentage
    }

