"""
db/vector_store.py – ChromaDB Vector Store for Historical JDs
Stores and retrieves past job descriptions for semantic similarity search.
Embedding model is configurable via EMBEDDING_MODEL in .env.
"""
import os
import chromadb
from chromadb.utils import embedding_functions

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma")
COLLECTION_NAME = "historical_jds"

# Configurable embedding model from .env
_embedding_model = os.getenv("EMBEDDING_MODEL", "default")

if _embedding_model and _embedding_model != "default":
    # Use SentenceTransformer (requires sentence-transformers + torch)
    _ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=_embedding_model
    )
else:
    # Built-in ONNX-based embedding — no extra install needed
    _ef = embedding_functions.DefaultEmbeddingFunction()


_client = chromadb.PersistentClient(path=CHROMA_PATH)


def _get_collection():
    return _client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=_ef,
        metadata={"hnsw:space": "cosine"},
    )


def seed_sample_jds():
    """
    Seed a few representative historical JDs so the internal analyst has
    something to compare against. Call this once on startup.
    """
    collection = _get_collection()

    sample_jds = [
        {
            "id": "jd-001",
            "text": """
                Senior Python Developer – AI Talent Lab (Hired 2024)
                Role: Senior Python Developer
                Experience: 5+ years
                Skills: Python, FastAPI, PostgreSQL, Redis, Docker, Kubernetes, REST APIs,
                        System Design, Microservices, CI/CD (GitHub Actions), AWS.
                Soft Skills: Strong communication, ability to work in async remote teams.
                Compensation: $120k–$150k
                Outcome: Hired. Candidate had strong FastAPI and container orchestration background.
            """,
            "meta": {"role": "Senior Python Developer", "year": "2024", "outcome": "hired"},
        },
        {
            "id": "jd-002",
            "text": """
                ML Engineer – AI Talent Lab (Hired 2024)
                Role: Machine Learning Engineer
                Experience: 4+ years
                Skills: Python, PyTorch, TensorFlow, MLflow, Feature Engineering, SQL,
                        Pandas, scikit-learn, Docker, FastAPI for model serving.
                Education: MS in Computer Science or related field preferred.
                Outcome: Hired. Strong MLflow and serving experience were differentiators.
            """,
            "meta": {"role": "ML Engineer", "year": "2024", "outcome": "hired"},
        },
        {
            "id": "jd-003",
            "text": """
                Full Stack Engineer – AI Talent Lab (Draft 2023)
                Role: Full Stack Engineer
                Experience: 3-5 years
                Skills: React, TypeScript, Python, FastAPI, PostgreSQL, GraphQL,
                        Tailwind CSS, Docker, Agile/Scrum.
                Location: Remote-first (India or US timezones).
                Status: Draft — position was later merged with Backend role.
            """,
            "meta": {"role": "Full Stack Engineer", "year": "2023", "outcome": "draft"},
        },
        {
            "id": "jd-004",
            "text": """
                DevOps Engineer – AI Talent Lab (Closed 2025)
                Role: DevOps / Platform Engineer
                Experience: 5+ years
                Skills: Kubernetes, Terraform, AWS (EKS, RDS, S3, CloudFront), GitHub Actions,
                        Prometheus, Grafana, SRE practices, Python scripting.
                Certifications: AWS Solutions Architect preferred.
                Outcome: Closed. Position was outsourced to a managed DevOps firm.
            """,
            "meta": {"role": "DevOps Engineer", "year": "2025", "outcome": "closed"},
        },
        {
            "id": "jd-005",
            "text": """
                Backend Python Developer – AI Talent Lab (Hired 2025)
                Role: Backend Developer (Python)
                Experience: 3+ years
                Skills: Python, Django REST Framework, PostgreSQL, Celery, Redis, RabbitMQ,
                        Unit Testing (pytest), Git, Code Reviews.
                Note: Previous hire had strong asynchronous task queue experience.
            """,
            "meta": {"role": "Backend Python Developer", "year": "2025", "outcome": "hired"},
        },
    ]

    existing_ids = set(collection.get()["ids"])
    new_docs = [d for d in sample_jds if d["id"] not in existing_ids]

    if new_docs:
        collection.add(
            documents=[d["text"] for d in new_docs],
            metadatas=[d["meta"] for d in new_docs],
            ids=[d["id"] for d in new_docs],
        )


def search_similar_jds(query: str, n_results: int = 3) -> list[dict]:
    """
    Search for semantically similar past JDs.
    Returns a list of dicts with 'text' and 'metadata'.
    """
    collection = _get_collection()

    count = collection.count()
    if count == 0:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(n_results, count),
    )

    hits = []
    for i in range(len(results["ids"][0])):
        hits.append({
            "id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        })
    return hits


def store_jd(jd_id: str, role_name: str, markdown_text: str, session_id: str):
    """Persist a newly generated JD into ChromaDB for future reference."""
    collection = _get_collection()
    collection.upsert(
        documents=[markdown_text],
        metadatas=[{"role": role_name, "session_id": session_id, "year": "2025"}],
        ids=[jd_id],
    )


# Seed on import (idempotent — skips existing IDs)
seed_sample_jds()
