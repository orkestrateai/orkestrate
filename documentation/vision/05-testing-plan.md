# Phase 4: End-to-End Advanced Coordination Test

We will test the 3 major features of the V2 Architecture: The Admin Mode Dashboard, the strict Checkpoint Consensus algorithm, and the Dynamic Identity Injection.

## Step 1: Prepare the Dashboard
1. Open `http://localhost:3000/dashboard` in your browser.
2. Sign in if you aren't already.
3. If no room is active, click "Home" and create/activate a new room. You should see the `ROOM ID` block light up on the Dashboard.
4. Set **Trigger Phrase**: `let's test v2`
5. Set **Master Behavior Rules**: 
   ```text
   1. You are a component developer.
   2. Scaffold a basic Login Component.
   3. ALWAYS use `create_checkpoint` titled `login_ui_done` and ask the other agent to review it before you proceed to styling.
   ```
6. Click **Deploy Configuration**.

## Step 2: Triggering the Agent (Identity & Autonomy verification)
1. Open your terminal where `OpenCode` or `Codex` is connected to this repo.
2. Type: `let's test v2`
3. **EXPECTED BEHAVIOR**:
   - The agent should instantly call `Orkestrate_initialize_session`.
   - It will see the injected identity and your Master Behavior Rules.
   - It will start scaffolding the Login Component and use `publish_status` to announce it to the ledger.
   - You should see these events streaming *live* onto your Web Dashboard!

## Step 3: Triggering the Checkpoint Halt (Sync verification)
1. Let the agent finish writing the component.
2. **EXPECTED BEHAVIOR**:
   - Because of your Master Rule #3, the agent will call `create_checkpoint` with `milestone_name: "login_ui_done"`.
   - The agent will then try to continue or poll `read_workspace_events`.
   - The MCP Server will mathematically truncate the ledger and yell at the agent: `🛑 SYSTEM HALT 🛑 WARNING: The workflow is BLOCKED pending approval on milestones: login_ui_done`.
   - The agent will be forced to stop and wait.

## Step 4: The Admin Mode Override
1. While the agent is halted, go back to your Web Dashboard.
2. In the "Inject System Override" box, type:
   `I am Prabha (simulating peer review). I have reviewed the code. You may call approve_checkpoint for summary 'login_ui_done' and proceed to styling.`
3. Click **INJECT OVERRIDE**.
4. **EXPECTED BEHAVIOR**:
   - The agent (which is polling every ~15-20s) will read the ledger.
   - It will see your red System Override event.
   - It will obey the review, call the `approve_checkpoint` tool, and resume its workflow smoothly.

If these four steps work, we have successfully built an enterprise-grade multi-agent runtime!
