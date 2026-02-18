"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const startCourse = async (topic: string) => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      if (res.status === 401) {
        // Not logged in — redirect to login, preserve the topic
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
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-lg w-full px-6">
        <h1 className="text-3xl font-semibold mb-2 text-center">
          What do you want to learn?
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-center mb-8 text-sm">
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
            className="w-full px-5 py-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 mb-3"
            autoFocus
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-full py-3 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-xl font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {isLoading ? "Creating course..." : "Start Learning"}
          </button>
        </form>
      </div>
    </div>
  );
}
