#!/usr/bin/env python3
"""GAM Simulator: Multi-Agent Graph-Based Memory System.

Agents:
- Alpha (Event Curator): creates events, progression edges, detects semantic shifts
- Beta (Topic Synthesizer): promotes event subgraphs to topics, topic-topic associations
- Gamma (Retrieval Navigator): graph walks (event progression + topic associations)
- Delta (Contradiction Arbiter): detects contradictions between topics

Entity-aware: Alpha resolves coreference before embedding/topic promotion.
"""

import json
import math
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
import numpy as np

from embedder import Embedder, cosine_similarity
from config import CONFIG


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Event:
    id: str
    session_id: str
    turn_index: int
    role: str
    raw_text: str
    resolved_text: str
    entities: List[str]
    embedding: np.ndarray
    topic_id: Optional[str] = None
    created_at: int = field(default_factory=lambda: 0)  # order index


@dataclass
class Topic:
    id: str
    name: str
    summary: str
    embedding: np.ndarray
    anchor_event_id: str
    event_ids: List[str] = field(default_factory=list)
    last_accessed: int = 0


@dataclass
class Edge:
    from_id: str
    to_id: str
    edge_type: str
    weight: float


@dataclass
class Contradiction:
    id: str
    topic_a_id: str
    topic_b_id: str
    topic_a_summary: str
    topic_b_summary: str
    status: str = "contested"
    pressure_score: int = 1


# ---------------------------------------------------------------------------
# Graph Store
# ---------------------------------------------------------------------------

class GraphStore:
    def __init__(self):
        self.events: Dict[str, Event] = {}
        self.topics: Dict[str, Topic] = {}
        self.event_edges: List[Edge] = []  # progression edges
        self.topic_edges: List[Edge] = []  # associations
        self.cross_edges: List[Edge] = []  # event->topic
        self.contradictions: List[Contradiction] = []
        self._counter = 0

    def next_id(self, prefix: str) -> str:
        self._counter += 1
        return f"{prefix}_{self._counter}"

    def get_event_chain(self, session_id: str) -> List[Event]:
        return sorted(
            [e for e in self.events.values() if e.session_id == session_id],
            key=lambda e: e.turn_index,
        )

    def get_topic_events(self, topic_id: str) -> List[Event]:
        return [self.events[eid] for eid in self.topics[topic_id].event_ids]

    def find_related_topics(self, embedding: np.ndarray, threshold: float = None) -> List[Tuple[Topic, float]]:
        if threshold is None:
            threshold = CONFIG.topic_association_threshold
        related = []
        for topic in self.topics.values():
            sim = cosine_similarity(embedding, topic.embedding)
            if sim >= (1.0 - threshold):  # threshold is distance-ish
                related.append((topic, sim))
        related.sort(key=lambda x: x[1], reverse=True)
        return related


# ---------------------------------------------------------------------------
# Alpha: Event Curator
# ---------------------------------------------------------------------------

class AlphaAgent:
    """Creates events with resolved text, detects semantic shifts."""

    def __init__(self, graph: GraphStore, embedder: Embedder):
        self.graph = graph
        self.embedder = embedder
        self.session_emas: Dict[str, np.ndarray] = {}  # exponential moving average per session
        self.session_last_shift: Dict[str, int] = {}  # event index since last shift

    def process_turn(self, turn: Dict[str, Any]) -> Event:
        sid = turn["session_id"]
        resolved = turn["resolved_text"]
        emb = self.embedder.embed(resolved)

        event = Event(
            id=self.graph.next_id("evt"),
            session_id=sid,
            turn_index=turn["turn_index"],
            role=turn["role"],
            raw_text=turn["raw_text"],
            resolved_text=resolved,
            entities=turn["entities"],
            embedding=emb,
            created_at=self.graph._counter,
        )
        self.graph.events[event.id] = event

        # Progression edge from previous event in same session
        chain = self.graph.get_event_chain(sid)
        if len(chain) >= 2:
            prev = chain[-2]
            self.graph.event_edges.append(Edge(
                from_id=prev.id,
                to_id=event.id,
                edge_type="progression",
                weight=1.0,
            ))

        # Semantic shift detection via EMA drift
        if sid not in self.session_emas:
            self.session_emas[sid] = emb.copy()
            self.session_last_shift[sid] = 0
        else:
            ema = self.session_emas[sid]
            sim = cosine_similarity(emb, ema)
            drift = 1.0 - sim

            # Update EMA
            alpha = 0.3
            self.session_emas[sid] = alpha * emb + (1 - alpha) * ema

            if drift > CONFIG.semantic_shift_threshold:
                # Flag the subgraph since last shift for promotion
                since = self.session_last_shift[sid]
                recent_chain = [e for e in chain if e.created_at >= since]
                if len(recent_chain) >= 2:
                    # Trigger Beta promotion for this subgraph
                    pass  # Beta will be called externally after Alpha batch
                self.session_last_shift[sid] = event.created_at

        return event


