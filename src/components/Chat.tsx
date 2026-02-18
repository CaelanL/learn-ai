"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "@/lib/types";

interface ChatProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  streamingContent: string;
  loaded?: boolean;
  placeholder?: string;
  welcome?: { title: string; goal: string | null };
}

// ─── Typing Indicator ──────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="max-w-[720px] mx-auto w-full">
      <div className="flex gap-1.5 py-2">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-faint animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Code Block with Copy ──────────────────────────────────────

function CodeBlock({ children, language }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 overflow-hidden bg-code rounded-md">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-code-border">
        <span className="text-[10px] font-mono text-code-muted">
          {language || "code"}
        </span>
        <button
          onClick={copy}
          className={`text-[10px] transition-colors ${
            copied ? "text-success" : "text-code-muted hover:text-code-text"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <code className="block p-4 text-xs font-mono overflow-x-auto whitespace-pre text-code-text">
        {children}
      </code>
    </div>
  );
}

// ─── Markdown Renderer ─────────────────────────────────────────

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const language = className?.replace("language-", "");
    const isBlock = !!language;
    if (isBlock) {
      const text = String(children).replace(/\n$/, "");
      return <CodeBlock language={language}>{text}</CodeBlock>;
    }
    return (
      <code className="rounded px-1.5 py-0.5 text-xs font-mono bg-overlay">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="pl-3 my-2 border-l-2 border-border text-muted">
      {children}
    </blockquote>
  ),
};

function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

// ─── Chat Component ────────────────────────────────────────────

export default function Chat({
  messages,
  onSendMessage,
  isLoading,
  streamingContent,
  loaded = true,
  placeholder = "Type your message...",
  welcome,
}: ChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isLoading]);

  // Reset textarea height when input is cleared
  useEffect(() => {
    if (input === "" && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading) return;
      onSendMessage(input.trim());
      setInput("");
    },
    [input, isLoading, onSendMessage]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Loading spinner — messages not yet fetched */}
        {!loaded && (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-border-subtle border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {/* Welcome card */}
        {loaded && messages.length === 0 && !isLoading && welcome && (
          <div className="max-w-[720px] mx-auto w-full flex flex-col items-center justify-center h-full text-center px-4">
            <h2 className="text-xl font-semibold mb-3 tracking-tight text-foreground">
              {welcome.title}
            </h2>
            {welcome.goal && (
              <p className="text-sm mb-8 max-w-md leading-relaxed text-muted">
                {welcome.goal}
              </p>
            )}
            <button
              onClick={() => onSendMessage("Let's begin.")}
              className="px-6 py-2.5 text-sm font-medium text-white bg-accent rounded-md shadow-accent-glow transition-opacity hover:opacity-90"
            >
              Begin lesson
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="max-w-[720px] mx-auto w-full space-y-6">
          {messages.map((msg, i) => {
            const prevRole = i > 0 ? messages[i - 1].role : null;
            const isNewSender = prevRole !== null && prevRole !== msg.role;
            return (
              <div key={i} className={`animate-message-in ${isNewSender ? "pt-2 border-t border-border-subtle" : ""}`}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[70%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-user-chip border border-user-chip-border rounded-2xl rounded-br-sm text-foreground">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-foreground">
                    <MessageContent content={msg.content} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Streaming message */}
          {streamingContent && (
            <div className="animate-fade-in">
              <div className="text-sm leading-relaxed text-foreground">
                <MessageContent content={streamingContent} />
                <span className="animate-cursor-blink inline-block ml-0.5 text-accent">
                  &#9611;
                </span>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {isLoading && !streamingContent && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-border-subtle bg-panel/80 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="max-w-[720px] mx-auto w-full">
          <div className="flex items-end gap-2 p-3 bg-panel border border-border-subtle rounded-xl transition-[border-color,box-shadow] duration-200 shadow-sm focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-glow">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className="flex-1 resize-none text-sm outline-none bg-transparent text-foreground max-h-[200px]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="shrink-0 w-8 h-8 flex items-center justify-center bg-accent text-white rounded-md disabled:opacity-30 transition-opacity hover:opacity-80"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
