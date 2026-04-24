#!/usr/bin/env python3
"""Benchmark Suite for RAG vs GAM.

Query categories:
1. Pronoun reference: "Why did I say that?" -> expects prior turn context
2. Temporal follow-up: "What happened with X?" -> expects session chain
3. Contradiction probe: "Do I still believe X?" -> expects contradiction awareness
4. Narrative summary: "What's been going on with Y?" -> expects topic synthesis
5. Negative space: "What haven't I mentioned?" -> expects gap detection (Delta)
"""

from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class BenchmarkQuery:
    id: str
    category: str
    query: str
    expected_sessions: List[str]       # which sessions contain relevant info
    expected_turns: List[tuple]        # (session_id, turn_index) tuples
    expected_entities: List[str]       # entities that should appear in retrieved items
    requires_contradiction: bool = False
    requires_pronoun_resolution: bool = False
    requires_temporal_chain: bool = False
    requires_topic_synthesis: bool = False


QUERIES: List[BenchmarkQuery] = [
    # -----------------------------------------------------------------------
    # 1. Pronoun Reference
    # -----------------------------------------------------------------------
    BenchmarkQuery(
        id="pronoun_1",
        category="pronoun_reference",
        query="Why did I say that?",
        expected_sessions=["s20"],
        expected_turns=[("s20", 3)],
        expected_entities=["USER:Prabha", "PROJECT:Keiyara", "PROJECT:Orkestrate", "EVENT:Google Next"],
        requires_pronoun_resolution=True,
        requires_temporal_chain=True,
    ),
    BenchmarkQuery(
        id="pronoun_2",
        category="pronoun_reference",
        query="What did I mean by 'him' in the Google Next conversation?",
        expected_sessions=["s02", "s05"],
        expected_turns=[("s02", 3), ("s05", 3)],
        expected_entities=["PERSON:Karan", "EVENT:Google Next", "USER:Prabha"],
        requires_pronoun_resolution=True,
    ),
    BenchmarkQuery(
        id="pronoun_3",
        category="pronoun_reference",
        query="Who was I helping with writing?",
        expected_sessions=["s02"],
        expected_turns=[("s02", 3)],
        expected_entities=["PERSON:Karan", "EVENT:Google Next"],
        requires_pronoun_resolution=True,
    ),
    BenchmarkQuery(
        id="pronoun_4",
        category="pronoun_reference",
        query="Who is the 'he' that wants me to drop a project?",
        expected_sessions=["s21"],
        expected_turns=[("s21", 3), ("s21", 5)],
        expected_entities=["PERSON:Manager", "USER:Prabha"],
        requires_pronoun_resolution=True,
    ),

    # -----------------------------------------------------------------------
    # 2. Temporal Follow-Up
    # -----------------------------------------------------------------------
    BenchmarkQuery(
        id="temporal_1",
        category="temporal_followup",
        query="What happened with Keiyara?",
        expected_sessions=["s01", "s04", "s07", "s12"],
        expected_turns=[("s01", 3), ("s04", 3), ("s07", 1), ("s12", 3)],
        expected_entities=["PROJECT:Keiyara"],
        requires_temporal_chain=True,
    ),
    BenchmarkQuery(
        id="temporal_2",
        category="temporal_followup",
        query="What happened with the Google Next challenge?",
        expected_sessions=["s02", "s05", "s08", "s15"],
        expected_turns=[("s02", 5), ("s05", 5), ("s08", 3), ("s15", 1)],
        expected_entities=["EVENT:Google Next", "PERSON:Karan"],
        requires_temporal_chain=True,
    ),
    BenchmarkQuery(
        id="temporal_3",
        category="temporal_followup",
        query="How did my work habits change over time?",
        expected_sessions=["s11", "s13", "s16"],
        expected_turns=[("s11", 3), ("s13", 3), ("s16", 3)],
        expected_entities=["USER:Prabha", "coffee", "night owl"],
        requires_temporal_chain=True,
        requires_topic_synthesis=True,
    ),

    # -----------------------------------------------------------------------
    # 3. Contradiction Probe
    # -----------------------------------------------------------------------
    BenchmarkQuery(
        id="contradiction_1",
        category="contradiction_probe",
        query="Do I still think Keiyara is going to be huge?",
        expected_sessions=["s01", "s04", "s07"],
        expected_turns=[("s01", 3), ("s04", 3), ("s07", 1)],
        expected_entities=["PROJECT:Keiyara"],
        requires_contradiction=True,
    ),
    BenchmarkQuery(
        id="contradiction_2",
        category="contradiction_probe",
        query="Did I end up doing the Google Next challenge?",
        expected_sessions=["s02", "s05", "s08", "s15"],
        expected_turns=[("s02", 5), ("s08", 3), ("s15", 1)],
        expected_entities=["EVENT:Google Next", "USER:Prabha"],
        requires_contradiction=True,
    ),
    BenchmarkQuery(
        id="contradiction_3",
        category="contradiction_probe",
        query="What do I drink in my coffee now?",
        expected_sessions=["s14", "s16", "s17"],
        expected_turns=[("s14", 1), ("s16", 3), ("s17", 1)],
        expected_entities=["coffee", "oat milk", "tea", "black coffee"],
        requires_contradiction=True,
    ),

    # -----------------------------------------------------------------------
    # 4. Narrative Summary
    # -----------------------------------------------------------------------
    BenchmarkQuery(
        id="narrative_1",
        category="narrative_summary",
        query="What's been going on with Orkestrate?",
        expected_sessions=["s03", "s06", "s09", "s10", "s18"],
        expected_turns=[("s03", 1), ("s06", 3), ("s09", 3), ("s10", 3), ("s18", 3)],
        expected_entities=["PROJECT:Orkestrate"],
        requires_topic_synthesis=True,
    ),
    BenchmarkQuery(
        id="narrative_2",
        category="narrative_summary",
        query="Tell me about my relationship with Karan.",
        expected_sessions=["s02", "s05", "s08"],
        expected_turns=[("s02", 1), ("s02", 3), ("s08", 3)],
        expected_entities=["PERSON:Karan"],
        requires_topic_synthesis=True,
    ),
    BenchmarkQuery(
        id="narrative_3",
        category="narrative_summary",
        query="Summarize my health journey.",
        expected_sessions=["s11", "s13", "s14", "s16", "s17"],
        expected_turns=[("s11", 3), ("s13", 3), ("s14", 3), ("s16", 3), ("s17", 3)],
        expected_entities=["health", "coffee", "burnout", "recovery"],
        requires_topic_synthesis=True,
    ),

    # -----------------------------------------------------------------------
    # 5. Negative Space (Gap Detection)
    # -----------------------------------------------------------------------
    BenchmarkQuery(
        id="negative_1",
        category="negative_space",
        query="What haven't I mentioned in a while?",
        expected_sessions=["s01", "s04", "s07", "s12"],  # Keiyara dropped
        expected_turns=[("s07", 1), ("s12", 3)],
        expected_entities=["PROJECT:Keiyara"],
        requires_topic_synthesis=True,
    ),
    BenchmarkQuery(
        id="negative_2",
        category="negative_space",
        query="Is there a project I abandoned that I should revisit?",
        expected_sessions=["s07", "s12"],
        expected_turns=[("s07", 3), ("s12", 3)],
        expected_entities=["PROJECT:Keiyara"],
        requires_topic_synthesis=True,
    ),
]


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score_retrieval(
    query: BenchmarkQuery,
    retrieved: List[Dict[str, Any]],
) -> Dict[str, float]:
    """Score a single query's retrieval results."""
    if not retrieved:
        return {
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
            "temporal_score": 0.0,
            "contradiction_score": 0.0,
            "pronoun_score": 0.0,
            "entity_precision": 0.0,
        }

    retrieved_sessions = set()
    retrieved_turns = set()
    for r in retrieved:
        sid = r.get("session_id")
        tid = r.get("turn_index")
        if sid:
            retrieved_sessions.add(sid)
        if sid and tid is not None:
            retrieved_turns.add((sid, tid))

    expected_set = set(query.expected_turns)

    # 1. Relevance precision: retrieved items from expected sessions
    session_hits = len(retrieved_sessions & set(query.expected_sessions))
    precision = session_hits / len(retrieved) if retrieved else 0.0

    # 2. Recall: coverage of expected sessions
    recall = session_hits / len(query.expected_sessions) if query.expected_sessions else 0.0

    # 3. F1
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    # 4. Temporal preservation: are sessions retrieved in chronological order?
    temporal_score = 0.0
    if query.requires_temporal_chain and retrieved_sessions:
        sessions_list = [r.get("session_id") for r in retrieved if r.get("session_id")]
        unique_sessions = []
        for s in sessions_list:
            if s not in unique_sessions:
                unique_sessions.append(s)
        # Check if order matches chronological
        expected_order = sorted(query.expected_sessions, key=lambda s: int(s[1:]))
        # Score based on how many are in order
        correct_order = 0
        last_idx = -1
        for s in unique_sessions:
            if s in expected_order:
                idx = expected_order.index(s)
                if idx > last_idx:
                    correct_order += 1
                    last_idx = idx
        temporal_score = correct_order / len(expected_order) if expected_order else 0.0

    # 5. Contradiction awareness: retrieves from multiple contradictory sessions
    contradiction_score = 0.0
    if query.requires_contradiction:
        # A good retrieval for contradiction should hit multiple sessions
        if len(retrieved_sessions & set(query.expected_sessions)) >= 2:
            contradiction_score = 1.0
        elif len(retrieved_sessions & set(query.expected_sessions)) >= 1:
            contradiction_score = 0.3

    # 6. Pronoun resolution: does NOT conflate unrelated entities
    pronoun_score = 0.0
    if query.requires_pronoun_resolution:
        # For pronoun queries, check if retrieved items contain expected entities
        # AND do NOT contain false merges (e.g., Karan + Google Next in same item when inappropriate)
        has_expected = False
        has_false_merge = False
        for r in retrieved:
            text = r.get("text", "")
            # Check for expected entities
            for ent in query.expected_entities:
                clean_ent = ent.split(":")[-1].lower()
                if clean_ent in text.lower():
                    has_expected = True
            # Check for false merge: Karan + Google Next together in a user turn about helping
            # This specifically tests your example: "We're helping him write" should NOT merge with Karan
            if "karan" in text.lower() and "google next" in text.lower():
                # If the original turn was about helping Karan write for Google Next, that's correct
                # But if it's a later turn where "him" refers to the user, that's wrong
                # For our test: we penalize if the SAME chunk contains both when the query
                # is about pronoun resolution
                has_false_merge = True
        pronoun_score = 1.0 if has_expected and not has_false_merge else (0.5 if has_expected else 0.0)
    else:
        pronoun_score = 0.0

    # 7. Entity precision: how many retrieved items contain at least one expected entity
    entity_hits = 0
    for r in retrieved:
        text = r.get("text", "").lower()
        for ent in query.expected_entities:
            clean_ent = ent.split(":")[-1].lower()
            if clean_ent in text:
                entity_hits += 1
                break
    entity_precision = entity_hits / len(retrieved) if retrieved else 0.0

    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "temporal_score": temporal_score,
        "contradiction_score": contradiction_score,
        "pronoun_score": pronoun_score,
        "entity_precision": entity_precision,
    }


def aggregate_scores(scores: List[Dict[str, float]]) -> Dict[str, float]:
    if not scores:
        return {}
    keys = scores[0].keys()
    return {k: sum(s[k] for s in scores) / len(scores) for k in keys}
