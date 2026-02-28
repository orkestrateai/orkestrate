"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAgentChatData, useSendPrompt } from "./hooks";
import { ChatHeader } from "./ChatHeader";
import { SessionList } from "./SessionList";
import { ChatTranscript } from "./ChatTranscript";
import { PromptComposer } from "./PromptComposer";

function AgentChatContent() {
  const searchParams = useSearchParams();
  const selectedAgentId = searchParams?.get("agent") || "";

  const {
    loading,
    activeWorkspaceId,
    selectedAgent,
    sessions,
    logs,
    activeSessionId,
    setActiveSessionId,
    activeSession,
    activeSessionNum,
    agentFamily,
  } = useAgentChatData(selectedAgentId);

  const { composer, setComposer, sending, send } = useSendPrompt();

  if (loading) {
    return <div className="h-full w-full bg-[#111214] flex items-center justify-center text-[#8A8F98]">Syncing...</div>;
  }

  return (
    <div className="h-full w-full bg-[#111214] text-[#F2F2F2] flex flex-col font-sans">
      <ChatHeader
        selectedAgent={selectedAgent}
        activeSession={activeSession}
        activeSessionNum={activeSessionNum}
        onBackToSessions={() => setActiveSessionId(null)}
      />

      {activeSession ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatTranscript logs={logs} agentFamily={agentFamily} />

          {agentFamily !== "claude" && (
            <PromptComposer
              composer={composer}
              setComposer={setComposer}
              sending={sending}
              onSend={() => activeWorkspaceId && selectedAgent && send(activeWorkspaceId, selectedAgent.stateClientId, activeSessionId)}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
          <SessionList sessions={sessions} onSelectSession={setActiveSessionId} />
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
