"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { StepWelcome } from "@/components/onboarding/StepWelcome";
import { StepGitHub } from "@/components/onboarding/StepGitHub";
import { StepWorkspace } from "@/components/onboarding/StepWorkspace";
import { StepMcpPolicy } from "@/components/onboarding/StepMcpPolicy";
import { StepInviteOptional } from "@/components/onboarding/StepInviteOptional";
import { StepConnectAgent } from "@/components/onboarding/StepConnectAgent";
import { Logo } from "@/components/brand/Logo";
import type { OnboardingStatusResponse } from "@/types/onboarding";

type LocalStep =
  | "welcome"
  | "github"
  | "workspace"
  | "mcp-policy"
  | "invite-team"
  | "connect-agent";

const STEP_ORDER: LocalStep[] = [
  "welcome",
  "github",
  "workspace",
  "mcp-policy",
  "invite-team",
  "connect-agent",
];

const STEP_COPY: Record<LocalStep, { title: string; subtitle: string }> = {
  welcome: {
    title: "Welcome",
    subtitle: "Unify autonomous agents and engineering teams through deterministic coordination.",
  },
  github: {
    title: "Source Access",
    subtitle: "Authorize repository access to enable cross-branch orchestration.",
  },
  workspace: {
    title: "Workspace Prep",
    subtitle: "Select a codebase to establish your team's operational environment.",
  },
  "mcp-policy": {
    title: "Access Policy",
    subtitle: "Govern tool permissions to define how agents operate within your workspace.",
  },
  "invite-team": {
    title: "Team Access",
    subtitle: "Optional: Share a secure bridge to onboard collaborators.",
  },
  "connect-agent": {
    title: "Deploy Agent",
    subtitle: "Join your local agent to initiate collaborative code orchestration.",
  },
};

