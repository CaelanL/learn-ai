"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { type ReadonlyURLSearchParams } from "next/navigation";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Course, Module, Message, ModuleState } from "@/lib/types";
import { readStream } from "@/lib/stream";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EMPTY_MODULE_STATE: ModuleState = {
  messages: [],
  streamingContent: "",
  isLoading: false,
  loaded: false,
  hasAutoSent: false,
};

// ---------------------------------------------------------------------------
// Pure helper: decides what (if anything) to auto-send when entering a module.
// Extracted so the most complex branching logic is testable without React.
// ---------------------------------------------------------------------------
type AutoSendAction =
  | { type: "setup-topic"; content: string }
  | { type: "setup-resume"; content: string };

function getAutoSendAction(
  mod: Module,
  messages: Message[],
  initialTopic: string | null,
  courseTopic: string
): AutoSendAction | null {
  // New course: setup module with the pre-loaded topic message already visible
  if (
    mod.is_course_setup &&
    initialTopic &&
    messages.length === 1 &&
    messages[0].role === "user"
  ) {
    return { type: "setup-topic", content: initialTopic };
  }

  // Returning to setup module with no messages (e.g., page refresh on empty setup)
  if (mod.is_course_setup && messages.length === 0) {
    return { type: "setup-resume", content: courseTopic };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useCourseSession(
  courseId: string,
  searchParams: ReadonlyURLSearchParams,
  router: AppRouterInstance,
  onError?: (message: string) => void
) {
  // If we arrived from the landing page with a topic, show it immediately
  const initialTopic = searchParams.get("topic");

  const [course, setCourse] = useState<Course | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(
    searchParams.get("module")
  );

  // -----------------------------------------------------------------
  // Per-module state: ref-based map + active snapshot for React renders
  // -----------------------------------------------------------------
  const moduleStatesRef = useRef<Map<string, ModuleState>>(new Map());
  const currentModuleIdRef = useRef<string | null>(currentModuleId);
  const [activeSnapshot, setActiveSnapshot] =
    useState<ModuleState>(EMPTY_MODULE_STATE);

  // Keep the ref in sync with React state
  currentModuleIdRef.current = currentModuleId;

  // Seed the initial topic into the setup module's state if present
  const initialTopicSeeded = useRef(false);
  if (initialTopic && currentModuleId && !initialTopicSeeded.current) {
    const state = moduleStatesRef.current.get(currentModuleId) || {
      ...EMPTY_MODULE_STATE,
    };
    state.messages = [{ role: "user", content: initialTopic }];
    state.isLoading = true;
    moduleStatesRef.current.set(currentModuleId, state);
    initialTopicSeeded.current = true;
  }

  function getOrCreate(moduleId: string): ModuleState {
    let state = moduleStatesRef.current.get(moduleId);
    if (!state) {
      state = { ...EMPTY_MODULE_STATE, messages: [] };
      moduleStatesRef.current.set(moduleId, state);
    }
    return state;
  }

  function syncIfActive(moduleId: string) {
    if (moduleId === currentModuleIdRef.current) {
      const state = getOrCreate(moduleId);
      setActiveSnapshot({ ...state, messages: [...state.messages] });
    }
  }

  function mutateModule(moduleId: string, patch: Partial<ModuleState>) {
    const state = getOrCreate(moduleId);
    Object.assign(state, patch);
    syncIfActive(moduleId);
  }

  const currentModule = modules.find((m) => m.id === currentModuleId);

  // -----------------------------------------------------------------
  // Core chat function — shared by all send paths.
  // Handles the fetch, streaming, and module refresh.
  // Does NOT add user message to state — caller handles that.
  // -----------------------------------------------------------------
  const sendChatMessage = useCallback(
    async (moduleId: string, content: string) => {
      mutateModule(moduleId, { isLoading: true, streamingContent: "" });

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleId, message: content }),
        });

        // 409 = module is already processing. Don't reset isLoading —
        // the original request is still in flight.
        if (response.status === 409) {
          onError?.("This module is still processing. Please wait.");
          return;
        }

        if (!response.ok) throw new Error("Chat request failed");

        const fullText = await readStream(response, (text) => {
          mutateModule(moduleId, { streamingContent: text });
        });

        const modState = getOrCreate(moduleId);
        mutateModule(moduleId, {
          messages: [...modState.messages, { role: "assistant", content: fullText }],
          streamingContent: "",
          isLoading: false,
        });

        // Refresh module list — agent might have created modules or changed status
        const res = await fetch(`/api/courses/${courseId}`);
        if (res.ok) {
          const data = await res.json();
          setModules(data.modules);
          setCourse((prev) =>
            prev && data.course.status !== prev.status ? data.course : prev
          );
        }
      } catch (error) {
        console.error("Error in chat:", error);
        onError?.("Something went wrong. Please try again.");
        mutateModule(moduleId, { isLoading: false, streamingContent: "" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courseId]
  );

  // -----------------------------------------------------------------
  // Send a user-typed message (adds to state, then calls core fn)
  // -----------------------------------------------------------------
  const sendMessage = useCallback(
    async (content: string) => {
      const moduleId = currentModuleIdRef.current;
      if (!moduleId) return;
      const modState = getOrCreate(moduleId);
      mutateModule(moduleId, {
        messages: [...modState.messages, { role: "user", content }],
      });
      await sendChatMessage(moduleId, content);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendChatMessage]
  );

  // -----------------------------------------------------------------
  // Load course + modules on mount
  // -----------------------------------------------------------------
  useEffect(() => {
    async function loadCourse() {
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          router.push("/");
          return;
        }
        const data = await res.json();
        setCourse(data.course);
        setModules(data.modules);

        // Default to the setup module if none selected
        if (!searchParams.get("module") && data.modules.length > 0) {
          const setupMod = data.modules.find(
            (m: Module) => m.is_course_setup
          );
          const defaultId = setupMod?.id || data.modules[0].id;
          setCurrentModuleId(defaultId);
          currentModuleIdRef.current = defaultId;
        }
      } catch {
        router.push("/");
      }
    }
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // -----------------------------------------------------------------
  // Load all courses for the header dropdown
  // -----------------------------------------------------------------
  useEffect(() => {
    async function loadAllCourses() {
      try {
        const res = await fetch("/api/courses");
        if (res.ok) {
          const data = await res.json();
          setAllCourses(data.courses || []);
        }
      } catch {
        // Silently ignore
      }
    }
    loadAllCourses();
  }, []);

  // -----------------------------------------------------------------
  // Poll for module list updates during course setup
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!course) return;

    const isInSetup = currentModule?.is_course_setup;
    if (!isInSetup && modules.length > 1) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/courses/${course.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setModules(data.modules);
        if (data.course.status !== course.status) {
          setCourse(data.course);
        }
      } catch {
        // Silently ignore poll failures
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [course, currentModule?.is_course_setup, modules.length]);

  // -----------------------------------------------------------------
  // Load messages when switching modules
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!currentModuleId) return;

    const modState = getOrCreate(currentModuleId);

    // Already loaded — just sync the snapshot
    if (modState.loaded) {
      syncIfActive(currentModuleId);
      return;
    }

    // If we have an initial topic, mark as loaded without fetching
    if (initialTopic && !modState.hasAutoSent) {
      mutateModule(currentModuleId, { loaded: true });
      return;
    }

    const abortController = new AbortController();

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/modules/${currentModuleId}/messages`, {
          signal: abortController.signal,
        });
        if (!res.ok) {
          mutateModule(currentModuleId, { messages: [], loaded: true });
          return;
        }
        const data = await res.json();
        if (!abortController.signal.aborted) {
          mutateModule(currentModuleId, {
            messages: data.messages || [],
            loaded: true,
          });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        mutateModule(currentModuleId, { messages: [], loaded: true });
      }
    };

    loadMessages();

    return () => abortController.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModuleId, initialTopic]);

  // -----------------------------------------------------------------
  // Auto-send: new course topic OR greeting for teaching modules
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!course || !currentModuleId) return;

    const modState = getOrCreate(currentModuleId);
    if (modState.hasAutoSent || !modState.loaded) return;

    const mod = modules.find((m) => m.id === currentModuleId);
    if (!mod) return;

    const action = getAutoSendAction(
      mod,
      modState.messages,
      initialTopic,
      course.topic
    );
    if (!action) return;

    mutateModule(currentModuleId, { hasAutoSent: true });

    switch (action.type) {
      case "setup-topic":
        // Message is already shown — just fire the API call
        sendChatMessage(currentModuleId, action.content);
        // Clean topic from URL so refresh doesn't re-send
        window.history.replaceState(
          null,
          "",
          `/course/${courseId}?module=${currentModuleId}`
        );
        break;
      case "setup-resume":
        // Adds user message to state + sends
        sendMessage(action.content);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    course,
    currentModuleId,
    activeSnapshot,
    modules,
    initialTopic,
    courseId,
    sendChatMessage,
    sendMessage,
  ]);

  // -----------------------------------------------------------------
  // Module navigation — just swap the pointer + snapshot
  // -----------------------------------------------------------------
  const handleSelectModule = useCallback(
    (moduleId: string) => {
      if (moduleId === currentModuleIdRef.current) return;
      setCurrentModuleId(moduleId);
      currentModuleIdRef.current = moduleId;
      setActiveSnapshot({ ...getOrCreate(moduleId), messages: [...getOrCreate(moduleId).messages] });
      window.history.replaceState(
        null,
        "",
        `/course/${courseId}?module=${moduleId}`
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courseId]
  );

  return {
    course,
    allCourses,
    modules,
    currentModuleId,
    currentModule,
    messages: activeSnapshot.messages,
    isLoading: activeSnapshot.isLoading,
    streamingContent: activeSnapshot.streamingContent,
    sendMessage,
    handleSelectModule,
  };
}
