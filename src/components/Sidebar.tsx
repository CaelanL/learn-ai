"use client";

import { useRef, useCallback } from "react";
import { Module } from "@/lib/types";

interface SidebarProps {
  modules: Module[];
  currentModuleId: string | null;
  onSelectModule: (id: string) => void;
  courseTopic: string;
  width: number;
  onResize: (width: number) => void;
}

export default function Sidebar({
  modules,
  currentModuleId,
  onSelectModule,
  courseTopic,
  width,
  onResize,
}: SidebarProps) {
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      startX.current = e.clientX;
      startWidth.current = width;

      const onMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = e.clientX - startX.current;
        onResize(startWidth.current + delta);
      };

      const onMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width, onResize]
  );

  return (
    <div
      className="relative h-full flex flex-col shrink-0 bg-panel border-r border-border-subtle"
      style={{ width }}
    >
      {/* Course title */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold leading-snug text-foreground">
          {courseTopic || "New Course"}
        </h2>
      </div>

      {/* Module list */}
      <div className="flex-1 overflow-y-auto p-2">
        {modules.map((mod) => {
          const isActive = mod.id === currentModuleId;
          return (
            <button
              key={mod.id}
              onClick={() => onSelectModule(mod.id)}
              className={`relative w-full text-left px-3 py-2.5 mb-0.5 text-sm rounded-md transition-colors duration-100 ${
                isActive
                  ? "bg-active text-foreground"
                  : "bg-transparent text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              {/* Active accent bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-accent" />
              )}

              <div className="flex items-center gap-2 pl-1">
                {/* Position / gear icon */}
                <span className="text-xs font-mono w-4 shrink-0 text-center text-faint">
                  {mod.is_course_setup ? "\u2699" : mod.position}
                </span>

                {/* Title */}
                <span className="flex-1 leading-snug">{mod.title}</span>

                {/* Status dot */}
                {mod.status === "completed" && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 bg-success"
                    title="Completed"
                  />
                )}
                {mod.status === "in_progress" && !mod.is_course_setup && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 bg-accent"
                    title="In progress"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 transition-opacity duration-150 bg-accent"
      />
    </div>
  );
}
