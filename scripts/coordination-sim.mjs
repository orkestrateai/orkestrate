import { createHash } from "node:crypto";

class CoordinationServer {
  constructor(workspaceRemote = "https://github.com/acme/agentalk") {
    this.workspaceRemote = this.normalizeRemote(workspaceRemote);
    this.sessions = new Map(); // agentId -> { active, remote, branch, headSha, toolName }
    this.states = new Map(); // agentId -> { version, content, updatedAt }
    this.claims = new Map(); // claimId -> { agentId, paths, leaseExpiresAt, status, updatedAt }
    this.nextClaimId = 1;
  }

  normalizeRemote(remote) {
    return String(remote || "")
      .trim()
      .toLowerCase()
      .replace(/\.git$/, "")
      .replace(/^git@([^:]+):/, "https://$1/")
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
  }

  joinWorkspace(agentId, args) {
    const git = args?.gitContext || {};
    const remote = String(git.remote || "").trim();
    const repoRoot = String(git.repoRoot || "").trim();
    const branch = String(git.branch || "").trim();
    const headSha = String(git.headSha || "").trim();
    const collectedAt = String(git.collectedAt || "").trim();
    const dirty = git.dirty;

    if (!remote || !repoRoot || !branch || !/^[a-f0-9]{7,64}$/i.test(headSha) || typeof dirty !== "boolean" || Number.isNaN(Date.parse(collectedAt))) {
      return { ok: false, error: "INVALID_GIT_CONTEXT" };
    }
    const normalizedRemote = this.normalizeRemote(remote);
    if (normalizedRemote !== this.workspaceRemote) {
      return { ok: false, error: "REPO_MISMATCH", expected: this.workspaceRemote, got: normalizedRemote };
    }

    this.sessions.set(agentId, {
      active: true,
      remote: normalizedRemote,
      branch,
      headSha,
      toolName: args?.toolName || "unknown",
    });
    return {
      ok: true,
      agentId,
      repoVerified: true,
      normalizedRemote,
      branch,
      headSha,
      policy: { overlapPolicy: "strict_reject", branchPolicy: "same_repo_any_branch" },
    };
  }

  expireClaims() {
    const now = Date.now();
    for (const claim of this.claims.values()) {
      if (claim.status === "active" && claim.leaseExpiresAt <= now) {
        claim.status = "expired";
      }
    }
  }

  pathNorm(path) {
    return String(path || "").trim().replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  }

  overlap(aRaw, bRaw) {
    const a = this.pathNorm(aRaw);
    const b = this.pathNorm(bRaw);
    if (!a || !b) return false;
    if (a === b) return true;

    const aGlob = a.endsWith("/**");
    const bGlob = b.endsWith("/**");
    const aBase = aGlob ? a.slice(0, -3) : a;
    const bBase = bGlob ? b.slice(0, -3) : b;
    const aPrefix = aBase.endsWith("/") ? aBase : `${aBase}/`;
    const bPrefix = bBase.endsWith("/") ? bBase : `${bBase}/`;

    if (aGlob && (b === aBase || b.startsWith(aPrefix))) return true;
    if (bGlob && (a === bBase || a.startsWith(bPrefix))) return true;
    if (a.startsWith(bPrefix) || b.startsWith(aPrefix)) return true;
    return false;
  }

  claimCovers(claimPathRaw, targetPathRaw) {
    const claimPath = this.pathNorm(claimPathRaw);
    const targetPath = this.pathNorm(targetPathRaw);
    if (!claimPath || !targetPath) return false;
    if (claimPath === targetPath) return true;
    if (claimPath.endsWith("/**")) {
      const base = claimPath.slice(0, -3);
      const prefix = base.endsWith("/") ? base : `${base}/`;
      return targetPath === base || targetPath.startsWith(prefix);
    }
    const prefix = claimPath.endsWith("/") ? claimPath : `${claimPath}/`;
    return targetPath.startsWith(prefix);
  }

