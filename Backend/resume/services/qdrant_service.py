# resume/services/qdrant_service.py
import os
import time
import uuid
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import (
    PointStruct,
    PointIdsList,
    SearchParams,
    FieldCondition,
    MatchValue,
)

# ======================================================
# Load ENV
# ======================================================
load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "").strip()
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "").strip()
COLLECTION_NAME = "resumes"
VECTOR_SIZE = 384  # must match embedding size

if not QDRANT_URL or not QDRANT_API_KEY:
    print("⚠️ Missing Qdrant credentials in .env")

# ======================================================
# Connect to Qdrant (cloud) with retry
# ======================================================
def connect_qdrant_with_retry(retries: int = 3, delay: int = 2) -> Optional[QdrantClient]:
    for attempt in range(1, retries + 1):
        try:
            client = QdrantClient(
                url=QDRANT_URL,
                api_key=QDRANT_API_KEY,
            )
            print(f"✅ Connected to Qdrant Cloud: {QDRANT_URL}")
            return client
        except Exception as e:
            print(f"⚠️ Retry {attempt}/{retries} failed: {e}")
            time.sleep(delay)
    print("❌ Failed to connect to Qdrant after retries.")
    return None

qdrant_client: Optional[QdrantClient] = connect_qdrant_with_retry()

# ======================================================
# Automatically Create Collection if Not Exists
# ======================================================
def auto_create_collection():
    if not qdrant_client:
        print("⚠️ auto_create_collection: qdrant_client is None")
        return

    try:
        collections = qdrant_client.get_collections().collections
        existing = [c.name for c in collections]
    except Exception as e:
        print(f"⚠️ Failed to list collections: {e}")
        existing = []

    if COLLECTION_NAME not in existing:
        try:
            qdrant_client.recreate_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=VECTOR_SIZE,
                    distance=models.Distance.COSINE,
                ),
            )
            print(f"✅ Collection '{COLLECTION_NAME}' created automatically!")
        except Exception as e:
            print(f"❌ Failed to create collection '{COLLECTION_NAME}': {e}")
    else:
        print(f"ℹ️ Collection '{COLLECTION_NAME}' already exists.")

# ======================================================
# Initialize Collection
# ======================================================
def initialize_qdrant_collection():
    if not qdrant_client:
        print("⚠️ Qdrant not initialized, skipping setup.")
        return

    auto_create_collection()

    INDEX_FIELDS = {
        "experience_years": models.PayloadSchemaType.INTEGER,
        "cpd_level": models.PayloadSchemaType.INTEGER,
        "email": models.PayloadSchemaType.KEYWORD,
        "file_hash": models.PayloadSchemaType.KEYWORD,
        "file_name": models.PayloadSchemaType.KEYWORD,
        "readable_file_name": models.PayloadSchemaType.KEYWORD,
        "skills": models.PayloadSchemaType.KEYWORD,  
    }

    for name, schema in INDEX_FIELDS.items():
        try:
            qdrant_client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name=name,
                field_schema=schema,
            )
            print(f"Index created for {name}")
        except Exception as e:
            # ignore if already exists
            if "already exists" not in str(e).lower():
                print(f"⚠️ Failed index {name}: {e}")

# ======================================================
# Insert Resume
# ======================================================
def insert_resume(resume_data: Dict[str, Any], vector: Optional[List[float]] = None):
    initialize_qdrant_collection()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    vec = vector if vector else [0.0] * VECTOR_SIZE

    if len(vec) != VECTOR_SIZE:
        raise ValueError(f"❌ Invalid embedding size: got {len(vec)}, expected {VECTOR_SIZE}")

    point = PointStruct(
        id=str(uuid.uuid4()),
        vector=vec,
        payload=resume_data
    )

    qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=[point],
        wait=True
    )

    print(f"✅ Inserted resume: {resume_data.get('candidate_name', resume_data.get('name', 'Unknown'))}")

# ======================================================
# Upsert Resume (given deterministic id)
# ======================================================
def upsert_point(point_id: str, vector: List[float], payload: Dict[str, Any]):
    initialize_qdrant_collection()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    if not vector or len(vector) != VECTOR_SIZE:
        raise ValueError(
            f"❌ Invalid embedding size: got {len(vector) if vector else 0}, expected {VECTOR_SIZE}"
        )

    qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=str(point_id),
                vector=vector,
                payload=payload,
            )
        ],
        wait=True,
    )

    print(f"✅ Upserted: {point_id}")

