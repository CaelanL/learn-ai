"use client";

import { Module } from "@/lib/types";

interface SidebarProps {
  modules: Module[];
  currentModuleId: string | null;
  onSelectModule: (id: string) => void;
  courseTopic: string;
}

export default function Sidebar({
  modules,
  currentModuleId,
  onSelectModule,
  courseTopic,
}: SidebarProps) {
  return (
    <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {courseTopic || "New Course"}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {modules.map((mod) => (
          <button
            key={mod.id}
            onClick={() => onSelectModule(mod.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
              mod.id === currentModuleId
                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-400">
                {mod.is_course_setup ? "⚙" : mod.position}
              </span>
              <span className="truncate">{mod.title}</span>
            </div>
            {mod.status === "completed" && (
              <span className="text-xs text-green-600 dark:text-green-400 ml-5">
                ✓ done
              </span>
            )}
            {mod.status === "in_progress" && !mod.is_course_setup && (
              <span className="text-xs text-blue-500 ml-5">in progress</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
