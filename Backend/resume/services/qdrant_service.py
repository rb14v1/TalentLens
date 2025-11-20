import os
import time
import uuid
from dotenv import load_dotenv

from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import (
    PointStruct,
    PointIdsList,
    Filter,
    SearchParams,
)
from qdrant_client.http.models import Filter, FieldCondition, MatchValue

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
def connect_qdrant_with_retry(retries=3, delay=2):
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

qdrant_client = connect_qdrant_with_retry()


# ======================================================
# Automatically Create Collection if Not Exists
# ======================================================
def auto_create_collection():
    collections = qdrant_client.get_collections().collections
    existing = [c.name for c in collections]

    if COLLECTION_NAME not in existing:
        qdrant_client.recreate_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=VECTOR_SIZE,
                distance=models.Distance.COSINE,
            ),
        )
        print(f"✅ Collection '{COLLECTION_NAME}' created automatically!")
    else:
        print(f"ℹ️ Collection '{COLLECTION_NAME}' already exists.")


# ======================================================
# Initialize Collection
# ======================================================
def initialize_qdrant_collection():
    if not qdrant_client:
        print("⚠️ Qdrant not initialized, skipping setup.")
        return

    auto_create_collection()  # <-- Added auto-create logic

    # Create payload indexes
    INDEX_FIELDS = {
        "experience_years": models.PayloadSchemaType.INTEGER,
        "cpd_level": models.PayloadSchemaType.INTEGER,
        "email": models.PayloadSchemaType.KEYWORD,
        "file_hash": models.PayloadSchemaType.KEYWORD,
        "file_name": models.PayloadSchemaType.KEYWORD,
        "readable_file_name": models.PayloadSchemaType.KEYWORD,
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
            if "already exists" not in str(e):
                print(f"⚠️ Failed index {name}: {e}")


# ======================================================
# Insert Resume (Zero Vector Default)
# ======================================================
def insert_resume(resume_data: dict, vector: list = None):
    """
    Insert a resume into Qdrant.
    If no vector is provided, a zero vector of size 384 is used.
    """
    initialize_qdrant_collection()

    point = PointStruct(
        id=str(uuid.uuid4()),
        vector=vector if vector else [0] * VECTOR_SIZE,
        payload=resume_data
    )

    qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=[point],
        wait=True
    )

    print(f"✅ Inserted resume: {resume_data.get('name', 'Unknown')}")


# ======================================================
# Upsert (Insert/Update)
# ======================================================
def upsert_point(point_id, vector, payload):
    initialize_qdrant_collection()

    if not vector or len(vector) != VECTOR_SIZE:
        raise ValueError(
            f"❌ Invalid embedding size: got {len(vector)}, expected {VECTOR_SIZE}"
        )

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

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
# Search
# ======================================================
def search_collection(query_vector, query_filter=None, limit=50, min_score=0.30):
    initialize_qdrant_collection()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    results = qdrant_client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        query_filter=query_filter if isinstance(query_filter, models.Filter) else None,
        limit=limit,
        with_payload=True,
        with_vectors=False,
        search_params=SearchParams(exact=False),
    )

    strong_matches = [r for r in results if r.score >= min_score]
    return strong_matches if strong_matches else results


# ======================================================
# Get All Points (FULL scroll)
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

            if next_offset is None:
                break

        print(f"✅ Total points fetched: {len(all_records)}")
        return all_records

    except Exception as e:
        print(f"❌ Scroll failed: {e}")
        return []


# ======================================================
# Delete (With Verification)
# ======================================================
def delete_point(point_id):
    initialize_qdrant_collection()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    # 1. Perform the delete
    qdrant_client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=models.PointIdsList(points=[point_id]),
        wait=True,
    )
    
    # 2. Verify it's actually gone
    try:
        check = qdrant_client.retrieve(
            collection_name=COLLECTION_NAME,
            ids=[point_id]
        )
        if check:
            print(f"❌ CRITICAL ERROR: Point {point_id} was NOT deleted! (Qdrant issue)")
        else:
            print(f"🗑️ SUCCESS: Verified deletion for point {point_id}")
    except Exception as e:
        print(f"⚠️ Could not verify delete: {e}")


# ======================================================
# Retrieve
# ======================================================
def retrieve_point(point_id):
    initialize_qdrant_collection()

    if not qdrant_client:
        raise RuntimeError("❌ Qdrant not initialized")

    records = qdrant_client.retrieve(
        collection_name=COLLECTION_NAME,
        ids=[point_id],
        with_payload=True,
    )

    if not records:
        raise Exception(f"Point {point_id} not found")
    return records[0]


# ======================================================
# Find Point by Filename
# ======================================================
def find_point_by_filename(file_name: str):
    initialize_qdrant_collection()

    f = Filter(
        must=[
            models.FieldCondition(
                key="readable_file_name",
                match=models.MatchValue(value=file_name),
            )
        ]
    )

    records, _ = qdrant_client.scroll(
        collection_name=COLLECTION_NAME,
        scroll_filter=f,
        limit=1,
        with_payload=True,
    )

    if not records:
        return None

    return records[0]


# ======================================================
# Initialize on import
# ======================================================
try:
    initialize_qdrant_collection()
except Exception as e:
    print(f"❌ Qdrant initialization error: {e}")


# ============================================================
# ✅ Find Points by Hash (FIXED)
# ============================================================
def find_points_by_hashes(hashes: list):
    """
    Finds points in the 'resumes' collection that match any of the provided file hashes.
    Returns a set of hashes that were found.
    """
    if not qdrant_client:  # <-- Also add this check
        raise RuntimeError("❌ Qdrant not initialized")
        
    if not hashes:
        return set()
    
    try:
        hash_filter = Filter(
            should=[
                FieldCondition(
                    key="file_hash",
                    match=MatchValue(value=h)
                ) for h in hashes
            ]
        )

        # ✅ FIX: Use 'qdrant_client.scroll' to match the client name in this file
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