# ======================================================
# Search Collection
# ======================================================
def search_collection(query_vector: List[float], query_filter: Optional[models.Filter] = None, limit: int = 50, min_score: float = 0.30):
    """
    Returns list of matches (objects returned by QdrantClient.search).
    If there are no matches above min_score, returns the full result list (so UI can still show results).
    """
    initialize_qdrant_collection()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    # Ensure query_vector has correct size; allow zero-vector fallback
    if not query_vector or len(query_vector) != VECTOR_SIZE:
        # Use zero vector (semantic will be ignored if filter used)
        query_vector = [0.0] * VECTOR_SIZE

    # Accept models.Filter or None
    q_filter = query_filter if isinstance(query_filter, models.Filter) else None

    try:
        results = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            query_filter=q_filter,
            limit=limit,
            with_payload=True,
            with_vectors=False,
            search_params=SearchParams(exact=False),
        )
    except Exception as e:
        print(f"❌ Qdrant search error: {e}")
        return []

    # Prefer strong matches but fall back to results if none pass threshold
    strong_matches = [r for r in results if (r.score is not None and r.score >= min_score)]
    return strong_matches if strong_matches else results

# ======================================================
# Get All Points
# ======================================================
def get_all_points():
    initialize_qdrant_collection()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    all_records = []
    next_offset = None

    try:
        while True:
            records, next_offset = qdrant_client.scroll(
                collection_name=COLLECTION_NAME,
                with_payload=True,
                with_vectors=False,
                limit=200,
                offset=next_offset,
            )
            all_records.extend(records)

            if not next_offset:
                break

        print(f"✅ Total points fetched: {len(all_records)}")
        return all_records

    except Exception as e:
        print(f"❌ Scroll failed: {e}")
        return []

# ======================================================
# Delete Point
# ======================================================
def delete_point(point_id: str):
    initialize_qdrant_collection()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    try:
        qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.PointIdsList(points=[point_id]),
            wait=True,
        )
    except Exception as e:
        print(f"❌ Qdrant delete error: {e}")

    # verify deletion (best-effort)
    try:
        check = qdrant_client.retrieve(
            collection_name=COLLECTION_NAME,
            ids=[point_id]
        )
        if check:
            print(f"❌ Point {point_id} NOT deleted!")
        else:
            print(f"🗑️ SUCCESS: Deleted point {point_id}")
    except Exception:
        # retrieval may throw if point not found; ignore
        pass

# ======================================================
# Retrieve Point
# ======================================================
def retrieve_point(point_id: str):
    initialize_qdrant_collection()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    try:
        records = qdrant_client.retrieve(
            collection_name=COLLECTION_NAME,
            ids=[point_id],
            with_payload=True,
        )
    except Exception as e:
        raise RuntimeError(f"Qdrant retrieve failed: {e}")

    if not records:
        raise Exception(f"Point {point_id} not found")
    return records[0]

# ======================================================
# Find by Filename
# ======================================================
def find_point_by_filename(file_name: str):
    initialize_qdrant_collection()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    f = models.Filter(
        must=[
            FieldCondition(
                key="readable_file_name",
                match=MatchValue(value=file_name),
            )
        ]
    )

    try:
        records, _ = qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=f,
            limit=1,
            with_payload=True,
        )
        return records[0] if records else None
    except Exception as e:
        print(f"❌ find_point_by_filename error: {e}")
        return None

# ======================================================
# Find Points By Hash
# ======================================================
def find_points_by_hashes(hashes: List[str]):
    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    if not hashes:
        return set()

    try:
        hash_filter = models.Filter(
            should=[
                FieldCondition(
                    key="file_hash",
                    match=MatchValue(value=h)
                ) for h in hashes
            ]
        )

        found_points, _ = qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=hash_filter,
            limit=len(hashes),
            with_payload=["file_hash"]
        )

        return {point.payload["file_hash"] for point in found_points if "file_hash" in point.payload}

    except Exception as e:
        print(f"❌ Qdrant hash check error: {e}")
        return set()

# ======================================================
# Job Collections Config (unchanged)
# ======================================================
JOB_COLLECTIONS = {
    "engineering_it": "Engineering/IT",
    "human_resources": "Human Resources",
    "sales_marketing": "Sales and Marketing",
    "finance_accounting": "Finance and Accounting",
}

# ======================================================
# Auto-create Job Collections
# ======================================================
def auto_create_job_collections():
    if not qdrant_client:
        return

    try:
        collections = qdrant_client.get_collections().collections
        existing = [c.name for c in collections]
    except Exception:
        existing = []

    for collection_key in JOB_COLLECTIONS.keys():
        if collection_key not in existing:
            try:
                qdrant_client.recreate_collection(
                    collection_name=collection_key,
                    vectors_config=models.VectorParams(
                        size=VECTOR_SIZE,
                        distance=models.Distance.COSINE,
                    ),
                )
                print(f"✅ Created {collection_key}")
            except Exception as e:
                print(f"⚠️ Failed to create {collection_key}: {e}")

# ======================================================
# Initialize Job Collections
# ======================================================
def initialize_job_collections():
    if not qdrant_client:
        return

    auto_create_job_collections()

    JOB_INDEX_FIELDS = {
        "s3_url": models.PayloadSchemaType.KEYWORD,
        "job_title": models.PayloadSchemaType.KEYWORD,
        "department": models.PayloadSchemaType.KEYWORD,
        "posting_date": models.PayloadSchemaType.DATETIME,
        "deadline": models.PayloadSchemaType.DATETIME,
    }

    for collection_key in JOB_COLLECTIONS.keys():
        for field_name, field_schema in JOB_INDEX_FIELDS.items():
            try:
                qdrant_client.create_payload_index(
                    collection_name=collection_key,
                    field_name=field_name,
                    field_schema=field_schema,
                )
            except Exception as e:
                if "already exists" not in str(e).lower():
                    print(f"⚠️ Failed index {field_name} in {collection_key}: {e}")

