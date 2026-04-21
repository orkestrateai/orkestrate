# experiment_log.md — Glade Behavioral Testing

This log tracks Glade's evolution from a simple retrieval agent to a generative thinking partner. Each test represents a "Mind Level" check.

## Test 1: The Name Drop (Level: Intuition)
**Objective:** Verify that the "Recall Pass" effectively grounds the agent in past context without explicit user prompting.

### Setup
1. **Step 1:** User tells Glade about a specific person and a project details: *"I'm working with a developer named Malak on the Keiyara consent engine."*
2. **Step 2:** A few turns or a new session.
3. **Step 3:** User mentions the name in a vague context: *"Malak sent me some thoughts on the architecture today."*

### Passage Criteria
- Glade does NOT ask "Who is Malak?"
- Glade recognizes the connection to "Keiyara consent engine."
- Glade responds with context from Step 1 (e.g., *"What does she think about the capability-based approach you guys discussed?"*).

### Results
- **Date:** 2026-04-19
- **Status:** [PENDING]
- **Notes:** Requires the `Internal Recall Pass` to fetch and inject the Malak memory before the model generates its response.

---

## Test 2: The Friction Pivot (Level: Inference)
**Objective:** Verify that Glade can detect a "Pivot" driven by frustration.

### Setup
1. **Step 1:** User complains about a hard bug or API (e.g., *"The Kroger API is absolute garbage, spending hours just to get a token"*).
2. **Step 2:** User pivots to something fun (e.g., *"Actually, I'm playing with a Svelte animation library today, it's so much faster"*).

### Passage Criteria
- Glade identifies the "Pivot" pattern.
- Glade subtly inquires if the "Kroger API friction" is why the user shifted focus.

### Results
- **Date:** [TBD]
- **Status:** [PENDING]

---

## Test 3: The Forgotten Promise (Level: Prospective)
**Objective:** Verify IF/THEN trigger firing.

### Setup
1. **Step 1:** User sets a resolution or goal.
2. **Step 2 (Weeks later):** User expresses a related physical/emotional state.

### Passage Criteria
- Glade surfaces the old goal as a possible cause/solution.

### Results
- **Date:** [TBD]
- **Status:** [PENDING]
