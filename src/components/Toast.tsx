"use client";

import { useState, useCallback, useRef } from "react";

interface Toast {
  id: string;
  message: string;
  type: "error" | "info";
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addToast = useCallback((message: string, type: "error" | "info" = "error") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    const timeout = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timeoutsRef.current.delete(id);
    }, 4000);
    timeoutsRef.current.set(id, timeout);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  return { toasts, addToast, dismissToast };
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-fade-in flex items-center gap-3 px-4 py-3 text-sm shadow-lg max-w-sm bg-overlay border border-border rounded-lg ${
            toast.type === "error" ? "text-error" : "text-foreground"
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 text-faint opacity-50 hover:opacity-100 transition-opacity"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