# ======================================================
# Insert Job Posting
# ======================================================
def insert_job_posting(collection_key: str, job_data: Dict[str, Any], vector: Optional[List[float]] = None):
    if collection_key not in JOB_COLLECTIONS:
        raise ValueError("Invalid collection key")

    initialize_job_collections()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    vec = vector if vector else [0.0] * VECTOR_SIZE
    if len(vec) != VECTOR_SIZE:
        raise ValueError(f"❌ Invalid embedding size for job posting: got {len(vec)}, expected {VECTOR_SIZE}")

    point = PointStruct(
        id=str(uuid.uuid4()),
        vector=vec,
        payload=job_data
    )

    qdrant_client.upsert(
        collection_name=collection_key,
        points=[point],
        wait=True
    )

    print(f"✅ Inserted job posting: {job_data.get('job_title', 'Unknown')}")

# ======================================================
# Search Job Collection
# ======================================================
def search_job_collection(collection_key: str, query_vector: List[float], query_filter: Optional[models.Filter] = None, limit: int = 50, min_score: float = 0.30):
    if collection_key not in JOB_COLLECTIONS:
        raise ValueError("Invalid collection_key")

    initialize_job_collections()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    if not query_vector or len(query_vector) != VECTOR_SIZE:
        query_vector = [0.0] * VECTOR_SIZE

    try:
        results = qdrant_client.search(
            collection_name=collection_key,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
    except Exception as e:
        print(f"❌ Job collection search error: {e}")
        return []

    strong_matches = [r for r in results if r.score is not None and r.score >= min_score]
    return strong_matches if strong_matches else results

# ======================================================
# Get All Job Postings
# ======================================================
def get_all_job_postings(collection_key: str):
    if collection_key not in JOB_COLLECTIONS:
        raise ValueError("Invalid collection_key")

    initialize_job_collections()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    all_records = []
    next_offset = None

    try:
        while True:
            records, next_offset = qdrant_client.scroll(
                collection_name=collection_key,
                with_payload=True,
                with_vectors=False,
                limit=200,
                offset=next_offset,
            )
            all_records.extend(records)

            if not next_offset:
                break

        return all_records

    except Exception as e:
        print(f"❌ Scroll failed for {collection_key}: {e}")
        return []

# ======================================================
# Initialize Job Collections on Import
# ======================================================
try:
    initialize_job_collections()
except Exception as e:
    print(f"❌ Job collections initialization error: {e}")

# ======================================================
# ADDITIONAL HELPERS (Minimal additions requested)
# ======================================================
from .embedding_service import get_text_embedding

def _average_embeddings(texts: List[str]) -> List[float]:
    """Compute average embedding for list of texts (safe fallback)."""
    if not texts:
        return [0.0] * VECTOR_SIZE

    embeddings = []
    for t in texts:
        try:
            emb = get_text_embedding(t)
            if emb:
                embeddings.append(emb)
        except Exception:
            pass

    if not embeddings:
        return [0.0] * VECTOR_SIZE

    import numpy as _np
    mean_vec = _np.mean(_np.array(embeddings, dtype=float), axis=0).tolist()

    if len(mean_vec) < VECTOR_SIZE:
        mean_vec += [0.0] * (VECTOR_SIZE - len(mean_vec))
    if len(mean_vec) > VECTOR_SIZE:
        mean_vec = mean_vec[:VECTOR_SIZE]

    return mean_vec

def upsert_resume_with_skills(resume_payload: Dict[str, Any], skills: List[str], point_id: Optional[str] = None) -> str:
    """Create/Upsert a resume but compute vector from skills average."""
    pid = point_id if point_id else str(uuid.uuid4())
    vec = _average_embeddings(skills)
    upsert_point(pid, vec, resume_payload)
    return pid

def add_job_posting_with_embeddings(collection_key: str, job_data: Dict[str, Any], jd_keywords: List[str]) -> str:
    pid = str(uuid.uuid4())
    vec = _average_embeddings(jd_keywords)
    insert_job_posting(collection_key, {**job_data, "point_id": pid}, vec)
    return pid

def match_resume_to_jobs(collection_key: str, resume_skills: List[str], top_k: int = 10):
    vec = _average_embeddings(resume_skills)
    return search_job_collection(collection_key, vec, limit=top_k)

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Simple cosine similarity between two vectors."""
    import math
    n = min(len(a), len(b))
    da = a[:n]
    db = b[:n]
    dot = sum(x * y for x, y in zip(da, db))
    na = math.sqrt(sum(x * x for x in da))
    nb = math.sqrt(sum(y * y for y in db))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
