"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAgentChatData, useSendPrompt } from "./hooks";
import { ChatHeader } from "./ChatHeader";
import { OpenCodeRenderer } from "./OpenCodeRenderer";
import { PromptComposer } from "./PromptComposer";

function AgentChatContent() {
  const params = useParams<{ agent?: string }>();
  const searchParams = useSearchParams();
  const selectedAgentId = (params?.agent && decodeURIComponent(params.agent)) || searchParams?.get("agent") || "";

  const {
    loading,
    activeWorkspaceId,
    selectedAgent,
    logs,
    activeSessionId,
    activeSession,
  } = useAgentChatData(selectedAgentId);

  const { composer, setComposer, sending, send } = useSendPrompt();
  const agentProfile = `${selectedAgent?.agentProfile || ""} ${selectedAgent?.agentId || ""}`.toLowerCase();
  const isJoinOnlyClient = agentProfile.includes("opencode") || agentProfile.includes("claude");

  if (loading) {
    return <div className="h-full w-full bg-[#111214] flex items-center justify-center text-[#8A8F98]">Syncing...</div>;
  }

  return (
    <div className="h-full w-full bg-[#111214] text-[#F2F2F2] flex flex-col font-sans">
      <ChatHeader
        selectedAgent={selectedAgent}
        activeSession={activeSession}
        activeSessionNum={null}
        onBackToSessions={() => { }}
      />

      {!selectedAgent?.pluginConnected ? (
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="max-w-2xl w-full bg-[#16181A] border border-[#232529] rounded-xl p-6 text-[14px] text-[#D1D3D8]">
            {isJoinOnlyClient
              ? "This client is currently in join-only mode. Coordination state is active, but live chat telemetry is disabled."
              : "This agent joined the workspace but has not connected the Orkestrate plugin yet."}
          </div>
        </div>
      ) : activeSession ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <OpenCodeRenderer logs={logs} />
          <PromptComposer
            composer={composer}
            setComposer={setComposer}
            sending={sending}
            onSend={() => activeWorkspaceId && selectedAgent && send(activeWorkspaceId, selectedAgent.stateClientId, activeSessionId)}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="max-w-2xl w-full bg-[#16181A] border border-[#232529] rounded-xl p-6 text-[14px] text-[#D1D3D8]">
            No active session detected. Once the plugin emits activity, live events will appear here.
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentChatView() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-[#111214] flex items-center justify-center text-[#8A8F98]">Loading...</div>}>
      <AgentChatContent />
    </Suspense>
  );
}
