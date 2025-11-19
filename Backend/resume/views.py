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
from urllib.parse import unquote
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
        # ✅ FIX: Changed to 'resume_file' to match your Upload.jsx
        resume_files = request.FILES.getlist("resume_file")
        if not resume_files:
            return Response({"error": "No resume files provided"}, status=status.HTTP_400_BAD_REQUEST)

        if len(resume_files) > 25:
            return Response({"error": "You can upload a maximum of 25 resumes at a time."},
                            status=status.HTTP_400_BAD_REQUEST)

        uploaded_results = []
        skipped_duplicates = []
        errors = []

        # Use the globally defined qdrant client
        qc = qdrant_client

        for resume_file in resume_files:
            try:
                # Use the original filename as the dedupe key
                incoming_name = (resume_file.name or "").strip()
                if not incoming_name:
                    errors.append(f"{resume_file.name or 'unknown'}: missing filename")
                    continue

                readable_file_name = incoming_name  # keep case as-is for display
                normalized_key = _normalize_filename(readable_file_name)

                # === Filename-only duplicate check (using same normalization) ===
                is_duplicate = False
                try:
                    if qc:
                        # 1) check by readable_file_name payload variants
                        variants = {
                            readable_file_name,
                            readable_file_name.lower(),
                            f"resumes/{readable_file_name}",
                            f"resumes/{readable_file_name.lower()}"
                        }
                        for v in variants:
                            try:
                                fil = models.Filter(must=[models.FieldCondition(
                                    key="readable_file_name", match=models.MatchValue(value=v))])
                                recs, _ = qc.scroll(
                                    collection_name="resumes", scroll_filter=fil, limit=1)
                                if recs and len(recs) > 0:
                                    is_duplicate = True
                                    break
                            except Exception as e:
                                # continue checking other variants
                                print(f"⚠️ filename duplicate variant check failed for '{v}': {e}")

                        # 2) fallback: check by deterministic UUID derived from normalized filename
                        if (not is_duplicate) and normalized_key:
                            try:
                                probe_id = _filename_to_point_id(normalized_key)
                                recs = qc.retrieve(
                                    collection_name="resumes", ids=[probe_id], with_payload=True)
                                if recs and len(recs) > 0:
                                    is_duplicate = True
                            except Exception:
                                # not fatal; continue
                                pass
                except Exception as e:
                    print(f"⚠️ filename duplicate check failed for {readable_file_name}: {e}")

                if is_duplicate:
                    skipped_duplicates.append(readable_file_name)
                    print(
                        f"⚠️ Duplicate filename detected (skipping upload for user-facing flow): {readable_file_name}")
                    continue

                # Read file bytes once (for S3 upload & extraction)
                file_bytes = resume_file.read()
                if not file_bytes:
                    errors.append(f"{readable_file_name}: file empty or unreadable")
                    continue
                
                # --- ✅ START OF FIX ---
                # Calculate the file hash
                file_hash = hashlib.sha256(file_bytes).hexdigest()
                # --- ✅ END OF FIX ---

                s3_buffer = io.BytesIO(file_bytes)
                s3_buffer.name = resume_file.name
                extract_buffer = io.BytesIO(file_bytes)
                extract_buffer.name = resume_file.name

                # Extract fields (you can still parse email/skills/etc.)
                try:
                    extracted_data = extract_fields(extract_buffer)
                except Exception as e:
                    print(f"⚠️ Text extraction failed for {readable_file_name}: {e}")
                    errors.append(f"{readable_file_name}: extraction failed ({str(e)})")
                    continue

                candidate_name = extracted_data.get(
                    "name") or extracted_data.get("candidate_name") or "Unknown"
                candidate_email = (
                    extracted_data.get("email") or "").strip().lower() or None

                # Upload to S3 (uses imported service)
                try:
                    s3_url = upload_resume_to_s3(
                        s3_buffer, resume_file.content_type, candidate_name)
                    print(f"✅ Uploaded to S3: {s3_url}")
                except Exception as e:
                    print(f"❌ S3 upload failed for {readable_file_name}: {e}")
                    errors.append(f"{readable_file_name}: s3 upload failed ({str(e)})")
                    continue

                # Determine object/file_name from s3 url
                try:
                    parsed_url = urlparse(s3_url)
                    object_name = parsed_url.path.lstrip('/')
                    stored_file_name = object_name.split('/')[-1] or readable_file_name
                except Exception:
                    stored_file_name = readable_file_name

                # Embedding
                resume_text = extracted_data.get(
                    "resume_text", "") or extracted_data.get("text", "")
                try:
                    embedding = get_text_embedding(resume_text)
                except Exception as e:
                    print(
                        f"⚠️ Embedding generation failed for {readable_file_name}: {e}")
                    errors.append(f"{readable_file_name}: embedding failed ({str(e)})")
                    continue

                extracted_skills = extracted_data.get("skills", []) or []

                payload = {
                    "s3_url": s3_url,
                    "candidate_name": candidate_name,
                    "email": candidate_email,
                    
                    # --- ✅ START OF FIX ---
                    "file_hash": file_hash,  # <-- ADDED THE HASH TO THE PAYLOAD
                    # --- ✅ END OF FIX ---
                    
                    "file_name": stored_file_name,
                    "readable_file_name": readable_file_name,
                    "experience_years": extracted_data.get("experience_years"),
                    "cpd_level": extracted_data.get("cpd_level"),
                    "skills": extracted_skills,
                    "resume_text": resume_text,
                }

                # === Deterministic UUID id derived from normalized filename ===
                try:
                    point_id = _filename_to_point_id(normalized_key)
                except Exception:
                    point_id = str(uuid.uuid4())

                # Perform upsert (idempotent)
                try:
                    upsert_point(point_id, embedding, payload)
                    uploaded_results.append(
                        {"point_id": point_id, "file": readable_file_name})
                    print(f"✅ Saved to Qdrant: {point_id} ({readable_file_name})")
                except Exception as e:
                    print(f"❌ Qdrant upsert failed for {readable_file_name}: {e}")
                    errors.append(
                        f"{readable_file_name}: qdrant upsert failed ({str(e)})")
                    continue

            except Exception as e:
                print(f"❌ Unexpected error processing {resume_file.name}: {e}")
                errors.append(
                    f"{resume_file.name}: unexpected error ({str(e)})")
                continue

        # Final responses
        if not uploaded_results and skipped_duplicates:
            return Response({
                "message": "All provided resumes already exist (by filename).",
                "duplicates": skipped_duplicates,
                "uploaded_count": 0,
                "errors": errors
            }, status=status.HTTP_200_OK)

        return Response({
            "message": "Upload complete!",
            "uploaded_count": len(uploaded_results),
            "skipped_duplicates": skipped_duplicates,
            "uploaded_data": uploaded_results,
            "errors": errors
        }, status=status.HTTP_201_CREATED if uploaded_results else status.HTTP_200_OK)
 
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


