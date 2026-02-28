"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Plus,
    Search,
    MoreHorizontal,
    Clock,
    CheckCircle2,
    Circle,
    CircleDot,
    BarChart3
} from 'lucide-react';
import useSWR from 'swr';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';

const fetcher = (url: string) => {
    const supabase = createSupabaseBrowserClient();
    return supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
        return fetch(url, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
        }).then((res) => res.json());
    });
};

type WorkspaceProject = {
    id: string;
    name: string;
    description: string;
    status: string;
    createdAt: string;
    updatedAt: string;
};

type WorkspaceTask = {
    id: string;
    projectId: string;
    title: string;
    status: string;
    assigneeScopedId: string;
};

export default function ProjectsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    const { data: wsData } = useSWR("/api/workspaces", fetcher);
    const rooms = Array.isArray(wsData?.rooms) ? wsData.rooms : [];
    const activeRoomId = rooms.find((r: any) => r.isActive)?.id || rooms[0]?.id || null;

    const { data: projectsData, mutate: mutateProjects } = useSWR(activeRoomId ? `/api/projects?workspaceId=${activeRoomId}` : null, fetcher);
    const { data: tasksData } = useSWR(activeRoomId ? `/api/tasks?workspaceId=${activeRoomId}` : null, fetcher);

    const projects: WorkspaceProject[] = Array.isArray(projectsData?.projects) ? projectsData.projects : [];
    const tasks: WorkspaceTask[] = Array.isArray(tasksData?.tasks) ? tasksData.tasks : [];

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateProject = async () => {
        if (!newProjectName.trim() || !activeRoomId) return;

        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch("/api/projects", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ action: "create", name: newProjectName, workspaceId: activeRoomId }),
        });

        if (res.ok) {
            setNewProjectName('');
            setIsCreating(false);
            void mutateProjects();
        }
    };

    return (
        <div className="h-full w-full bg-[#111214] text-[#EBEBEB] font-sans flex flex-col">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[#232529] flex items-center justify-between shrink-0 bg-[#111214]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-[15px] font-semibold tracking-tight text-[#F2F2F2]">Projects</h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8F98]" />
                        <input
                            type="text"
                            placeholder="Find project..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[#1A1C20] border border-[#2A2D32] rounded-[6px] py-1.5 pl-8 pr-3 text-[13px] text-[#F2F2F2] placeholder:text-[#5E626B] focus:outline-none focus:border-[#444853] focus:bg-[#232529] w-48 transition-colors shadow-inner"
                        />
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-1.5 bg-[#F2F2F2] hover:bg-white text-[#111214] px-3 py-1.5 rounded-[6px] text-[13px] font-semibold transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        New Project
                    </button>
                </div>
            </div>

            {/* List View */}
            <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto py-8 px-8">
                {isCreating && (
                    <div className="mb-6 p-4 bg-[#16181A] border border-[#5E6AD2]/30 rounded-[10px] flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Project name..."
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                            className="flex-1 bg-[#111214] border border-[#232529] rounded-[6px] py-1.5 px-3 text-[13px] text-[#F2F2F2] focus:outline-none focus:border-[#5E6AD2]"
                        />
                        <button
                            onClick={handleCreateProject}
                            className="px-3 py-1.5 bg-[#5E6AD2] text-white text-[12px] font-semibold rounded-[6px] hover:bg-[#4E5AC2]"
                        >
                            Create
                        </button>
                        <button
                            onClick={() => setIsCreating(false)}
                            className="px-3 py-1.5 text-[#8A8F98] text-[12px] hover:text-[#F2F2F2]"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                <div className="space-y-4">
                    {filteredProjects.length === 0 && (
                        <div className="py-20 text-center text-[#8A8F98] text-[13px]">
                            {searchQuery ? "No projects match your search." : "No projects in this workspace yet."}
                        </div>
                    )}

                    {filteredProjects.map(project => {
                        const projectTasks = tasks.filter(t => t.projectId === project.id);
                        const completedCount = projectTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
                        const progress = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;
                        const updatedAt = new Date(project.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

                        return (
                            <div key={project.id} className="bg-[#16181A] border border-[#232529] rounded-[10px] shadow-sm hover:border-[#33363D] transition-colors group flex flex-col overflow-hidden">
                                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1.5">
                                            <BarChart3 className={`w-4 h-4 text-[#5E6AD2]`} />
                                            <h2 className="text-[15px] font-semibold text-[#F2F2F2] truncate tracking-tight">{project.name}</h2>
                                            <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium border bg-[#5E6AD2]/10 text-[#5E6AD2] border-[#5E6AD2]/20 uppercase tracking-tight`}>
                                                {project.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[13px] text-[#8A8F98]">
                                            <span>Updated {updatedAt}</span>
                                            {project.description && <span className="truncate max-w-xs">{project.description}</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 shrink-0">
                                        <div className="flex flex-col gap-1.5 w-32">
                                            <div className="flex justify-between text-[11px] font-medium text-[#8A8F98]">
                                                <span>Progress</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-[#111214] rounded-full overflow-hidden border border-white/5 shadow-inner">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 bg-[#5E6AD2]`}
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <button className="p-1.5 text-[#8A8F98] hover:text-[#F2F2F2] hover:bg-[#2A2D32] rounded-[6px] opacity-0 group-hover:opacity-100 transition-all">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {projectTasks.length > 0 && (
                                    <div className="bg-[#111214]/50 border-t border-[#232529] p-3 px-5">
                                        <div className="text-[11px] font-semibold text-[#8A8F98] mb-2 uppercase tracking-wider px-1">Tasks</div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {projectTasks.map((task) => (
                                                <Link href={`/dashboard/agent-chat`} key={task.id} className="flex items-center justify-between p-2 rounded-[6px] hover:bg-[#1A1C20] border border-transparent hover:border-[#33363D] transition-all group/task">
                                                    <div className="flex items-center gap-2.5 truncate">
                                                        {task.status === 'done' || task.status === 'completed' ? (
                                                            <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0" />
                                                        ) : task.status === 'in_progress' ? (
                                                            <CircleDot className="w-4 h-4 text-[#5E6AD2] shrink-0" />
                                                        ) : (
                                                            <Circle className="w-4 h-4 text-[#8A8F98] shrink-0" />
                                                        )}
                                                        <span className="text-[13px] text-[#D1D3D8] truncate group-hover/task:text-[#F2F2F2] transition-colors">{task.title}</span>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

