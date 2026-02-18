"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { Course } from "@/lib/types";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface CourseHeaderProps {
  currentCourse: Course;
  courses: Course[];
}

export default function CourseHeader({
  currentCourse,
  courses,
}: CourseHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const toggleTheme = () =>
    setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-12 flex items-center px-4 shrink-0 bg-panel border-b border-border-subtle">
      {/* Logo */}
      <button
        onClick={() => router.push("/")}
        className="text-sm font-bold tracking-tight text-foreground hover:opacity-70 transition-opacity"
      >
        learn
      </button>

      {/* Separator */}
      <span className="mx-2.5 text-sm select-none text-faint">/</span>

      {/* Course title + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <span className="truncate max-w-[200px]" title={currentCourse.topic}>
            {currentCourse.title ?? currentCourse.topic}
          </span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown — always in DOM, animated via data-open */}
        <div
          data-open={isOpen || undefined}
          className="absolute top-full left-0 mt-1 w-64 z-50 py-1
                     bg-card border border-border rounded-lg
                     opacity-0 -translate-y-1 pointer-events-none
                     data-[open]:opacity-100 data-[open]:translate-y-0
                     data-[open]:pointer-events-auto
                     transition-[opacity,transform] duration-200 ease-out"
        >
          {courses.map((c) => {
            const isCurrent = c.id === currentCourse.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setIsOpen(false);
                  if (!isCurrent) router.push(`/course/${c.id}`);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  isCurrent
                    ? "bg-active text-foreground"
                    : "text-muted hover:bg-hover hover:text-foreground"
                }`}
              >
                <span className="truncate block">{c.title ?? c.topic}</span>
              </button>
            );
          })}
          <div className="mt-1 pt-1 border-t border-border-subtle">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/");
              }}
              className="w-full text-left px-3 py-2 text-sm text-faint hover:bg-hover hover:text-foreground transition-colors"
            >
              + New Course
            </button>
          </div>
        </div>
      </div>

      {/* Right side — theme toggle + sign out */}
      <div className="ml-auto flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-7 h-7 flex items-center justify-center rounded-sm text-faint hover:bg-hover hover:text-muted transition-colors"
          title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          {mounted && (resolvedTheme === "dark" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ))}
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="text-xs text-faint hover:text-muted transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
