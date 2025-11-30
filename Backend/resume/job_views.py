from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
import json
import io
import boto3
import os
import uuid
from django.conf import settings
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
 
# Import your services
from .services.qdrant_service import insert_job_posting
from .services.embedding_service import get_text_embedding
from .services.qdrant_service import insert_job_posting, qdrant_client # <-- ✅ Add qdrant_client
from qdrant_client.http import models
from .models import AppUser
from .services.qdrant_service import get_all_job_postings, insert_job_posting, qdrant_client
from datetime import datetime
from .services.s3_service import s3, BUCKET  # ✅ Imported for S3 deletion
from urllib.parse import urlparse, unquote # ✅ ADD unquote HERE
from django.http import HttpResponse
 
 
# Mapping: Frontend Department Selection -> Qdrant Collection Name
DEPARTMENT_MAPPING = {
    "Engineering / IT": "engineering_it",
    "Human Resources": "human_resources",
    "Sales & Marketing": "sales_marketing",
    "Finance & Accounting": "finance_accounting",
}
 
# ==========================================
# Helper: Generate Formal PDF in Memory
# ==========================================
def generate_jd_pdf(data):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
   
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='FormalTitle', fontName='Times-Bold', fontSize=18, spaceAfter=12, alignment=1)) # Center
    styles.add(ParagraphStyle(name='FormalHeading', fontName='Times-Bold', fontSize=12, spaceAfter=6, spaceBefore=12))
    styles.add(ParagraphStyle(name='FormalBody', fontName='Times-Roman', fontSize=11, leading=14))
 
    story = []
 
    # 1. Header
    title = data.get('jobTitle', 'Job Description').upper()
    company = data.get('companyName', '')
    story.append(Paragraph(title, styles['FormalTitle']))
    if company:
        story.append(Paragraph(f"{company}", styles['FormalTitle']))
   
    story.append(Spacer(1, 12))
 
    # 2. Key Details Line
    details = []
    if data.get('location'): details.append(data['location'])
    if data.get('jobType'): details.append(data['jobType'])
    if data.get('experience'): details.append(f"{data['experience']} Exp.")
   
    if details:
        story.append(Paragraph(" | ".join(details), styles['FormalBody']))
        story.append(Spacer(1, 24))
 
    # 3. Sections
    # Define the sections we want to print in order
    sections_map = {
        "Role Overview": ["summary", "responsibilities", "requiredSkills", "preferredSkills"],
        "Qualifications": ["education", "specialization"],
        "Company & Contact": ["companyDescription", "contactEmail"],
        "Details": ["postingDate", "deadline", "workMode", "status"]
    }
 
    for section_title, fields in sections_map.items():
        # Check if section has data
        has_data = any(data.get(f) for f in fields)
        if not has_data: continue
 
        story.append(Paragraph(section_title, styles['FormalHeading']))
       
        for field in fields:
            val = data.get(field)
            if val:
                # Format field name: "requiredSkills" -> "Required Skills"
                label = " ".join(re.findall(r'[A-Z]?[a-z]+', field)).capitalize()
                text = f"<b>{label}:</b> {val}"
                # Handle newlines in text areas
                text = text.replace("\n", "<br/>")
                story.append(Paragraph(text, styles['FormalBody']))
                story.append(Spacer(1, 6))
       
        story.append(Spacer(1, 12))
 
    doc.build(story)
    buffer.seek(0)
    return buffer
 
import re
 
