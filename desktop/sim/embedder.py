#!/usr/bin/env python3
"""Embedding client — mock for development, OpenRouter for real runs."""

import hashlib
import numpy as np
from typing import List

from config import CONFIG


class Embedder:
    def __init__(self):
        self._cache: dict = {}

    def embed(self, text: str) -> np.ndarray:
        """Return a normalized embedding vector for text."""
        if text in self._cache:
            return self._cache[text]

        if CONFIG.use_mock_embeddings:
            vec = self._mock_embed(text)
        else:
            vec = self._openrouter_embed(text)

        # Normalize
        vec = vec / (np.linalg.norm(vec) + 1e-9)
        self._cache[text] = vec
        return vec

    def embed_batch(self, texts: List[str]) -> List[np.ndarray]:
        return [self.embed(t) for t in texts]

    def _mock_embed(self, text: str) -> np.ndarray:
        """Deterministic mock embedding with STRONG entity anchoring.

        The design goal: entity mentions should DOMINATE the vector space
        so that texts about different entities are clearly separable.
        This is critical for testing pronoun resolution / entity-aware memory.
        """
        lowered = text.lower()

        # Start with very small random noise (0.1 std)
        h = hashlib.sha256(text.encode()).hexdigest()
        seed = int(h[:8], 16) % (2**31)
        rng = np.random.RandomState(seed)
        vec = rng.randn(CONFIG.embedding_dim).astype(np.float32) * 0.1

        # Entity/concept anchors — VERY strong signal
        # Each entity gets a dedicated block of 8 dimensions with high values
        entity_blocks = {
            "karan": (0, 8),
            "blockchain": (8, 16),
            "google next": (16, 24),
            "writing": (24, 32),
            "orkestrate": (32, 40),
            "memory": (40, 48),
            "keiyara": (48, 56),
            "prabha": (56, 64),
            "user": (56, 64),  # Alias
            "tired": (64, 72),
            "coffee": (72, 80),
            "oat milk": (80, 88),
            "black coffee": (72, 80),  # Shares block with coffee
            "tea": (80, 88),  # Near oat milk
            "burnout": (88, 96),
            "recovery": (96, 104),
            "night owl": (104, 112),
            "health": (112, 120),
            "travel": (120, 128),
            "japan": (120, 128),
            "tokyo": (120, 128),
            "kyoto": (120, 128),
        }

        for entity, (start, end) in entity_blocks.items():
            if entity in lowered:
                # Inject strong positive signal in entity's block
                block_size = end - start
                vec[start:end] += 5.0 + np.random.RandomState(seed + start).rand(block_size).astype(np.float32) * 2.0

        # Sentiment/concept signals (secondary, cross-cutting)
        sentiment_dims = {
            "excited": 200, "huge": 200, "great": 200, "love": 200,
            "doubt": 201, "not": 201, "dead": 201, "failed": 201,
            "deprioritized": 201, "dropped": 201, "withdrew": 201,
        }
        for word, dim in sentiment_dims.items():
            if word in lowered:
                vec[dim % CONFIG.embedding_dim] += 3.0

        return vec

    def _openrouter_embed(self, text: str) -> np.ndarray:
        import requests
        resp = requests.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers={
                "Authorization": f"Bearer {CONFIG.openrouter_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": CONFIG.openrouter_model,
                "input": text,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return np.array(data["data"][0]["embedding"], dtype=np.float32)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
