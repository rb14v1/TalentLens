import uuid
import io
import os
import re
import traceback
import json
from typing import List, Dict

import fitz  # PyMuPDF
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import redirect
from botocore.exceptions import ClientError
from urllib.parse import unquote, urlparse
import requests
import hashlib

# services 
from .services.s3_service import upload_resume_to_s3, list_pdfs, get_pdf_bytes, get_presigned_url, s3, BUCKET
from .services.extract_data import extract_fields
from .services.embedding_service import get_text_embedding
from .services.qdrant_service import (
    qdrant_client,
    upsert_point,
    search_collection,
    get_all_points,
    delete_point,
    retrieve_point,
    find_point_by_filename,
    find_points_by_hashes
)
from .services.pdf_parser import extract_text_from_pdf_bytes, parse_resume as simple_parse_resume
from .services.jd_keyword_service import extract_jd_keywords, match_resume_to_jd
from qdrant_client.http import models
from .services.qdrant_service import search_collection
from .models import ConfirmedMatch
from django.db import IntegrityError
from resume.services.keyword_match_service import KeywordMatchService
from qdrant_client.http.models import MatchAny



# ============================
# NEW: Utility function to split and deduplicate skills
# ============================
def _split_skills(lines: list) -> list:
    """Split skills by comma or semicolon and remove exact duplicates."""
    items = []
    for line in lines:
        line = str(line)
        tokens = re.split(r"[;,]", line)
        for token in tokens:
            skill = token.strip()
            if skill:
                items.append(skill)

    # Remove exact duplicates (case-insensitive)
    seen = set()
    result = []
    for skill in items:
        key = skill.lower()
        if key not in seen:
            seen.add(key)
            result.append(skill)

    return result

def _normalize_filename(fn: str) -> str:
    """
    Normalization used across upload/check/migration:
      - strip whitespace
      - collapse internal whitespace
      - strip leading/trailing dots/spaces
      - lowercase (for deterministic id)
    Returns normalized lowercase string (suitable for uuid5).
    """
    if not fn:
        return ""
    s = fn.strip()
    s = re.sub(r"\s+", " ", s)
    s = s.strip(". ")
    return s.lower()


def _filename_to_point_id(fn: str) -> str:
    """
    Convert a filename (string) to a deterministic UUID string (UUID5).
    Falls back to a random UUID if something goes wrong.
    """
    try:
        normalized = _normalize_filename(fn)
        if not normalized:
            return str(uuid.uuid4())
        # We need uuid to be imported, so let's make sure it is at the top
        # (Your file already has 'import uuid' at the top, so this is fine)
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, normalized))
    except Exception:
        return str(uuid.uuid4())

# -----------------------------
# Home
# -----------------------------
def home(request):
    return HttpResponse("Welcome to ProMatch Resume Portal!")


