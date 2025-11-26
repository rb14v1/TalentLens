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
from urllib.parse import urlparse # ✅ Imported for parsing S3 URLs


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
    

from .services.qdrant_service import get_all_job_postings

# ... existing imports ...

# ✅ HELPER: Checks multiple keys to find data (Handles camelCase vs snake_case)
def get_val(payload, keys, default=None):
    for k in keys:
        val = payload.get(k)
        if val: return val
    return default

# ✅ LIST JOBS (Robust Version)
@api_view(['GET'])
def list_jobs(request):
    try:
        user_id = request.session.get('user_id')
        if not user_id:
            return Response({"error": "Unauthorized"}, status=401)
            
        user = AppUser.objects.get(id=user_id)
        user_dept = user.department
        
        collection_name = DEPARTMENT_MAPPING.get(user_dept, "engineering_it")
        print(f"🔍 DEBUG: Fetching '{collection_name}' for Dept '{user_dept}'")

        raw_jobs = get_all_job_postings(collection_name)
        formatted_jobs = []

        for point in raw_jobs:
            payload = point.payload or {}
            
            # 1. Strict Department Filter
            job_dept = payload.get("department")
            if job_dept and job_dept != user_dept:
                continue 

            # 2. FORCE DATE CHECK
            # We check 'postingDate' explicitly because that is what is in your DB screenshot
            date_val = payload.get("postingDate") 
            
            # Backup checks
            if not date_val:
                date_val = payload.get("created_at") or payload.get("posting_date") or "No Date Found"

            # Debug print to terminal to verify what we found
            print(f"   - Job: {payload.get('job_title')} | Date Found: {date_val}")

            # 3. Get other fields
            manager_name = payload.get("hiringManagerName") or payload.get("creator_name") or "Unknown"
            manager_email = payload.get("creator_email") or payload.get("email") or ""

            formatted_jobs.append({
                "id": point.id,
                "title": payload.get("job_title", "Untitled"),
                "creator_name": manager_name, 
                "email": manager_email, 
                "department": job_dept,
                "location": payload.get("location", "Remote"),
                "type": payload.get("job_type", "Full-time"),
                "status": payload.get("status", "Open"),
                
                # ✅ This sends the found date to the frontend
                "created_at": date_val,
                
                "s3_url": payload.get("s3_url"),
                "file_name": payload.get("file_name"),
            })

        return Response({"results": formatted_jobs}, status=200)

    except Exception as e:
        print(f"❌ ERROR in list_jobs: {str(e)}")
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
    


# ... (Keep your existing imports)

# ✅ TOGGLE JOB STATUS (Fixed with Fallback)
@api_view(['PATCH'])
def update_jd_status(request, job_id):
    try:
        user_id = request.session.get('user_id')
        if not user_id:
            return Response({"error": "Unauthorized"}, status=401)
        
        user = AppUser.objects.get(id=user_id)
        
        # ✅ FIX: Use the same fallback as list/publish
        collection_name = DEPARTMENT_MAPPING.get(user.department, "engineering_it")
        
        print(f"🔄 Updating status for {job_id} in {collection_name}")

        # 1. Get the current job data
        points = qdrant_client.retrieve(
            collection_name=collection_name,
            ids=[job_id]
        )
        
        if not points:
            return Response({"error": "Job not found"}, status=404)
            
        point = points[0]
        payload = point.payload or {}
        
        # 2. Toggle the status
        current_status = payload.get("status", "Open")
        new_status = "Closed" if current_status == "Open" else "Open"
        
        # 3. Update Qdrant Payload
        qdrant_client.set_payload(
            collection_name=collection_name,
            payload={"status": new_status},
            points=[job_id]
        )
        
        return Response({"message": "Status updated", "status": new_status}, status=200)

    except Exception as e:
        # Print error to terminal so we can see it
        print(f"❌ Status Update Error: {str(e)}")
        return Response({"error": str(e)}, status=500)