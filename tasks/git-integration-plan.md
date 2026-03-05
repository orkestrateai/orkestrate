# Git Integration Plan for Orkestrate

> **Note**: Per `documentation/ORKESTRATE_GOSPEL.md` line 59: "No git integration (beyond what agents do naturally)." This plan proposes minimal, non-invasive git features that enhance agent coordination without turning Orkestrate into a git management tool.

---

## Philosophy
Git integration should be **agent-facing**, not human-facing. Agents already use git naturally — this integration makes their git activity visible to other agents and the orchestration system.

---

## Phase 1: Telemetry Enhancement (Quick Wins)

### 1.1 Richer Git Telemetry
Currently: Branch detection, commit detection
Add:
- **File change tracking**: Emit `file_changed` events with diff stats on `git add` / `git commit`
- **Conflict detection**: Detect `git merge/rebase` conflicts, emit `conflict` events
- **Remote ops**: Track `git push`, `git pull`, `git fetch` with success/failure

```typescript
// New telemetry events
type GitTelemetry =
  | { type: 'git_files_changed', files: string[], count: number }
  | { type: 'git_conflict', files: string[], mergeType: 'merge' | 'rebase' }
  | { type: 'git_remote_op', operation: 'push' | 'pull' | 'fetch', success: boolean };
```

### 1.2 Repo Context in Agent State
Include repo metadata in agent state broadcasts:
- Current branch
- Upstream status (ahead/behind)
- Working tree status (clean/dirty)

---

## Phase 2: Agent Coordination with Git (Medium)

### 2.1 Branch-Aware Coordination
Allow agents to declare branch/area in their state footprint:

```
Agent: "Working on auth feature. Branch: feat/auth. Files: src/auth/*"
```

Other agents can see branch context and avoid conflicts.

### 2.2 Commit Notifications
When agents commit, emit to workspace inbox:
- Commit message
- Files changed
- Link to remote (if configured)

This is visible to humans in the Inbox but requires no extra action.

---

## Phase 3: Optional Bootstrap (Future)

### 3.1 Auto-Init for Empty Folders
From `tasks/dashboard-todo-detailed.md` lines 19-35:

```bash
# Config flags
Orkestrate_AUTO_INIT_REPO=true
Orkestrate_REPO_REMOTE=https://github.com/org/repo
Orkestrate_REPO_BRANCH=main
```

On session start:
1. Check if `.git` exists
2. If not and `AUTO_INIT_REPO=true`:
   - Run `git init` / `git init -b <branch>`
   - Add remote if provided
   - Fetch and track

### 3.2 Git Command Execution (Optional)
Add optional MCP tool for agents to:
- `git_branch_list`: Get local/remote branches
- `git_status`: Get working tree state
- `git_log`: Get recent commits

> **Warning**: Only enable if workspace trust model permits. Disabled by default.

---

## What NOT to Build (Per Gospel)

- ❌ Git GUI in browser
- ❌ PR/MR creation UI
- ❌ Commit history browser
- ❌ Branch management UI
- ❌ CI/CD integration
- ❌ Git hooks execution

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Richer git telemetry (files, conflicts) | 1 day | High |
| P0 | Repo context in agent state | 1 day | Medium |
| P1 | Commit notifications to Inbox | 2 days | Low |
| P1 | Branch-aware coordination display | 1 day | Medium |
| P2 | Auto-init bootstrap | 2 days | Low |
| P2 | Git MCP tools (optional) | 3 days | Low |

---

## Files to Modify

1. `public/tools/claude/telemetry.js` - Extend git event emission
2. `public/tools/opencode/telemetry.js` - Same for OpenCode
3. `src/lib/agent-activity.ts` - New telemetry types
4. `src/app/dashboard/agent-state/page.tsx` - Show branch in state
5. `src/app/dashboard/inbox/page.tsx` - Show commit notifications

---

## Success Criteria

- Agents can see each other's branch context
- Git conflicts are surfaced as events
- Human users see commit activity in Inbox
- Zero new UI for git management
- Agents retain full git agency
