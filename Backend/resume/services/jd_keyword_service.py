# Backend/resume/services/jd_keyword_service.py

import re
from typing import List, Dict
from .llama3_service import invoke_llama3_model
from .extract_data import looks_like_tech, clean_skills

NON_SKILL_STOPWORDS = {
    'responsibilities', 'responsibility', 'requirements', 'requirement',
    'design', 'develop', 'test', 'testing', 'development', 'designing',
    'experience', 'years', 'strong', 'excellent', 'good', 'skills',
    'ability', 'knowledge', 'understanding', 'working', 'work',
    'team', 'collaboration', 'communication', 'problem', 'solving',
    'analytical', 'critical', 'thinking', 'leadership', 'management',
    'project', 'projects', 'deadlines', 'deadline', 'time', 'customer',
    'client', 'business', 'stakeholder', 'stakeholders', 'delivery',
    'quality', 'performance', 'optimization', 'improve', 'improvement',
    'maintain', 'maintenance', 'support', 'documentation', 'document',
    'analyze', 'analysis', 'implement', 'implementation', 'ensure',
    'enhance', 'enhancement', 'monitor', 'monitoring', 'troubleshoot',
    'troubleshooting', 'debug', 'debugging', 'review', 'reviews',
    'participate', 'collaborate', 'coordinate',
    'assist', 'help', 'provide', 'create', 'build', 'integrate',
    'integration', 'manage', 'lead', 'mentor', 'mentoring'
}

def validate_skill_in_text(skill: str, jd_text: str) -> bool:
    """
    Check if a skill actually appears in the JD text.
    Returns True if the skill is found (case-insensitive).
    """
    jd_lower = jd_text.lower()
    skill_lower = skill.lower()
    
    # Direct match
    if skill_lower in jd_lower:
        return True
    
    # Handle variations like "python3" vs "python"
    if re.search(r'\b' + re.escape(skill_lower) + r'[0-9]*\b', jd_lower):
        return True
    
    return False


def extract_jd_keywords(jd_text: str, top_k: int = 30) -> List[str]:
    """
    Extract ACTUAL technical skills mentioned in the JD using LLaMA3 + validation.
    ONLY returns skills that are ACTUALLY present in the JD text.
    """
    if not jd_text or len(jd_text.strip()) < 50:
        return []

    try:
        # ✅ IMPROVED PROMPT - more explicit about what to include/exclude
        prompt = f"""
Extract ONLY technical skills from this Job Description.

INCLUDE ONLY:
- Programming languages (Python, Java, JavaScript, C++, etc.)
- Frameworks (React, Django, Spring Boot, Angular, etc.)
- Databases (PostgreSQL, MongoDB, MySQL, Redis, etc.)
- Cloud platforms (AWS, Azure, GCP, Kubernetes, etc.)
- DevOps tools (Docker, Jenkins, CI/CD tools, etc.)
- Version control (Git, GitLab, GitHub, etc.)
- Libraries and packages (NumPy, pandas, TensorFlow, etc.)
- Operating systems (Linux, Unix, Windows Server, etc.)

EXCLUDE:
- Soft skills (communication, teamwork, leadership, etc.)
- Job duties (design, develop, test, maintain, analyze, etc.)
- Generic words (responsibilities, requirements, experience, years, strong, excellent, etc.)
- Company names or job titles

Return ONLY a comma-separated list. No explanations.

Job Description:
{jd_text[:4000]}

Technical Skills:"""

        response = invoke_llama3_model(prompt)
        
        if not response:
            print("⚠️ LLaMA3 returned empty response for JD")
            return []

        # Parse comma/semicolon separated skills
        raw_skills = [x.strip() for x in re.split(r',|;|\n', response) if x.strip()]

        # Filter to keep only technical skills that ACTUALLY exist in the JD
        technical_skills = []
        for skill in raw_skills:
            skill_clean = skill.lower().strip()
            
            # Remove bullet points, numbers, etc.
            skill_clean = re.sub(r'^[\-\•\d\.\)\s]+', '', skill_clean)
            
            # Skip empty strings after cleaning
            if not skill_clean:
                continue
            
            # Filter out stopwords
            if skill_clean in NON_SKILL_STOPWORDS:
                print(f"  ⊗ Filtered stopword: {skill_clean}")
                continue
            
            # Filter out multi-word phrases that start with stopwords
            first_word = skill_clean.split()[0] if ' ' in skill_clean else skill_clean
            if first_word in NON_SKILL_STOPWORDS:
                print(f"  ⊗ Filtered phrase starting with stopword: {skill_clean}")
                continue
            
            # ✅ NEW: Validate that the skill actually appears in the JD text
            if not validate_skill_in_text(skill_clean, jd_text):
                print(f"  ⊗ Skill NOT found in JD text: {skill_clean}")
                continue
            
            # Keep only if it looks like a technical skill
            if looks_like_tech(skill_clean):
                technical_skills.append(skill_clean)
            else:
                print(f"  ⊗ Filtered non-tech: {skill_clean}")

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