class ResumeSearchView(APIView):
    def post(self, request, *args, **kwargs):
        query = request.data.get('query', '')
        filters = request.data.get('filters', {})

        if not query:
            return Response({'error': 'A search query is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            query_embedding = get_text_embedding(query)
        except Exception as e:
            traceback.print_exc()
            return Response({'error': f'Embedding generation failed: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # build qdrant filter
        query_filter = None
        must_conditions = []

        exp_range = filters.get("experience", "")
        cpd_level = filters.get("cpd_level", "")

        if cpd_level and cpd_level not in ["", "Any"]:
            try:
                cpd_int = int(cpd_level)
                must_conditions.append(models.FieldCondition(key="cpd_level", match=models.MatchValue(value=cpd_int)))
            except Exception:
                pass

        if exp_range and exp_range != "Any":
            if exp_range == "0-2":
                must_conditions.append(models.FieldCondition(key="experience_years", range=models.Range(gte=0, lte=2)))
            elif exp_range == "3-5":
                must_conditions.append(models.FieldCondition(key="experience_years", range=models.Range(gte=3, lte=5)))
            elif exp_range == "6-10":
                must_conditions.append(models.FieldCondition(key="experience_years", range=models.Range(gte=6, lte=10)))
            elif exp_range == "10+":
                must_conditions.append(models.FieldCondition(key="experience_years", range=models.Range(gte=10)))

        if must_conditions:
            query_filter = models.Filter(must=must_conditions)

        try:
            all_results = search_collection(query_embedding, query_filter=query_filter, limit=1000)
        except Exception as e:
            traceback.print_exc()
            return Response({'error': f'Qdrant primary search failed: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        def match_exp(exp_value, exp_range):
            if not exp_range or exp_range == "Any":
                return True
            if exp_range == "0-2":
                return 0 <= exp_value <= 2
            elif exp_range == "3-5":
                return 3 <= exp_value <= 5
            elif exp_range == "6-10":
                return 6 <= exp_value <= 10
            elif exp_range == "10+":
                return exp_value >= 10
            return True

        filtered_resumes = []
        for match in all_results:
            try:
                exp_val = int(match.payload.get("experience_years", 0) or 0)
            except Exception:
                exp_val = 0
            try:
                cpd_val = int(match.payload.get("cpd_level", 0) or 0)
            except Exception:
                cpd_val = 0
            exp_match = match_exp(exp_val, exp_range)
            cpd_match = (cpd_level in ["", "Any"] or cpd_val == int(cpd_level)) if cpd_level else True
            if exp_match and cpd_match:
                filtered_resumes.append(match)

        # Build words to highlight / expand using synonym map
        query_keywords = set(query.lower().split())
        words_to_highlight = set(query_keywords)
        for kw in query_keywords:
            for key in SYNONYM_MAP:
                if key in kw or kw in key:
                    words_to_highlight.update(SYNONYM_MAP.get(key, []))

        results = []
        for match in filtered_resumes:
            resume_content = (match.payload.get('resume_text') or '').lower()
            matched_keywords = [kw for kw in words_to_highlight if kw in resume_content]
            base_score = match.score or 0
            keyword_boost = len(matched_keywords) * 5
            try:
                exp_years = int(match.payload.get("experience_years", 0) or 0)
            except Exception:
                exp_years = 0
            exp_boost = exp_years * 1.5
            final_score = min(100, base_score * 100 + keyword_boost + exp_boost)
            response_data = dict(match.payload)
            results.append({
                'id': match.id,
                'score': round(final_score, 2),
                'data': response_data,
                'matched_keywords': matched_keywords
            })

        results.sort(key=lambda r: r['score'], reverse=True)
        return Response({"results": results, "highlight_words": list(words_to_highlight)}, status=status.HTTP_200_OK)


# -----------------------------
# List resumes (Qdrant)
# -----------------------------
class ResumeListView(APIView):
    def get(self, request):
        try:
            qdrant_records = get_all_points()
            formatted_results = []
            for record in qdrant_records:
                payload = record.payload or {}
                formatted_results.append({
                    'id': record.id,
                    'candidate_name': payload.get('candidate_name'),
                    'email': payload.get('email'),
                    'experience_years': payload.get('experience_years'),
                    'cpd_level': payload.get('cpd_level'),
                    'skills': payload.get('skills', []),
                    's3_url': payload.get('s3_url'),
                    'resume_text': payload.get('resume_text')
                })
            return Response({"results": formatted_results}, status=status.HTTP_200_OK)
        except Exception as e:
            traceback.print_exc()
            return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
    FILTER using S3 → PDF → Text Parsing.
    Supports CPD, EXPERIENCE (bucket range) & SKILL.
    """
    print("\n" + "="*60)
    print("=== FILTER_RESUMES (S3 PARSER) CALLED ===")

    cpd_level = request.query_params.get('cpd_level')
    skill = request.query_params.get('skill')
    experience_bucket = request.query_params.get('experience')

    print("Requested Filters:")
    print(" - CPD Level:", cpd_level)
    print(" - Skill:", skill)
    print(" - Experience Bucket:", experience_bucket)

    try:
        pdf_keys = list_pdfs()
        print(f"[1] Found {len(pdf_keys)} PDFs in S3")

        matching_resumes = []

        for idx, pdf_key in enumerate(pdf_keys, 1):
            print(f"\n[{idx}/{len(pdf_keys)}] Processing {pdf_key}")

            try:
                pdf_bytes = get_pdf_bytes(pdf_key)
                text = extract_text_from_pdf_bytes(pdf_bytes)
                resume_data = simple_parse_resume(text)


                # Proper Skill Split
                skills_list = _split_skills(resume_data.get("skills", []))
                resume_data["skills"] = skills_list

                # Normalize Experience → convert raw "5 years" → bucket "3-5 yrs"
                raw_exp = resume_data.get("experience", "")
                exp_years = 0

                try:
                    # Extract first integer found in exp string
                    m = re.search(r"(\d+)", raw_exp)
                    if m:
                        exp_years = int(m.group(1))
                except:
                    exp_years = 0

                # Convert number → experience bucket
                if exp_years <= 2:
                    exp_bucket = "0-2 yrs"
                elif exp_years <= 5:
                    exp_bucket = "3-5 yrs"
                elif exp_years <= 10:
                    exp_bucket = "6-10 yrs"
                else:
                    exp_bucket = "10+ yrs"

                resume_data["experience_bucket"] = exp_bucket

                # ------------------------
                # APPLY FILTER CONDITIONS
                # ------------------------

                # CPD FILTER
                if cpd_level:
                    if str(resume_data.get("cpd_level")) != str(cpd_level):
                        continue

                # EXPERIENCE BUCKET FILTER
                if experience_bucket:
                    if exp_bucket.lower() != experience_bucket.lower():
                        continue

                # SKILL FILTER
                if skill:
                    if not any(skill.lower() == s.lower() for s in skills_list):
                        continue

                # Prepare response data
                file_name = os.path.basename(pdf_key)
                if not resume_data.get("name"):
                    resume_data["name"] = file_name.replace(".pdf", "").replace("_", " ").title()

                matching_resumes.append({
                    "file_name": file_name,
                    "s3_path": f"s3://{BUCKET}/{pdf_key}",
                    "skills": skills_list,
                    "experience_bucket": exp_bucket,
                    **resume_data
                })

                print(f"  → MATCH: {resume_data['name']}")

            except Exception as e:
                print(f"  ❌ Error parsing {pdf_key}: {e}")
                continue

        print("\n" + "="*60)
        print(f"FINAL MATCH COUNT: {len(matching_resumes)}")
        print("="*60)

        return Response({
            "message": f"Found {len(matching_resumes)} matching resumes.",
            "data": matching_resumes
        })

    except Exception as e:
        print("❌ CRASH IN FILTER:", e)
        return Response({"detail": str(e)}, status=500)




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
class ResumeDetailView(APIView):
    def get(self, request, pk):
        try:
            record = _get_qdrant_record_by_id(pk)
            if not record:
                return Response({"detail": "Resume not found"}, status=status.HTTP_404_NOT_FOUND)
            payload = record.payload or {}
            data = {
                "id": record.id,
                "candidate_name": payload.get("candidate_name"),
                "email": payload.get("email"),
                "experience_years": payload.get("experience_years"),
                "cpd_level": payload.get("cpd_level"),
                "skills": payload.get("skills", []),
                "s3_url": payload.get("s3_url"),
                "resume_text": payload.get("resume_text"),
                "file_name": payload.get("file_name"),
                "year_joined": payload.get("year_joined"),
            }
            return Response({"data": data}, status=status.HTTP_200_OK)
        except Exception as e:
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -----------------------------
# Delete resume (by qdrant id)
# -----------------------------
class ResumeDeleteView(APIView):
    # ✅ FIX: Changed 'pk' to 'id' to match the URL
    def delete(self, request, id):
        if not id:
            return Response({'error': 'No resume ID provided'}, status=status.HTTP_400_BAD_REQUEST)
 
        try:
            # ✅ FIX: Use the 'id' variable
            delete_point(id)
            return Response({"message": f"Resume with id {id} deleted successfully."}, status=status.HTTP_200_OK)
        except Exception as e:
            traceback.print_exc()
            return Response({"error": f"Failed to delete resume: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            traceback.print_exc()
            return Response({"error": f"Failed to delete resume: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
 
 
@api_view(['GET'])
def analytics_overview(request):
    try:
        records = get_all_points()

        cpd_levels = {}
        experience = {}
        skill_counts = {}

        for rec in records:
            p = rec.payload or {}

            # CPD
            cpd = p.get("cpd_level")
            if cpd:
                cpd = str(cpd)
                cpd_levels[cpd] = cpd_levels.get(cpd, 0) + 1

            # EXPERIENCE
            exp = p.get("experience_years")
            if exp is not None:
                exp = int(exp)
                if exp <= 2: bucket = "0-2 yrs"
                elif exp <= 5: bucket = "3-5 yrs"
                elif exp <= 10: bucket = "6-10 yrs"
                else: bucket = "10+ yrs"
                experience[bucket] = experience.get(bucket, 0) + 1

            # SKILLS
            skills = p.get("skills", [])
            for s in skills:
                s = s.strip().lower()
                if s:
                    skill_counts[s] = skill_counts.get(s, 0) + 1

        # return EXACTLY what frontend expects
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
                return Response({'error': f'PDF extraction failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        elif request.data and 'jd_text' in request.data:
            print("[1] Processing raw JD text...")
            jd_text = request.data.get('jd_text', '')
        
        if not jd_text:
            return Response({'error': 'No JD file or text provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        # ===== STEP 2: Extract keywords =====
        print("[2] Extracting JD keywords...")
        try:
            jd_keywords = extract_jd_keywords(jd_text, top_k=25)
            print(f"✅ Found {len(jd_keywords)} keywords: {jd_keywords[:5]}...")
        except Exception as e:
            print(f"❌ Keyword extraction failed: {e}")
            return Response({'error': f'Keyword extraction failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # ===== STEP 3: Get all resumes =====
        print("[3] Fetching all resumes from Qdrant...")
        try:
            all_resumes = get_all_points()
            print(f"✅ Found {len(all_resumes)} resumes in Qdrant")
        except Exception as e:
            print(f"❌ Failed to fetch resumes: {e}")
            return Response({'error': f'Failed to fetch resumes: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # ===== STEP 4: Match resumes =====
        print("[4] Matching resumes against JD...")
        matches = []
        
        for idx, resume in enumerate(all_resumes, 1):
            try:
                payload = resume.payload or {}
                resume_skills = payload.get('skills', [])
                if isinstance(resume_skills, str):
                    resume_skills = [resume_skills]
                
                match_result = match_resume_to_jd(resume_skills, jd_keywords)
                
                # ✅ FIX: Extract 'file_name' from the payload
                # This is the critical missing piece!
                file_name = payload.get('file_name') or payload.get('readable_file_name') or payload.get('s3_url', '').split('/')[-1]
                
                candidate_data = {
                    'id': resume.id,
                    'candidate_name': payload.get('candidate_name', 'Unknown'),
                    'email': payload.get('email', 'N/A'),
                    'experience_years': payload.get('experience_years', 0),
                    'cpd_level': payload.get('cpd_level', 0),
                    'skills': resume_skills,
                    'match_percentage': match_result['match_percentage'],
                    'matched_skills': match_result['matched'],
                    'missing_skills': match_result['missing'],
                    'match_count': match_result['match_count'],
                    'total_required': match_result['total_required'],
                    's3_url': payload.get('s3_url', ''),
                    'file_name': file_name, # <--- ADDED THIS FIELD
                }
                
                matches.append(candidate_data)
            
            except Exception as e:
                print(f"  ❌ Error processing resume {idx}: {e}")
                continue
        
        matches.sort(key=lambda x: x['match_percentage'], reverse=True)
        
        return Response({
            'jd_text': jd_text, 
            'jd_keywords': jd_keywords,
            'matches': matches,
            'total_matches': len(matches),
            'success': True
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        print(f"❌ CRITICAL ERROR in jd_match: {e}")
        traceback.print_exc()
        return Response({'error': str(e), 'success': False}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)    


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