  claimScope(agentId, expectedStateHash, paths, ttlSeconds = 900) {
    const session = this.sessions.get(agentId);
    if (!session?.active) return { ok: false, error: "AGENT_NOT_JOINED" };

    this.expireClaims();
    const current = this.workspaceStateHash();
    if (expectedStateHash !== current) {
      return { ok: false, error: "HASH_MISMATCH", currentStateHash: current };
    }

    const normalizedPaths = Array.from(new Set((paths || []).map((p) => this.pathNorm(p)).filter(Boolean)));
    if (normalizedPaths.length === 0) return { ok: false, error: "EMPTY_PATHS" };

    const conflicts = [];
    for (const claim of this.claims.values()) {
      if (claim.status !== "active") continue;
      if (claim.agentId === agentId) continue;
      const overlap = normalizedPaths.some((p) => claim.paths.some((q) => this.overlap(p, q)));
      if (overlap) {
        conflicts.push({ claimId: claim.id, agentId: claim.agentId, paths: claim.paths });
      }
    }
    if (conflicts.length > 0) {
      return { ok: false, error: "SCOPE_CONFLICT", conflicts, currentStateHash: this.workspaceStateHash() };
    }

    for (const claim of this.claims.values()) {
      if (claim.agentId === agentId && claim.status === "active") claim.status = "released";
    }

    const claimId = `claim_${String(this.nextClaimId++).padStart(3, "0")}`;
    const now = Date.now();
    this.claims.set(claimId, {
      id: claimId,
      agentId,
      paths: normalizedPaths,
      status: "active",
      leaseExpiresAt: now + Math.max(30, Math.min(3600, Math.floor(ttlSeconds))) * 1000,
      updatedAt: new Date(now).toISOString(),
    });

    return { ok: true, claimId, stateHash: this.workspaceStateHash() };
  }

  releaseScope(agentId, claimId) {
    const claim = this.claims.get(claimId);
    if (!claim) return { ok: false, error: "CLAIM_NOT_FOUND" };
    if (claim.agentId !== agentId) return { ok: false, error: "CLAIM_NOT_OWNED" };
    claim.status = "released";
    claim.updatedAt = new Date().toISOString();
    return { ok: true, stateHash: this.workspaceStateHash() };
  }

  readTeamState() {
    this.expireClaims();
    const agents = [];
    for (const [agentId, row] of this.states.entries()) {
      const session = this.sessions.get(agentId);
      agents.push({
        agentId,
        toolName: session?.toolName || "unknown",
        version: row.version,
        status: row.content.status || "active",
        objective: row.content.currentObjective,
        footprint: row.content.architectureFootprint,
        branch: row.content.repo?.branch || session?.branch || null,
        headSha: row.content.repo?.headSha || session?.headSha || null,
      });
    }
    agents.sort((a, b) => a.agentId.localeCompare(b.agentId));

    const activeClaims = [];
    for (const claim of this.claims.values()) {
      if (claim.status !== "active") continue;
      activeClaims.push({
        claimId: claim.id,
        agentId: claim.agentId,
        paths: claim.paths,
        leaseExpiresAt: new Date(claim.leaseExpiresAt).toISOString(),
      });
    }

    return { stateHash: this.workspaceStateHash(), agents, activeClaims };
  }

  updateMyState(agentId, expectedStateHash, content) {
    const session = this.sessions.get(agentId);
    if (!session?.active) {
      return { ok: false, error: "Agent not joined." };
    }

    const current = this.workspaceStateHash();
    if (expectedStateHash !== current) {
      return { ok: false, error: "HASH_MISMATCH", currentStateHash: current };
    }

    if (!content?.repo?.canonicalRemote || !content?.repo?.branch || !content?.repo?.headSha) {
      return { ok: false, error: "REPO_FIELDS_REQUIRED" };
    }
    if (this.normalizeRemote(content.repo.canonicalRemote) !== session.remote) {
      return { ok: false, error: "REPO_MISMATCH_ON_UPDATE" };
    }

    const footprint = Array.isArray(content.architectureFootprint) ? content.architectureFootprint.map((p) => this.pathNorm(p)).filter(Boolean) : [];
    if (footprint.length > 0) {
      const ownActiveClaims = [...this.claims.values()].filter((c) => c.status === "active" && c.agentId === agentId);
      if (ownActiveClaims.length === 0) return { ok: false, error: "NO_ACTIVE_CLAIM" };

      const claimPaths = ownActiveClaims.flatMap((c) => c.paths);
      const missing = footprint.filter((path) => !claimPaths.some((cp) => this.claimCovers(cp, path)));
      if (missing.length > 0) return { ok: false, error: "FOOTPRINT_OUTSIDE_CLAIM", missingPaths: missing, claimPaths };
    }

    const prev = this.states.get(agentId);
    const nextVersion = `v${(prev ? Number(prev.version.slice(1)) : 0) + 1}`;
    this.states.set(agentId, {
      version: nextVersion,
      content,
      updatedAt: new Date().toISOString(),
    });

    if (
      footprint.length === 0 &&
      ["idle", "done", "handoff"].includes(String(content.status || "").toLowerCase())
    ) {
      for (const claim of this.claims.values()) {
        if (claim.agentId === agentId && claim.status === "active") claim.status = "released";
      }
    }

    return { ok: true, stateHash: this.workspaceStateHash() };
  }

  workspaceStateHash() {
    const signatures = [];
    for (const [agentId, row] of this.states.entries()) {
      signatures.push(`${agentId}:${row.version}:${row.updatedAt}`);
    }
    this.expireClaims();
    for (const claim of this.claims.values()) {
      if (claim.status !== "active") continue;
      signatures.push(`${claim.id}:${claim.agentId}:${claim.updatedAt}:${claim.paths.join(",")}`);
    }
    signatures.sort();
    const digest = createHash("sha1")
      .update(signatures.join("|"))
      .digest("hex")
      .slice(0, 12);
    return `v${digest}`;
  }
}

