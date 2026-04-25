#!/usr/bin/env python3
"""Main execution: run RAG vs GAM benchmark and output comparison."""

import json
from pathlib import Path
from typing import Dict, Any, List

from corpus import write_corpus, CORPUS_PATH
from rag_baseline import RAGSimulator
from gam_simulator import GAMSimulator
from benchmark import QUERIES, score_retrieval, aggregate_scores


def run_simulation() -> Dict[str, Any]:
    # Ensure corpus exists
    if not CORPUS_PATH.exists():
        write_corpus()

    print("=" * 60)
    print("ORKESTRATE MEMORY ARCHITECTURE SIMULATION")
    print("RAG Baseline vs Graph-Agentic Memory (GAM)")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # RAG Baseline
    # -----------------------------------------------------------------------
    print("\n[1/4] Ingesting corpus into RAG baseline...")
    rag = RAGSimulator()
    rag.ingest_corpus(CORPUS_PATH)
    print(f"      RAG chunks: {len(rag.chunks)}")

    rag_results = []
    print("\n[2/4] Running RAG retrieval on benchmark queries...")
    for q in QUERIES:
        result = rag.answer(q.query)
        scores = score_retrieval(q, result["retrieved"])
        rag_results.append({
            "query_id": q.id,
            "category": q.category,
            "query": q.query,
            "scores": scores,
            "retrieved": result["retrieved"],
        })

    # -----------------------------------------------------------------------
    # GAM Simulator
    # -----------------------------------------------------------------------
    print("\n[3/4] Ingesting corpus into GAM simulator...")
    gam = GAMSimulator()
    gam.ingest_corpus(CORPUS_PATH)
    print(f"      GAM events: {len(gam.graph.events)}")
    print(f"      GAM topics: {len(gam.graph.topics)}")
    print(f"      GAM contradictions: {len(gam.graph.contradictions)}")

    gam_results = []
    print("\n[4/4] Running GAM retrieval on benchmark queries...")
    for q in QUERIES:
        result = gam.answer(q.query)
        scores = score_retrieval(q, result["retrieved"])
        gam_results.append({
            "query_id": q.id,
            "category": q.category,
            "query": q.query,
            "scores": scores,
            "retrieved": result["retrieved"],
        })

    # -----------------------------------------------------------------------
    # Aggregate
    # -----------------------------------------------------------------------
    rag_agg = aggregate_scores([r["scores"] for r in rag_results])
    gam_agg = aggregate_scores([r["scores"] for r in gam_results])

    # Category breakdown
    categories = sorted(set(q.category for q in QUERIES))
    category_comparison = []
    for cat in categories:
        rag_cat = [r["scores"] for r in rag_results if r["category"] == cat]
        gam_cat = [r["scores"] for r in gam_results if r["category"] == cat]
        category_comparison.append({
            "category": cat,
            "rag": aggregate_scores(rag_cat),
            "gam": aggregate_scores(gam_cat),
        })

    return {
        "rag": {
            "per_query": rag_results,
            "aggregate": rag_agg,
        },
        "gam": {
            "per_query": gam_results,
            "aggregate": gam_agg,
            "graph_stats": {
                "events": len(gam.graph.events),
                "topics": len(gam.graph.topics),
                "contradictions": len(gam.graph.contradictions),
            },
        },
        "category_comparison": category_comparison,
    }


def print_results(results: Dict[str, Any]):
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)

    print("\n--- AGGREGATE SCORES ---")
    print(f"{'Metric':<25} {'RAG':>10} {'GAM':>10} {'Delta':>10}")
    print("-" * 60)
    for metric in results["rag"]["aggregate"]:
        r = results["rag"]["aggregate"][metric]
        g = results["gam"]["aggregate"][metric]
        delta = g - r
        print(f"{metric:<25} {r:>10.3f} {g:>10.3f} {delta:>+10.3f}")

    print("\n--- CATEGORY BREAKDOWN ---")
    for comp in results["category_comparison"]:
        cat = comp["category"]
        print(f"\n  [{cat}]")
        print(f"  {'Metric':<23} {'RAG':>10} {'GAM':>10} {'Delta':>10}")
        print(f"  {'-' * 56}")
        for metric in comp["rag"]:
            r = comp["rag"][metric]
            g = comp["gam"][metric]
            delta = g - r
            print(f"  {metric:<23} {r:>10.3f} {g:>10.3f} {delta:>+10.3f}")

    print("\n--- DETAILED QUERY RESULTS ---")
    for rag_q, gam_q in zip(results["rag"]["per_query"], results["gam"]["per_query"]):
        qid = rag_q["query_id"]
        cat = rag_q["category"]
        print(f"\n  [{qid}] ({cat})")
        print(f"  Query: {rag_q['query']}")
        print(f"  {'Metric':<23} {'RAG':>10} {'GAM':>10}")
        for metric in rag_q["scores"]:
            r = rag_q["scores"][metric]
            g = gam_q["scores"][metric]
            print(f"  {metric:<23} {r:>10.3f} {g:>10.3f}")

    # Save to file
    out_path = Path(__file__).parent / "results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    print(f"\n[Saved detailed results to {out_path}]")


if __name__ == "__main__":
    results = run_simulation()
    print_results(results)
