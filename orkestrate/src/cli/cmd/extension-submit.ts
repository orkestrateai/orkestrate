import { validateManifest, createManifestTemplate, type ExtensionManifest, type ExtensionType } from "../../sdk/extensions/manifest";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const BLUE = "\x1b[34m";

const REGISTRY_URL = process.env.ORKESTRATE_REGISTRY_URL || "https://orkestrate.space/api/registry";

export async function runExtensionSubmit(options: {
  path?: string;
  type?: ExtensionType;
  init?: boolean;
  outputPath?: string;
}): Promise<void> {
  const { path, type, init, outputPath } = options;

  if (init) {
    if (!type) {
      console.error(`${RED}Error:${RESET} --type required with --init`);
      console.error(`Types: adapter, profile-pack, skill-pack, mcp-pack, command-pack`);
      process.exitCode = 1;
      return;
    }
    
    await initManifest(type, outputPath ?? "orkestrate.extension.json");
    return;
  }

  if (!path) {
    console.error(`${RED}Error:${RESET} Usage: orkestrate extension submit <path-to-manifest> [--init --type <type>]`);
    process.exitCode = 1;
    return;
  }

  console.log(`${BOLD}Validating extension manifest...${RESET}`);
  console.log("");

  // Load manifest
  let manifest: ExtensionManifest;
  try {
    const file = Bun.file(path);
    if (!await file.exists()) {
      console.error(`${RED}Error:${RESET} Manifest file not found: ${path}`);
      process.exitCode = 1;
      return;
    }
    manifest = await file.json();
  } catch (error) {
    console.error(`${RED}Error:${RESET} Failed to load manifest:`, error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  // Validate
  const { valid, errors } = validateManifest(manifest);
  if (!valid) {
    console.error(`${RED}Validation failed:${RESET}`);
    for (const err of errors) {
      console.error(`  ${RED}✗${RESET} ${err}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`${GREEN}✓${RESET} Manifest validation passed`);
  console.log("");

  // Show summary
  console.log(`${BOLD}Extension:${RESET} ${manifest.name} (${manifest.id})`);
  console.log(`${BOLD}Version:${RESET} ${manifest.version}`);
  console.log(`${BOLD}Type:${RESET} ${manifest.type}`);
  console.log(`${BOLD}Entry:${RESET} ${manifest.entry}`);
  if (manifest.harness) console.log(`${BOLD}Harness:${RESET} ${manifest.harness}`);
  if (manifest.profiles?.length) console.log(`${BOLD}Profiles:${RESET} ${manifest.profiles.join(", ")}`);
  if (manifest.skills?.length) console.log(`${BOLD}Skills:${RESET} ${manifest.skills.join(", ")}`);
  console.log("");

  // Get auth token
  const token = await getAuthToken();
  if (!token) {
    console.log(`${YELLOW}Authentication required${RESET}`);
    const proceed = await confirm("Continue with GitHub authentication?");
    if (!proceed) {
      console.log("Cancelled.");
      return;
    }
    const authResult = await startAuthFlow();
    if (!authResult) {
      console.error(`${RED}Error:${RESET} Authentication failed`);
      process.exitCode = 1;
      return;
    }
  }

  // Submit
  console.log(`${BLUE}Submitting extension to registry...${RESET}`);
  try {
    const response = await fetch(`${REGISTRY_URL}/extensions/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        manifest,
        source: "cli",
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(`Registry error: ${response.status} - ${error.message ?? "Unknown"}`);
    }

    const result = await response.json();
    console.log(`${GREEN}✓${RESET} Extension submitted successfully!`);
    console.log("");
    console.log(`Submission ID: ${result.submission_id}`);
    console.log(`Status: ${result.status}`);
    if (result.review_url) console.log(`Review URL: ${result.review_url}`);

  } catch (error) {
    console.error(`${RED}Error:${RESET} Submission failed:`, error instanceof Error ? error.message : String(error));
    console.log("");
    console.log("Manual submission:");
    console.log(`  1. Go to ${BLUE}https://orkestrate.space/submit${RESET}`);
    console.log("  2. Sign in with GitHub");
    console.log("  3. Select 'Extension' and upload manifest");
    process.exitCode = 1;
  }
}

async function initManifest(type: ExtensionType, outputPath: string): Promise<void> {
  const template = createManifestTemplate(type);
  
  // Check if file exists
  const file = Bun.file(outputPath);
  if (await file.exists()) {
    const overwrite = await confirm(`${YELLOW}File exists: ${outputPath}. Overwrite?${RESET}`);
    if (!overwrite) {
      console.log("Cancelled.");
      return;
    }
  }

  await Bun.write(outputPath, JSON.stringify(template, null, 2) + "\n");
  console.log(`${GREEN}✓${RESET} Created manifest template: ${outputPath}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Edit ${outputPath} with your extension details`);
  console.log(`  2. Run ${BOLD}orkestrate extension validate ${outputPath}${RESET} to verify`);
  console.log(`  3. Run ${BOLD}orkestrate extension submit ${outputPath}${RESET} to publish`);
}

async function getAuthToken(): Promise<string | null> {
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
  
  if (process.env.ORKESTRATE_AUTH_TOKEN) {
    return process.env.ORKESTRATE_AUTH_TOKEN;
  }
  
  return null;
}

async function startAuthFlow(): Promise<string | null> {
  console.log(`${BLUE}Opening browser for GitHub authentication...${RESET}`);
  
  const authUrl = `${REGISTRY_URL}/auth/device`;
  try {
    const response = await fetch(authUrl, { method: "POST" });
    const data = await response.json();
    
    if (data.device_code && data.verification_uri_complete) {
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
        console.log(`Please open: ${BLUE}${url}${RESET}`);
      }
      
      console.log(`Or visit: ${BLUE}${data.verification_uri}${RESET} and enter code: ${BOLD}${data.user_code}${RESET}`);
      console.log("Waiting for authentication...");
      
      return await pollForToken(data.device_code, data.interval ?? 5);
    }
  } catch (error) {
    console.error("Auth flow error:", error);
  }
  
  return null;
}

async function pollForToken(deviceCode: string, interval: number): Promise<string | null> {
  const maxAttempts = 180 / interval;
  
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
        if (error.error === "authorization_pending") continue;
        if (error.error === "slow_down") { interval += 5; continue; }
        if (error.error === "expired_token") { console.log("Expired."); return null; }
        if (error.error === "access_denied") { console.log("Denied."); return null; }
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