# ---------------------------------------------------------------------------
# Beta: Topic Synthesizer
# ---------------------------------------------------------------------------

class BetaAgent:
    """Promotes event subgraphs to topics, creates topic-topic edges."""

    def __init__(self, graph: GraphStore, embedder: Embedder):
        self.graph = graph
        self.embedder = embedder

    def promote_topic(self, events: List[Event]) -> Topic:
        # Generate name and summary from resolved texts
        texts = [e.resolved_text for e in events]
        # Simple heuristic: name from most common entity or first sentence fragment
        name = self._generate_name(events)
        summary = self._generate_summary(texts)
        emb = self.embedder.embed(summary)

        topic = Topic(
            id=self.graph.next_id("top"),
            name=name,
            summary=summary,
            embedding=emb,
            anchor_event_id=events[0].id,
            event_ids=[e.id for e in events],
        )
        self.graph.topics[topic.id] = topic

        # Cross-layer edges
        for e in events:
            e.topic_id = topic.id
            self.graph.cross_edges.append(Edge(
                from_id=e.id,
                to_id=topic.id,
                edge_type="promotion",
                weight=1.0,
            ))

        # Topic-topic associations
        related = self.graph.find_related_topics(emb)
        for rel_topic, sim in related[:3]:  # top 3
            if rel_topic.id == topic.id:
                continue
            self.graph.topic_edges.append(Edge(
                from_id=topic.id,
                to_id=rel_topic.id,
                edge_type="association",
                weight=sim,
            ))

        return topic

    def _generate_name(self, events: List[Event]) -> str:
        # Use most frequent non-USER entity, or fallback to first few words
        entity_counts = defaultdict(int)
        for e in events:
            for ent in e.entities:
                if not ent.startswith("USER:"):
                    entity_counts[ent] += 1
        if entity_counts:
            top = max(entity_counts, key=entity_counts.get)
            return top.replace("PROJECT:", "").replace("PERSON:", "").replace("EVENT:", "")
        words = events[0].resolved_text.split()[:3]
        return " ".join(words)

    def _generate_summary(self, texts: List[str]) -> str:
        # Naive: join first 100 chars of each
        parts = []
        for t in texts:
            clean = t.replace("[ENTITY:", "").replace("]", "")
            parts.append(clean)
        joined = " | ".join(parts)
        return joined[:300] if len(joined) > 300 else joined


# ---------------------------------------------------------------------------
# Gamma: Retrieval Navigator
# ---------------------------------------------------------------------------

