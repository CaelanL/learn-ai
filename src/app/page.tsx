"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Wrapper to provide the Suspense boundary that useSearchParams requires
export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Restore topic from URL if returning from login redirect
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [recentCourseId, setRecentCourseId] = useState<string | null>(null);

  // Check auth + fetch most recent course.
  // If returning from login with a pending topic, auto-create the course.
  const pendingTopic = searchParams.get("topic");
  const hasAutoSubmitted = useRef(false);

  useEffect(() => {
    if (pendingTopic) {
      setInput(pendingTopic);
    }
  }, [pendingTopic]);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      // Auto-submit if returning from login with a pending topic
      if (pendingTopic && !hasAutoSubmitted.current) {
        hasAutoSubmitted.current = true;
        startCourse(pendingTopic);
        return;
      }

      const res = await fetch("/api/courses");
      if (!res.ok) return;
      const { courses } = await res.json();
      if (courses && courses.length > 0) {
        setRecentCourseId(courses[0].id);
      }
    };
    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCourse = async (topic: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      if (res.status === 401) {
        // Preserve the topic through the login round-trip:
        // landing → /login?mode=signup&next=/?topic=... → login/signup → /?topic=... → auto-create
        const returnUrl = `/?topic=${encodeURIComponent(topic)}`;
        router.push(`/login?mode=signup&next=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // Safely parse JSON — if the response isn't JSON (e.g. HTML redirect page),
      // catch the parse error instead of crashing with "unexpected token doctype"
      let body;
      try {
        body = await res.json();
      } catch {
        throw new Error("Something went wrong. Please try again.");
      }

      if (!res.ok) {
        throw new Error(body.error || "Failed to create course");
      }

      router.push(`/course/${body.course.id}?topic=${encodeURIComponent(topic)}`);
    } catch (err) {
      console.error("Error starting course:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page">
      {/* Ambient glow — centered behind content */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, var(--accent-glow), transparent)",
        }}
      />

      {/* Top nav */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4">
        <span className="text-sm font-bold tracking-tight text-foreground">
          learn<span className="text-accent">.</span>
        </span>
        {user ? (
          recentCourseId && (
            <button
              onClick={() => router.push(`/course/${recentCourseId}`)}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              My Courses &rarr;
            </button>
          )
        ) : (
          <button
            onClick={() => router.push("/login")}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Sign up
          </button>
        )}
      </div>

      <div className="relative max-w-lg w-full px-6">
        <h1
          className="text-center mb-3 font-extrabold tracking-tight text-foreground"
          style={{
            fontSize: "clamp(48px, 8vw, 64px)",
            lineHeight: "1.1",
          }}
        >
          Welcome, Janitor<span className="text-accent">.</span>
        </h1>
        <p className="text-center mb-8 text-sm text-muted">
          Your CEO has prepared a very special curriculum for you.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && !isLoading) startCourse(input.trim());
          }}
        >
          <div className="flex items-center gap-2 p-3 bg-panel border border-border-subtle rounded-xl transition-[border-color,box-shadow] duration-200 shadow-sm focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-glow">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What do you want to learn? (choose wisely)"
              className="flex-1 px-2 text-sm outline-none bg-transparent text-foreground placeholder:text-faint"
              autoFocus
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="shrink-0 w-8 h-8 flex items-center justify-center bg-accent text-white rounded-lg disabled:opacity-30 transition-opacity hover:opacity-80"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </div>
          {error && (
            <p className="text-xs px-1 mt-2 text-error">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