# -----------------------------
# Upload endpoint (class based)
# -----------------------------
# ============================================================
# ✅ Resume Upload (FIXED)
# ============================================================
class ResumeUploadView(APIView):
    """
    Handles multi-file multipart-form uploads from the frontend.
    Duplicate detection and identity are based ONLY on the uploaded filename (normalized).
    """

    def post(self, request, *args, **kwargs):
        # ✅ matches Upload.jsx
        resume_files = request.FILES.getlist("resume_file")
        if not resume_files:
            return Response({"error": "No resume files provided"}, status=status.HTTP_400_BAD_REQUEST)

        if len(resume_files) > 25:
            return Response(
                {"error": "You can upload a maximum of 25 resumes at a time."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ✅ NEW: extra metadata for this batch
        salary = request.data.get("salary")
        salary_currency = request.data.get("salary_currency")
        candidate_type = request.data.get("candidate_type")

        uploaded_results = []
        skipped_duplicates = []
        errors = []

        qc = qdrant_client

        for resume_file in resume_files:
            try:
                incoming_name = (resume_file.name or "").strip()
                if not incoming_name:
                    errors.append(f"{resume_file.name or 'unknown'}: missing filename")
                    continue

                readable_file_name = incoming_name
                normalized_key = _normalize_filename(readable_file_name)

                # === Filename-only duplicate check ===
                is_duplicate = False
                try:
                    if qc:
                        variants = {
                            readable_file_name,
                            readable_file_name.lower(),
                            f"resumes/{readable_file_name}",
                            f"resumes/{readable_file_name.lower()}",
                        }
                        for v in variants:
                            try:
                                fil = models.Filter(
                                    must=[
                                        models.FieldCondition(
                                            key="readable_file_name",
                                            match=models.MatchValue(value=v),
                                        )
                                    ]
                                )
                                recs, _ = qc.scroll(
                                    collection_name="resumes",
                                    scroll_filter=fil,
                                    limit=1,
                                )
                                if recs and len(recs) > 0:
                                    is_duplicate = True
                                    break
                            except Exception as e:
                                print(f"⚠️ filename duplicate variant check failed for '{v}': {e}")

                        if (not is_duplicate) and normalized_key:
                            try:
                                probe_id = _filename_to_point_id(normalized_key)
                                recs = qc.retrieve(
                                    collection_name="resumes",
                                    ids=[probe_id],
                                    with_payload=True,
                                )
                                if recs and len(recs) > 0:
                                    is_duplicate = True
                            except Exception:
                                pass
                except Exception as e:
                    print(f"⚠️ filename duplicate check failed for {readable_file_name}: {e}")

                if is_duplicate:
                    skipped_duplicates.append(readable_file_name)
                    print(
                        f"⚠️ Duplicate filename detected (skipping upload for user-facing flow): {readable_file_name}"
                    )
                    continue

                # Read file bytes once
                file_bytes = resume_file.read()
                if not file_bytes:
                    errors.append(f"{readable_file_name}: file empty or unreadable")
                    continue

                # hash
                file_hash = hashlib.sha256(file_bytes).hexdigest()

                s3_buffer = io.BytesIO(file_bytes)
                s3_buffer.name = resume_file.name
                extract_buffer = io.BytesIO(file_bytes)
                extract_buffer.name = resume_file.name

                # Extract fields
                try:
                    extracted_data = extract_fields(extract_buffer)
                except Exception as e:
                    print(f"⚠️ Text extraction failed for {readable_file_name}: {e}")
                    errors.append(f"{readable_file_name}: extraction failed ({str(e)})")
                    continue

                candidate_name = (
                    extracted_data.get("name")
                    or extracted_data.get("candidate_name")
                    or "Unknown"
                )
                candidate_email = (extracted_data.get("email") or "").strip().lower() or None

                # S3 upload
                try:
                    s3_url = upload_resume_to_s3(
                        s3_buffer, resume_file.content_type, candidate_name
                    )
                    print(f"✅ Uploaded to S3: {s3_url}")
                except Exception as e:
                    print(f"❌ S3 upload failed for {readable_file_name}: {e}")
                    errors.append(f"{readable_file_name}: s3 upload failed ({str(e)})")
                    continue

                # object/file name
                try:
                    parsed_url = urlparse(s3_url)
                    object_name = parsed_url.path.lstrip("/")
                    stored_file_name = object_name.split("/")[-1] or readable_file_name
                except Exception:
                    stored_file_name = readable_file_name

                # Embedding
                resume_text = extracted_data.get("resume_text", "") or extracted_data.get(
                    "text", ""
                )
                try:
                    embedding = get_text_embedding(resume_text)
                except Exception as e:
                    print(f"⚠️ Embedding generation failed for {readable_file_name}: {e}")
                    errors.append(f"{readable_file_name}: embedding failed ({str(e)})")
                    continue

                extracted_skills = extracted_data.get("skills", []) or []

                # ✅ payload now also carries salary + currency + candidate_type
                payload = {
                    "s3_url": s3_url,
                    "candidate_name": candidate_name,
                    "email": candidate_email,
                    "file_hash": file_hash,
                    "file_name": stored_file_name,
                    "readable_file_name": readable_file_name,
                    "experience_years": extracted_data.get("experience_years"),
                    "cpd_level": extracted_data.get("cpd_level"),
                    "skills": extracted_skills,
                    "resume_text": resume_text,
                    "salary": float(salary) if salary else None,
                    "salary_currency": salary_currency or None,
                    "candidate_type": (candidate_type or "external").lower(),
                }

                # Deterministic UUID id
                try:
                    point_id = _filename_to_point_id(normalized_key)
                except Exception:
                    point_id = str(uuid.uuid4())

                # Upsert
                try:
                    upsert_point(point_id, embedding, payload)
                    uploaded_results.append(
                        {"point_id": point_id, "file": readable_file_name}
                    )
                    print(f"✅ Saved to Qdrant: {point_id} ({readable_file_name})")
                except Exception as e:
                    print(f"❌ Qdrant upsert failed for {readable_file_name}: {e}")
                    errors.append(
                        f"{readable_file_name}: qdrant upsert failed ({str(e)})"
                    )
                    continue

            except Exception as e:
                print(f"❌ Unexpected error processing {resume_file.name}: {e}")
                errors.append(f"{resume_file.name}: unexpected error ({str(e)})")
                continue

        # Final responses
        if not uploaded_results and skipped_duplicates:
            return Response(
                {
                    "message": "All provided resumes already exist (by filename).",
                    "duplicates": skipped_duplicates,
                    "uploaded_count": 0,
                    "errors": errors,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "message": "Upload complete!",
                "uploaded_count": len(uploaded_results),
                "skipped_duplicates": skipped_duplicates,
                "uploaded_data": uploaded_results,
                "errors": errors,
            },
            status=status.HTTP_201_CREATED if uploaded_results else status.HTTP_200_OK,
        )

 
# -----------------------------
# Search endpoint (kept largely as-is)
# -----------------------------
from qdrant_client.http import models  # used for filter building
 
SYNONYM_MAP = {
    'script': ['python', 'bash', 'powershell', 'perl', 'ruby', 'javascript'],
    'language': ['python', 'java', 'c++', 'javascript', 'go'],
    'database': ['sql', 'postgres', 'mysql', 'oracle', 'mongodb'],
    'cloud': ['aws', 'azure', 'gcp'],
}


# ============================================================
# Search Resume (Fixed: Aligned with Dashboard filters)
# ============================================================
# ============================================================

# Resume Search + Filtering (ATS scoring + CPD + experience)

# ============================================================

class ResumeSearchView(APIView):
 
    def post(self, request, *args, **kwargs):

        query = request.data.get("query", "")

        filters = request.data.get("filters", {}) or {}
 
        if not query:

            return Response({"error": "Search query required"}, status=400)
 
        # Extract filters

        filter_cpd = filters.get("cpd_level")

        filter_exp = filters.get("experience_years")

        filter_skills = filters.get("skills", [])
 
        # ------------------------------------------------------------

        # 1) Extract raw keywords + dependency-expanded search set

        # ------------------------------------------------------------

        raw_keywords = KeywordMatchService.extract_keywords(query)

        expanded_keywords = KeywordMatchService.expand_dependencies(raw_keywords)
 
        print("\n🔍 Expanded search keywords:", expanded_keywords)
 
        # ------------------------------------------------------------

        # 2) SEMANTIC EMBEDDING

        # ------------------------------------------------------------

        try:

            query_embedding = get_text_embedding(query)

        except Exception as e:

            return Response({"error": f"Embedding failed: {e}"}, status=500)
 
        # ------------------------------------------------------------

        # 3) QDRANT SEARCH

        # ------------------------------------------------------------

        try:

            results = search_collection(query_embedding, limit=200)

        except Exception as e:

            return Response({"error": f"Qdrant search error: {e}"}, status=500)
 
        final_results = []
 
        # ------------------------------------------------------------

        # 4) ATS MATCHING + FILTERS

        # ------------------------------------------------------------

        import math
 
        for match in results:

            payload = match.payload or {}
 
            # ==============================================

            # ✔ FILTER 1: CPD LEVEL

            # ==============================================

            if filter_cpd:

                resume_cpd = payload.get("cpd_level")

                if not resume_cpd or str(resume_cpd) != str(filter_cpd):

                    continue  # skip this candidate
 
            # ==============================================

            # ✔ FILTER 2: EXPERIENCE

            # ==============================================

            if filter_exp:

                try:

                    exp_years = int(payload.get("experience_years", 0))

                except:

                    exp_years = 0
 
                if exp_years < int(filter_exp):

                    continue
 
            # ==============================================

            # ✔ FILTER 3: REQUIRED SKILLS

            # ==============================================

            if filter_skills:

                resume_skills = payload.get("skills", [])

                if isinstance(resume_skills, str):

                    resume_skills = [resume_skills]
 
                # Ensure all required skills appear

                missing = [

                    skill for skill in filter_skills

                    if skill.lower() not in [s.lower() for s in resume_skills]

                ]
 
                if missing:

                    continue
 
            # ============================================================

            # ATS SCORING SYSTEM (Keyword Ratio + Semantic + Experience)

            # ============================================================

            resume_skills = payload.get("skills", [])

            if isinstance(resume_skills, str):

                resume_skills = [resume_skills]
 
            matched_keywords = KeywordMatchService.get_matched_keywords(

                resume_skills, query

            )
 
            matched_count = len(matched_keywords)

            total_required = len(expanded_keywords) if expanded_keywords else 1

            keyword_ratio = matched_count / total_required
 
            # ---- SEMANTIC normalization ----

            sem_raw = float(match.score or 0.0)

            if not math.isfinite(sem_raw) or sem_raw < 0:

                sem_raw = 0.0

            semantic_norm = max(min(sem_raw, 1.0), 0.0)
 
            # ---- EXPERIENCE normalization ----

            try:

                exp_raw = float(payload.get("experience_years") or 0)

            except:

                exp_raw = 0

            experience_norm = min(exp_raw / 10.0, 1.0)
 
            # ---- ATS WEIGHTS ----

            W_KEYWORD = 0.60

            W_SEMANTIC = 0.35

            W_EXPERIENCE = 0.05
 
            combined = (

                W_KEYWORD * keyword_ratio +

                W_SEMANTIC * semantic_norm +

                W_EXPERIENCE * experience_norm

            )
 
            final_pct = round(max(min(combined, 1.0), 0.0) * 100, 2)
 
            # Build response entry

            final_results.append({

                "id": match.id,

                "score": final_pct,

                "semantic_raw": round(semantic_norm, 4),

                "keyword_ratio": round(keyword_ratio, 4),

                "matched_keywords": matched_keywords,

                "matched_count": matched_count,

                "total_required": total_required,

                "data": payload

            })
 
        # SORT by score descending

        final_results.sort(key=lambda x: x["score"], reverse=True)
 
        return Response({"results": final_results}, status=200)

 
 


# -----------------------------
# List resumes (Qdrant)
# -----------------------------


class ResumeListView(APIView):
    def get(self, request):
        try:
            source = request.query_params.get("source", "qdrant").lower()
            
            if source == "s3":
                # List objects from S3 directly
                formatted_results = []
                try:
                    all_keys = list_pdfs(prefix="resumes/")
                    for key in all_keys:
                        if not key: continue
                        
                        file_name = os.path.basename(key)
                        
                        # ✅ CHANGE: Use the actual filename as the ID. 
                        # This allows DeleteView to know exactly what file to target.
                        formatted_results.append({
                            "id": file_name, # <--- Critical Fix: ID is now the filename
                            "candidate_name": os.path.splitext(file_name)[0].replace("_", " ").title(),
                            "email": None,
                            "experience_years": None,
                            "cpd_level": None,
                            "skills": [],
                            "s3_url": f"https://{BUCKET}.s3.amazonaws.com/{key}",
                            "file_name": file_name,
                            "resume_text": None
                        })
                    return Response({"results": formatted_results}, status=status.HTTP_200_OK)
                except Exception as e:
                    traceback.print_exc()
                    return Response({"error": f"Failed to list S3: {str(e)}"}, status=500)

            # Default: Qdrant list
            qdrant_records = get_all_points()
            formatted_results = []
            for record in qdrant_records:
                payload = record.payload or {}
                
                # Robust filename extraction
                file_name = payload.get('file_name') or payload.get('readable_file_name') or payload.get('s3_url', '').split('/')[-1]

                formatted_results.append({
                    'id': record.id,
                    'candidate_name': payload.get('candidate_name'),
                    'email': payload.get('email'),
                    'experience_years': payload.get('experience_years'),
                    'cpd_level': payload.get('cpd_level'),
                    'skills': payload.get('skills', []),
                    's3_url': payload.get('s3_url'),
                    'file_name': file_name,
                    'resume_text': payload.get('resume_text')
                })

            return Response({"results": formatted_results}, status=status.HTTP_200_OK)
        except Exception as e:
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)
        
        

# ============================
# ENHANCED: Fetch all resumes with detailed S3 parsing
# ============================
@api_view(['POST'])
def fetch_all_resumes(request):
    """
    Enhanced version that processes PDFs from S3 with full parsing.
    Includes skill splitting and deduplication.
    """
    print("\n" + "="*60)
    print("=== FETCH_ALL_RESUMES CALLED ===")
    print(f"Request method: {request.method}")
    print(f"Request body: {request.body}")
    print("="*60)
   
    try:
        print("\n[1] Attempting to list PDFs from S3...")
        pdf_keys = list_pdfs()
        print(f"[1] ✅ Found {len(pdf_keys)} PDFs: {pdf_keys[:5]}...")  # Show first 5
       
        if not pdf_keys:
            print("[1] ⚠️ No PDFs found in S3")
            return Response(
                {"message": "No PDF files found in S3.", "data": []},
                status=status.HTTP_200_OK
            )

        processed_resumes = []
        for idx, pdf_key in enumerate(pdf_keys, 1):
            print(f"\n[{idx}/{len(pdf_keys)}] Processing: {pdf_key}")
            try:
                pdf_bytes = get_pdf_bytes(pdf_key)
                print(f"  ✅ Downloaded {len(pdf_bytes)} bytes")
               
                text = extract_text_from_pdf_bytes(pdf_bytes)
                print(f"  ✅ Extracted {len(text)} characters")
               
                resume_data = simple_parse_resume(text)
                print(f"  ✅ Parsed data keys: {list(resume_data.keys())}")

                # Parse all skills correctly using the new utility
                skills_list = _split_skills(resume_data.get("skills", []))
                resume_data["skills"] = skills_list

                # Fallback for name
                file_name = os.path.basename(pdf_key)
                if not resume_data.get("name"):
                    resume_data["name"] = file_name.replace(".pdf", "").replace("_", " ").title()

                processed_resumes.append({
                    "file_name": os.path.basename(pdf_key),
                    "s3_path": f"s3://{BUCKET}/{pdf_key}",
                    **resume_data
                })
                print(f"  ✅ Successfully processed: {resume_data.get('name')}")
               
            except Exception as pdf_error:
                print(f"  ❌ Error processing {pdf_key}: {str(pdf_error)}")
                import traceback
                traceback.print_exc()
                continue

        print(f"\n{'='*60}")
        print(f"✅ Successfully processed {len(processed_resumes)}/{len(pdf_keys)} resumes")
        print(f"{'='*60}\n")
       
        return Response(
            {"message": f"Processed {len(processed_resumes)} resumes.", "data": processed_resumes},
            status=status.HTTP_200_OK
        )

    except Exception as e:
        print(f"\n❌ CRITICAL ERROR in fetch_all_resumes: {str(e)}")
        import traceback
        traceback.print_exc()
       
        return Response(
            {"detail": f"Error: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================
# ENHANCED: Filter resumes with improved matching
# ============================
@api_view(['GET'])
def filter_resumes(request):
    """
    Filter resumes by specific criteria (CPD, Experience, Skill).
    Used when clicking on Dashboard charts.
    Queries Qdrant directly for fast, accurate results.
    """
    print("=== FILTER_RESUMES (QDRANT) CALLED ===")
    try:
        cpd_level = request.query_params.get('cpd_level')
        skill = request.query_params.get('skill')
        # The dashboard sends "10+ yrs", "0-2 yrs", etc.
        experience_bucket = request.query_params.get('experience') 

        print(f"Filters: CPD={cpd_level}, Skill={skill}, Exp={experience_bucket}")

        must_conditions = []

        # 1. CPD Filter
        if cpd_level:
            try:
                val = int(cpd_level)
                must_conditions.append(models.FieldCondition(
                    key="cpd_level", match=models.MatchValue(value=val)
                ))
            except: pass

        # 2. Experience Filter
        if experience_bucket:
            # Logic must match 'analytics_overview' exactly
            if experience_bucket in ["0-2", "0-2 yrs"]:
                must_conditions.append(models.FieldCondition(key="experience_years", range=models.Range(gte=0, lte=2)))
            elif experience_bucket in ["3-5", "3-5 yrs"]:
                must_conditions.append(models.FieldCondition(key="experience_years", range=models.Range(gte=3, lte=5)))
            elif experience_bucket in ["6-10", "6-10 yrs"]:
                must_conditions.append(models.FieldCondition(key="experience_years", range=models.Range(gte=6, lte=10)))
            elif experience_bucket in ["10+", "10+ yrs"]:
                # Matches >10 (so 11 and up)
                must_conditions.append(models.FieldCondition(key="experience_years", range=models.Range(gte=11)))

        # 3. Skill Filter
        if skill:
            # Search the 'skills' list in Qdrant
            must_conditions.append(models.FieldCondition(
                key="skills", match=models.MatchAny(any=[skill.lower()])
            ))

        # Execute Search
        query_filter = models.Filter(must=must_conditions) if must_conditions else None
        
        # We use a zero vector because we only care about the filter, not semantic similarity
        dummy_vector = [0.0] * 384 
        
        # Search limit 100 to show plenty of results
        results = search_collection(dummy_vector, query_filter=query_filter, limit=100)

        formatted_results = []
        for match in results:
            p = match.payload or {}
            
            # Extract filename securely
            file_name = p.get('file_name') or p.get('readable_file_name') or p.get('s3_url', '').split('/')[-1]

            formatted_results.append({
                'id': match.id,
                'candidate_name': p.get('candidate_name', 'Unknown'),
                'email': p.get('email', 'N/A'),
                'experience_years': p.get('experience_years', 0),
                'cpd_level': p.get('cpd_level', 0),
                'skills': p.get('skills', []),
                's3_url': p.get('s3_url', ''),
                'file_name': file_name,
                'resume_text': p.get('resume_text', '')
            })

        print(f"✅ Found {len(formatted_results)} matches.")
        return Response({"results": formatted_results}, status=status.HTTP_200_OK)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)



# ============================
# ENHANCED: View resume with advanced highlighting
# ============================
@api_view(['GET'])
def view_resume(request):
    """
    View a resume PDF.
    Returns an HTML page that embeds the PDF from S3.
    This allows window.open() to work correctly on the frontend.
    """
    print("=== VIEW_RESUME (HTML) CALLED ===")
    file_name = request.query_params.get('file_name', None)
    
    if not file_name:
        return Response({"detail": "file_name parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Clean filename
    file_name_unquoted = unquote(str(file_name))
    if not file_name_unquoted.lower().endswith(".pdf"):
        file_name_unquoted = f"{file_name_unquoted}.pdf"

    # Find the file in S3
    candidate_keys = [file_name_unquoted]
    if not file_name_unquoted.startswith("resumes/"):
        candidate_keys.append(f"resumes/{file_name_unquoted}")

    found_key = None
    try:
        for key in candidate_keys:
            s3.head_object(Bucket=BUCKET, Key=key)
            found_key = key
            break
    except ClientError:
        pass 

    # Fallback search
    if not found_key:
        try:
            all_keys = list_pdfs(prefix="resumes/")
            basename = os.path.basename(file_name_unquoted).lower()
            for k in all_keys:
                if os.path.basename(k).lower() == basename:
                    found_key = k
                    break
        except Exception:
            pass

    if not found_key:
        return Response({"detail": "Resume not found in S3"}, status=status.HTTP_404_NOT_FOUND)

    try:
        # 1. Get secure S3 URL
        presigned_s3_url = get_presigned_url(found_key, expires_in=3600)
        
        # 2. Return HTML wrapper (so the tab shows the filename)
        clean_name = os.path.basename(found_key)
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{clean_name}</title>
            <style>
                body, html {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }}
                embed {{ width: 100%; height: 100%; }}
            </style>
        </head>
        <body>
            <embed src="{presigned_s3_url}" type="application/pdf">
        </body>
        </html>
        """
        return HttpResponse(html_content, content_type='text/html')

    except Exception as e:
        print(f"❌ Error in view_resume: {e}")
        return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

# -----------------------------
# Proxy + Validate helpers
# -----------------------------
def proxy_resume(request):
    file_url = request.GET.get("file_url")
    if not file_url:
        return JsonResponse({"error": "Missing file_url parameter"}, status=400)
    try:
        response = requests.get(file_url, stream=True, timeout=10)
        response.raise_for_status()
        pdf_data = response.content
        return HttpResponse(pdf_data, content_type="application/pdf")
    except requests.exceptions.RequestException as e:
        traceback.print_exc()
        return JsonResponse({"error": f"Failed to fetch PDF: {str(e)}"}, status=500)


@csrf_exempt
def validate_word(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    try:
        body = request.body.decode("utf-8")
        import json
        data = json.loads(body)
        word = data.get("query", "").strip().lower()
        if not word:
            return JsonResponse({"valid": False})
        # Basic heuristics validation (expand if you have Gemini)
        if len(word) <= 1:
            return JsonResponse({"valid": False})
        return JsonResponse({"valid": True})
    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"error": str(e), "valid": False}, status=500)


# -----------------------------
# Utility: fetch single Qdrant record by id (used by detail endpoint)
# -----------------------------
def _get_qdrant_record_by_id(qdrant_id: str):
    """
    Simple helper: fetch all points (should be fast for moderate dataset) and find id match.
    If you have a direct qdrant service helper to fetch by id, replace this implementation.
    """
    try:
        points = get_all_points()
        for p in points:
            if str(p.id) == str(qdrant_id):
                return p
        return None
    except Exception:
        traceback.print_exc()
        return None


# -----------------------------
# Resume detail (by qdrant id)
# -----------------------------
# class ResumeDetailView(APIView):
#     def get(self, request, pk):
#         try:
#             record = _get_qdrant_record_by_id(pk)
#             if not record:
#                 return Response({"detail": "Resume not found"}, status=status.HTTP_404_NOT_FOUND)
#             payload = record.payload or {}
#             data = {
#                 "id": record.id,
#                 "candidate_name": payload.get("candidate_name"),
#                 "email": payload.get("email"),
#                 "experience_years": payload.get("experience_years"),
#                 "cpd_level": payload.get("cpd_level"),
#                 "skills": payload.get("skills", []),
#                 "s3_url": payload.get("s3_url"),
#                 "resume_text": payload.get("resume_text"),
#                 "file_name": payload.get("file_name"),
#                 "year_joined": payload.get("year_joined"),
#             }
#             return Response({"data": data}, status=status.HTTP_200_OK)
#         except Exception as e:
#             traceback.print_exc()
#             return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ============================================================
# ✅ Delete Resume (Strict Version)
# ============================================================
# In Backend/resume/views.py

class ResumeDeleteView(APIView):
    def delete(self, request, id):
        if not id:
            return Response({'error': 'No ID provided'}, status=400)

        try:
            object_key = None
            candidate_name = "Unknown File"
            point_id_to_delete = None
            record = None

            # 1. Check if ID is a UUID (Qdrant ID) or a Filename
            is_uuid = False
            try:
                uuid.UUID(str(id))
                is_uuid = True
            except ValueError:
                is_uuid = False

            if is_uuid:
                # It's a UUID, find it in the database
                try:
                    record = retrieve_point(id)
                    point_id_to_delete = id
                except:
                    pass
            else:
                # It's a filename (e.g., "Anika.pdf"), so set the key directly
                object_key = f"resumes/{id}"
                candidate_name = id
                
                # Try to find the UUID for this file so we can delete it from DB too
                try:
                    # Calculate the UUID based on the filename
                    point_id_to_delete = _filename_to_point_id(id)
                except:
                    pass

            # 2. If we found a DB record, get S3 info from it
            if record:
                payload = record.payload or {}
                s3_url = payload.get('s3_url')
                file_name = payload.get('file_name')
                candidate_name = payload.get('candidate_name', 'Candidate')
                
                if s3_url:
                    try:
                        parsed = urlparse(s3_url)
                        object_key = parsed.path.lstrip('/')
                    except:
                        pass
                
                if not object_key and file_name:
                    object_key = f"resumes/{file_name}"

            # 3. Execute S3 Delete
            if object_key:
                try:
                    s3.head_object(Bucket=BUCKET, Key=object_key)
                    s3.delete_object(Bucket=BUCKET, Key=object_key)
                    print(f"🗑️ Deleted from S3: {object_key}")
                except ClientError as e:
                    if e.response['Error']['Code'] == "404":
                        print(f"⚠️ File not found in S3 (already deleted?): {object_key}")
                    else:
                        print(f"❌ S3 Error: {e}")

            # 4. Execute Qdrant Delete
            if point_id_to_delete:
                try:
                    delete_point(point_id_to_delete)
                    print(f"✅ Deleted from Qdrant: {point_id_to_delete}")
                except Exception as e:
                    print(f"⚠️ Qdrant delete failed: {e}")

            return Response({"message": f"Deleted {candidate_name}"}, status=200)

        except Exception as e:
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)
                


@api_view(['GET'])
def analytics_overview(request):
    try:
        records = get_all_points()

        # Initialize with 0s
        cpd_levels = {str(i): 0 for i in range(1, 7)}
        experience = {
            "0-2 yrs": 0,
            "3-5 yrs": 0,
            "6-10 yrs": 0,
            "10+ yrs": 0
        }
        skill_counts = {}

        print(f"📊 ANALYTICS: Processing {len(records)} records...")

        for rec in records:
            p = rec.payload or {}

            # CPD
            cpd = p.get("cpd_level")
            if cpd:
                cpd_str = str(cpd)
                if cpd_str in cpd_levels:
                    cpd_levels[cpd_str] += 1

            # EXPERIENCE
            # Robust extraction: handles strings, ints, and floats
            raw_exp = p.get("experience_years")
            if raw_exp is not None:
                try:
                    # Convert to float first to handle "10.5", then int
                    exp = int(float(raw_exp))
                    
                    if exp <= 2: bucket = "0-2 yrs"
                    elif exp <= 5: bucket = "3-5 yrs"
                    elif exp <= 10: bucket = "6-10 yrs"
                    else: bucket = "10+ yrs"
                    
                    experience[bucket] += 1
                    print(f"  - Found {exp} years -> {bucket}") # Debug print
                except (ValueError, TypeError):
                    print(f"  - ⚠️ Invalid experience value: {raw_exp}")
                    pass 

            # SKILLS
            skills = p.get("skills", [])
            for s in skills:
                s = str(s).strip().lower()
                if s:
                    skill_counts[s] = skill_counts.get(s, 0) + 1

        print(f"✅ Experience Data: {experience}")

        return Response({
            "cpd_levels": cpd_levels,
            "experience": experience,
            "skills": dict(sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:20])
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)
    

# ====================================================================
# ✅ NEW JD MATCHING ENDPOINTS
# ====================================================================

@csrf_exempt
@api_view(['POST'])
def extract_jd(request):
    """
    Extract keywords from Job Description PDF.
    
    Endpoint: POST /api/skill-analytics/extract_jd/
    Payload: multipart/form-data with 'jd_file'
    Response: { jd_text, keywords: [...], keyword_count }
    """
    print("\n" + "="*60)
    print("=== EXTRACT_JD CALLED ===")
    
    try:
        # Get JD file from request
        jd_file = request.FILES.get('jd_file')
        if not jd_file:
            return Response(
                {'error': 'No JD file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Read file content
        file_content = jd_file.read()
        
        # Extract text from PDF
        try:
            jd_text = extract_text_from_pdf_bytes(file_content)
            print(f"✅ Extracted {len(jd_text)} characters from JD")
        except Exception as e:
            print(f"❌ Failed to extract PDF: {e}")
            return Response(
                {'error': f'Failed to extract PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Extract keywords from JD text
        try:
            keywords = extract_jd_keywords(jd_text, top_k=25)
            print(f"✅ Extracted {len(keywords)} keywords")
        except Exception as e:
            print(f"❌ Failed to extract keywords: {e}")
            return Response(
                {'error': f'Failed to extract keywords: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        print("="*60 + "\n")
        
        return Response({
            'jd_text': jd_text,
            'keywords': keywords,
            'keyword_count': len(keywords)
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        print(f"❌ CRITICAL ERROR: {e}")
        traceback.print_exc()
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


import re
import traceback
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

# Make sure these helper functions are imported/defined in this module:
# - extract_text_from_pdf_bytes(file_bytes)
# - extract_jd_keywords(text, top_k=25)
# - get_all_points() # returns list of qdrant points/objects with .payload and .id
# - match_resume_to_jd(resume_skills, jd_keywords) -> returns dict with keys: match_percentage, matched, missing, match_count, total_required

@csrf_exempt
@api_view(['POST'])
def jd_match(request):
    """
    Match all resumes in Qdrant against a Job Description.
    """
    print("\n" + "="*60)
    print("=== JD_MATCH CALLED ===")
    
    jd_text = None
    jd_keywords = []


    # ===== JD SALARY RANGE =====
    salary_str = request.data.get("salary") or request.POST.get("salary")
    jd_min_salary = jd_max_salary = None
    if salary_str:
        parts = (
            salary_str.replace("–", "-")
            .replace("—", "-")
            .split("-")
        )
        try:
            if len(parts) == 2:
                jd_min_salary = float(parts[0].strip())
                jd_max_salary = float(parts[1].strip())
            else:
                jd_min_salary = float(parts[0].strip())
                jd_max_salary = jd_min_salary
        except (TypeError, ValueError):
            jd_min_salary = jd_max_salary = None


    # ===== Experience extraction defaults =====
    required_experience = 0
    EXPERIENCE_WEIGHT = 20


    try:
        # ===== STEP 1: Get JD text =====
        jd_file = request.FILES.get('jd_file')
        if jd_file:
            print("[1] Processing uploaded JD file...")
            try:
                file_content = jd_file.read()
                jd_text = extract_text_from_pdf_bytes(file_content)
                print(f"✅ Extracted {len(jd_text)} chars from PDF")
            except Exception as e:
                print(f"❌ PDF extraction failed: {e}")
                return Response(
                    {'error': f'PDF extraction failed: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        elif request.data and 'jd_text' in request.data:
            print("[1] Processing raw JD text...")
            jd_text = request.data.get('jd_text', '')
        
        if not jd_text:
            return Response(
                {'error': 'No JD file or text provided'},
                status=status.HTTP_400_BAD_REQUEST
            )


        # ===== AUTO-SALARY EXTRACTION =====
        if jd_min_salary is None and jd_max_salary is None and jd_text:
            try:
                import re
                jt = jd_text.lower()
                jt_norm = jt.replace("₹", " ").replace("rs.", " ").replace("rs", " ").replace("inr", " ")


                strict_range = re.compile(r'(\d{5,}(?:[,\d]*\d)?)\s*[-–—]\s*(\d{5,}(?:[,\d]*\d)?)')
                single_pattern = re.compile(r'(\d{5,}(?:[,\d]*\d)?)')


                m = strict_range.search(jt_norm)
                if m:
                    jd_min_salary = float(m.group(1).replace(",", ""))
                    jd_max_salary = float(m.group(2).replace(",", ""))
                else:
                    m2 = single_pattern.search(jt_norm)
                    if m2:
                        v = float(m2.group(1).replace(",", ""))
                        jd_min_salary = jd_max_salary = v


            except Exception as ex:
                print("⚠️ Salary extraction failed:", ex)


        # ===== ✅ IMPROVED EXPERIENCE EXTRACTION FROM JD =====
        try:
            import re as _re
            
            # Pattern 1: "3-5 years Exp" or "3 - 5 years experience"
            range_pattern = r"(\d+)\s*[-–—]\s*(\d+)\s*years?\s*(?:exp|experience)"
            m_range = _re.search(range_pattern, jd_text, flags=_re.IGNORECASE)
            
            if m_range:
                required_experience = int(m_range.group(1))  # Take minimum value
                print(f"🟩 REQUIRED EXPERIENCE FOUND (range): {m_range.group(1)}-{m_range.group(2)} years, using minimum: {required_experience}")
            else:
                # Pattern 2: "Experience: 5 years" or "5+ years experience"
                exp_patterns = [
                    r"[Ee]xperience[:\s]+(\d+)\+?\s*years?",
                    r"(\d+)\+?\s*years?\s+(?:of\s+)?experience",
                    r"minimum\s+of\s+(\d+)\s*years?",
                    r"at\s+least\s+(\d+)\s*years?",
                    r"(\d+)\s*years?\s*(?:exp|experience)"
                ]
                
                for pattern in exp_patterns:
                    mm = _re.search(pattern, jd_text, flags=_re.IGNORECASE)
                    if mm:
                        required_experience = int(mm.group(1))
                        print(f"🟩 REQUIRED EXPERIENCE FOUND: {required_experience} years")
                        break
        except Exception as ex:
            print(f"⚠️ Experience extraction error: {ex}")
            required_experience = 0


        # ===== STEP 2: Extract keywords =====
        print("[2] Extracting JD keywords...")
        jd_keywords = extract_jd_keywords(jd_text, top_k=25)


        # ===== STEP 3: Fetch resumes =====
        print("[3] Fetching resumes...")
        all_resumes = get_all_points()


        # ===== STEP 4: Match resumes =====
        matches = []
        
        for idx, resume in enumerate(all_resumes, 1):
            try:
                payload = resume.payload or {}
                resume_skills = payload.get('skills', [])
                if isinstance(resume_skills, str):
                    resume_skills = [resume_skills]


                # SALARY FILTER
                resume_salary = payload.get("salary")
                if jd_max_salary is not None and resume_salary is not None:
                    try:
                        rs = float(str(resume_salary).replace(",", "").strip())
                        if rs > jd_max_salary:
                            continue
                    except:
                        continue


                # SKILL MATCHING
                match_result = match_resume_to_jd(resume_skills, jd_keywords)


                # EXPERIENCE MATCH
                try:
                    experience_years = int(payload.get('experience_years') or 0)
                except:
                    experience_years = 0


                if required_experience > 0:
                    if experience_years >= required_experience:
                        experience_match_score = EXPERIENCE_WEIGHT
                    else:
                        shortfall = required_experience - experience_years
                        penalty = min(shortfall * 5, EXPERIENCE_WEIGHT)
                        experience_match_score = EXPERIENCE_WEIGHT - penalty
                else:
                    experience_match_score = EXPERIENCE_WEIGHT


                # ===== ✅ FIXED SCORING LOGIC =====
                # Get skill percentage from match_result
                skill_pct = match_result.get('match_percentage', 0) or 0
                
                # 🔥 FIX: Normalize skill percentage to max 100% BEFORE calculation
                skill_pct_norm = min(skill_pct, 100.0)
                
                # Calculate final match percentage using normalized skill_pct
                # Skill contributes (100 - EXPERIENCE_WEIGHT)% and experience contributes EXPERIENCE_WEIGHT%
                final_match_pct = (skill_pct_norm * (100 - EXPERIENCE_WEIGHT) / 100.0) + experience_match_score
                
                # Round to 2 decimal places
                final_match_pct = round(float(final_match_pct), 2)
                # ===== END FIXED SCORING LOGIC =====


                # BUILD CANDIDATE DATA
                file_name = (
                    payload.get('file_name')
                    or payload.get('readable_file_name')
                    or payload.get('s3_url', '').split('/')[-1]
                )


                candidate_data = {
                    'id': resume.id,
                    'candidate_name': payload.get('candidate_name', 'Unknown'),
                    'email': payload.get('email', 'N/A'),
                    'experience_years': experience_years,
                    'required_experience': required_experience,  # ✅ Include in each resume
                    'experience_match_score': experience_match_score,
                    'skills': resume_skills,
                    'match_percentage': final_match_pct,
                    'matched_skills': match_result['matched'],
                    'missing_skills': match_result['missing'],
                    'match_count': match_result['match_count'],
                    'total_required': match_result['total_required'],
                    's3_url': payload.get('s3_url', ''),
                    'file_name': file_name,
                    'resume_text': payload.get('resume_text', ''),
                    'salary': payload.get('salary'),
                    'salary_currency': payload.get('salary_currency'),
                    'candidate_type': payload.get('candidate_type'),
                }
                
                matches.append(candidate_data)


            except Exception as e:
                print(f"⚠️ Error processing resume {idx}: {e}")
                continue
        
        # Sort by match percentage descending
        matches.sort(key=lambda x: x['match_percentage'], reverse=True)
        
        return Response({
            'jd_text': jd_text,
            'jd_keywords': jd_keywords,
            'required_experience_min': required_experience,
            'required_experience_max': None,
            'matches': matches,
            'total_matches': len(matches),
            'success': True,
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        print(f"❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': str(e), 'success': False},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================
# ✅ Check for Duplicate Resumes by Hash
# ============================================================
@csrf_exempt
def check_hashes(request):
    """
    Check if a list of file hashes already exists in Qdrant.
    Expects JSON: {"hashes": ["hash1", "hash2", ...]}
    Returns: {"existing_hashes": ["hash1", ...]}
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST method required"}, status=405)
    
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
        hashes_to_check = payload.get("hashes", [])
        
        if not isinstance(hashes_to_check, list) or not hashes_to_check:
            return JsonResponse({"error": "Invalid payload, 'hashes' list is required."}, status=400)
        
        existing_hashes = find_points_by_hashes(hashes_to_check)
        
        return JsonResponse({"existing_hashes": list(existing_hashes)}, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)
    except Exception as e:
        print(f"❌ Hash check view error: {e}")
        return JsonResponse({"error": f"An error occurred: {str(e)}"}, status=500)
    

# ====================================================================
# USER AUTH: Register + Login (Using AppUser)
# ====================================================================
from .models import AppUser
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
 
@csrf_exempt
def register_user(request):
    """Register a new user (Manager, Recruiter, Hiring Manager)."""
    if request.method != "POST":
        return JsonResponse({"error": "POST request required"}, status=400)
 
    try:
        data = json.loads(request.body)
 
        name = data.get("name")
        email = data.get("email")
        password = data.get("password")
        role = data.get("role")
        department = data.get("department")  # ✅ Get department from request
 
        # Validate required fields
        if not all([name, email, password, role]):
            return JsonResponse({"error": "All fields are required"}, status=400)
 
        # Check if email already exists
        if AppUser.objects.filter(email=email).exists():
            return JsonResponse({"error": "Email already exists"}, status=400)
 
        # Validate hiring manager has department
        if role == "hiring_manager" and not department:
            return JsonResponse({"error": "Department is required for hiring managers"}, status=400)
 
        # Set department to None for non-hiring managers
        if role in ["recruiter", "manager"]:
            department = None
 
        # Create user with department
        user = AppUser(
            name=name,
            email=email,
            password=password,
            role=role,
            department=department  # ✅ Save department
        )
        user.save()
 
        return JsonResponse({"message": "Registered successfully"}, status=201)
 
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
 
 
# In Backend/resume/views.py

# ... existing imports ...

@csrf_exempt
def login_user(request):
    """Login user and return their role for redirect."""
    if request.method != "POST":
        return JsonResponse({"error": "POST request required"}, status=400)
 
    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")
 
        user = AppUser.objects.filter(email=email).first()
 
        if user is None:
            return JsonResponse({"error": "Invalid email"}, status=400)
 
        if not user.check_password(password):
            return JsonResponse({"error": "Invalid password"}, status=400)
 
        # ✅ CRITICAL FIX: Save User ID to session
        # This creates the cookie so the server remembers you
        request.session['user_id'] = user.id
        request.session.modified = True

        return JsonResponse({
            "role": user.role,
            "name": user.name,
            "department": user.department,
            "message": "Login successful"
        })
 
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@api_view(['GET'])
def user_profile(request):
    """
    Fetches the currently logged-in user's profile.
    """
    try:
        # 1. Get User ID from session
        user_id = request.session.get('user_id')
        if not user_id:
            return Response({"error": "Not logged in"}, status=status.HTTP_401_UNAUTHORIZED)

        # 2. Fetch from DB
        user = AppUser.objects.get(id=user_id)

        return Response({
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "department": user.department or "General"
        }, status=status.HTTP_200_OK)

    except AppUser.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

# ==========================================
# API: Confirm Resume Selections
# ==========================================
@csrf_exempt
@api_view(['POST'])
def confirm_resume_matches(request):
    """
    Save recruiter's confirmed resume selections to PostgreSQL.
    
    Request body:
    {
        "jd_id": "uuid",
        "jd_title": "Cloud Software Engineer",
        "jd_department": "Engineering/IT",
        "confirmed_by_email": "recruiter@example.com",
        "resumes": [
            {
                "id": "resume_uuid",
                "name": "Anika Email",
                "email": "anika@version.com",
                "match_score": "58%",
                "matched_skills": ["azure", "skills", "microservices"],
                "experience_years": 12,
                "s3_url": "...",
                "file_name": "..."
            },
            ...
        ]
    }
    """
    print("=== CONFIRM RESUME MATCHES CALLED ===")
    
    try:
        data = request.data
        
        # Get recruiter
        recruiter_email = data.get("confirmed_by_email")
        try:
            recruiter = AppUser.objects.get(email=recruiter_email)
        except AppUser.DoesNotExist:
            return Response({"error": "Recruiter not found"}, status=404)
        
        # Extract JD details
        jd_id = data.get("jd_id")
        jd_title = data.get("jd_title")
        jd_department = data.get("jd_department")
        resumes = data.get("resumes", [])
        
        if not jd_id or not resumes:
            return Response({"error": "Missing jd_id or resumes"}, status=400)
        
        saved_count = 0
        skipped_count = 0
        
        # Save each confirmed resume
        for resume in resumes:
            try:
                ConfirmedMatch.objects.create(
                    jd_id=jd_id,
                    jd_title=jd_title,
                    jd_department=jd_department,
                    resume_id=resume.get("id"),
                    candidate_name=resume.get("name", "Unknown"),
                    candidate_email=resume.get("email", ""),
                    match_score=resume.get("match_score", ""),
                    matched_skills=resume.get("matched_skills", []),
                    experience_years=resume.get("experience_years", 0),
                    resume_s3_url=resume.get("s3_url", ""),
                    resume_file_name=resume.get("file_name", ""),
                    candidate_type=resume.get("candidate_type", ""),
                    confirmed_by=recruiter
                )
                saved_count += 1
            except IntegrityError:
                # Already exists (duplicate)
                skipped_count += 1
                continue
        
        print(f"✅ Saved {saved_count} matches, skipped {skipped_count} duplicates")
        
        return Response({
            "message": f"Successfully confirmed {saved_count} resume(s)",
            "saved": saved_count,
            "skipped": skipped_count
        }, status=201)
        
    except Exception as e:
        print(f"❌ Error confirming matches: {e}")
        return Response({"error": str(e)}, status=500)


# ==========================================
# API: Get Confirmed Matches for Hiring Manager
# ==========================================
# ==========================================
# API: Get Confirmed Matches for Hiring Manager
# ==========================================
@api_view(['GET'])
def get_confirmed_matches(request):
    """
    Fetch all confirmed resume matches (temporarily NOT filtered by department).
    Groups results by JD so the frontend sees:
    [
      {
        "jd_id": "...",
        "jd_title": "...",
        "jd_department": "...",
        "resumes": [ ... ]
      },
      ...
    ]
    """
    print("=== GET CONFIRMED MATCHES CALLED ===")
 
    try:
        # Still check user is logged in (optional – you can relax this too)
        user_id = request.session.get('user_id')
        if not user_id:
            return Response({"error": "Unauthorized"}, status=401)
 
        user = AppUser.objects.get(id=user_id)
        print(f"🔍 Fetching matches for user: {user.email} ({user.department})")
 
        # ✅ TEMP: show ALL matches, do not filter by department
        matches = (
            ConfirmedMatch.objects
            .all()
            .select_related('confirmed_by')
            .order_by('-confirmed_at')
        )
 
        # Group by JD
        jd_groups = {}
        for match in matches:
            jd_id = match.jd_id
 
            if jd_id not in jd_groups:
                jd_groups[jd_id] = {
                    "jd_id": jd_id,
                    "jd_title": match.jd_title,
                    "jd_department": match.jd_department,
                    "resumes": []
                }
 
            jd_groups[jd_id]["resumes"].append({
                "id": match.id,
                "resume_id": match.resume_id,
                "candidate_name": match.candidate_name,
                "candidate_email": match.candidate_email,
                "match_score": match.match_score,
                "matched_skills": match.matched_skills,
                "experience_years": match.experience_years,
                "resume_s3_url": match.resume_s3_url,
                "resume_file_name": match.resume_file_name,
                "status": match.status,
                "hiring_stage": match.hiring_stage,
                "hiring_stage": match.hiring_stage or "Applied",
                "candidate_type": match.candidate_type,
                "confirmed_at": match.confirmed_at.strftime("%Y-%m-%d %H:%M"),
                "confirmed_by": match.confirmed_by.name,
            })
 
        result = list(jd_groups.values())
        print(f"✅ Returning {len(result)} JD groups with confirmed matches")
        return Response(result, status=200)
 
    except Exception as e:
        print(f"❌ Error fetching confirmed matches: {e}")
        return Response({"error": str(e)}, status=500)
 
    
@api_view(["POST"])
def match_resume_keywords(request):
    """
    POST /api/resume/match_keywords/
    {
        "resume_skills": [...],
        "search_text": "python aws developer"
    }
    """
    try:
        resume_skills = request.data.get("resume_skills", [])
        search_text = request.data.get("search_text", "")
 
        if not search_text:
            return Response({"error": "search_text is required"}, status=400)
 
        matched_keywords = KeywordMatchService.get_matched_keywords(
            resume_skills, search_text
        )
 
        return Response({
            "matched_keywords": matched_keywords,
            "count": len(matched_keywords)
        }, status=200)
 
    except Exception as e:
        return Response({"error": str(e)}, status=500)