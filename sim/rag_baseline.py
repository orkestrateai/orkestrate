#!/usr/bin/env python3
"""RAG Baseline Simulator.

Simple chunk-based retrieval with cosine similarity.
No graph. No entity awareness. No temporal chaining.
"""

import json
from pathlib import Path
from typing import List, Dict, Any
import numpy as np

from embedder import Embedder, cosine_similarity
from config import CONFIG


class RAGSimulator:
    def __init__(self):
        self.embedder = Embedder()
        self.chunks: List[Dict[str, Any]] = []

    def ingest_corpus(self, corpus_path: Path):
        """Read corpus and create flat chunks."""
        with open(corpus_path, "r", encoding="utf-8") as f:
            for line in f:
                turn = json.loads(line)
                # RAG uses RAW text — no entity resolution, no coreference
                text = turn["raw_text"]
                embedding = self.embedder.embed(text)
                self.chunks.append({
                    "text": text,
                    "embedding": embedding,
                    "session_id": turn["session_id"],
                    "turn_index": turn["turn_index"],
                    "role": turn["role"],
                    "ground_truth_topics": turn["ground_truth_topics"],
                    "entities": turn["entities"],
                })

    def retrieve(self, query: str, top_k: int = None) -> List[Dict[str, Any]]:
        if top_k is None:
            top_k = CONFIG.top_k_retrieval

        q_emb = self.embedder.embed(query)
        scored = []
        for chunk in self.chunks:
            sim = cosine_similarity(q_emb, chunk["embedding"])
            scored.append((sim, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in scored[:top_k]]

    def answer(self, query: str) -> Dict[str, Any]:
        """Return retrieved chunks as 'answer' + metadata."""
        results = self.retrieve(query)
        return {
            "query": query,
            "retrieved": [
                {
                    "text": r["text"],
                    "session_id": r["session_id"],
                    "turn_index": r["turn_index"],
                    "role": r["role"],
                }
                for r in results
            ],
            "retrieved_count": len(results),
        }