# ==========================================
# API: Save Job Description
# ==========================================
@csrf_exempt
@api_view(['POST'])
def save_job_description(request):
    """
    1. Generates a PDF from the JD data.
    2. Uploads PDF to S3 (jobs/ folder).
    3. Generates Embedding.
    4. Saves Data + S3 Link to Qdrant Department Collection.
    """
    print("=== SAVE JD (S3 + QDRANT) CALLED ===")
    try:
        data = request.data
       
        # 1. Identify Collection
        dept_selected = data.get("department", "")
        collection_key = DEPARTMENT_MAPPING.get(dept_selected)
       
        if not collection_key:
            print(f"⚠️ Unknown department: {dept_selected}")
            return Response(
                {"error": f"Invalid or missing department: '{dept_selected}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        # 2. Generate PDF
        try:
            pdf_buffer = generate_jd_pdf(data)
            print("✅ PDF generated in memory.")
        except Exception as e:
            print(f"❌ PDF Generation failed: {e}")
            return Response({"error": "Failed to generate PDF"}, status=500)
 
        # 3. Upload to S3
        s3_url = ""
        try:
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "us-east-1"),
            )
            bucket_name = os.getenv("S3_BUCKET_JD")
           
            # Create a unique filename
            safe_title = re.sub(r'[^a-zA-Z0-9]', '_', data.get('jobTitle', 'JD'))
            filename = f"jobs/{safe_title}_{uuid.uuid4().hex[:8]}.pdf"
 
            s3_client.upload_fileobj(
                pdf_buffer,
                bucket_name,
                filename,
                ExtraArgs={"ContentType": "application/pdf"}
            )
           
            s3_url = f"https://{bucket_name}.s3.amazonaws.com/{filename}"
            print(f"✅ Uploaded to S3: {s3_url}")
           
        except Exception as e:
            print(f"❌ S3 Upload failed: {e}")
            # We might still want to save to Qdrant even if S3 fails?
            # Usually no, but let's fail for now so user knows.
            return Response({"error": f"S3 Upload failed: {str(e)}"}, status=500)
 
        # 4. Generate Embedding
        text_to_embed = f"{data.get('jobTitle', '')} {data.get('requiredSkills', '')} {data.get('summary', '')}"
        try:
            vector = get_text_embedding(text_to_embed)
        except Exception as e:
            print(f"⚠️ Embedding failed: {e}")
            vector = None
 
        # 5. Save to Qdrant
        # Add the S3 URL to the data payload so we can retrieve it later
        final_payload = {**data, "s3_url": s3_url, "file_name": filename}
       
        insert_job_posting(collection_key, final_payload, vector)
       
        return Response({"message": "Job Description published and saved to S3 successfully!"}, status=status.HTTP_201_CREATED)
 
    except Exception as e:
        print(f"❌ Error saving JD: {e}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
   
 
@csrf_exempt
@api_view(['DELETE'])
def delete_job_description(request, job_id):
    """
    Deletes a Job Description from Qdrant and S3.
    Searches all job collections since we might not know which one the ID belongs to.
    """
    print(f"=== DELETE JOB CALLED: {job_id} ===")
   
    # Get all unique collection names from our mapping
    collections_to_check = set(DEPARTMENT_MAPPING.values())
   
    job_found = False
   
    try:
        # 1. Initialize S3 Client
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION_NAME,
        )
 
        # 2. Search for the job in each collection
        for collection_name in collections_to_check:
            try:
                # Try to retrieve the record
                points = qdrant_client.retrieve(
                    collection_name=collection_name,
                    ids=[job_id],
                    with_payload=True
                )
               
                if points:
                    # Found it!
                    job_found = True
                    point = points[0]
                    payload = point.payload or {}
                   
                    # 3. Delete from S3
                    # We saved the full key (e.g. "jobs/file.pdf") as 'file_name'
                    object_key = payload.get("file_name")
                   
                    if object_key:
                        try:
                            s3_client.delete_object(
                                Bucket=settings.S3_BUCKET_JD,
                                Key=object_key
                            )
                            print(f"🗑️ Deleted S3 file: {object_key}")
                        except Exception as s3_e:
                            print(f"⚠️ S3 Delete Warning: {s3_e}")
 
                    # 4. Delete from Qdrant
                    qdrant_client.delete(
                        collection_name=collection_name,
                        points_selector=models.PointIdsList(points=[job_id]),
                    )
                    print(f"✅ Deleted Qdrant record from {collection_name}")
                   
                    return Response({"message": "Job deleted successfully"}, status=status.HTTP_200_OK)
 
            except Exception as e:
                # If collection doesn't exist or other minor error, continue searching
                continue
       
        if not job_found:
            return Response({"error": "Job ID not found"}, status=status.HTTP_404_NOT_FOUND)
 
    except Exception as e:
        print(f"❌ Error deleting JD: {e}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
   
 
@api_view(['GET'])
def get_all_jobs(request):
    """
    Fetch all job descriptions from all collections.
    """
    all_jobs = []
    try:
        # Iterate over all unique collection names
        unique_collections = set(DEPARTMENT_MAPPING.values())
       
        # Initialize Qdrant client (ensure it is imported or use the service)
        from .services.qdrant_service import qdrant_client
        if not qdrant_client:
             return Response({"error": "Qdrant not connected"}, status=500)
 
        for collection_name in unique_collections:
            try:
                # Fetch all points from this collection
                records, _ = qdrant_client.scroll(
                    collection_name=collection_name,
                    limit=100,
                    with_payload=True,
                    with_vectors=False
                )
               
                for record in records:
                    p = record.payload or {}
                    all_jobs.append({
                        "id": record.id,
                        "title": p.get("jobTitle", "Unknown Role"),
                        "company": p.get("companyName", "Unknown Company"),
                        "location": p.get("location", "Remote"),
                        "type": p.get("jobType", "Full-time"),
                        "posted": p.get("postingDate", "Recently"),
                        "applicants": 0, # Placeholder
                        "description": p.get("summary", ""),
                        "skills": p.get("requiredSkills", "").split(",") if p.get("requiredSkills") else [],
                        "creator_email": p.get("contactEmail", ""), # Used to filter "My JDs"
                        "department": p.get("department", ""),
                        "s3_url": p.get("s3_url", ""), # <--- Needed for "View" button
                        "file_name": p.get("file_name", ""), # <--- Needed for "View" button
                        "collection": collection_name
                    })
            except Exception:
                continue
 
        return Response(all_jobs, status=status.HTTP_200_OK)
       
    except Exception as e:
        print(f"❌ Error fetching jobs: {e}")
        return Response({"error": str(e)}, status=500)
   
 
 
@csrf_exempt
@api_view(['POST'])
def upload_profile_image(request):
    try:
        body = json.loads(request.body)
        email = body.get("email")
        image = body.get("image")  # base64 string
 
        user = AppUser.objects.filter(email=email).first()
        if not user:
            return JsonResponse({"error": "User not found"}, status=404)
 
        user.profile_image = image
        user.save()
 
        return JsonResponse({"message": "Profile image updated successfully", "image": image})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
 
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .models import AppUser, JDDraft
 
 
@csrf_exempt
def save_jd_draft(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)
 
    body = json.loads(request.body)
 
    email = body.get("email")
    data = body.get("data")
    title = data.get("jobTitle") or "Untitled JD"
 
    try:
        user = AppUser.objects.get(email=email)
    except AppUser.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)
 
    draft_id = body.get("id")
 
    if draft_id:
        draft = JDDraft.objects.get(id=draft_id)
        draft.data = data
        draft.title = title
        draft.save()
    else:
        draft = JDDraft.objects.create(
            user=user,
            title=title,
            data=data,
        )
 
    return JsonResponse({"message": "Draft saved", "draft_id": draft.id})
 
