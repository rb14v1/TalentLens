import uuid
import io
import os
import re
import traceback
from typing import List, Dict

import fitz  # PyMuPDF - add this import at the top
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from botocore.exceptions import ClientError
from urllib.parse import unquote
import requests

# services (your existing modules)
from .services.s3_service import upload_resume_to_s3, list_pdfs, get_pdf_bytes, get_presigned_url, s3, BUCKET
from .services.extract_data import extract_fields
from .services.embedding_service import get_text_embedding
from .services.qdrant_service import upsert_point, search_collection, get_all_points, delete_point
from .services.pdf_parser import extract_text_from_pdf_bytes, parse_resume as simple_parse_resume
from .services.jd_keyword_service import extract_jd_keywords, match_resume_to_jd
from .services.pdf_parser import extract_text_from_pdf_bytes



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


# -----------------------------
# Home
# -----------------------------
def home(request):
    return HttpResponse("Welcome to ProMatch Resume Portal!")


# -----------------------------
# Upload endpoint (class based)
# -----------------------------
class ResumeUploadView(APIView):
    def post(self, request, *args, **kwargs):
        # ✅ FIX: Check for BOTH 'file' (new) and 'resume_file' (old)
        resume_files = request.FILES.getlist('file')
        if not resume_files:
            resume_files = request.FILES.getlist('resume_file')
       
        # Now, if it's *still* empty, return the error
        if not resume_files:
            return Response({'error': 'No resume files provided'}, status=status.HTTP_400_BAD_REQUEST)
 
        # MODIFICATION 2: Prepare lists for summary response
        uploaded_results = []
        errors = []
 
        # MODIFICATION 3: Loop through all files
        for resume_file in resume_files:
            try:
                # --- Start of your original logic (now indented) ---
                file_content_type = resume_file.content_type
                file_content = resume_file.read()
                s3_buffer = io.BytesIO(file_content)
                s3_buffer.name = resume_file.name
 
                extract_buffer = io.BytesIO(file_content)
                extract_buffer.name = resume_file.name
 
                # Extract metadata
                try:
                    extracted_data = extract_fields(extract_buffer)
                except Exception as e:
                    traceback.print_exc()
                    # MODIFICATION: Change to raise error for the loop's catch block
                    raise Exception(f'Text extraction failed: {e}')
 
                candidate_name = extracted_data.get("name", "Unknown")
 
                try:
                    s3_url = upload_resume_to_s3(s3_buffer, file_content_type, candidate_name)
                except Exception as e:
                    traceback.print_exc()
                    raise Exception(f'S3 upload failed: {e}')
 
                # experience/cpd override from POST if provided
                exp_years_post = request.POST.get("experience_years")
                if exp_years_post and exp_years_post not in ["", "None", "null"]:
                    try:
                        experience_years = int(exp_years_post)
                    except Exception:
                        experience_years = extracted_data.get("experience_years", 0)
                else:
                    experience_years = extracted_data.get("experience_years", 0)
 
                cpd_level_post = request.POST.get("cpd_level")
                if cpd_level_post and cpd_level_post not in ["", "None", "null"]:
                    try:
                        cpd_level = int(cpd_level_post)
                    except (ValueError, TypeError):
                        cpd_level = extracted_data.get("cpd_level", 1)
                else:
                    cpd_level = extracted_data.get("cpd_level", 1)
 
                # sanitize CPD level into accepted bounds
                try:
                    cpd_level = int(cpd_level)
                except Exception:
                    cpd_level = 1
                cpd_level = max(1, min(6, cpd_level))
 
                # create embedding (text should be present)
                resume_text = extracted_data.get('resume_text', '') or ''
                try:
                    embedding = get_text_embedding(resume_text)
                except Exception as e:
                    traceback.print_exc()
                    raise Exception(f'Embedding generation failed: {e}')
 
                payload = {
                    "s3_url": s3_url,
                    "candidate_name": candidate_name,
                    "email": extracted_data.get("email"),
                    "experience_years": experience_years,
                    "cpd_level": cpd_level,
                    "skills": extracted_data.get("skills", []),
                    "year_joined": extracted_data.get("year_joined"),
                    "resume_text": resume_text,
                    "file_name": resume_file.name,
                }
 
                point_id = str(uuid.uuid4())
                try:
                    upsert_point(point_id, embedding, payload)
                except Exception as e:
                    traceback.print_exc()
                    raise Exception(f'Qdrant upsert failed: {e}')
 
                # MODIFICATION 4: Append success data
                uploaded_results.append({
                    'file': resume_file.name,
                    'qdrant_id': point_id,
                    'data': payload
                })
                # --- End of your original logic ---
           
            except Exception as e:
                # MODIFICATION 5: Catch per-file errors
                print(f"❌ Error processing {resume_file.name}: {e}")
                traceback.print_exc()
                errors.append(f"{resume_file.name}: {str(e)}")
                continue # Move to the next file
       
        # MODIFICATION 6: Return summary response
        return Response({
            'message': f"Upload complete. Processed {len(uploaded_results)} files.",
            'uploaded_count': len(uploaded_results),
            'uploaded_data': uploaded_results,
            'errors': errors
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
    View a resume PDF. Query params:
      - file_name (required): filename (Denise.pdf) or full key (resumes/Denise.pdf)
      - highlight (optional): 'cpd', 'experience', or arbitrary text to highlight.
    Behavior:
      - If `highlight` is provided: download, annotate, and return modified PDF bytes inline.
      - If no `highlight`: generate a presigned S3 URL and redirect the client there (fast).
    """
    print("=== VIEW_RESUME CALLED ===")
    file_name = request.query_params.get('file_name', None)
    highlight_field = request.query_params.get('highlight', None)

    print(f"Requested file_name: {file_name}, highlight: {highlight_field}")

    if not file_name:
        return Response({"detail": "file_name parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Normalize incoming file_name
    file_name = unquote(str(file_name))
    if not file_name.lower().endswith(".pdf"):
        file_name = f"{file_name}.pdf"

    # candidate keys to try
    candidate_keys = [file_name]
    if not file_name.startswith("resumes/"):
        candidate_keys.append(f"resumes/{file_name}")

    # If still not found, attempt search by basename from S3 listing (case-insensitive)
    found_key = None
    for key in candidate_keys:
        try:
            s3.head_object(Bucket=BUCKET, Key=key)
            found_key = key
            print(f"Found exact key in S3: {found_key}")
            break
        except ClientError as e:
            # not found — continue
            pass

    if not found_key:
        # Try scanning S3 list (this is slightly heavier, but handles paths and case variance)
        try:
            print("Searching S3 listing for matching basename...")
            all_keys = list_pdfs(prefix="resumes/")  # this returns only PDFs under 'resumes/'
            basename = os.path.basename(file_name).lower()
            for k in all_keys:
                if os.path.basename(k).lower() == basename:
                    found_key = k
                    print(f"Matched by listing: {found_key}")
                    break
            # As a last attempt, see if exact non-prefixed file exists in bucket root
            if not found_key:
                # list objects at root prefix
                root_keys = list_pdfs(prefix="")  # may return all pdfs
                for k in root_keys:
                    if os.path.basename(k).lower() == basename:
                        found_key = k
                        print(f"Matched by root listing: {found_key}")
                        break
        except Exception as e:
            print("Error while searching S3 listing:", e)

    if not found_key:
        msg = f"Resume '{file_name}' not found in S3 (tried: {candidate_keys})."
        print(msg)
        return Response({"detail": msg}, status=status.HTTP_404_NOT_FOUND)

    # If highlight requested, download + annotate and return PDF bytes
    if highlight_field:
        try:
            print(f"Downloading {found_key} for highlighting...")
            pdf_bytes = get_pdf_bytes(found_key)
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")

            for page_num in range(pdf_document.page_count):
                page = pdf_document[page_num]
                page_text = page.get_text("text")

                if highlight_field.lower() == "cpd":
                    cpd_matches = re.finditer(r'CPD\s*Level:\s*\d+\b', page_text, re.IGNORECASE)
                    for match in cpd_matches:
                        cpd_text = match.group(0).strip()
                        rects = page.search_for(cpd_text)
                        for rect in rects:
                            annot = page.add_highlight_annot(rect)
                            annot.set_colors(stroke=[1, 1, 0])
                            annot.update()

                elif highlight_field.lower() == "experience":
                    exp_matches = re.finditer(r'Experience:\s*\d+\s*years?', page_text, re.IGNORECASE)
                    for match in exp_matches:
                        exp_text = match.group(0).strip()
                        rects = page.search_for(exp_text)
                        if not rects:
                            rects = page.search_for(exp_text.split('|')[0].strip())
                        for rect in rects:
                            annot = page.add_highlight_annot(rect)
                            annot.set_colors(stroke=[1, 1, 0])
                            annot.update()

                else:
                    rects = page.search_for(highlight_field)
                    for rect in rects:
                        annot = page.add_highlight_annot(rect)
                        annot.set_colors(stroke=[1, 1, 0])
                        annot.update()

            pdf_bytes = pdf_document.write(garbage=4, deflate=True)
            pdf_document.close()

            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="{os.path.basename(found_key)}"'
            print("Returning highlighted PDF inline.")
            return response

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"detail": f"Error processing PDF for highlighting: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # No highlighting requested -> return presigned URL redirect (fast)
    try:
        presigned = get_presigned_url(found_key, expires_in=3600)
        print(f"Returning presigned URL for {found_key}")
        # Redirect client to S3 presigned URL so browser loads PDF directly from S3
        return JsonResponse({"url": presigned})
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Fallback: stream file bytes if presigned generation fails
        try:
            pdf_bytes = get_pdf_bytes(found_key)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="{os.path.basename(found_key)}"'
            print("Presigned generation failed — returning bytes inline.")
            return response
        except Exception as e2:
            import traceback
            traceback.print_exc()
            return Response({"detail": f"Unable to return resume: {str(e2)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
    
    Endpoint: POST /api/skill-analytics/jd_match/
    Payload: multipart/form-data with 'jd_file'
    Response: {
        jd_keywords: [...],
        matches: [{ candidate_name, email, match_percentage, ... }],
        total_matches: N,
        success: true
    }
    """
    print("\n" + "="*60)
    print("=== JD_MATCH CALLED ===")
    
    jd_text = None
    jd_keywords = []
    
    try:
        # ===== STEP 1: Get JD text =====
        
        # Check for file upload
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
        
        # Check for JSON body
        elif request.data and 'jd_text' in request.data:
            print("[1] Processing raw JD text...")
            jd_text = request.data.get('jd_text', '')
        
        if not jd_text:
            return Response(
                {'error': 'No JD file or text provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ===== STEP 2: Extract keywords from JD =====
        print("[2] Extracting JD keywords...")
        try:
            jd_keywords = extract_jd_keywords(jd_text, top_k=25)
            print(f"✅ Found {len(jd_keywords)} keywords: {jd_keywords[:5]}...")
        except Exception as e:
            print(f"❌ Keyword extraction failed: {e}")
            return Response(
                {'error': f'Keyword extraction failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # ===== STEP 3: Get all resumes from Qdrant =====
        print("[3] Fetching all resumes from Qdrant...")
        try:
            all_resumes = get_all_points()
            print(f"✅ Found {len(all_resumes)} resumes in Qdrant")
        except Exception as e:
            print(f"❌ Failed to fetch resumes: {e}")
            return Response(
                {'error': f'Failed to fetch resumes: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # ===== STEP 4: Match each resume against JD =====
        print("[4] Matching resumes against JD...")
        matches = []
        
        for idx, resume in enumerate(all_resumes, 1):
            try:
                payload = resume.payload or {}
                
                # Get resume skills
                resume_skills = payload.get('skills', [])
                if isinstance(resume_skills, str):
                    resume_skills = [resume_skills]
                
                # Match resume against JD
                match_result = match_resume_to_jd(resume_skills, jd_keywords)
                
                # Build response data
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
                }
                
                matches.append(candidate_data)
                print(f"  [{idx}] {candidate_data['candidate_name']}: {candidate_data['match_percentage']}% match")
            
            except Exception as e:
                print(f"  ❌ Error processing resume {idx}: {e}")
                continue
        
        # Sort by match percentage (descending)
        matches.sort(key=lambda x: x['match_percentage'], reverse=True)
        
        print("="*60)
        print(f"✅ Matching complete: {len(matches)} resumes matched")
        print("="*60 + "\n")
        
        return Response({
            'jd_keywords': jd_keywords,
            'matches': matches,
            'total_matches': len(matches),
            'success': True
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        print(f"❌ CRITICAL ERROR in jd_match: {e}")
        traceback.print_exc()
        return Response(
            {'error': str(e), 'success': False},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
