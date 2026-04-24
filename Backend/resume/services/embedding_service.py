import os

from sentence_transformers import SentenceTransformer


MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
VECTOR_SIZE = 384
_model = None
_model_load_failed = False


def _get_model():
    global _model, _model_load_failed

    if _model is not None:
        return _model

    if _model_load_failed:
        return None

    try:
        _model = SentenceTransformer(MODEL_NAME)
        return _model
    except Exception as exc:
        _model_load_failed = True
        print(f"Warning: failed to load embedding model '{MODEL_NAME}': {exc}")
        return None


def get_text_embedding(text: str):
    model = _get_model()
    if model is None:
        return [0.0] * VECTOR_SIZE

    if not text:
        return [0.0] * model.get_sentence_embedding_dimension()

    emb = model.encode(text)
    return emb.tolist()