def get_jd_drafts(request, email):
    try:
        user = AppUser.objects.get(email=email)
    except AppUser.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)
 
    drafts = JDDraft.objects.filter(user=user).order_by("-updated_at")
    result = []
 
    for d in drafts:
        result.append({
            "id": d.id,
            "title": d.title,
            "updated_at": d.updated_at,
            "data": d.data,
            "status": d.status,
        })
 
    return JsonResponse({"drafts": result})
 
 
@csrf_exempt
def delete_jd_draft(request, draft_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE required"}, status=400)
 
    try:
        JDDraft.objects.get(id=draft_id).delete()
        return JsonResponse({"message": "Draft deleted"})
    except JDDraft.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)
 
@api_view(['POST'])
def publish_jd(request):
    try:
        user_id = request.session.get('user_id')
        if not user_id:
            return Response({"error": "Unauthorized"}, status=401)
        user = AppUser.objects.get(id=user_id)
        data = request.data
        dept = user.department
        collection_name = DEPARTMENT_MAPPING.get(dept, "engineering_it")
 
        job_id = str(uuid.uuid4())
        payload = {
            "job_title": data.get("job_title"),
            "job_description": data.get("job_description"),
            "department": dept,
            "creator_email": user.email,
            "hiringManagerName": user.name, # ✅ Saves correctly
            "location": data.get("location", "Remote"),
            "job_type": data.get("job_type", "Full-time"),
            "status": "Open",
            "created_at": datetime.now().strftime("%Y-%m-%d"),
            "skills_required": data.get("skills", []),
            "experience_required": data.get("experience", "0-2 years")
        }
        from .services.embedding_service import get_text_embedding
        from qdrant_client.http import models
        vector = get_text_embedding(payload["job_description"])
        qdrant_client.upsert(
            collection_name=collection_name,
            points=[models.PointStruct(id=job_id, vector=vector, payload=payload)]
        )
        return Response({"message": "Job Published", "id": job_id}, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
   
# In Backend/resume/job_views.py
 
# ✅ HELPER: Fuzzy search for keys (Place this above list_jobs if not already there)
def get_fuzzy(payload, targets):
    clean_targets = [t.lower().strip() for t in targets]
    for key, value in payload.items():
        if key.lower().strip() in clean_targets and value:
            return value
    return None
 
# ✅ SMART LIST FUNCTION (Deduplicates Jobs & Fixes Status)
@api_view(['GET'])
def list_jobs(request):
    try:
        user_id = request.session.get('user_id')
        if not user_id: return Response({"error": "Unauthorized"}, status=401)
       
        # 1. Search ALL Collections (Universal View)
        unique_collections = set(DEPARTMENT_MAPPING.values())
        job_map = {} # This will store unique jobs by ID
 
        for collection_name in unique_collections:
            try:
                # Fetch all records
                records, _ = qdrant_client.scroll(
                    collection_name=collection_name,
                    limit=1000,
                    with_payload=True,
                    with_vectors=False
                )
               
                for record in records:
                    p = record.payload or {}
                    job_id = record.id
                   
                    # Extract Data safely
                    title = get_fuzzy(p, ["job_title", "jobTitle", "title"]) or "Untitled"
                    manager_name = get_fuzzy(p, ["hiringManagerName", "creator_name", "name"]) or "Unknown"
                    manager_email = get_fuzzy(p, ["creator_email", "email"]) or ""
                    dept = get_fuzzy(p, ["department", "dept"]) or "General"
                    s3_url = get_fuzzy(p, ["s3_url", "fileUrl", "url"])
                    file_name = get_fuzzy(p, ["file_name", "fileName"])
                   
                    # Fix Status: Default to "Open" if missing
                    status_val = p.get("status")
                    if not status_val: status_val = "Open"
                   
                    # Date Logic
                    date_val = get_fuzzy(p, ["postingDate", "posting_date", "created_at"]) or "Recently"
 
                    job_data = {
                        "id": job_id,
                        "title": title,
                        "creator_name": manager_name,
                        "email": manager_email,
                        "department": dept,
                        "location": p.get("location", "Remote"),
                        "type": p.get("job_type", "Full-time"),
                        "status": status_val,
                        "created_at": date_val,
                        "s3_url": s3_url,
                        "file_name": file_name,
                    }
 
                    # ✅ SMART DEDUPLICATION
                    # If we haven't seen this ID yet, add it.
                    if job_id not in job_map:
                        job_map[job_id] = job_data
                    else:
                        # If we HAVE seen it, check if the new one is "Better" (Open/Active)
                        existing = job_map[job_id]
                        if existing["status"] == "Closed" and status_val in ["Open", "Active"]:
                            # The new one is Open, so replace the Closed one!
                            job_map[job_id] = job_data
                           
            except Exception:
                continue
 
        # Return clean, unique list
        return Response({"results": list(job_map.values())}, status=200)
 
    except Exception as e:
        return Response({"error": str(e)}, status=500)
   
 
# ✅ DELETE JD (New Function)
@api_view(['DELETE'])
def delete_jd(request, job_id):
    try:
        # 1. Auth Check
        user_id = request.session.get('user_id')
        if not user_id:
            return Response({"error": "Unauthorized"}, status=401)
       
        user = AppUser.objects.get(id=user_id)
        collection_name = DEPARTMENT_MAPPING.get(user.department)
       
        if not collection_name:
            return Response({"error": "Invalid department"}, status=400)
 
        print(f"🗑️ Attempting to delete Job ID: {job_id} from {collection_name}")
 
        # 2. Retrieve Point first (to get S3 URL)
        points = qdrant_client.retrieve(
            collection_name=collection_name,
            ids=[job_id]
        )
       
        if not points:
            return Response({"error": "Job not found"}, status=404)
           
        point = points[0]
        payload = point.payload or {}
       
        # 3. Delete from S3
        s3_url = payload.get("s3_url")
        if s3_url:
            try:
                # Extract key from URL (e.g., https://bucket.s3.../jobs/file.pdf -> jobs/file.pdf)
                parsed = urlparse(s3_url)
                key = parsed.path.lstrip('/')
               
                s3.delete_object(Bucket=BUCKET, Key=key)
                print(f"✅ Deleted from S3: {key}")
            except Exception as s3_e:
                print(f"⚠️ S3 Delete Warning: {s3_e}")
 
        # 4. Delete from Qdrant
        qdrant_client.delete(
            collection_name=collection_name,
            points_selector=models.PointIdsList(points=[job_id])
        )
        print(f"✅ Deleted from Qdrant: {job_id}")
       
        return Response({"message": "Job deleted successfully"}, status=200)
 
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)
   
 
 
 
# ✅ TOGGLE JOB STATUS (Fixed with Fallback)
@api_view(['PATCH'])
def update_jd_status(request, job_id):
    print(f"🔄 STATUS TOGGLE REQUEST: {job_id}")
    try:
        user_id = request.session.get('user_id')
        if not user_id:
            return Response({"error": "Unauthorized"}, status=401)
       
        # 1. Find the job in ANY collection
        # (This fixes the issue where it couldn't find the job to update)
        point, collection_name = find_job_and_collection(job_id)
       
        if not point:
            return Response({"error": "Job not found in any department"}, status=404)
           
        payload = point.payload or {}
       
        # 2. Toggle Status Logic
        # If it's "Open", make it "Closed". Otherwise make it "Open".
        current_status = payload.get("status", "Open")
        if current_status in ["Open", "Active"]:
            new_status = "Closed"
        else:
            new_status = "Open"
       
        print(f"   Collection: {collection_name}")
        print(f"   Old Status: {current_status} -> New Status: {new_status}")
 
        # 3. Save to Qdrant (This makes it UNIVERSAL)
        # Because we update the central DB, all other users will see this change.
        qdrant_client.set_payload(
            collection_name=collection_name,
            payload={"status": new_status},
            points=[job_id]
        )
       
        return Response({
            "message": "Status updated successfully",
            "status": new_status,
            "id": job_id
        }, status=200)
 
    except Exception as e:
        print(f"❌ STATUS UPDATE ERROR: {str(e)}")
        return Response({"error": str(e)}, status=500)
   
 
 
