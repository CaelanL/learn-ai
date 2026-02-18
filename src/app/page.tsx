"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [recentCourseId, setRecentCourseId] = useState<string | null>(null);
  const router = useRouter();

  // Check auth + fetch most recent course (no auto-redirect)
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      const res = await fetch("/api/courses");
      if (!res.ok) return;
      const { courses } = await res.json();
      if (courses && courses.length > 0) {
        setRecentCourseId(courses[0].id);
      }
    };
    checkAuth();
  }, []);

  const startCourse = async (topic: string) => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      if (res.status === 401) {
        const loginUrl = `/login?next=${encodeURIComponent("/")}`;
        router.push(loginUrl);
        return;
      }

      if (!res.ok) throw new Error("Failed to create course");

      const { course } = await res.json();
      router.push(`/course/${course.id}?topic=${encodeURIComponent(topic)}`);
    } catch (error) {
      console.error("Error starting course:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page">
      {/* Subtle radial gradient orb */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[800px] h-[600px] opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, var(--accent-glow), transparent)",
        }}
      />

      {/* X button — return to most recent course (only when signed in) */}
      {user && recentCourseId && (
        <button
          onClick={() => router.push(`/course/${recentCourseId}`)}
          className="absolute top-5 left-5 w-8 h-8 flex items-center justify-center rounded-md text-faint hover:bg-hover transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      <div className="relative max-w-lg w-full px-6">
        <h1
          className="text-center mb-3 font-extrabold tracking-tight text-foreground"
          style={{
            fontSize: "clamp(48px, 8vw, 64px)",
            lineHeight: "1.1",
          }}
        >
          Learn.
        </h1>
        <p className="text-center mb-10 text-sm text-muted">
          Enter a topic and we&apos;ll build a personalized curriculum for you.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && !isLoading) startCourse(input.trim());
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. How databases work, React state management, REST APIs..."
            className="w-full px-5 py-4 text-base mb-3 outline-none bg-panel border border-border rounded-xl text-foreground transition-[border-color,box-shadow] duration-100 focus:border-accent focus:ring-3 focus:ring-accent-glow"
            autoFocus
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-full py-3 font-medium text-sm text-white bg-accent rounded-xl disabled:opacity-40 transition-opacity hover:opacity-90"
          >
            {isLoading ? "Creating course..." : "Start Learning"}
          </button>
        </form>
      </div>
    </div>
  );
}
