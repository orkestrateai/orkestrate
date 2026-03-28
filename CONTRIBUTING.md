# Contributing to Orkestrate

Thank you for your interest in contributing to Orkestrate! This document provides guidelines and workflows for contributing to the project.

## 🎯 Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Orkestrate.git`
3. Add upstream remote: `git remote add upstream https://github.com/system1970/Orkestrate.git`
4. Create a feature branch: `git checkout -b feat/your-feature-name`
5. Make your changes and commit
6. Push to your fork and create a Pull Request

## 🌿 Branching Strategy

Orkestrate uses a **feature branch workflow** with the following conventions:

### Main Branches

- **`main`**: Production-ready code. All PRs merge here.
- **`redesign/backend`**: Current active development branch (temporary, will merge to main)

### Feature Branches

Create branches from `main` using these prefixes:

- `feat/` - New features (e.g., `feat/knowledge-base-ui`)
- `fix/` - Bug fixes (e.g., `fix/auth-callback-error`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)
- `docs/` - Documentation updates (e.g., `docs/api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/agent-state-management`)
- `test/` - Test additions or fixes (e.g., `test/api-routes`)

### Branch Naming Rules

- Use lowercase with hyphens
- Be descriptive but concise
- Include issue number if applicable: `feat/123-add-feature`

**Examples:**
```bash
git checkout -b feat/mcp-server-improvements
git checkout -b fix/telemetry-ingest-race-condition
git checkout -b docs/git-workflow
```

## 📝 Commit Message Guidelines

We follow **Conventional Commits** for clear, semantic commit history.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependencies, config

### Examples

```bash
feat(knowledge): add delete functionality with cascade

Implemented DELETE endpoint in /api/knowledge route with recursive
cascade delete for folders. Added confirmation modal in UI.

Closes #42

---

fix(auth): resolve callback redirect loop

The auth callback was redirecting infinitely when session was invalid.
Added proper error handling and fallback redirect.

---

chore(deps): update next.js to 15.1.0
```

### Commit Best Practices

- Keep commits atomic (one logical change per commit)
- Write clear, descriptive messages
- Use present tense ("add feature" not "added feature")
- Reference issues/PRs when applicable
- Keep subject line under 72 characters

## 🔄 Git Workflow

### 1. Sync with Upstream

Before starting work, sync your fork:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

### 2. Create Feature Branch

```bash
git checkout -b feat/your-feature-name
```

### 3. Make Changes

- Write code following project conventions
- Test your changes locally
- Commit frequently with clear messages

```bash
git add src/app/api/knowledge/route.ts
git commit -m "feat(api): add knowledge base CRUD endpoints"
```

### 4. Keep Branch Updated

Regularly sync with main to avoid conflicts:

```bash
git fetch upstream
git rebase upstream/main
```

If conflicts occur, resolve them and continue:

```bash
# Fix conflicts in your editor
git add .
git rebase --continue
```

### 5. Push to Your Fork

```bash
git push origin feat/your-feature-name
```

For rebased branches, you may need to force push:

```bash
git push --force-with-lease origin feat/your-feature-name
```

**⚠️ Never force push to `main` or shared branches!**

### 6. Create Pull Request

1. Go to GitHub and create a PR from your fork to `system1970/Orkestrate:main`
2. Fill out the PR template with:
   - Clear description of changes
   - Related issue numbers
   - Testing performed
   - Screenshots (if UI changes)
3. Request review from maintainers
4. Address review feedback

## 🤝 Multi-Agent Collaboration

When working with AI agents (Claude, OpenCode, etc.) in the Orkestrate workspace:

### Coordination Protocol

1. **Join the workspace**: Use MCP tools to join the active workspace
2. **Read team state**: Check what other agents are working on
3. **Claim your footprint**: Update your state with files you'll modify
4. **Avoid conflicts**: Don't touch files claimed by other active agents
5. **Update progress**: Keep your state current as you work
6. **Communicate**: Use `notesForTeam` for important decisions or blockers
7. **Complete your work**: When finished, update your state to `status: "done"` or `status: "completed"` BEFORE releasing scope
8. **Release scope**: After updating state to done, release all claimed paths

**⚠️ IMPORTANT**: Always update your state to completed/done status when releasing scope after finishing work. This ensures the team knows your task is complete and prevents confusion about work status.

### Git Best Practices for Agents

- **Commit frequently**: Each logical unit of work should be committed
- **Clear messages**: Describe what changed and why
- **Coordinate branches**: Multiple agents can work on the same branch if footprints don't overlap
- **Pull before push**: Always fetch latest changes before pushing
- **Handle conflicts carefully**: If conflicts occur, coordinate with other agents

### Example Agent Workflow

```bash
# Agent 1: Working on API routes
git checkout -b feat/knowledge-api
# Claim: src/app/api/knowledge/route.ts
# Make changes, commit, push

# Agent 2: Working on UI (same branch, different files)
git checkout feat/knowledge-api
git pull origin feat/knowledge-api
# Claim: src/app/dashboard/knowledge-base/page.tsx
# Make changes, commit, push
```

## 🧪 Testing Requirements

Before submitting a PR:

- [ ] Code builds without errors: `bun run build`
- [ ] Linting passes: `bun run lint`
- [ ] Type checking passes: `npm run type-check` (if available)
- [ ] Manual testing completed
- [ ] No console errors in browser
- [ ] Database migrations tested (if applicable)

## 📋 Pull Request Checklist

- [ ] Branch is up to date with `main`
- [ ] Commits follow conventional commit format
- [ ] Code follows project style guidelines
- [ ] Tests pass (when test suite exists)
- [ ] Documentation updated (if needed)
- [ ] No merge conflicts
- [ ] PR description is clear and complete
- [ ] Related issues are linked

## 🚫 What Not to Commit

The `.gitignore` already covers most cases, but never commit:

- Environment files (`.env`, `.env.local`)
- API keys, secrets, or credentials
- Personal IDE configurations
- Agent-local files (`.claude/`, `.agent/`, `opencode_*.json`)
- Large binary files or datasets
- `node_modules/` or build artifacts
- Temporary or debug files

## 🔐 Security

- Never commit sensitive data
- Use environment variables for secrets
- Report security vulnerabilities privately to maintainers
- Don't include real user data in examples

## 💬 Communication

- **Issues**: For bug reports and feature requests
- **Discussions**: For questions and general discussion
- **PRs**: For code contributions
- **Discord/Slack**: For real-time coordination (if available)

## 🔌 Adding MCP Configs

Orkestrate supports auto-configuration for multiple AI coding tools. We welcome contributions for tools not yet supported!

**📋 See [Issue #6: Add MCP configuration support for [YOUR TOOL]](https://github.com/system1970/Orkestrate/issues/6)** for details on what's needed and how to contribute.

If your tool isn't in the auto-config list, use `orkestrate connect` to get tool-specific setup instructions.

## 📚 Additional Resources

- [Git Workflow Documentation](./documentation/git-workflow.md) - Detailed workflow guide
- [Project Documentation](./documentation/PROJECT_DOCUMENTATION.md) - Architecture overview
- [Orkestrate Gospel](./documentation/ORKESTRATE_GOSPEL.md) - Core principles

## 🎉 Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Project README (for major features)

Thank you for contributing to Orkestrate! 🚀
