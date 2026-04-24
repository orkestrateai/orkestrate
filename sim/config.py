#!/usr/bin/env python3
"""Configuration for GAM simulation."""

import os
from dataclasses import dataclass


@dataclass
class SimConfig:
    # Embedding dimensions
    embedding_dim: int = 768  # Reduced for mock; OpenRouter is 2048

    # Semantic thresholds
    semantic_shift_threshold: float = 0.30  # Cosine distance; ~0.7 similarity
    topic_association_threshold: float = 0.25  # Cosine distance

    # Mock vs real embeddings
    use_mock_embeddings: bool = True  # Set False for OpenRouter calls
    openrouter_key: str = os.environ.get("OPENROUTER_KEY", "")
    openrouter_model: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free"

    # Batch / simulation params
    batch_size: int = 8
    max_event_topic_promotion: int = 20  # Epsilon compresses beyond this

    # Graph walk params
    max_graph_hops: int = 3
    top_k_retrieval: int = 5


CONFIG = SimConfig()