# In Backend/resume/job_views.py
 
# ... existing imports ...
 
# ✅ HELPER: Search all collections for a Job ID
def find_job_in_any_collection(job_id):
    # Check every department collection
    for col_name in DEPARTMENT_MAPPING.values():
        try:
            points = qdrant_client.retrieve(collection_name=col_name, ids=[job_id])
            if points:
                return points[0] # Found it!
        except:
            continue
    return None
 
# ✅ 1. ROBUST VIEW FUNCTION
@api_view(['GET'])
def view_jd(request, job_id):
    print(f"👀 VIEW JD REQUEST: {job_id}")
    try:
        # 1. Auth Check
        user_id = request.session.get('user_id')
        if not user_id: return Response({"error": "Unauthorized"}, status=401)
       
        # 2. Find Job in ANY collection (Fixes the Qdrant Error)
        point = find_job_in_any_collection(job_id)
       
        if not point:
            # Now this error means it truly doesn't exist anywhere
            return Response({"error": f"Job ID {job_id} not found in any department"}, status=404)
       
        # 3. Get Metadata
        payload = point.payload or {}
        s3_url = payload.get("s3_url") or payload.get("fileUrl")
       
        if not s3_url:
            return Response({"error": "Database record found, but no S3 Link attached"}, status=404)
 
        # 4. Parse S3 Key
        parsed = urlparse(s3_url)
        file_key = unquote(parsed.path.lstrip('/'))
       
        # 5. Handle Bucket Logic
        jd_bucket_name = os.getenv("S3_BUCKET_JD")
       
        # If the key stored was full path "bucket/jobs/file.pdf", strip the bucket
        if file_key.startswith(f"{jd_bucket_name}/"):
            file_key = file_key[len(jd_bucket_name)+1:]
           
        print(f"   Bucket: {jd_bucket_name}")
        print(f"   Key: {file_key}")
 
        # 6. Fetch from S3
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
 
        s3_object = s3_client.get_object(Bucket=jd_bucket_name, Key=file_key)
        file_content = s3_object['Body'].read()
 
        response = HttpResponse(file_content, content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="job_description.pdf"'
        return response
 
    except Exception as e:
        print(f"❌ VIEW JD ERROR: {str(e)}")
        return HttpResponse(f"Error viewing file: {str(e)}", status=500)
 
 
# ✅ 2. ROBUST DOWNLOAD FUNCTION
@api_view(['GET'])
def download_jd(request, job_id):
    print(f"⬇️ DOWNLOAD JD REQUEST: {job_id}")
    try:
        user_id = request.session.get('user_id')
        if not user_id: return Response({"error": "Unauthorized"}, status=401)
       
        # 1. Find Job (using the same helper)
        point = find_job_in_any_collection(job_id)
        if not point: return Response({"error": "Job not found"}, status=404)
       
        # 2. Extract Data
        payload = point.payload or {}
        s3_url = payload.get("s3_url")
        if not s3_url: return Response({"error": "No file attached"}, status=404)
 
        parsed = urlparse(s3_url)
        file_key = unquote(parsed.path.lstrip('/'))
        filename = os.path.basename(file_key) or "job_description.pdf"
 
        # 3. S3 Fetch
        jd_bucket_name = os.getenv("S3_BUCKET_JD")
       
        if file_key.startswith(f"{jd_bucket_name}/"):
            file_key = file_key[len(jd_bucket_name)+1:]
 
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
 
        s3_object = s3_client.get_object(Bucket=jd_bucket_name, Key=file_key)
        file_content = s3_object['Body'].read()
 
        response = HttpResponse(file_content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
 
    except Exception as e:
        print(f"❌ DOWNLOAD ERROR: {str(e)}")
        return Response({"error": str(e)}, status=500)
 
 
 
def find_job_and_collection(job_id):
    """
    Searches all department collections for a specific Job ID.
    Returns a tuple: (Point, Collection_Name) or (None, None)
    """
    for col_name in DEPARTMENT_MAPPING.values():
        try:
            points = qdrant_client.retrieve(collection_name=col_name, ids=[job_id])
            if points:
                return points[0], col_name
        except:
            continue
    return None, None
 
 
 
@api_view(['PUT'])
def update_job_details(request, job_id):
    print(f"✏️ EDIT JOB REQUEST: {job_id}")
    try:
        user_id = request.session.get('user_id')
        if not user_id: return Response({"error": "Unauthorized"}, status=401)
       
        data = request.data
       
        # 1. Find the job (to get the old S3 key)
        point, collection = find_job_and_collection(job_id)
        if not point: return Response({"error": "Job not found"}, status=404)
 
        payload = point.payload or {}
        old_s3_url = payload.get("s3_url", "")
       
        # 2. Prepare Data for PDF Generation
        # Merge old data with new data so the PDF is complete
        pdf_data = {
            "jobTitle": data.get("job_title", payload.get("job_title")),
            "companyName": data.get("companyName", payload.get("companyName", "My Company")),
            "location": data.get("location", payload.get("location")),
            "jobType": data.get("job_type", payload.get("job_type")),
            "experience": data.get("experience", payload.get("experience_required")),
            "summary": data.get("job_description", payload.get("job_description")),
            "responsibilities": "", # Add these if your edit form has them
            "requiredSkills": ", ".join(data.get("skills", [])), # Convert list to string for PDF
            "postingDate": payload.get("created_at"),
            "status": data.get("status") or payload.get("status") or "Open"
        }
 
        # 3. Generate NEW PDF
        try:
            pdf_buffer = generate_jd_pdf(pdf_data)
            print("✅ New PDF generated.")
        except Exception as e:
            print(f"❌ PDF Gen Failed: {e}")
            return Response({"error": "Failed to regenerate PDF"}, status=500)
 
        # 4. Upload to S3 (Overwrite or New)
        # We try to use the existing filename to save space, or create a new one
        jd_bucket = os.getenv("S3_BUCKET_JD")
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
 
        # Extract old key or make a new one
        file_key = f"jobs/edited_{job_id}_{uuid.uuid4().hex[:4]}.pdf"
        if old_s3_url:
            try:
                parsed = urlparse(old_s3_url)
                extracted_key = unquote(parsed.path.lstrip('/'))
                if extracted_key.startswith(f"{jd_bucket}/"):
                    extracted_key = extracted_key[len(jd_bucket)+1:]
                file_key = extracted_key
            except:
                pass
 
        # Upload
        s3_client.upload_fileobj(
            pdf_buffer,
            jd_bucket,
            file_key,
            ExtraArgs={"ContentType": "application/pdf"}
        )
        new_s3_url = f"https://{jd_bucket}.s3.amazonaws.com/{file_key}"
        print(f"✅ Re-uploaded to S3: {new_s3_url}")
 
        # 5. Update Qdrant Data
        updates = {
            "job_title": pdf_data["jobTitle"],
            "job_description": pdf_data["summary"],
            "location": pdf_data["location"],
            "job_type": pdf_data["jobType"],
            "skills_required": data.get("skills", payload.get("skills_required")),
            "experience_required": pdf_data["experience"],
            "s3_url": new_s3_url, # Update URL just in case name changed
            "file_name": file_key,
            "status": pdf_data["status"],
        }
 
        qdrant_client.set_payload(
            collection_name=collection,
            payload=updates,
            points=[job_id]
        )
 
        return Response({"message": "Job and PDF updated successfully"}, status=200)
 
    except Exception as e:
        print(f"❌ EDIT ERROR: {str(e)}")
        return Response({"error": str(e)}, status=500)
   
 
 
# In Backend/resume/job_views.py
 
@api_view(['GET'])
def get_job_details(request, job_id):
    try:
        user_id = request.session.get('user_id')
        if not user_id: return Response({"error": "Unauthorized"}, status=401)
       
        # Use the helper to find the job
        point, collection = find_job_and_collection(job_id)
       
        if not point:
            return Response({"error": "Job not found"}, status=404)
           
        payload = point.payload or {}
       
        # ✅ CORRECT: Return EVERYTHING.
        # Don't filter or rename keys here. Let the frontend handle the mapping.
        data = {**payload, "id": job_id}
       
        return Response(data, status=200)
 
    except Exception as e:
        return Response({"error": str(e)}, status=500)
 
 