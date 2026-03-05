/**
 * Git utilities for Git-Rooted Coordination
 * Provides git context extraction and validation for multi-agent synchronization
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitContext {
  remote: string | null;
  branch: string | null;
  headSha: string | null;
  aheadBehind: string | null;
  hasUncommittedChanges: boolean;
  error?: string;
}

/**
 * Get comprehensive git context from the current working directory
 */
export async function getGitContext(cwd?: string): Promise<GitContext> {
  const context: GitContext = {
    remote: null,
    branch: null,
    headSha: null,
    aheadBehind: null,
    hasUncommittedChanges: false,
  };

  try {
    // Get remote URL
    try {
      const { stdout: remote } = await execAsync('git remote get-url origin', { cwd });
      context.remote = remote.trim();
    } catch (e) {
      context.error = 'No git remote configured';
    }

    // Get current branch
    try {
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
      context.branch = branch.trim();
    } catch (e) {
      // Ignore - might be in detached HEAD state
    }

    // Get current commit SHA
    try {
      const { stdout: sha } = await execAsync('git rev-parse HEAD', { cwd });
      context.headSha = sha.trim();
    } catch (e) {
      // Ignore - might not have any commits yet
    }

    // Get ahead/behind status
    if (context.branch) {
      try {
        await execAsync('git fetch origin --dry-run', { cwd, timeout: 5000 });
        const { stdout: status } = await execAsync(
          `git rev-list --left-right --count origin/${context.branch}...HEAD`,
          { cwd }
        );
        const [behind, ahead] = status.trim().split('\t').map(Number);

        if (ahead === 0 && behind === 0) {
          context.aheadBehind = 'up-to-date';
        } else {
          const parts = [];
          if (ahead > 0) parts.push(`ahead ${ahead}`);
          if (behind > 0) parts.push(`behind ${behind}`);
          context.aheadBehind = parts.join(', ');
        }
      } catch (e) {
        // Ignore - might not have upstream branch
        context.aheadBehind = 'unknown';
      }
    }

    // Check for uncommitted changes
    try {
      const { stdout: status } = await execAsync('git status --porcelain', { cwd });
      context.hasUncommittedChanges = status.trim().length > 0;
    } catch (e) {
      // Ignore
    }

  } catch (error) {
    context.error = error instanceof Error ? error.message : String(error);
  }

  return context;
}

/**
 * Normalize git remote URLs for comparison
 * Handles different formats: https, ssh, git@
 */
export function normalizeGitUrl(url: string): string {
  if (!url) return '';

  let normalized = url.trim().toLowerCase();

  // Remove trailing .git
  normalized = normalized.replace(/\.git$/, '');

  // Convert SSH to HTTPS format for comparison
  // git@github.com:user/repo -> https://github.com/user/repo
  normalized = normalized.replace(/^git@([^:]+):/, 'https://$1/');

  // Remove trailing slashes
  normalized = normalized.replace(/\/$/, '');

  // Remove protocol for comparison
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^git:\/\//, '');

  return normalized;
}

/**
 * Check if two git URLs refer to the same repository
 */
export function isSameRepository(url1: string, url2: string): boolean {
  return normalizeGitUrl(url1) === normalizeGitUrl(url2);
}

/**
 * Validate that agent's git context matches room's repository
 * This is the core of the "Join Guard" logic
 */
export interface JoinGuardResult {
  allowed: boolean;
  reason?: string;
  agentRepo?: string;
  roomRepo?: string;
}

export function validateJoinGuard(
  agentGitRemote: string | null,
  roomRepoUrl: string | null
): JoinGuardResult {
  // If room has no repo URL, allow join (backward compatibility)
  if (!roomRepoUrl) {
    return { allowed: true };
  }

  // If agent has no git remote, deny join
  if (!agentGitRemote) {
    return {
      allowed: false,
      reason: 'Agent is not in a git repository. This room requires git synchronization.',
      roomRepo: roomRepoUrl,
    };
  }

  // Check if repositories match
  if (!isSameRepository(agentGitRemote, roomRepoUrl)) {
    return {
      allowed: false,
      reason: 'Repository mismatch. Agent must be working in the same repository as the room.',
      agentRepo: agentGitRemote,
      roomRepo: roomRepoUrl,
    };
  }

  return { allowed: true };
}

/**
 * Check if agent should be warned about sync status
 */
export interface SyncWarning {
  level: 'error' | 'warning' | 'info';
  message: string;
}

export function checkSyncStatus(gitContext: GitContext): SyncWarning | null {
  // Critical: Agent is behind remote
  if (gitContext.aheadBehind?.includes('behind')) {
    const match = gitContext.aheadBehind.match(/behind (\d+)/);
    const count = match ? match[1] : 'some';
    return {
      level: 'error',
      message: `Your branch is ${count} commit(s) behind the remote. Pull latest changes before starting work.`,
    };
  }

  // Warning: Agent has uncommitted changes
  if (gitContext.hasUncommittedChanges) {
    return {
      level: 'warning',
      message: 'You have uncommitted changes. Consider committing or stashing before coordinating with other agents.',
    };
  }

  // Info: Agent is ahead (should push)
  if (gitContext.aheadBehind?.includes('ahead')) {
    const match = gitContext.aheadBehind.match(/ahead (\d+)/);
    const count = match ? match[1] : 'some';
    return {
      level: 'info',
      message: `Your branch is ${count} commit(s) ahead. Consider pushing your changes.`,
    };
  }

  return null;
}

/**
 * Format git context for display
 */
export function formatGitContext(context: GitContext): string {
  const parts: string[] = [];

  if (context.branch) {
    parts.push(`Branch: ${context.branch}`);
  }

  if (context.headSha) {
    parts.push(`Commit: ${context.headSha.substring(0, 7)}`);
  }

  if (context.aheadBehind && context.aheadBehind !== 'unknown') {
    parts.push(`Status: ${context.aheadBehind}`);
  }

  if (context.hasUncommittedChanges) {
    parts.push('⚠️ Uncommitted changes');
  }

  return parts.join(' | ');
}