class GammaAgent:
    """Graph-walk retrieval: event progression + topic associations."""

    def __init__(self, graph: GraphStore, embedder: Embedder):
        self.graph = graph
        self.embedder = embedder

    def retrieve(self, query: str, current_event_id: Optional[str] = None) -> List[Dict[str, Any]]:
        q_emb = self.embedder.embed(query)
        visited = set()
        candidates = []

        # Strategy 1: Anchor from best-matching events (or provided current event)
        anchor_events = []
        if current_event_id and current_event_id in self.graph.events:
            anchor_events.append(self.graph.events[current_event_id])
        else:
            # Find top 3 matching events directly
            event_scores = []
            for evt in self.graph.events.values():
                sim = cosine_similarity(q_emb, evt.embedding)
                event_scores.append((sim, evt))
            event_scores.sort(key=lambda x: x[0], reverse=True)
            anchor_events = [evt for _, evt in event_scores[:3]]

        for anchor in anchor_events:
            walk_results = self._walk_progression(anchor.id, steps=5, visited=visited)
            candidates.extend(walk_results)
            # Also walk forward from anchor
            forward_results = self._walk_forward(anchor.id, steps=3, visited=visited)
            candidates.extend(forward_results)

        # Strategy 2: Explore topic graph from topics of anchor events
        topic_anchors = set()
        for evt in anchor_events:
            if evt.topic_id:
                topic_anchors.add(evt.topic_id)

        # Also find nearest topics by embedding
        nearest_topics = self._nearest_topics(q_emb, top_n=3)
        for t, _ in nearest_topics:
            topic_anchors.add(t.id)

        for tid in topic_anchors:
            topic = self.graph.topics.get(tid)
            if topic:
                topic_results = self._explore_topic_graph(topic, q_emb, visited)
                candidates.extend(topic_results)

        # Strategy 3: Direct semantic search over all events as fallback
        if len(candidates) < CONFIG.top_k_retrieval:
            fallback = self._semantic_event_search(q_emb, visited)
            candidates.extend(fallback)

        # Deduplicate and rank
        seen = set()
        unique = []
        for c in candidates:
            key = c.get("event_id") or c.get("topic_id")
            if key and key not in seen:
                seen.add(key)
                unique.append(c)

        # Rank by combined score
        ranked = self._rank_results(unique, q_emb)
        return ranked[:CONFIG.top_k_retrieval]

    def _walk_progression(self, event_id: str, steps: int, visited: set) -> List[Dict[str, Any]]:
        results = []
        current = event_id
        for _ in range(steps):
            prev_edges = [e for e in self.graph.event_edges if e.to_id == current and e.edge_type == "progression"]
            if not prev_edges:
                break
            prev = prev_edges[0].from_id
            if prev in visited:
                break
            visited.add(prev)
            evt = self.graph.events.get(prev)
            if evt:
                results.append({
                    "type": "event",
                    "event_id": evt.id,
                    "text": evt.resolved_text,
                    "session_id": evt.session_id,
                    "turn_index": evt.turn_index,
                    "score": 0.9,
                })
            current = prev
        return results

    def _walk_forward(self, event_id: str, steps: int, visited: set) -> List[Dict[str, Any]]:
        results = []
        current = event_id
        for _ in range(steps):
            next_edges = [e for e in self.graph.event_edges if e.from_id == current and e.edge_type == "progression"]
            if not next_edges:
                break
            nxt = next_edges[0].to_id
            if nxt in visited:
                break
            visited.add(nxt)
            evt = self.graph.events.get(nxt)
            if evt:
                results.append({
                    "type": "event",
                    "event_id": evt.id,
                    "text": evt.resolved_text,
                    "session_id": evt.session_id,
                    "turn_index": evt.turn_index,
                    "score": 0.85,
                })
            current = nxt
        return results

    def _nearest_topics(self, q_emb: np.ndarray, top_n: int = 3) -> List[tuple]:
        scored = []
        for topic in self.graph.topics.values():
            sim = cosine_similarity(q_emb, topic.embedding)
            scored.append((sim, topic))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [(t, s) for s, t in scored[:top_n] if s > 0.05]

    def _explore_topic_graph(self, start_topic: Topic, q_emb: np.ndarray, visited: set) -> List[Dict[str, Any]]:
        results = []
        queue = [(start_topic, 0)]
        topic_visited = set()

        while queue:
            topic, depth = queue.pop(0)
            if topic.id in topic_visited or depth > CONFIG.max_graph_hops:
                continue
            topic_visited.add(topic.id)

            for eid in topic.event_ids:
                if eid not in visited:
                    visited.add(eid)
                    evt = self.graph.events[eid]
                    sim = cosine_similarity(q_emb, evt.embedding)
                    results.append({
                        "type": "event",
                        "event_id": evt.id,
                        "text": evt.resolved_text,
                        "session_id": evt.session_id,
                        "turn_index": evt.turn_index,
                        "topic_id": topic.id,
                        "score": sim * (1.0 - depth * 0.15),
                    })

            for edge in self.graph.topic_edges:
                if edge.from_id == topic.id and edge.to_id not in topic_visited:
                    next_topic = self.graph.topics.get(edge.to_id)
                    if next_topic:
                        queue.append((next_topic, depth + 1))
                elif edge.to_id == topic.id and edge.from_id not in topic_visited:
                    next_topic = self.graph.topics.get(edge.from_id)
                    if next_topic:
                        queue.append((next_topic, depth + 1))

        return results

    def _semantic_event_search(self, q_emb: np.ndarray, visited: set) -> List[Dict[str, Any]]:
        results = []
        for evt in self.graph.events.values():
            if evt.id in visited:
                continue
            sim = cosine_similarity(q_emb, evt.embedding)
            if sim > 0.05:
                visited.add(evt.id)
                results.append({
                    "type": "event",
                    "event_id": evt.id,
                    "text": evt.resolved_text,
                    "session_id": evt.session_id,
                    "turn_index": evt.turn_index,
                    "score": sim,
                })
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:10]

    def _rank_results(self, candidates: List[Dict], q_emb: np.ndarray) -> List[Dict]:
        for c in candidates:
            if c["type"] == "event":
                evt = self.graph.events.get(c["event_id"])
                if evt:
                    relevance = cosine_similarity(q_emb, evt.embedding)
                    c["final_score"] = c["score"] * 0.3 + relevance * 0.7
        candidates.sort(key=lambda x: x.get("final_score", x.get("score", 0)), reverse=True)
        return candidates


