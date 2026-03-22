/**
 * GitHub Token Management
 *
 * Provides persistent storage and automatic refresh of GitHub OAuth tokens.
 * Tokens are stored in PostgreSQL (github_tokens table) rather than Supabase session.
 */

import { nanoid } from "nanoid";
import { db } from "@/db";
import { githubTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

export interface GithubTokenRecord {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  tokenType: string;
  scope: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GithubTokenResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

/**
 * Store or update GitHub tokens for a user
 */
export async function storeGithubTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null = null,
  expiresInSeconds: number | null = null,
  scope: string | null = null,
): Promise<GithubTokenRecord> {
  const now = new Date();
  const expiresAt = expiresInSeconds
    ? new Date(now.getTime() + expiresInSeconds * 1000)
    : null;

  const existing = await db.query.githubTokens.findFirst({
    where: and(
      eq(githubTokens.userId, userId),
      eq(githubTokens.tokenType, "github"),
    ),
  });

  if (existing) {
    // Update existing token
    const updated = await db
      .update(githubTokens)
      .set({
        accessToken,
        refreshToken,
        expiresAt,
        scope,
        updatedAt: now,
      })
      .where(eq(githubTokens.id, existing.id))
      .returning();
    return updated[0];
  }

  // Create new token record
  const id = `ght_${nanoid(16)}`;
  const inserted = await db
    .insert(githubTokens)
    .values({
      id,
      userId,
      accessToken,
      refreshToken,
      expiresAt,
      tokenType: "github",
      scope,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return inserted[0];
}

/**
 * Get the current valid access token for a user, refreshing if necessary
 */
export async function getValidGithubAccessToken(
  userId: string,
): Promise<GithubTokenResult> {
  const tokenRecord = await db.query.githubTokens.findFirst({
    where: and(
      eq(githubTokens.userId, userId),
      eq(githubTokens.tokenType, "github"),
    ),
  });

  if (!tokenRecord) {
    return { success: false, error: "No GitHub token found for user" };
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (tokenRecord.expiresAt && tokenRecord.expiresAt <= fiveMinutesFromNow) {
    // Token is expired or about to expire, try to refresh
    if (!tokenRecord.refreshToken) {
      return {
        success: false,
        error: "GitHub token expired and no refresh token available",
      };
    }

    const refreshResult = await refreshGithubToken(
      tokenRecord.refreshToken,
      userId,
    );
    if (!refreshResult.success) {
      return { success: false, error: refreshResult.error };
    }

    return { success: true, accessToken: refreshResult.accessToken };
  }

  // Token is still valid
  return { success: true, accessToken: tokenRecord.accessToken };
}

/**
 * Refresh an expired GitHub token using the refresh token
 */
export async function refreshGithubToken(
  refreshToken: string,
  userId: string,
): Promise<GithubTokenResult> {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: "GitHub OAuth credentials not configured",
      };
    }

    const response = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub token refresh failed:", errorText);
      return { success: false, error: "Failed to refresh GitHub token" };
    }

    const data = await response.json();

    if (data.error) {
      console.error("GitHub token refresh error:", data.error_description);
      return { success: false, error: data.error_description || data.error };
    }

    // Parse expires_in (seconds) or use default of 3600 (1 hour) for GitHub tokens
    // GitHub tokens don't always include expires_in for OAuth tokens
    const expiresIn = data.expires_in || 3600;

    // Store the new tokens
    await storeGithubTokens(
      userId,
      data.access_token,
      data.refresh_token || refreshToken, // Use new refresh token if provided
      expiresIn,
      data.scope,
    );

    return { success: true, accessToken: data.access_token };
  } catch (error) {
    console.error("GitHub token refresh exception:", error);
    return { success: false, error: "Exception during token refresh" };
  }
}

/**
 * Delete GitHub tokens for a user (disconnect)
 */
export async function deleteGithubTokens(userId: string): Promise<boolean> {
  try {
    await db
      .delete(githubTokens)
      .where(
        and(
          eq(githubTokens.userId, userId),
          eq(githubTokens.tokenType, "github"),
        ),
      );
    return true;
  } catch (error) {
    console.error("Failed to delete GitHub tokens:", error);
    return false;
  }
}

/**
 * Check if user has connected GitHub
 */
export async function hasGithubConnection(userId: string): Promise<boolean> {
  const token = await db.query.githubTokens.findFirst({
    where: and(
      eq(githubTokens.userId, userId),
      eq(githubTokens.tokenType, "github"),
    ),
  });
  return !!token;
}

/**
 * Fetch from GitHub API with automatic token handling
 */
export async function githubApiFetch(
  userId: string,
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const tokenResult = await getValidGithubAccessToken(userId);

  if (!tokenResult.success || !tokenResult.accessToken) {
    throw new Error(tokenResult.error || "No valid GitHub token");
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${GITHUB_API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
      Accept: "application/vnd.github.v3+json",
      ...options.headers,
    },
  });

  return response;
}

/**
 * Exchange authorization code for GitHub tokens (for OAuth flow)
 */
export async function exchangeCodeForGithubToken(code: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  error?: string;
}> {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: "GitHub OAuth credentials not configured",
      };
    }

    const response = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub code exchange failed:", errorText);
      return { success: false, error: "Failed to exchange code for token" };
    }

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error_description || data.error };
    }

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  } catch (error) {
    console.error("GitHub code exchange exception:", error);
    return { success: false, error: "Exception during code exchange" };
  }
}
