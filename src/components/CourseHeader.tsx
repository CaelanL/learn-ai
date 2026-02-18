"use client";

import { useState, useRef, useEffect } from "react";
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
    <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 bg-white dark:bg-zinc-950 shrink-0">
      {/* Logo — navigates to landing page */}
      <button
        onClick={() => router.push("/")}
        className="text-sm font-bold tracking-tight mr-3 hover:opacity-70 transition-opacity"
      >
        learn
      </button>

      {/* Course title + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <span className="truncate max-w-[200px]">{currentCourse.topic}</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
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

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 py-1">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setIsOpen(false);
                  if (c.id !== currentCourse.id) {
                    router.push(`/course/${c.id}`);
                  }
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  c.id === currentCourse.id
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="truncate block">{c.topic}</span>
              </button>
            ))}
            <div className="border-t border-zinc-200 dark:border-zinc-700 mt-1 pt-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/");
                }}
                className="w-full text-left px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                + New Course
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
