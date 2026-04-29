"""
db/vector_store.py – ChromaDB wrapper.
Provides embeddings storage and retrieval for Job Descriptions and Resumes.
Uses persistent local storage at data/chroma/
"""
import logging
import os
from typing import Optional

from backend.adapters.llm.factory import get_embedding_model

try:
    import chromadb
    from chromadb.config import Settings
    HAS_CHROMA = True
except ImportError:
    HAS_CHROMA = False

logger = logging.getLogger(__name__)

# Path to Chroma DB on disk
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "chroma")

_client = None

def get_chroma_client():
    """Get or initialize the ChromaDB client."""
    global _client
    if not HAS_CHROMA:
        logger.warning("ChromaDB not installed.")
        return None
        
    if _client is None:
        os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
        try:
            _client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
            logger.info(f"Initialized ChromaDB at {CHROMA_PERSIST_DIR}")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            
    return _client


# Simple wrapper for LangChain Embedding Model to Chroma Embedding Function
class LangChainEmbeddingFunctionAdapter:
    def __init__(self, lc_embeddings):
        self.lc_embeddings = lc_embeddings
        
    def __call__(self, input: list[str]) -> list[list[float]]:
        # Chroma passes a list of texts
        return self.lc_embeddings.embed_documents(input)


def get_jd_collection():
    """Get the job descriptions vector collection."""
    client = get_chroma_client()
    if not client:
        return None
        
    lc_model = get_embedding_model()
    
    # Use default model if our chosen LLM provider has no embedding model
    embedding_fn = None
    if lc_model:
        embedding_fn = LangChainEmbeddingFunctionAdapter(lc_model)
        
    # Get or create
    return client.get_or_create_collection(
        name="job_descriptions",
        embedding_function=embedding_fn
    )


async def embed_jd(position_id: int, org_id: int, department_id: Optional[int], role_name: str, jd_text: str):
    """
    Insert or update a Job Description in ChromaDB.
    """
    collection = get_jd_collection()
    if not collection:
        return

    try:
        metadata = {"org_id": org_id, "role_name": role_name}
        if department_id:
            metadata["department_id"] = department_id
            
        collection.upsert(
            documents=[jd_text],
            metadatas=[metadata],
            ids=[f"pos_{position_id}"]
        )
        logger.info(f"Embedded JD for position {position_id} (org {org_id})")
    except Exception as e:
        logger.error(f"Failed to embed JD: {e}")


async def search_similar(query_text: str, org_id: int, department_id: Optional[int] = None, top_k: int = 3) -> list[dict]:
    """
    Search for similar JDs within the same organization.
    """
    collection = get_jd_collection()
    if not collection:
        return []

    try:
        # Enforce tenant isolation (only search within the same org)
        where_clause = {"org_id": org_id}
        
        # Optional: Boost/filter by department if provided
        # Or we can just search the whole org. We'll search the whole org for internal check.
        
        results = collection.query(
            query_texts=[query_text],
            n_results=top_k,
            where=where_clause
        )
        
        matched_jds = []
        if results and results.get("documents") and len(results["documents"]) > 0:
            docs = results["documents"][0]
            metadatas = results["metadatas"][0]
            distances = results["distances"][0] if "distances" in results else [0]*len(docs)
            
            for doc, meta, dist in zip(docs, metadatas, distances):
                matched_jds.append({
                    "id": meta.get("id"), # Might not be in metadata if we used purely chromadb ID
                    "role_name": meta.get("role_name", "Unknown Role"),
                    "department": meta.get("department_id"),
                    "text": doc,
                    "distance": dist
                })
                
        return matched_jds
        
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return []


async def delete_jd(position_id: int):
    """Remove a JD from the vector store."""
    collection = get_jd_collection()
    if not collection:
        return
        
    try:
        collection.delete(ids=[f"pos_{position_id}"])
        logger.info(f"Deleted vector for position {position_id}")
    except Exception as e:
        logger.error(f"Failed to delete vector: {e}")
