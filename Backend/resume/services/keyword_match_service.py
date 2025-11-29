import re
from difflib import SequenceMatcher
 
# Import the ADVANCED dependency expander from extract_data.py
from resume.services.extract_data import expand_skill
 
 
class KeywordMatchService:
 
    # -------------------------------------------------------
    # 1) Extract clean keywords from user search input
    # -------------------------------------------------------
    @staticmethod
    def extract_keywords(text: str):
        if not text:
            return []
        # Allows java, c#, c++, python3, reactjs, etc.
        return list(set(re.findall(r"[a-zA-Z0-9\+\#\.]+", text.lower())))
 
    # -------------------------------------------------------
    # 2) Expand dependencies using expand_skill()
    # -------------------------------------------------------
    @staticmethod
    def expand_dependencies(keywords):
        """
        Expands keywords using the FULL dependency graph from extract_data.py
 
        Example:
        django  -> python, flask, rest, backend
        linux   -> devops, docker, kubernetes, bash
        python  -> django, fastapi, pandas, numpy...
        """
        expanded = set()
 
        for kw in keywords:
            kw = kw.lower()
 
            # Add original keyword
            expanded.add(kw)
 
            # Add expanded related skills
            try:
                related = expand_skill(kw)
                for r in related:
                    expanded.add(r.lower())
            except Exception:
                pass
 
        return list(expanded)
 
    # -------------------------------------------------------
    # 3) Exact Match
    # -------------------------------------------------------
    @staticmethod
    def exact_match(resume_skills, keywords):
        resume_set = {s.lower() for s in resume_skills}
        keyword_set = {k.lower() for k in keywords}
        return list(resume_set.intersection(keyword_set))
 
    # -------------------------------------------------------
    # 4) Fuzzy Match
    # -------------------------------------------------------
    @staticmethod
    def fuzzy_ratio(a, b):
        return SequenceMatcher(None, a.lower(), b.lower()).ratio()
 
    @staticmethod
    def fuzzy_match(resume_skills, keywords, threshold=0.78):
        """
        python3 ↔ python
        reactjs ↔ react
        nodejs ↔ node.js
        """
        matches = []
        for skill in resume_skills:
            s = skill.lower()
            for kw in keywords:
                if KeywordMatchService.fuzzy_ratio(s, kw.lower()) >= threshold:
                    matches.append(s)
                    break
        return matches
 
    # -------------------------------------------------------
    # 5) MAIN PIPELINE (Call This)
    # -------------------------------------------------------
    @staticmethod
    def get_matched_keywords(resume_skills, search_text):
        """
        FULL MATCHING PIPELINE
 
        1. Extract raw keywords -> ['django']
        2. Expand dependencies -> ['django', 'python', 'backend', ...]
        3. Exact match -> direct matches
        4. Fuzzy match -> python3 ~ python, reactjs ~ react
        """
        # STEP 1: extract keywords
        keywords = KeywordMatchService.extract_keywords(search_text)
 
        # STEP 2: dependency expansion
        expanded_keywords = KeywordMatchService.expand_dependencies(keywords)
 
        # STEP 3: exact match
        exact_matches = KeywordMatchService.exact_match(resume_skills, expanded_keywords)
 
        # STEP 4: fuzzy match
        fuzzy_matches = KeywordMatchService.fuzzy_match(resume_skills, expanded_keywords)
 
        # COMBINE
        final = sorted(list(set(exact_matches + fuzzy_matches)))
        return final
 
 