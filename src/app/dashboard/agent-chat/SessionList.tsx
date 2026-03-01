"use client";

import { Calendar } from "lucide-react";
import type { SessionRecord } from "./types";
import { formatTs } from "./utils";

interface SessionListProps {
    sessions: SessionRecord[];
    onSelectSession: (id: string) => void;
}

export function SessionList({ sessions, onSelectSession }: SessionListProps) {
    if (sessions.length === 0) {
        return (
            <div className="text-[13px] text-[#8A8F98] bg-[#16181A] border border-[#232529] rounded-xl p-6 text-center">
                No sessions detected in the past 72 hours.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            {sessions.map((s, i) => (
                <div
                    key={s.id}
                    onClick={() => onSelectSession(s.id)}
                    className="p-5 bg-[#16181A] border border-[#232529] rounded-xl cursor-pointer hover:bg-[#1A1C20] group transition-all"
                >
                    <h3 className="font-medium text-[16px] text-[#F2F2F2] group-hover:text-[#5E6AD2] mb-1">
                        {s.title || `Session ${sessions.length - i}`}
                    </h3>
                    <div className="text-[12px] text-[#5E626B] flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {formatTs(s.createdAt)}
                    </div>
                </div>
            ))}
        </div>
    );
}
