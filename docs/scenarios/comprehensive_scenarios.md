# Comprehensive Agent Memory Scenarios (The Benchmark Suite)

These scenarios are designed to test the **High-Dimensional Context Persistence Engine**. Each scenario breaks down into a series of "Inputs" (Days/Weeks apart) and a "Target Response" that requires advanced cognitive integration.

---

## Scenario A: The Identity Trajectory (The Mirror)
**Objective**: Detect if the user's stated aspirations are being sabotaged by their own behavioral patterns.

### Phase 1: Intent (Day 1)
- **Input**: "I’ve decided I’m going to stop working past 7 PM. I’m burning out and it’s affecting my creativity. I need to protect my evenings."
- **Memory Captured**: `Commitment: No evening work`, `State: Burnout risk`.

### Phase 2: The Drift (Day 4 & Day 9)
- **Input (Day 4)**: "Just finishing up a quick task, it’s 8:30 PM but I’m almost done."
- **Input (Day 9)**: "Working on this new project idea, it’s 10 PM but I’m in the zone."
- **Memory Captured**: `Incident: 8:30 PM work`, `Incident: 10:00 PM work`.

### Phase 3: The Trigger (Day 14)
- **Input**: "I’m feeling so drained and uninspired today. I don’t know why my productivity has crashed."
- **Target Response**:
    - **Current RAG Fail**: "Maybe you should try a productivity technique like Pomodoro?"
    - **Solved Glade Response**: "I’m noticing a pattern. Two weeks ago you identified 7 PM as your hard limit to prevent this exact crash, but you've worked until 10 PM twice this week. The 'Productivity Crash' isn't a mystery—it’s the debt from the evenings we didn't protect. Do we need to reset the 7 PM boundary?"

---

## Scenario B: The Context Janitor (Drowning in Data)
**Objective**: Test if the agent can ignore "stale" or "overlapping" data to find the single relevant truth.

### Phase 1: The First Truth (Day 1)
- **Input**: "I’m moving to a new apartment at 123 Maple St."
### Phase 2: The Pivot (Day 10)
- **Input**: "The Maple St. deal fell through. I found a much better place at 456 Oak Ave. Moving there on the 1st."
### Phase 3: The Detail Dump (Day 11)
- **Input**: (User sends 10 messages about furniture, boxes, and truck rentals for the "Oak Ave" move).

### Phase 4: The Noise Trigger (Day 20)
- **Input**: "Hey, I lost the address for the move. Where am I going again?"
- **Target Response**:
    - **Current RAG Fail**: "I found two addresses: 123 Maple St and 456 Oak Ave. Which one is it?" (Confusing old vs new).
    - **Solved Glade Response**: "You're heading to **456 Oak Ave.** The Maple St. deal fell through ten days ago." 

---

## Scenario C: The Prospective Guardian (Semantic Tripwires)
**Objective**: Test if a "Conditional Memory" can be set and triggered weeks later by a non-obvious semantic match.

### Phase 1: The Condition (Day 1)
- **Input**: "I’m allergic to peanuts, but specifically the cheap oil used in fast-food places. If I ever talk about grabbing a quick greasy burger, remind me to check the oil type."
- **Memory Captured**: `Condition: Fast-food burger -> Trigger oil check`.

### Phase 2: The Gap (Month 1)
- (30 days of unrelated conversation about coding, life, and weather).

### Phase 3: The Match (Day 31)
- **Input**: "I’m starving and in a rush, just going to pull into this drive-thru at 'Greasy Joe's' for a quick double-cheese."
- **Target Response**:
    - **Current RAG Fail**: "Enjoy your burger! Hope you get some work done after."
    - **Solved Glade Response**: "Wait—remember the peanut oil allergy. You asked me to remind you to check their oil type before eating at a fast-food place like this. Is it worth the risk?"

---

## Scenario D: Relational Friction (The Social Map)
**Objective**: Track the evolution of a relationship's "valence" (the emotional weight).

### Phase 1: Mentorship (Week 1)
- **Input**: "I’m learning so much from Alex. He’s a total genius at backend architecture."
### Phase 2: Friction (Week 4)
- **Input**: "Alex is being incredibly pedantic about my pull requests lately. It’s getting annoying."
### Phase 3: Rivalry (Week 8)
- **Input**: "Alex went over my head to the boss today. I can't trust his feedback anymore."

### Phase 4: The Vague Mention (Week 10)
- **Input**: "Alex just messaged me. He wants to 'chat about the new feature' over lunch."
- **Target Response**:
    - **Current RAG Fail**: "That sounds great! Lunch with your mentor is always a good idea." (Stored Week 1 as 'Master' fact).
    - **Solved Glade Response**: "Given the recent trust issues and the PR friction, a 'chat' over lunch feels like it might be a confrontation or a power move. How do you want to handle the defensive posture before you go?"
