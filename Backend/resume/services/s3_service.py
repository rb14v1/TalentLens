import boto3
import uuid
import re
import os
from botocore.exceptions import ClientError
from django.conf import settings
from dotenv import load_dotenv

load_dotenv()

# ======================================================
# S3 Client
# ======================================================
def _get_s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION_NAME,
    )

# ======================================================
# FIX: Add global S3 client and BUCKET (your views import these)
# ======================================================
s3 = _get_s3_client()
BUCKET = settings.AWS_STORAGE_BUCKET_NAME


# ======================================================
# Upload Resume
# ======================================================
def upload_resume_to_s3(file_obj, content_type, candidate_name=None):
    s3_client = _get_s3_client()
    file_extension = file_obj.name.split('.')[-1]

    # Prepare clean file name
    if candidate_name and candidate_name != "Name Not Found":
        clean_name = candidate_name.strip()
        clean_name = re.sub(r'[^\w\s-]', '', clean_name)
        clean_name = re.sub(r'\s+', '_', clean_name)
        object_name = f"resumes/{clean_name}.{file_extension}"
    else:
        object_name = f"resumes/{uuid.uuid4()}.{file_extension}"

    file_obj.seek(0)

    try:
        s3_client.upload_fileobj(
            Fileobj=file_obj,
            Bucket=BUCKET,
            Key=object_name,
            ExtraArgs={"ContentType": content_type},
        )

        s3_url = f"https://{BUCKET}.s3.{settings.AWS_REGION_NAME}.amazonaws.com/{object_name}"
        return s3_url

    except ClientError as e:
        raise Exception(f"S3 upload failed: {e}")


# ======================================================
# List PDFs
# ======================================================
def list_pdfs(prefix="resumes/"):
    s3_client = _get_s3_client()
    pdf_keys = []

    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                if obj["Key"].lower().endswith(".pdf"):
                    pdf_keys.append(obj["Key"])

    except ClientError as e:
        raise Exception(f"Error listing files in S3: {e}")

    return pdf_keys


# ======================================================
# Read PDF Bytes
# ======================================================
def get_pdf_bytes(pdf_key: str):
    s3_client = _get_s3_client()

    try:
        response = s3_client.get_object(Bucket=BUCKET, Key=pdf_key)
        return response["Body"].read()

    except ClientError as e:
        if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
            raise Exception(f"File not found in S3: {pdf_key}")
        raise


# ======================================================
# Generate Presigned URL
# ======================================================
def get_presigned_url(key: str, expires_in=3600):
    s3_client = _get_s3_client()

    try:
        return s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": BUCKET,
                "Key": key,
                "ResponseContentDisposition": f"inline; filename={key}",
            },
            ExpiresIn=expires_in,
        )

    except ClientError as e:
        raise Exception(f"Failed to generate presigned URL: {e}")