async function emitAnalytics(eventName: string, payload: Record<string, unknown>) {
  try {
    const analytics = (await import("@vercel/analytics")) as Record<string, unknown>;
    const track = analytics.track as ((name: string, data?: Record<string, unknown>) => void) | undefined;
    track?.(eventName, payload);
  } catch {
    // ignore analytics transport failures
  }
}

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<LocalStep>("welcome");
  const [stepError, setStepError] = useState<string | null>(null);

  const fetcher = async (url: string) => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("unauthorized");
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (response.status === 401) {
      throw new Error("unauthorized");
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Failed to load onboarding status.");
    }
    return (await response.json()) as OnboardingStatusResponse;
  };

  const {
    data: status,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<OnboardingStatusResponse>("/api/onboarding/status", fetcher, {
    refreshInterval: (current) => (current?.completed ? 0 : 3500),
    revalidateOnFocus: true,
    dedupingInterval: 1200,
  });

  useEffect(() => {
    if (error?.message === "unauthorized") {
      router.replace(`/login?next=${encodeURIComponent("/dashboard/onboarding")}`);
    }
  }, [error, router]);

  // Handle Supabase OAuth redirects that tuck errors into the URL hash
  // e.g. `#error=server_error&error_code=identity_already_exists`
  // Also handle `?error=...` query parameters
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    let caughtError = false;
    
    // Parse Hash Fragment logic
    if (window.location.hash.includes("error=")) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const errorCode = hashParams.get("error_code");
      const errorDesc = hashParams.get("error_description");
      
      if (errorCode === "identity_already_exists") {
        setStepError(
          "This GitHub account is already tied to another Orkestrate user account. Please log out and sign in with GitHub, or connect a different GitHub account.",
        );
      } else if (errorDesc) {
        setStepError(decodeURIComponent(errorDesc).replace(/\+/g, " "));
      } else {
        setStepError("Failed to connect GitHub. Please try again.");
      }
      caughtError = true;
    } 
    // Parse Query Parameter logic
    else if (window.location.search.includes("error=")) {
      const searchParams = new URLSearchParams(window.location.search);
      const errorVal = searchParams.get("error");
      const errorDesc = searchParams.get("error_description");
      
      if (errorVal === "auth_callback_failed") {
        setStepError("GitHub connection failed or was cancelled. Please try again.");
      } else if (errorDesc) {
        setStepError(decodeURIComponent(errorDesc).replace(/\+/g, " "));
      } else if (errorVal) {
        setStepError(errorVal.replace(/_/g, " "));
      }
      caughtError = true;
    }
    
    if (caughtError) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const statusStep = useMemo<LocalStep>(() => {
    if (!status) return "welcome";
    if (status.completed || status.nextStep === "completed") {
      return "connect-agent";
    }
    return status.nextStep as LocalStep;
  }, [status]);

  // Initialize step when status is first loaded or changes
  useEffect(() => {
    if (status && !isLoading) {
      // We don't auto-forward to maintain sequential step logic as per user request
    }
  }, [status, isLoading]);

  const effectiveStep = step;

  useEffect(() => {
    void emitAnalytics("onboarding_step_view", { step: effectiveStep });
  }, [effectiveStep]);

  useEffect(() => {
    if (!stepError) return;
    void emitAnalytics("onboarding_step_error", {
      step: effectiveStep,
      message: stepError,
    });
  }, [effectiveStep, stepError]);

  const handleStepClick = (index: number) => {
    const targetStep = STEP_ORDER[index];
    const targetIndex = index;
    const maxReachedIndex = STEP_ORDER.indexOf(statusStep);

    // Allow jumping to any step already reached or the next one
    if (targetIndex <= maxReachedIndex) {
      setStep(targetStep);
      setStepError(null);
    }
  };

  const stepIndex = useMemo(() => STEP_ORDER.indexOf(effectiveStep), [effectiveStep]);
  const copy = STEP_COPY[effectiveStep];

  const refreshStatus = async () => {
    setStepError(null);
    try {
      await mutate();
    } catch {
      setStepError("Failed to refresh onboarding state.");
    }
  };

  const goToWorkspace = () => {
    const workspaceId = status?.activeWorkspace?.id;
    if (workspaceId) {
      router.push(`/dashboard/workspaces/${workspaceId}/agents`);
      return;
    }
    router.push("/dashboard");
  };

  if (error && !status) {
    return (
      <OnboardingShell
        title="Connection Error"
        subtitle="We hit a roadblock checking your account state."
        stepIndex={0}
        totalSteps={STEP_ORDER.length}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 text-center max-w-sm">
            {error.message || "An unexpected network error occurred."}
          </div>
          <button
            onClick={() => void refreshStatus()}
            className="rounded-full border border-white/10 bg-zinc-800 px-6 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700"
          >
            Retry Connection
          </button>
        </div>
      </OnboardingShell>
    );
  }

  if (!status) {
    return (
      <OnboardingShell
        title="Preparing setup"
        subtitle="Reading your account activation state..."
        stepIndex={0}
        totalSteps={STEP_ORDER.length}
      >
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      title={copy.title}
      subtitle={copy.subtitle}
      stepIndex={Math.max(0, stepIndex)}
      totalSteps={STEP_ORDER.length}
      onStepClick={handleStepClick}
      logo={
        effectiveStep === "welcome" ? (
          <div className="relative flex items-center justify-center p-4 bg-white/[0.01] rounded-2xl border border-white/5 shadow-2xl">
            <Logo withText={false} size="xl" className="scale-125 opacity-80" />
          </div>
        ) : effectiveStep === "github" ? (
          <div className="relative flex items-center justify-center p-4 bg-white/[0.01] rounded-2xl border border-white/5 shadow-2xl">
            <svg
              className="h-10 w-10 text-zinc-400 opacity-80"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        ) : null
      }
    >
      {stepError ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {stepError}
        </div>
      ) : null}

      {effectiveStep === "welcome" ? (
        <StepWelcome
          onContinue={() => {
            void emitAnalytics("onboarding_step_complete", { step: "welcome" });
            setStep("github");
          }}
        />
      ) : null}

      {effectiveStep === "github" ? (
        <StepGitHub
          githubConnected={status.githubConnected}
          isRefreshing={isValidating}
          onContinue={() => {
            if (!status.githubConnected) return;
            void emitAnalytics("onboarding_step_complete", { step: "github" });
            setStep("workspace");
          }}
        />
      ) : null}

      {effectiveStep === "workspace" ? (
        <StepWorkspace
          workspaceReady={status.workspaceReady}
          activeWorkspace={status.activeWorkspace}
          onWorkspaceUpdated={async () => {
            await mutate();
            void emitAnalytics("onboarding_step_complete", { step: "workspace" });
          }}
          onContinue={() => {
            if (!status.workspaceReady) return;
            void emitAnalytics("onboarding_step_complete", { step: "workspace" });
            setStep("mcp-policy");
          }}
        />
      ) : null}

      {effectiveStep === "mcp-policy" ? (
        <StepMcpPolicy
          mcpPolicyConfigured={status.mcpPolicyConfigured}
          onSaved={async () => {
            await mutate();
            void emitAnalytics("onboarding_step_complete", { step: "mcp-policy" });
          }}
          onContinue={() => {
            void emitAnalytics("onboarding_step_complete", { step: "mcp-policy" });
            setStep("invite-team");
          }}
        />
      ) : null}

      {effectiveStep === "invite-team" ? (
        <StepInviteOptional
          workspaceId={status.activeWorkspace?.id ?? null}
          inviteCount={status.inviteCount}
          onInviteUpdated={async () => {
            await mutate();
            void emitAnalytics("onboarding_step_complete", { step: "invite-team" });
          }}
          onContinue={() => {
            void emitAnalytics("onboarding_step_complete", {
              step: "invite-team",
              inviteCount: status.inviteCount,
            });
            setStep("connect-agent");
          }}
        />
      ) : null}

      {effectiveStep === "connect-agent" ? (
        <StepConnectAgent
          hasEverJoinedAgent={status.hasEverJoinedAgent}
          activeAgentCount={status.activeAgentCount}
          workspaceId={status.activeWorkspace?.id ?? null}
          isRefreshing={isValidating}
          onRefresh={() => void refreshStatus()}
          onOpenWorkspace={() => {
            if (status.hasEverJoinedAgent) {
              void emitAnalytics("onboarding_activation_complete", {
                workspaceId: status.activeWorkspace?.id ?? null,
                activeAgentCount: status.activeAgentCount,
              });
            }
            goToWorkspace();
          }}
        />
      ) : null}
    </OnboardingShell>
  );
}
