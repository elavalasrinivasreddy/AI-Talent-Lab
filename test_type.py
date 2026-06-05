from typing import Any

class LangChainEmbeddingFunctionAdapter:
    def __init__(self, lc_embeddings):
        self.lc_embeddings = lc_embeddings
        self.name = "LangChainEmbeddingFunctionAdapter"
        
    def __call__(self, input: Any) -> Any:
        return self.lc_embeddings.embed_documents(input)