function content(objective, footprint) {
  return {
    agentProfile: "sim-agent",
    currentObjective: objective,
    architectureFootprint: footprint,
    implementationPlan: [],
    notesForTeam: "",
    pastWorkSummary: [],
    status: "active",
    repo: {
      canonicalRemote: "https://github.com/acme/agentalk",
      branch: "feat/sim",
      headSha: "a".repeat(40),
    },
  };
}

function gitCtx(branch, shaSeed = "a") {
  return {
    remote: "https://github.com/acme/agentalk.git",
    repoRoot: "/workspace/agentalk",
    branch,
    headSha: shaSeed.repeat(40).slice(0, 40),
    dirty: false,
    collectedAt: new Date().toISOString(),
  };
}

function scenarioJoinValidation() {
  const s = new CoordinationServer();
  const ok = s.joinWorkspace("alpha", { toolName: "ToolA", gitContext: gitCtx("feat/auth", "a") });
  const bad = s.joinWorkspace("intruder", {
    toolName: "ToolX",
    gitContext: { ...gitCtx("feat/x", "b"), remote: "https://github.com/evil/not-agentalk" },
  });
  const missing = s.joinWorkspace("broken", { toolName: "ToolY", gitContext: { branch: "feat/x" } });
  return { name: "join_validation", ok, bad, missing };
}

function scenarioStrictClaims() {
  const s = new CoordinationServer();
  s.joinWorkspace("alpha", { toolName: "ToolA", gitContext: gitCtx("feat/auth", "a") });
  s.joinWorkspace("beta", { toolName: "ToolB", gitContext: gitCtx("feat/billing", "b") });

  const r1 = s.readTeamState();
  const c1 = s.claimScope("alpha", r1.stateHash, ["src/auth/**"]);
  const u1 = s.updateMyState("alpha", c1.stateHash, content("Build auth", ["src/auth/jwt.ts"]));

  const r2 = s.readTeamState();
  const c2 = s.claimScope("beta", r2.stateHash, ["src/auth/jwt.ts"]);
  const c3 = s.claimScope("beta", r2.stateHash, ["src/billing/**"]);
  const u2 = c3.ok ? s.updateMyState("beta", c3.stateHash, content("Build billing", ["src/billing/retry.ts"])) : { ok: false, error: "CLAIM_FAILED" };

  return {
    name: "strict_claims",
    alphaClaimOk: c1.ok,
    alphaUpdateOk: u1.ok,
    betaOverlapRejected: c2.error === "SCOPE_CONFLICT",
    betaClaimOk: c3.ok,
    betaUpdateOk: u2.ok,
    final: s.readTeamState(),
  };
}

function scenarioReleaseAndReclaim() {
  const s = new CoordinationServer();
  s.joinWorkspace("alpha", { toolName: "ToolA", gitContext: gitCtx("feat/auth", "a") });
  s.joinWorkspace("beta", { toolName: "ToolB", gitContext: gitCtx("feat/auth", "b") });

  const first = s.readTeamState();
  const claim = s.claimScope("alpha", first.stateHash, ["src/db/**"]);
  const released = claim.ok ? s.releaseScope("alpha", claim.claimId) : { ok: false };

  const second = s.readTeamState();
  const betaClaim = s.claimScope("beta", second.stateHash, ["src/db/schema.ts"]);

  return {
    name: "release_reclaim",
    alphaClaim: claim.ok,
    alphaRelease: released.ok,
    betaReclaim: betaClaim.ok,
  };
}

function scenarioStaleHash() {
  const s = new CoordinationServer();
  s.joinWorkspace("alpha", { toolName: "ToolA", gitContext: gitCtx("feat/a", "a") });
  s.joinWorkspace("beta", { toolName: "ToolB", gitContext: gitCtx("feat/b", "b") });

  const stale = s.readTeamState();
  const fresh = s.readTeamState();
  const c1 = s.claimScope("alpha", fresh.stateHash, ["src/core/**"]);
  const mismatch = s.claimScope("beta", stale.stateHash, ["src/worker/**"]);

  const retryRead = s.readTeamState();
  const retry = s.claimScope("beta", retryRead.stateHash, ["src/worker/**"]);
  return {
    name: "stale_hash_retry",
    firstClaim: c1.ok,
    mismatchError: mismatch.error,
    retrySuccess: retry.ok,
  };
}

function run() {
  const results = [
    scenarioJoinValidation(),
    scenarioStrictClaims(),
    scenarioReleaseAndReclaim(),
    scenarioStaleHash(),
  ];
  console.log(JSON.stringify(results, null, 2));
}

run();
