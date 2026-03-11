# User Intent Model v1 (Discussion Draft)

## Why this doc
Users do not want to manage agent protocol details.  
They want to ask for work in plain language and get results without collisions.

This model maps real user intents to automatic Orkestrate coordination behavior.

## Product assumption
Protocol is system-managed.  
User prompt stays simple.  
`join_workspace`, `read_team_state`, `claim_scope`, `update_my_state`, and `release_scope` are internal mechanics.

## Core user intents
These are the intents we should optimize first.

1. Implement my task without blocking others.
2. Help another person by seeing their current work and taking a compatible chunk.
3. Tell another agent/person to do something specific.

## Additional likely intents
These show up quickly in real teams.

1. See what everyone is doing right now.
2. Ask for review before merge.
3. Pick up abandoned or stale work.
4. Resolve overlap/conflict and re-scope.
5. Request a plan only (no edits yet).
6. Hotfix urgently with temporary priority override.
7. Hand off work cleanly at shift/session end.
8. Ask for cleanup/refactor in safe isolated scope.
9. Ask for release/deploy checks.

## Intent taxonomy and required behavior

| Intent ID | User goal | Typical user phrasing | Edit scope required | System behavior |
|---|---|---|---|---|
| I1 | Build feature safely | "Add X feature" | Yes | Auto-join, read state, claim non-overlapping scope, publish progress, release on done |
| I2 | Help teammate | "See what Alex is doing and help" | Usually yes | Read teammate state, propose adjacent scope, claim, update status as support/handoff |
| I3 | Delegate work | "Claude do docs, OpenCode do API" | Yes | Assign target agent(s), create scoped claims per target, track execution status |
| I4 | Awareness only | "What is everyone working on?" | No | Read state only, summarize agents, branches, claims, blockers |
| I5 | Review request | "Review this before merge" | Usually no | Read state/footprint/branch, run checks, publish review findings in notes |
| I6 | Takeover stale work | "Pick up abandoned auth task" | Yes | Detect stale owner/expired claim, claim scope, mark takeover in notes |
| I7 | Conflict resolution | "You are colliding, split work" | Maybe | Detect overlap, suggest non-overlapping slices, force re-claim workflow |
| I8 | Plan only | "Plan this migration first" | No | Read state, propose plan + scope plan, no claim until execution starts |
| I9 | Hotfix | "Fix prod bug now" | Yes | Priority mode, narrow claim, fast loop updates, strict handoff log |
| I10 | Handoff/close | "Wrap up and hand over" | No/Yes | Publish done/handoff status, clear footprint, release claims |
| I11 | Cleanup | "Clean old code safely" | Yes | Claim broad but bounded non-critical scope, incremental updates |
| I12 | Release support | "Prepare deploy and CI checks" | Yes | Claim CI/CD paths, run checks, publish readiness status |

## Minimal user prompt style we should support
System should infer intent from short prompts like:

1. "Implement OAuth refresh flow."
2. "Help Priya finish the auth feature."
3. "Ask Claude to handle docs and me to handle backend."
4. "What are the other agents doing?"
5. "Clean up old dashboard code."

No protocol words should be required from users.

## Expected automatic protocol mapping

### If intent needs edits
1. Ensure joined session with valid git context.
2. Read team state.
3. Compute candidate scope.
4. Try claim.
5. If conflict, propose re-scope and retry claim.
6. Publish active state.
7. Execute work and periodically update state.
8. Release claim on done/handoff.

### If intent is awareness/review/plan-only
1. Ensure joined session.
2. Read team state.
3. Return summary/plan/review.
4. Do not claim scope unless user confirms execution.

## Delegation model (intent I3)
User should be able to issue one natural command and system handles:

1. Target selection.
2. Scope split.
3. Claim attempts per target.
4. Conflict remediation.
5. Progress rollup back to user.

User should not need to manually coordinate per agent.

## Practical defaults for v1

1. Default to safe non-overlapping execution.
2. Auto-read state before any write operation.
3. Reject overlaps hard.
4. Require git-derived repo facts at join and state updates.
5. Show branch + head SHA in summaries.
6. Auto-release claims on `done`/`handoff` with empty footprint.

## UX requirement implied by this model
Prompt UX should ask for task intent, not protocol.

Good:
1. "Implement X."
2. "Help Y."
3. "Delegate Z."

Bad:
1. "Run join_workspace with this JSON..."
2. "Call claim_scope then update_my_state..."

## Open design questions for next discussion

1. Should delegation require explicit user confirmation when it affects multiple agents?
2. Should hotfix mode allow temporary claim preemption, or stay strict reject only?
3. How should stale ownership be detected for takeover: lease expiry only, or activity timeout plus lease?
4. Should plan-only mode support reserving a tentative scope without hard claim?
5. What should the user see when a conflict is auto-resolved by re-scope?
