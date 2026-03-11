# Git Workflow Guide for Orkestrate

This document provides detailed git workflows, best practices, and troubleshooting for the Orkestrate project.

## Table of Contents

1. [Repository Overview](#repository-overview)
2. [Development Workflows](#development-workflows)
3. [Branch Management](#branch-management)
4. [Collaboration Patterns](#collaboration-patterns)
5. [Conflict Resolution](#conflict-resolution)
6. [Advanced Git Operations](#advanced-git-operations)
7. [Troubleshooting](#troubleshooting)

---

## Repository Overview

**Repository**: `https://github.com/system1970/Orkestrate.git`

**Main Branch**: `main` - Production-ready code

**Current Active Branches**:
- `redesign/backend` - Backend redesign work
- `feat/backend-wiring-orkestrate` - Orkestrate integration
- `rebrand/orkestrate` - Rebranding efforts
- `browser-testing` - Browser automation experiments

### Repository Structure

```
Orkestrate/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/              # Core libraries and utilities
│   ├── db/               # Database schema and migrations
│   └── tools/            # Agent tool adapters
├── public/
│   └── tools/            # Client-side telemetry plugins
├── documentation/        # Project documentation
├── drizzle/              # Database migrations
└── .gitignore
```

---

## Development Workflows

### Workflow 1: Solo Feature Development

**Use case**: Working on a feature independently

```bash
# 1. Start from main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feat/my-feature

# 3. Work and commit
git add src/app/api/new-endpoint/route.ts
git commit -m "feat(api): add new endpoint for feature X"

# 4. Push to remote
git push -u origin feat/my-feature

# 5. Create PR on GitHub
# Navigate to repo and click "Compare & pull request"

# 6. After PR approval, merge via GitHub UI
# Then clean up local branch
git checkout main
git pull origin main
git branch -d feat/my-feature
```

### Workflow 2: Multi-Agent Collaboration

**Use case**: Multiple AI agents working on the same feature

```bash
# Agent 1: Create feature branch and claim backend files
git checkout -b feat/knowledge-improvements
# Update Orkestrate state: claim src/app/api/knowledge/
git add src/app/api/knowledge/route.ts
git commit -m "feat(api): add DELETE endpoint for knowledge base"
git push -u origin feat/knowledge-improvements

# Agent 2: Join the same branch, claim different files
git fetch origin
git checkout feat/knowledge-improvements
git pull origin feat/knowledge-improvements
# Update Orkestrate state: claim src/app/dashboard/knowledge-base/
git add src/app/dashboard/knowledge-base/page.tsx
git commit -m "feat(ui): add delete button and confirmation modal"
git push origin feat/knowledge-improvements

# Agent 3: Join and work on documentation
git checkout feat/knowledge-improvements
git pull origin feat/knowledge-improvements
# Update Orkestrate state: claim documentation/
git add documentation/knowledge-base-api.md
git commit -m "docs: document knowledge base delete API"
git push origin feat/knowledge-improvements
```

### Workflow 3: Hotfix for Production

**Use case**: Critical bug fix needed immediately

```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b fix/critical-auth-bug

# 2. Make minimal fix
git add src/app/auth/callback/route.ts
git commit -m "fix(auth): resolve infinite redirect loop

Added proper session validation and fallback redirect.

Fixes #123"

# 3. Push and create PR with "hotfix" label
git push -u origin fix/critical-auth-bug

# 4. After merge, ensure fix is in all active branches
git checkout redesign/backend
git merge main
git push origin redesign/backend
```

---

## Branch Management

### Creating Branches

```bash
# From main (recommended)
git checkout main
git pull origin main
git checkout -b feat/new-feature

# From another branch (if needed)
git checkout redesign/backend
git pull origin redesign/backend
git checkout -b feat/based-on-redesign
```

### Keeping Branches Updated

**Option 1: Merge** (preserves history)
```bash
git checkout feat/my-feature
git fetch origin
git merge origin/main
git push origin feat/my-feature
```

**Option 2: Rebase** (cleaner history, preferred)
```bash
git checkout feat/my-feature
git fetch origin
git rebase origin/main

# If conflicts occur
# 1. Fix conflicts in files
# 2. Stage resolved files
git add .
# 3. Continue rebase
git rebase --continue

# Push rebased branch
git push --force-with-lease origin feat/my-feature
```

### Deleting Branches

```bash
# Delete local branch (after merge)
git branch -d feat/my-feature

# Force delete (if not merged)
git branch -D feat/my-feature

# Delete remote branch
git push origin --delete feat/my-feature
```

### Branch Naming Conventions

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/mcp-server-v2` |
| `fix/` | Bug fix | `fix/telemetry-race-condition` |
| `refactor/` | Code refactoring | `refactor/agent-state-store` |
| `docs/` | Documentation | `docs/api-reference` |
| `chore/` | Maintenance | `chore/update-deps` |
| `test/` | Testing | `test/api-integration` |
| `perf/` | Performance | `perf/optimize-queries` |

---

## Collaboration Patterns

### Pattern 1: Parallel Development (No Overlap)

**Scenario**: Two agents working on different parts of the codebase

```bash
# Agent A: Backend API
git checkout -b feat/user-management
# Works on: src/app/api/users/
git commit -m "feat(api): add user CRUD endpoints"
git push origin feat/user-management

# Agent B: Frontend UI (different branch)
git checkout -b feat/user-ui
# Works on: src/app/dashboard/users/
git commit -m "feat(ui): add user management interface"
git push origin feat/user-ui

# Later: Merge both to main independently
```

### Pattern 2: Sequential Development (Handoff)

**Scenario**: One agent completes work, another continues

```bash
# Agent A: Initial implementation
git checkout -b feat/notification-system
git commit -m "feat(api): add notification endpoints"
git push origin feat/notification-system
# Update Orkestrate: "Backend complete, ready for UI work"

# Agent B: Continues on same branch
git checkout feat/notification-system
git pull origin feat/notification-system
git commit -m "feat(ui): add notification UI components"
git push origin feat/notification-system
```

### Pattern 3: Coordinated Development (Same Branch)

**Scenario**: Multiple agents on same branch, different files

```bash
# All agents work on: feat/knowledge-improvements

# Agent 1: API layer
git checkout feat/knowledge-improvements
git pull origin feat/knowledge-improvements
# Modify: src/app/api/knowledge/route.ts
git commit -m "feat(api): add knowledge base endpoints"
git push origin feat/knowledge-improvements

# Agent 2: UI layer (pulls latest first)
git checkout feat/knowledge-improvements
git pull origin feat/knowledge-improvements  # Gets Agent 1's changes
# Modify: src/app/dashboard/knowledge-base/page.tsx
git commit -m "feat(ui): add knowledge base interface"
git push origin feat/knowledge-improvements

# Agent 3: Documentation (pulls latest)
git checkout feat/knowledge-improvements
git pull origin feat/knowledge-improvements  # Gets both previous changes
# Modify: documentation/knowledge-base.md
git commit -m "docs: document knowledge base feature"
git push origin feat/knowledge-improvements
```

---

## Conflict Resolution

### Understanding Conflicts

Conflicts occur when:
- Two agents modify the same lines in a file
- One agent deletes a file another agent modified
- Merge/rebase operations encounter incompatible changes

### Resolving Merge Conflicts

```bash
# Attempt to merge/pull
git pull origin main
# Output: CONFLICT (content): Merge conflict in src/app/api/route.ts

# 1. Check conflicted files
git status

# 2. Open conflicted file, look for markers:
<<<<<<< HEAD
// Your changes
const result = await newImplementation();
=======
// Incoming changes
const result = await oldImplementation();
>>>>>>> origin/main

# 3. Resolve by choosing one or combining:
const result = await newImplementation();

# 4. Remove conflict markers, stage file
git add src/app/api/route.ts

# 5. Complete merge
git commit -m "merge: resolve conflict in api route"
```

### Resolving Rebase Conflicts

```bash
# Start rebase
git rebase origin/main
# Output: CONFLICT (content): Merge conflict in file.ts

# 1. Fix conflicts in file
# 2. Stage resolved files
git add file.ts

# 3. Continue rebase
git rebase --continue

# If multiple conflicts, repeat steps 1-3

# 4. Push rebased branch
git push --force-with-lease origin feat/my-feature
```

### Aborting Operations

```bash
# Abort merge
git merge --abort

# Abort rebase
git rebase --abort

# Abort cherry-pick
git cherry-pick --abort
```

---

## Advanced Git Operations

### Cherry-Picking Commits

**Use case**: Apply specific commits from one branch to another

```bash
# Find commit hash
git log --oneline feat/source-branch

# Apply commit to current branch
git cherry-pick abc1234

# Cherry-pick multiple commits
git cherry-pick abc1234 def5678

# Cherry-pick without committing (to modify)
git cherry-pick -n abc1234
```

### Interactive Rebase

**Use case**: Clean up commit history before PR

```bash
# Rebase last 3 commits
git rebase -i HEAD~3

# In editor, choose actions:
# pick = keep commit
# reword = change commit message
# squash = combine with previous commit
# drop = remove commit

# Example:
pick abc1234 feat: add feature A
squash def5678 fix: typo in feature A
reword ghi9012 feat: add feature B

# Save and close editor, follow prompts
```

### Stashing Changes

**Use case**: Temporarily save work to switch branches

```bash
# Stash current changes
git stash

# Stash with message
git stash save "WIP: implementing feature X"

# List stashes
git stash list

# Apply most recent stash
git stash apply

# Apply and remove stash
git stash pop

# Apply specific stash
git stash apply stash@{1}

# Drop stash
git stash drop stash@{0}
```

### Viewing History

```bash
# Compact log
git log --oneline -10

# Graph view
git log --graph --oneline --all

# Show changes in commit
git show abc1234

# Show file history
git log --follow src/app/api/route.ts

# Search commits
git log --grep="knowledge base"

# Show who changed each line
git blame src/app/api/route.ts
```

---

## Troubleshooting

### Problem: Accidentally Committed to Wrong Branch

```bash
# Move commit to new branch
git branch feat/correct-branch
git reset --hard HEAD~1
git checkout feat/correct-branch
```

### Problem: Need to Undo Last Commit

```bash
# Undo commit, keep changes
git reset --soft HEAD~1

# Undo commit and changes
git reset --hard HEAD~1

# Undo commit, unstage changes
git reset HEAD~1
```

### Problem: Pushed Sensitive Data

```bash
# 1. Remove from history (DANGEROUS)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/sensitive/file" \
  --prune-empty --tag-name-filter cat -- --all

# 2. Force push (coordinate with team first!)
git push --force --all

# 3. Rotate compromised secrets immediately
```

### Problem: Diverged Branches

```bash
# Check divergence
git log --oneline --graph --all

# Option 1: Merge
git merge origin/main

# Option 2: Rebase (cleaner)
git rebase origin/main

# Option 3: Reset to remote (lose local changes)
git reset --hard origin/main
```

### Problem: Large File Committed by Mistake

```bash
# Remove from last commit
git rm --cached large-file.zip
git commit --amend -m "feat: add feature (removed large file)"
git push --force-with-lease origin feat/my-branch

# If already pushed and merged, use BFG Repo-Cleaner
```

### Problem: Lost Commits After Reset

```bash
# Find lost commit
git reflog

# Restore commit
git cherry-pick abc1234

# Or reset to that point
git reset --hard abc1234
```

---

## Best Practices Summary

### ✅ Do

- Commit frequently with clear messages
- Pull before push
- Use feature branches
- Keep branches up to date with main
- Test before committing
- Use `--force-with-lease` instead of `--force`
- Coordinate with other agents via Orkestrate state
- Write descriptive commit messages

### ❌ Don't

- Force push to `main` or shared branches
- Commit sensitive data or secrets
- Make huge commits with unrelated changes
- Rebase public/shared branches
- Ignore merge conflicts
- Commit directly to `main`
- Push broken code
- Use `git push --force` (use `--force-with-lease`)

---

## Quick Reference

```bash
# Setup
git clone https://github.com/system1970/Orkestrate.git
git remote add upstream https://github.com/system1970/Orkestrate.git

# Daily workflow
git checkout main && git pull origin main
git checkout -b feat/my-feature
# ... make changes ...
git add . && git commit -m "feat: description"
git push -u origin feat/my-feature

# Sync with main
git fetch origin
git rebase origin/main
git push --force-with-lease origin feat/my-feature

# Cleanup
git checkout main
git pull origin main
git branch -d feat/my-feature
git remote prune origin
```

---

## Additional Resources

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [Git Documentation](https://git-scm.com/doc)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Orkestrate Gospel](./ORKESTRATE_GOSPEL.md) - Multi-agent coordination principles

---

**Last Updated**: 2026-03-05
