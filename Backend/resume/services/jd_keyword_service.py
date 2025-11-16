# Backend/resume/services/jd_keyword_service.py
from keybert import KeyBERT
import nltk
from nltk.corpus import stopwords

# Initialize KeyBERT model (lightweight)
kw_model = KeyBERT(model='all-MiniLM-L6-v2')

# Download stopwords if not already present
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

stop_words = set(stopwords.words('english'))


def extract_jd_keywords(jd_text: str, top_k: int = 20) -> list:
    """
    Extract keywords from Job Description using KeyBERT.
    Returns top keywords that are most relevant to the JD.
    """
    if not jd_text or len(jd_text.strip()) < 50:
        return []
    
    try:
        # Extract keywords using KeyBERT - REMOVED 'language' parameter
        keywords = kw_model.extract_keywords(
            jd_text,
            top_n=top_k,
            use_mmr=True,  # Use Maximum Marginal Relevance for diversity
            diversity=0.7
        )
        
        # Filter out stopwords and format
        result = []
        for kw, score in keywords:
            if kw.lower() not in stop_words and len(kw) > 2:
                result.append(kw)
        
        print(f"✅ Extracted {len(result)} keywords: {result}")  # Debug output
        return result[:top_k]
    
    except Exception as e:
        print(f"❌ Error extracting keywords: {e}")
        import traceback
        traceback.print_exc()
        return []


def match_resume_to_jd(resume_skills: list, jd_keywords: list) -> dict:
    """
    Match resume skills against JD keywords.
    Returns matched and missing skills with percentage.
    """
    resume_skills_lower = [s.lower().strip() for s in resume_skills]
    jd_keywords_lower = [k.lower().strip() for k in jd_keywords]
    
    matched = []
    missing = []
    
    for jd_kw in jd_keywords_lower:
        # Check if keyword matches any resume skill
        found = False
        for rs in resume_skills_lower:
            if jd_kw in rs or rs in jd_kw:
                matched.append(jd_kw)
                found = True
                break
        
        if not found:
            missing.append(jd_kw)
    
    match_percentage = 0
    if jd_keywords_lower:
        match_percentage = round((len(matched) / len(jd_keywords_lower)) * 100, 2)
    
    return {
        'matched': list(set(matched)),
        'missing': list(set(missing)),
        'match_count': len(set(matched)),
        'total_required': len(jd_keywords_lower),
        'match_percentage': match_percentage
    }
