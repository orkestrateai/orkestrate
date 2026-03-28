import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { createClient } from "@/utils/supabase/server";
import WaveBackground from "@/components/WaveBackground";
import { getOnboardingStatus } from "@/lib/onboarding-core";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const requestPath = (await headers()).get("x-pathname") || "/dashboard";
  const isOnboardingRoute = requestPath.startsWith("/dashboard/onboarding");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const onboardingStatus = await getOnboardingStatus(user.id);
  const isMinimallyOnboarded = onboardingStatus.mcpPolicyConfigured;

  // If they haven't finished the mandatory backend configurations, lock them in onboarding.
  if (!isMinimallyOnboarded && !isOnboardingRoute) {
    redirect("/dashboard/onboarding");
  }

  // If they have full agent connection and attempt to revisit the onboarding wrapper, reroute them safely.
  if (onboardingStatus.hasEverJoinedAgent && isOnboardingRoute) {
    const fallbackWorkspaceId = onboardingStatus.activeWorkspace?.id;
    if (fallbackWorkspaceId) {
      redirect(`/dashboard/workspaces/${fallbackWorkspaceId}/agents`);
    }
    redirect("/dashboard");
  }

  if (isOnboardingRoute) {
    return (
      <main className="min-h-screen bg-[#050505] text-[#F2F2F2] relative overflow-hidden">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-[#F2F2F2] overflow-hidden">
      {/*<SandBackground />*/}
      <WaveBackground />
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative flex flex-col custom-scrollbar pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
