pub mod types;
pub mod analyzer;
pub mod extractors;
pub mod validator;

pub use types::{AnalyzerPlan, ExtractedFact, ValidationDecision, DecisionAction};

use crate::ai::memory::session::ToolCallRecord;
use crate::ai::memory::MemoryManager;

/// Result of the full multi-agent extraction pipeline.
pub struct PipelineResult {
    pub plan: AnalyzerPlan,
    pub decisions: Vec<ValidationDecision>,
}

/// Run the full multi-agent extraction pipeline:
/// 1. Analyze (mini LLM) → determine if extraction is needed + which domains + SWM metadata
/// 2. Extract (parallel domain LLMs) → domain-specific facts
/// 3. Validate (programmatic + LLM) → quality gate, duplicates, vagueness, tone
/// 4. Apply (arbiter) → store/update/skip based on decisions
pub async fn run_pipeline(
    manager: &MemoryManager,
    user_message: &str,
    assistant_message: &str,
    tool_trace: &[ToolCallRecord],
    entity_context: &str,
    conversation_history: &str,
) -> Result<PipelineResult, String> {
    // Step 1: Analyze
    eprintln!("[memory] Pipeline Step 1: Analyze...");
    let plan = analyzer::analyze(user_message, assistant_message, conversation_history).await?;

    eprintln!("[memory]   Analyzer: should_extract={}, domains={:?}, reasoning=\"{}\", swm_topic=\"{}\"",
        plan.should_extract, plan.domains, plan.reasoning, plan.swm.topic);

    if !plan.should_extract {
        eprintln!("[memory]   Analyzer decided no extraction needed, skipping.");
        return Ok(PipelineResult { plan, decisions: Vec::new() });
    }

    // Step 2: Parallel domain extraction
    eprintln!("[memory] Pipeline Step 2: Extracting domains {:?} in parallel...", plan.domains);
    let raw_facts = extractors::extract_all(
        user_message,
        assistant_message,
        tool_trace,
        entity_context,
        &plan.domains,
        conversation_history,
    ).await;

    eprintln!("[memory]   Extracted {} raw fact(s)", raw_facts.len());
    for fact in &raw_facts {
        eprintln!("[memory]     raw: [{}] {} (confidence={})", fact.domain, fact.content.chars().take(60).collect::<String>(), fact.confidence);
    }

    if raw_facts.is_empty() {
        eprintln!("[memory]   No facts extracted, skipping validation.");
        return Ok(PipelineResult { plan, decisions: Vec::new() });
    }

    // Step 3: Validate
    eprintln!("[memory] Pipeline Step 3: Validating {} fact(s)...", raw_facts.len());
    let decisions = validator::validate(manager, raw_facts, user_message).await;

    eprintln!("[memory]   Validation produced {} decision(s)", decisions.len());
    Ok(PipelineResult { plan, decisions })
}
