import { listProfiles, loadProfile } from "../../sdk/profiles/load";
import { parseProfile, type Profile } from "../../sdk/profiles/schema";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const BLUE = "\x1b[34m";

const REGISTRY_URL = process.env.ORKESTRATE_REGISTRY_URL || "https://orkestrate.space/api/registry";

export async function runProfileSubmit(name: string): Promise<void> {
  const profiles = await listProfiles({ warn: true });
  const profile = profiles.find((p: { name: string }) => p.name === name);

  if (!profile) {
    console.error(`${RED}Error:${RESET} Profile "${name}" not found`);
    process.exitCode = 1;
    return;
  }

  console.log(`${BOLD}Submitting profile: ${profile.name}${RESET}`);
  console.log("");

  // Load full profile with source path
  let fullProfile: Profile;
  try {
    fullProfile = await loadProfile(profile.name);
  } catch (error) {
    console.error(`${RED}Error:${RESET} Failed to load profile:`, error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  // Validate
  try {
    parseProfile(fullProfile);
  } catch (error) {
    console.error(`${RED}Error:${RESET} Profile validation failed:`, error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  console.log(`${GREEN}✓${RESET} Profile validation passed`);
  console.log("");

  // Check for existing auth token
  const token = await getAuthToken();
  if (!token) {
    console.log(`${YELLOW}Authentication required${RESET}`);
    console.log("This will open a browser window for GitHub OAuth via Supabase.");
    console.log("");
    
    const proceed = await confirm("Continue with authentication?");
    if (!proceed) {
      console.log("Cancelled.");
      return;
    }

    // Start device flow or web auth
    const authResult = await startAuthFlow();
    if (!authResult) {
      console.error(`${RED}Error:${RESET} Authentication failed or cancelled`);
      process.exitCode = 1;
      return;
    }
  }

  // Submit to registry
  console.log(`${BLUE}Submitting to registry...${RESET}`);
  try {
    const response = await fetch(`${REGISTRY_URL}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile: fullProfile,
        source: "cli",
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(`Registry error: ${response.status} - ${error.message ?? "Unknown"}`);
    }

    const result = await response.json();
    console.log(`${GREEN}✓${RESET} Profile submitted successfully!`);
    console.log("");
    console.log(`Submission ID: ${result.submission_id}`);
    console.log(`Status: ${result.status}`);
    console.log(`Review URL: ${result.review_url ?? "N/A"}`);
    console.log("");
    console.log("The Orkestrate team will review your submission.");
    console.log("You'll receive a notification when the review is complete.");

  } catch (error) {
    console.error(`${RED}Error:${RESET} Submission failed:`, error instanceof Error ? error.message : String(error));
    console.log("");
    console.log("You can also submit manually by:");
    console.log(`  1. Go to ${BLUE}https://orkestrate.space/submit${RESET}`);
    console.log("  2. Sign in with GitHub");
    console.log("  3. Paste the profile JSON or upload the file");
    process.exitCode = 1;
  }
}

async function getAuthToken(): Promise<string | null> {
  // Check for stored token (in ~/.orkestrate/auth.json or env)
  const authPath = `${process.env.HOME || process.env.USERPROFILE}/.orkestrate/auth.json`;
  try {
    const file = Bun.file(authPath);
    if (await file.exists()) {
      const auth = await file.json();
      if (auth.access_token && auth.expires_at && Date.now() < auth.expires_at) {
        return auth.access_token;
      }
    }
  } catch {}
  
  // Check env var
  if (process.env.ORKESTRATE_AUTH_TOKEN) {
    return process.env.ORKESTRATE_AUTH_TOKEN;
  }
  
  return null;
}

async function startAuthFlow(): Promise<string | null> {
  // Use Supabase device flow or redirect to web auth
  console.log(`${BLUE}Opening browser for GitHub authentication...${RESET}`);
  
  const authUrl = `${REGISTRY_URL}/auth/device`;
  try {
    const response = await fetch(authUrl, { method: "POST" });
    const data = await response.json();
    
    if (data.device_code && data.verification_uri_complete) {
      // Open browser
      const { spawn } = await import("node:child_process");
      const url = data.verification_uri_complete;
      
      let opened = false;
      if (process.platform === "darwin") {
        spawn("open", [url]);
        opened = true;
      } else if (process.platform === "win32") {
        spawn("cmd", ["/c", "start", url]);
        opened = true;
      } else if (process.platform === "linux") {
        spawn("xdg-open", [url]);
        opened = true;
      }
      
      if (!opened) {
        console.log(`Please open this URL in your browser: ${BLUE}${url}${RESET}`);
      }
      
      console.log(`Or visit: ${BLUE}${data.verification_uri}${RESET} and enter code: ${BOLD}${data.user_code}${RESET}`);
      console.log("");
      console.log("Waiting for authentication...");
      
      // Poll for token
      const token = await pollForToken(data.device_code, data.interval ?? 5);
      return token;
    }
  } catch (error) {
    console.error("Auth flow error:", error);
  }
  
  return null;
}

async function pollForToken(deviceCode: string, interval: number): Promise<string | null> {
  const maxAttempts = 180 / interval; // 3 minutes max
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, interval * 1000));
    
    try {
      const response = await fetch(`${REGISTRY_URL}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          // Save token
          const authPath = `${process.env.HOME || process.env.USERPROFILE}/.orkestrate/auth.json`;
          await Bun.write(authPath, JSON.stringify({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + (data.expires_in * 1000),
          }, null, 2));
          
          console.log(`${GREEN}✓${RESET} Authentication successful!`);
          return data.access_token;
        }
      } else if (response.status === 400) {
        const error = await response.json().catch(() => ({}));
        if (error.error === "authorization_pending") {
          continue; // Keep polling
        } else if (error.error === "slow_down") {
          interval += 5;
          continue;
        } else if (error.error === "expired_token") {
          console.log("Authentication expired. Please try again.");
          return null;
        } else if (error.error === "access_denied") {
          console.log("Authentication denied.");
          return null;
        }
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }
  
  console.log("Authentication timed out.");
  return null;
}

function confirm(message: string): Promise<boolean> {
  return new Promise(resolve => {
    console.log(`${message} (y/N): `);
    process.stdin.once("data", data => {
      const input = data.toString().trim().toLowerCase();
      resolve(input === "y" || input === "yes");
    });
  });
}