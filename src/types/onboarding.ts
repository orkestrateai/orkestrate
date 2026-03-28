export type OnboardingStepId =
  | "welcome"
  | "github"
  | "workspace"
  | "mcp-policy"
  | "invite-team"
  | "connect-agent"
  | "completed";

export type OnboardingStepState = {
  id: Exclude<OnboardingStepId, "completed">;
  complete: boolean;
  optional?: boolean;
};

export type OnboardingWorkspace = {
  id: string;
  name: string;
  repoUrl: string | null;
  baseBranch: string;
} | null;

export type OnboardingStatusResponse = {
  completed: boolean;
  nextStep: OnboardingStepId;
  githubConnected: boolean;
  workspaceReady: boolean;
  mcpPolicyConfigured: boolean;
  inviteCount: number;
  hasEverJoinedAgent: boolean;
  activeAgentCount: number;
  activeWorkspace: OnboardingWorkspace;
  steps: OnboardingStepState[];
};
