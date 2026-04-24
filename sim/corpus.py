#!/usr/bin/env python3
"""Synthetic conversation corpus with hand-tagged entities and coreference resolution.

Each turn includes:
- raw_text: what was literally said
- resolved_text: pronouns resolved to entities (simulating coreference resolution)
- entities: explicit entity mentions in this turn
- ground_truth_topics: which topics this turn truly belongs to
- contradiction_with: list of turn IDs this contradicts (if any)
- pronoun_references: list of turn IDs this implicitly refers to
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional


CORPUS_PATH = Path(__file__).parent / "corpus.jsonl"


def make_turn(
    session_id: str,
    turn_index: int,
    role: str,
    raw_text: str,
    resolved_text: str,
    entities: List[str],
    ground_truth_topics: List[str],
    contradiction_with: Optional[List[int]] = None,
    pronoun_references: Optional[List[int]] = None,
) -> Dict[str, Any]:
    return {
        "session_id": session_id,
        "turn_index": turn_index,
        "role": role,
        "raw_text": raw_text,
        "resolved_text": resolved_text,
        "entities": entities,
        "ground_truth_topics": ground_truth_topics,
        "contradiction_with": contradiction_with or [],
        "pronoun_references": pronoun_references or [],
    }


SESSIONS: List[List[Dict[str, Any]]] = []

# ---------------------------------------------------------------------------
# Session 1: Keiyara — excitement
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s01", 1, "user",
        "My name is Prabha. I'm working on a project called Keiyara.",
        "My name is [ENTITY:USER:Prabha]. I'm working on a project called [ENTITY:PROJECT:Keiyara].",
        ["USER:Prabha", "PROJECT:Keiyara"],
        ["identity", "projects"]),
    make_turn("s01", 2, "assistant",
        "Nice to meet you, Prabha. Tell me about Keiyara.",
        "Nice to meet you, [ENTITY:USER:Prabha]. Tell me about [ENTITY:PROJECT:Keiyara].",
        ["USER:Prabha", "PROJECT:Keiyara"],
        []),
    make_turn("s01", 3, "user",
        "It's a consent engine. I think it's going to be huge.",
        "[ENTITY:PROJECT:Keiyara] is a consent engine. [ENTITY:USER:Prabha] thinks it's going to be huge.",
        ["PROJECT:Keiyara", "USER:Prabha"],
        ["projects"]),
    make_turn("s01", 4, "assistant",
        "What makes you think that?",
        "What makes [ENTITY:USER:Prabha] think that?",
        ["USER:Prabha"],
        []),
    make_turn("s01", 5, "user",
        "The trust mechanics. Nobody's doing it right. I'm excited.",
        "The trust mechanics. Nobody's doing it right. [ENTITY:USER:Prabha] is excited.",
        ["USER:Prabha"],
        ["projects", "motivation"]),
])

# ---------------------------------------------------------------------------
# Session 2: Google Next — initial commitment
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s02", 1, "user",
        "I met someone interesting today. Karan. He's great at blockchain.",
        "[ENTITY:USER:Prabha] met someone interesting today. [ENTITY:PERSON:Karan]. [ENTITY:PERSON:Karan] is great at blockchain.",
        ["USER:Prabha", "PERSON:Karan", "TOPIC:blockchain"],
        ["relationships", "interests"]),
    make_turn("s02", 2, "assistant",
        "What did you talk about?",
        "What did [ENTITY:USER:Prabha] talk about?",
        ["USER:Prabha"],
        []),
    make_turn("s02", 3, "user",
        "We're helping him write for the Google Next writing challenge.",
        "[ENTITY:USER:Prabha] is helping [ENTITY:PERSON:Karan] write for the [ENTITY:EVENT:Google Next] writing challenge.",
        ["USER:Prabha", "PERSON:Karan", "EVENT:Google Next"],
        ["projects", "relationships"],
        pronoun_references=[1]),
    make_turn("s02", 4, "assistant",
        "That sounds like a good opportunity.",
        "That sounds like a good opportunity.",
        [],
        []),
    make_turn("s02", 5, "user",
        "Yeah. I think I'll do it. It'll be good for him too.",
        "Yeah. [ENTITY:USER:Prabha] thinks [ENTITY:USER:Prabha] will do it. It'll be good for [ENTITY:PERSON:Karan] too.",
        ["USER:Prabha", "PERSON:Karan"],
        ["projects", "motivation"],
        pronoun_references=[3]),
])

# ---------------------------------------------------------------------------
# Session 3: Orkestrate — inception
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s03", 1, "user",
        "I've been thinking about Orkestrate again. Current AI memory is broken.",
        "[ENTITY:USER:Prabha] has been thinking about [ENTITY:PROJECT:Orkestrate] again. Current AI memory is broken.",
        ["USER:Prabha", "PROJECT:Orkestrate"],
        ["projects", "philosophy"]),
    make_turn("s03", 2, "assistant",
        "How so?",
        "How so?",
        [],
        []),
    make_turn("s03", 3, "user",
        "Everyone treats it as storage and retrieval. That's not how memory works.",
        "Everyone treats it as storage and retrieval. That's not how memory works.",
        [],
        ["philosophy", "motivation"]),
    make_turn("s03", 4, "assistant",
        "What should it be instead?",
        "What should it be instead?",
        [],
        []),
    make_turn("s03", 5, "user",
        "A graph. Events connected by meaning, not just similarity.",
        "A graph. Events connected by meaning, not just similarity.",
        [],
        ["philosophy", "projects"]),
])

# ---------------------------------------------------------------------------
# Session 4: Keiyara — doubt creeps in
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s04", 1, "user",
        "I'm having second thoughts about Keiyara.",
        "[ENTITY:USER:Prabha] is having second thoughts about [ENTITY:PROJECT:Keiyara].",
        ["USER:Prabha", "PROJECT:Keiyara"],
        ["projects"],
        pronoun_references=[]),
    make_turn("s04", 2, "assistant",
        "What changed?",
        "What changed?",
        [],
        []),
    make_turn("s04", 3, "user",
        "The market is saturated. And I don't know if I care enough about consent as a product.",
        "The market is saturated. And [ENTITY:USER:Prabha] doesn't know if [ENTITY:USER:Prabha] cares enough about consent as a product.",
        ["USER:Prabha"],
        ["projects", "motivation"],
        contradiction_with=[(1, 3)]),  # contradicts s01 turn 3 ("it's going to be huge")
    make_turn("s04", 4, "assistant",
        "That's a big shift from last time.",
        "That's a big shift from last time.",
        [],
        []),
    make_turn("s04", 5, "user",
        "Yeah. I might pivot. Keep the trust idea but change the vessel.",
        "Yeah. [ENTITY:USER:Prabha] might pivot. Keep the trust idea but change the vessel.",
        ["USER:Prabha"],
        ["projects"]),
])

# ---------------------------------------------------------------------------
# Session 5: Google Next — struggle
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s05", 1, "user",
        "The Google Next thing is harder than I thought.",
        "The [ENTITY:EVENT:Google Next] thing is harder than [ENTITY:USER:Prabha] thought.",
        ["EVENT:Google Next", "USER:Prabha"],
        ["projects"]),
    make_turn("s05", 2, "assistant",
        "What's the blocker?",
        "What's the blocker?",
        [],
        []),
    make_turn("s05", 3, "user",
        "I don't have a clear angle. And I'm not sure helping him is the right use of my time.",
        "[ENTITY:USER:Prabha] doesn't have a clear angle. And [ENTITY:USER:Prabha] is not sure helping [ENTITY:PERSON:Karan] is the right use of [ENTITY:USER:Prabha] time.",
        ["USER:Prabha", "PERSON:Karan"],
        ["projects", "motivation"],
        pronoun_references=[(2, 3)]),  # refers to s02 turn 3 (helping him)
    make_turn("s05", 4, "assistant",
        "Do you want to drop it?",
        "Do [ENTITY:USER:Prabha] want to drop it?",
        ["USER:Prabha"],
        []),
    make_turn("s05", 5, "user",
        "Not yet. But I'm deprioritizing it.",
        "Not yet. But [ENTITY:USER:Prabha] is deprioritizing it.",
        ["USER:Prabha"],
        ["projects"],
        contradiction_with=[(2, 5)]),  # contradicts s02 turn 5 ("I'll do it")
])

# ---------------------------------------------------------------------------
# Session 6: Orkestrate — iteration
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s06", 1, "user",
        "I changed the compiler in Orkestrate. It's not flat anymore.",
        "[ENTITY:USER:Prabha] changed the compiler in [ENTITY:PROJECT:Orkestrate]. It's not flat anymore.",
        ["USER:Prabha", "PROJECT:Orkestrate"],
        ["projects"]),
    make_turn("s06", 2, "assistant",
        "What is it now?",
        "What is it now?",
        [],
        []),
    make_turn("s06", 3, "user",
        "A graph compiler. Events feed topics, topics feed the profile.",
        "A graph compiler. Events feed topics, topics feed the profile.",
        [],
        ["projects", "philosophy"]),
    make_turn("s06", 4, "assistant",
        "That's a big architectural change.",
        "That's a big architectural change.",
        [],
        []),
    make_turn("s06", 5, "user",
        "Yeah. I had to. Flat memory wasn't capturing connections.",
        "Yeah. [ENTITY:USER:Prabha] had to. Flat memory wasn't capturing connections.",
        ["USER:Prabha"],
        ["projects", "philosophy"]),
])

# ---------------------------------------------------------------------------
# Session 7: Keiyara — pivot
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s07", 1, "user",
        "I decided. Keiyara is dead. Long live whatever comes next.",
        "[ENTITY:USER:Prabha] decided. [ENTITY:PROJECT:Keiyara] is dead. Long live whatever comes next.",
        ["USER:Prabha", "PROJECT:Keiyara"],
        ["projects"]),
    make_turn("s07", 2, "assistant",
        "What are you keeping from it?",
        "What are [ENTITY:USER:Prabha] keeping from it?",
        ["USER:Prabha"],
        []),
    make_turn("s07", 3, "user",
        "The trust layer. That's the only part that felt true.",
        "The trust layer. That's the only part that felt true.",
        [],
        ["projects", "motivation"]),
    make_turn("s07", 4, "assistant",
        "And the rest?",
        "And the rest?",
        [],
        []),
    make_turn("s07", 5, "user",
        "Gone. Consent as a product was always someone else's idea.",
        "Gone. Consent as a product was always someone else's idea.",
        [],
        ["projects", "motivation"],
        contradiction_with=[(1, 3), (1, 5)]),  # contradicts initial excitement
])

# ---------------------------------------------------------------------------
# Session 8: Google Next — deprioritized
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s08", 1, "user",
        "I haven't touched the Google Next thing in two weeks.",
        "[ENTITY:USER:Prabha] hasn't touched the [ENTITY:EVENT:Google Next] thing in two weeks.",
        ["USER:Prabha", "EVENT:Google Next"],
        ["projects"]),
    make_turn("s08", 2, "assistant",
        "Are you still planning to submit?",
        "Are [ENTITY:USER:Prabha] still planning to submit?",
        ["USER:Prabha"],
        []),
    make_turn("s08", 3, "user",
        "No. I told him I'm out. He understood.",
        "No. [ENTITY:USER:Prabha] told [ENTITY:PERSON:Karan] [ENTITY:USER:Prabha] is out. [ENTITY:PERSON:Karan] understood.",
        ["USER:Prabha", "PERSON:Karan"],
        ["projects", "relationships"],
        contradiction_with=[(2, 5)]),  # contradicts s02 "I'll do it"
    make_turn("s08", 4, "assistant",
        "How do you feel about that?",
        "How do [ENTITY:USER:Prabha] feel about that?",
        ["USER:Prabha"],
        []),
    make_turn("s08", 5, "user",
        "Relieved. It was never really my thing.",
        "Relieved. It was never really [ENTITY:USER:Prabha] thing.",
        ["USER:Prabha"],
        ["motivation"]),
])

# ---------------------------------------------------------------------------
# Session 9: Orkestrate — integration
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s09", 1, "user",
        "I integrated the graph compiler into Orkestrate today.",
        "[ENTITY:USER:Prabha] integrated the graph compiler into [ENTITY:PROJECT:Orkestrate] today.",
        ["USER:Prabha", "PROJECT:Orkestrate"],
        ["projects"]),
    make_turn("s09", 2, "assistant",
        "How's it performing?",
        "How's it performing?",
        [],
        []),
    make_turn("s09", 3, "user",
        "Better. Topic synthesis actually works now. The connections are visible.",
        "Better. Topic synthesis actually works now. The connections are visible.",
        [],
        ["projects"]),
    make_turn("s09", 4, "assistant",
        "What kind of connections?",
        "What kind of connections?",
        [],
        []),
    make_turn("s09", 5, "user",
        "Causal ones. I can see how one project led to another now.",
        "Causal ones. [ENTITY:USER:Prabha] can see how one project led to another now.",
        ["USER:Prabha"],
        ["projects", "philosophy"]),
])

# ---------------------------------------------------------------------------
# Session 10: Orkestrate — refinement
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s10", 1, "user",
        "I refined the topic promotion threshold in Orkestrate.",
        "[ENTITY:USER:Prabha] refined the topic promotion threshold in [ENTITY:PROJECT:Orkestrate].",
        ["USER:Prabha", "PROJECT:Orkestrate"],
        ["projects"]),
    make_turn("s10", 2, "assistant",
        "What did you change?",
        "What did [ENTITY:USER:Prabha] change?",
        ["USER:Prabha"],
        []),
    make_turn("s10", 3, "user",
        "Lowered it. More events become topics. Less lossy.",
        "Lowered it. More events become topics. Less lossy.",
        [],
        ["projects"]),
    make_turn("s10", 4, "assistant",
        "Any downside?",
        "Any downside?",
        [],
        []),
    make_turn("s10", 5, "user",
        "More noise. But I'd rather have noise than amnesia.",
        "More noise. But [ENTITY:USER:Prabha] would rather have noise than amnesia.",
        ["USER:Prabha"],
        ["projects", "philosophy"]),
])

# ---------------------------------------------------------------------------
# Session 11: Work habits — night owl
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s11", 1, "user",
        "I've been working until 3am every night this week.",
        "[ENTITY:USER:Prabha] has been working until 3am every night this week.",
        ["USER:Prabha"],
        ["habits", "health"]),
    make_turn("s11", 2, "assistant",
        "How's that working for you?",
        "How's that working for [ENTITY:USER:Prabha]?",
        ["USER:Prabha"],
        []),
    make_turn("s11", 3, "user",
        "I'm productive but exhausted. I drink five cups of coffee a day.",
        "[ENTITY:USER:Prabha] is productive but exhausted. [ENTITY:USER:Prabha] drinks five cups of coffee a day.",
        ["USER:Prabha"],
        ["habits", "health", "preferences"]),
    make_turn("s11", 4, "assistant",
        "That doesn't sound sustainable.",
        "That doesn't sound sustainable.",
        [],
        []),
    make_turn("s11", 5, "user",
        "It's not. But I don't know how else to get everything done.",
        "It's not. But [ENTITY:USER:Prabha] doesn't know how else to get everything done.",
        ["USER:Prabha"],
        ["habits", "motivation"]),
])

# ---------------------------------------------------------------------------
# Session 12: Keiyara — post-mortem reflection
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s12", 1, "user",
        "I was thinking about why Keiyara failed.",
        "[ENTITY:USER:Prabha] was thinking about why [ENTITY:PROJECT:Keiyara] failed.",
        ["USER:Prabha", "PROJECT:Keiyara"],
        ["projects", "reflection"]),
    make_turn("s12", 2, "assistant",
        "What did you conclude?",
        "What did [ENTITY:USER:Prabha] conclude?",
        ["USER:Prabha"],
        []),
    make_turn("s12", 3, "user",
        "I cared about the problem but not the product. That's a fatal mismatch.",
        "[ENTITY:USER:Prabha] cared about the problem but not the product. That's a fatal mismatch.",
        ["USER:Prabha"],
        ["projects", "motivation", "reflection"]),
    make_turn("s12", 4, "assistant",
        "Will you remember that next time?",
        "Will [ENTITY:USER:Prabha] remember that next time?",
        ["USER:Prabha"],
        []),
    make_turn("s12", 5, "user",
        "I hope so. I keep making the same mistake.",
        "[ENTITY:USER:Prabha] hopes so. [ENTITY:USER:Prabha] keeps making the same mistake.",
        ["USER:Prabha"],
        ["patterns", "reflection"]),
])

# ---------------------------------------------------------------------------
# Session 13: Work habits — burnout
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s13", 1, "user",
        "I crashed yesterday. Couldn't get out of bed.",
        "[ENTITY:USER:Prabha] crashed yesterday. Couldn't get out of bed.",
        ["USER:Prabha"],
        ["health", "habits"]),
    make_turn("s13", 2, "assistant",
        "What do you think caused it?",
        "What do [ENTITY:USER:Prabha] think caused it?",
        ["USER:Prabha"],
        []),
    make_turn("s13", 3, "user",
        "The 3am schedule. The coffee. Ignoring my body for weeks.",
        "The 3am schedule. The coffee. Ignoring [ENTITY:USER:Prabha] body for weeks.",
        ["USER:Prabha"],
        ["health", "habits"],
        pronoun_references=[(11, 3)]),  # refers to s11 coffee + night owl
    make_turn("s13", 4, "assistant",
        "Are you going to change anything?",
        "Are [ENTITY:USER:Prabha] going to change anything?",
        ["USER:Prabha"],
        []),
    make_turn("s13", 5, "user",
        "I have to. This isn't worth it.",
        "[ENTITY:USER:Prabha] has to. This isn't worth it.",
        ["USER:Prabha"],
        ["health", "motivation"]),
])

# ---------------------------------------------------------------------------
# Session 14: Coffee preference shift
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s14", 1, "user",
        "I switched to oat milk in my coffee.",
        "[ENTITY:USER:Prabha] switched to oat milk in [ENTITY:USER:Prabha] coffee.",
        ["USER:Prabha"],
        ["preferences", "habits"]),
    make_turn("s14", 2, "assistant",
        "Why the change?",
        "Why the change?",
        [],
        []),
    make_turn("s14", 3, "user",
        "Stomach issues. Black coffee was destroying me.",
        "Stomach issues. Black coffee was destroying [ENTITY:USER:Prabha].",
        ["USER:Prabha"],
        ["preferences", "health"]),
    make_turn("s14", 4, "assistant",
        "Do you like it?",
        "Do [ENTITY:USER:Prabha] like it?",
        ["USER:Prabha"],
        []),
    make_turn("s14", 5, "user",
        "It's okay. I miss the sharpness though.",
        "It's okay. [ENTITY:USER:Prabha] misses the sharpness though.",
        ["USER:Prabha"],
        ["preferences"]),
])

# ---------------------------------------------------------------------------
# Session 15: Google Next — final status
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s15", 1, "user",
        "I officially withdrew from the Google Next challenge.",
        "[ENTITY:USER:Prabha] officially withdrew from the [ENTITY:EVENT:Google Next] challenge.",
        ["USER:Prabha", "EVENT:Google Next"],
        ["projects"]),
    make_turn("s15", 2, "assistant",
        "How do you feel about that decision now?",
        "How do [ENTITY:USER:Prabha] feel about that decision now?",
        ["USER:Prabha"],
        []),
    make_turn("s15", 3, "user",
        "Good. It freed up space for Orkestrate.",
        "Good. It freed up space for [ENTITY:PROJECT:Orkestrate].",
        ["USER:Prabha", "PROJECT:Orkestrate"],
        ["projects", "motivation"]),
    make_turn("s15", 4, "assistant",
        "Do you regret the time you spent on it?",
        "Do [ENTITY:USER:Prabha] regret the time [ENTITY:USER:Prabha] spent on it?",
        ["USER:Prabha"],
        []),
    make_turn("s15", 5, "user",
        "No. It taught me what I don't want to work on.",
        "No. It taught [ENTITY:USER:Prabha] what [ENTITY:USER:Prabha] doesn't want to work on.",
        ["USER:Prabha"],
        ["motivation", "reflection"]),
])

# ---------------------------------------------------------------------------
# Session 16: Work habits — recovery
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s16", 1, "user",
        "I've been sleeping 8 hours for a week now.",
        "[ENTITY:USER:Prabha] has been sleeping 8 hours for a week now.",
        ["USER:Prabha"],
        ["habits", "health"]),
    make_turn("s16", 2, "assistant",
        "How do you feel?",
        "How do [ENTITY:USER:Prabha] feel?",
        ["USER:Prabha"],
        []),
    make_turn("s16", 3, "user",
        "Better. I'm drinking tea instead of coffee.",
        "Better. [ENTITY:USER:Prabha] is drinking tea instead of coffee.",
        ["USER:Prabha"],
        ["habits", "preferences", "health"],
        contradiction_with=[(14, 1)]),  # contradicts oat milk coffee
    make_turn("s16", 4, "assistant",
        "No coffee at all?",
        "No coffee at all?",
        [],
        []),
    make_turn("s16", 5, "user",
        "Maybe one cup in the morning. But no more all-nighters.",
        "Maybe one cup in the morning. But no more all-nighters.",
        ["USER:Prabha"],
        ["habits", "health"],
        contradiction_with=[(11, 3)]),  # contradicts 5 cups a day
])

# ---------------------------------------------------------------------------
# Session 17: Coffee preference — back to black
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s17", 1, "user",
        "I went back to black coffee.",
        "[ENTITY:USER:Prabha] went back to black coffee.",
        ["USER:Prabha"],
        ["preferences", "habits"],
        contradiction_with=[(14, 1), (16, 3)]),  # contradicts both oat milk and tea
    make_turn("s17", 2, "assistant",
        "What about the stomach issues?",
        "What about the stomach issues?",
        [],
        ["health"]),
    make_turn("s17", 3, "user",
        "I eat first now. Problem solved.",
        "[ENTITY:USER:Prabha] eats first now. Problem solved.",
        ["USER:Prabha"],
        ["preferences", "health"]),
    make_turn("s17", 4, "assistant",
        "So you're a black coffee person again.",
        "So [ENTITY:USER:Prabha] is a black coffee person again.",
        ["USER:Prabha"],
        ["preferences"]),
    make_turn("s17", 5, "user",
        "Always was. The experiments were just that.",
        "Always was. The experiments were just that.",
        [],
        ["preferences", "reflection"]),
])

# ---------------------------------------------------------------------------
# Session 18: Orkestrate — current state
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s18", 1, "user",
        "Orkestrate is almost ready for beta.",
        "[ENTITY:PROJECT:Orkestrate] is almost ready for beta.",
        ["PROJECT:Orkestrate"],
        ["projects"]),
    make_turn("s18", 2, "assistant",
        "What's left?",
        "What's left?",
        [],
        []),
    make_turn("s18", 3, "user",
        "The retrieval navigator. Graph walks are tricky.",
        "The retrieval navigator. Graph walks are tricky.",
        [],
        ["projects"]),
    make_turn("s18", 4, "assistant",
        "What kind of queries are hard?",
        "What kind of queries are hard?",
        [],
        []),
    make_turn("s18", 5, "user",
        "Temporal ones. 'What happened with X?' needs session traversal.",
        "Temporal ones. 'What happened with [ENTITY:VARIABLE:X]?' needs session traversal.",
        [],
        ["projects", "philosophy"]),
])

# ---------------------------------------------------------------------------
# Session 19: Random — travel
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s19", 1, "user",
        "I'm going to Japan next month.",
        "[ENTITY:USER:Prabha] is going to [ENTITY:LOCATION:Japan] next month.",
        ["USER:Prabha", "LOCATION:Japan"],
        ["travel", "plans"]),
    make_turn("s19", 2, "assistant",
        "For work or pleasure?",
        "For work or pleasure?",
        [],
        []),
    make_turn("s19", 3, "user",
        "Pleasure. I need a break from screens.",
        "Pleasure. [ENTITY:USER:Prabha] needs a break from screens.",
        ["USER:Prabha"],
        ["travel", "health", "motivation"]),
    make_turn("s19", 4, "assistant",
        "Where in Japan?",
        "Where in [ENTITY:LOCATION:Japan]?",
        ["LOCATION:Japan"],
        []),
    make_turn("s19", 5, "user",
        "Tokyo first, then Kyoto. Maybe Osaka if I have time.",
        "[ENTITY:LOCATION:Tokyo] first, then [ENTITY:LOCATION:Kyoto]. Maybe [ENTITY:LOCATION:Osaka] if [ENTITY:USER:Prabha] has time.",
        ["LOCATION:Tokyo", "LOCATION:Kyoto", "LOCATION:Osaka", "USER:Prabha"],
        ["travel", "plans"]),
])

# ---------------------------------------------------------------------------
# Session 20: Reflection — patterns
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s20", 1, "user",
        "I've been noticing a pattern in my projects.",
        "[ENTITY:USER:Prabha] has been noticing a pattern in [ENTITY:USER:Prabha] projects.",
        ["USER:Prabha"],
        ["patterns", "reflection"]),
    make_turn("s20", 2, "assistant",
        "What pattern?",
        "What pattern?",
        [],
        []),
    make_turn("s20", 3, "user",
        "I get excited, commit hard, then lose interest when it gets real.",
        "[ENTITY:USER:Prabha] gets excited, commits hard, then loses interest when it gets real.",
        ["USER:Prabha"],
        ["patterns", "reflection"],
        pronoun_references=[(1, 3), (4, 3), (7, 1)]),  # Keiyara, Google Next, Orkestrate arcs
    make_turn("s20", 4, "assistant",
        "Orkestrate feels different though.",
        "[ENTITY:PROJECT:Orkestrate] feels different though.",
        ["PROJECT:Orkestrate"],
        []),
    make_turn("s20", 5, "user",
        "It does. Because it's about the problem I actually live with.",
        "It does. Because it's about the problem [ENTITY:USER:Prabha] actually lives with.",
        ["USER:Prabha"],
        ["patterns", "motivation", "projects"]),
])


# ---------------------------------------------------------------------------
# Session 21: Adversarial — pronoun "him" refers to USER, not Karan
# This tests the exact false-merge scenario:
#   Memory A: "Karan is great at blockchain"
#   Memory B: "We're helping him write" (him = Karan)
#   Memory C: "My manager is helping me. He thinks I'm stretched too thin."
#     (he = manager, a NEW person — should NOT merge with Karan)
# ---------------------------------------------------------------------------
SESSIONS.append([
    make_turn("s21", 1, "user",
        "My manager has been helping me with my workload.",
        "[ENTITY:USER:Prabha] manager [ENTITY:PERSON:Manager] has been helping [ENTITY:USER:Prabha] with [ENTITY:USER:Prabha] workload.",
        ["USER:Prabha", "PERSON:Manager"],
        ["relationships", "work"]),
    make_turn("s21", 2, "assistant",
        "What kind of help?",
        "What kind of help?",
        [],
        []),
    make_turn("s21", 3, "user",
        "He thinks I'm stretched too thin. He wants me to drop one project.",
        "[ENTITY:PERSON:Manager] thinks [ENTITY:USER:Prabha] is stretched too thin. [ENTITY:PERSON:Manager] wants [ENTITY:USER:Prabha] to drop one project.",
        ["PERSON:Manager", "USER:Prabha"],
        ["relationships", "work", "projects"],
        pronoun_references=[1]),
    make_turn("s21", 4, "assistant",
        "Which project?",
        "Which project?",
        [],
        []),
    make_turn("s21", 5, "user",
        "He didn't say. But I think he means Orkestrate.",
        "[ENTITY:PERSON:Manager] didn't say. But [ENTITY:USER:Prabha] thinks [ENTITY:PERSON:Manager] means [ENTITY:PROJECT:Orkestrate].",
        ["PERSON:Manager", "USER:Prabha", "PROJECT:Orkestrate"],
        ["relationships", "projects"],
        pronoun_references=[1]),
])


def write_corpus():
    with open(CORPUS_PATH, "w", encoding="utf-8") as f:
        for session in SESSIONS:
            for turn in session:
                f.write(json.dumps(turn, ensure_ascii=False) + "\n")
    print(f"Wrote {sum(len(s) for s in SESSIONS)} turns to {CORPUS_PATH}")


if __name__ == "__main__":
    write_corpus()
