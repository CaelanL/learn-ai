import { SupabaseClient } from "@supabase/supabase-js";

// Each handler takes parsed arguments from a tool call and does the Supabase operation.
// They all return a string result that gets sent back to the model as function_call_output.
// The model reads these results to know what happened (success, error, new IDs, etc).

type ToolHandler = (
  args: Record<string, unknown>,
  supabase: SupabaseClient
) => Promise<string>;

export const toolHandlers: Record<string, ToolHandler> = {
  update_module_status: async (args, supabase) => {
    const { module_id, status } = args as {
      module_id: string;
      status: string;
    };

    const { error } = await supabase
      .from("modules")
      .update({ status })
      .eq("id", module_id);

    if (error) return `Error updating module status: ${error.message}`;
    return `Module status updated to "${status}".`;
  },

  update_module_summary: async (args, supabase) => {
    const { module_id, summary } = args as {
      module_id: string;
      summary: string;
    };

    const { error } = await supabase
      .from("modules")
      .update({ summary })
      .eq("id", module_id);

    if (error) return `Error updating module summary: ${error.message}`;
    return `Module summary updated.`;
  },

  add_module: async (args, supabase) => {
    const { course_id, title, goal, material, position } = args as {
      course_id: string;
      title: string;
      goal: string;
      material: string | null;
      position: number;
    };

    const { data, error } = await supabase
      .from("modules")
      .insert({
        course_id,
        title,
        goal,
        material,
        position,
        status: "not_started",
        is_course_setup: false,
      })
      .select("id")
      .single();

    if (error) return `Error adding module: ${error.message}`;
    return `Module "${title}" created with id ${data.id} at position ${position}.`;
  },

  edit_module: async (args, supabase) => {
    const { module_id, title, goal, material } = args as {
      module_id: string;
      title: string | null;
      goal: string | null;
      material: string | null;
    };

    // Only update fields that aren't null
    const updates: Record<string, string> = {};
    if (title !== null) updates.title = title;
    if (goal !== null) updates.goal = goal;
    if (material !== null) updates.material = material;

    if (Object.keys(updates).length === 0) {
      return "No changes provided — all fields were null.";
    }

    const { error } = await supabase
      .from("modules")
      .update(updates)
      .eq("id", module_id);

    if (error) return `Error editing module: ${error.message}`;
    return `Module updated: ${Object.keys(updates).join(", ")} changed.`;
  },

  add_content_to_module: async (args, supabase) => {
    const { module_id, content } = args as {
      module_id: string;
      content: string;
    };

    // Atomic append via Postgres function — safe under concurrent access
    const { error } = await supabase.rpc("append_module_material", {
      p_module_id: module_id,
      p_content: content,
    });

    if (error) return `Error appending content: ${error.message}`;
    return `Content appended to module material.`;
  },

  update_learner_profile: async (args, supabase) => {
    const { course_id, profile_updates } = args as {
      course_id: string;
      profile_updates: Record<string, string | null>;
    };

    // Filter to non-null updates (JSONB || merge doesn't remove keys)
    const nonNullUpdates: Record<string, string> = {};
    for (const [key, value] of Object.entries(profile_updates)) {
      if (value !== null) {
        nonNullUpdates[key] = value;
      }
    }

    if (Object.keys(nonNullUpdates).length === 0) {
      return "No non-null updates provided.";
    }

    // Atomic JSONB merge via Postgres function — safe under concurrent access
    const { error } = await supabase.rpc("merge_learner_profile", {
      p_course_id: course_id,
      p_updates: nonNullUpdates,
    });

    if (error) return `Error updating learner profile: ${error.message}`;
    return `Learner profile updated: ${Object.keys(nonNullUpdates).join(", ")}.`;
  },
};