# ---------------------------------------------------------------------------
# Delta: Contradiction Arbiter
# ---------------------------------------------------------------------------

class DeltaAgent:
    """Detects contradictions between topics."""

    def __init__(self, graph: GraphStore, embedder: Embedder):
        self.graph = graph
        self.embedder = embedder

    def check_new_topic(self, topic: Topic):
        """When a new topic is created, check against existing topics."""
        for existing in self.graph.topics.values():
            if existing.id == topic.id:
                continue
            if self._topics_conflict(topic, existing):
                contradiction = Contradiction(
                    id=self.graph.next_id("ctr"),
                    topic_a_id=existing.id,
                    topic_b_id=topic.id,
                    topic_a_summary=existing.summary,
                    topic_b_summary=topic.summary,
                )
                self.graph.contradictions.append(contradiction)
                # Add contradiction edge
                self.graph.topic_edges.append(Edge(
                    from_id=existing.id,
                    to_id=topic.id,
                    edge_type="contradiction",
                    weight=1.0,
                ))

    def _topics_conflict(self, a: Topic, b: Topic) -> bool:
        # Heuristic: same entity but opposite sentiment keywords
        a_text = a.summary.lower()
        b_text = b.summary.lower()

        # Extract entities from both
        a_entities = set()
        b_entities = set()
        for eid in a.event_ids:
            a_entities.update(self.graph.events[eid].entities)
        for eid in b.event_ids:
            b_entities.update(self.graph.events[eid].entities)

        shared = a_entities & b_entities
        if not shared:
            return False

        # Check for polarity words
        positive = ["excited", "great", "good", "better", "huge", "love", "like"]
        negative = ["doubt", "not", "dead", "failed", "deprioritized", "dropped", "hate", "bad"]

        a_pos = any(p in a_text for p in positive)
        a_neg = any(n in a_text for n in negative)
        b_pos = any(p in b_text for p in positive)
        b_neg = any(n in b_text for n in negative)

        return (a_pos and b_neg) or (a_neg and b_pos)


# ---------------------------------------------------------------------------
# GAM Orchestrator
# ---------------------------------------------------------------------------

class GAMSimulator:
    def __init__(self):
        self.graph = GraphStore()
        self.embedder = Embedder()
        self.alpha = AlphaAgent(self.graph, self.embedder)
        self.beta = BetaAgent(self.graph, self.embedder)
        self.gamma = GammaAgent(self.graph, self.embedder)
        self.delta = DeltaAgent(self.graph, self.embedder)

    def ingest_corpus(self, corpus_path: Path):
        with open(corpus_path, "r", encoding="utf-8") as f:
            turns = [json.loads(line) for line in f]

        # Group by session for batch topic promotion
        session_events: Dict[str, List[Event]] = defaultdict(list)

        for turn in turns:
            event = self.alpha.process_turn(turn)
            session_events[turn["session_id"]].append(event)

        # After all events, run Beta to promote topics per session
        for sid, events in session_events.items():
            # Simple promotion: group events into chunks where semantic shift occurred
            # For simulation, we promote every 3-5 events as a topic
            chunk_size = 5
            for i in range(0, len(events), chunk_size):
                chunk = events[i:i+chunk_size]
                if len(chunk) >= 2:
                    topic = self.beta.promote_topic(chunk)
                    self.delta.check_new_topic(topic)

    def retrieve(self, query: str) -> List[Dict[str, Any]]:
        return self.gamma.retrieve(query)

    def answer(self, query: str) -> Dict[str, Any]:
        results = self.retrieve(query)
        return {
            "query": query,
            "retrieved": [
                {
                    "text": r["text"],
                    "session_id": r["session_id"],
                    "turn_index": r["turn_index"],
                    "score": r.get("final_score", r.get("score", 0)),
                    "type": r["type"],
                }
                for r in results
            ],
            "retrieved_count": len(results),
            "topics": len(self.graph.topics),
            "events": len(self.graph.events),
            "contradictions": len(self.graph.contradictions),
        }
