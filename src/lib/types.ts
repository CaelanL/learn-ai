// These match the Supabase schema shape.
// The frontend works with these types — no more client-side state hacks.

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface Module {
  id: string;
  position: number;
  title: string;
  goal: string | null;
  status: "not_started" | "in_progress" | "completed";
  is_course_setup: boolean;
}

export interface Course {
  id: string;
  topic: string;
  end_goal: string | null;
  status: "scoping" | "active" | "completed";
}

export interface ModuleState {
  messages: Message[];
  streamingContent: string;
  isLoading: boolean;
  loaded: boolean;
  hasAutoSent: boolean;
}
