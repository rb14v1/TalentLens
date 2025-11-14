from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

def get_text_embedding(text: str):
    if not text:
        return [0.0] * model.get_sentence_embedding_dimension()
    emb = model.encode(text)
    return emb.tolist()
