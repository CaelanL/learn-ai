"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      const params = new URLSearchParams(window.location.search);
      router.push(params.get("next") || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <div className="max-w-sm w-full mx-4 p-8 bg-card border border-border-subtle rounded-lg">
        {/* Logo */}
        <p className="text-center mb-1 text-lg font-bold tracking-tight text-accent">
          learn.
        </p>

        <h1 className="text-xl font-semibold mb-6 text-center text-foreground">
          {isSignUp ? "Create an account" : "Welcome back"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 text-sm outline-none bg-panel border border-border rounded-lg text-foreground transition-[border-color,box-shadow] duration-100 focus:border-accent focus:ring-3 focus:ring-accent-glow"
            required
            disabled={isLoading}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 text-sm outline-none bg-panel border border-border rounded-lg text-foreground transition-[border-color,box-shadow] duration-100 focus:border-accent focus:ring-3 focus:ring-accent-glow"
            required
            minLength={6}
            disabled={isLoading}
          />

          {error && (
            <p className="text-xs px-1 text-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 font-medium text-sm text-white bg-accent rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90"
          >
            {isLoading
              ? "Loading..."
              : isSignUp
              ? "Sign Up"
              : "Log In"}
          </button>
        </form>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
          className="mt-4 w-full text-center text-xs text-faint hover:text-muted transition-colors"
        >
          {isSignUp
            ? "Already have an account? Log in"
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
