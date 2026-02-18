import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/auth";

// GET /api/modules/[id]/messages — Fetch all messages for a module.
// Used when the user navigates to a module to load its conversation history.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Verify the user owns this module's course
  const { data: module } = await supabase
    .from("modules")
    .select("course_id, courses!inner(user_id)")
    .eq("id", id)
    .single();

  const courseOwner = (module?.courses as unknown as { user_id: string })?.user_id;
  if (!module || courseOwner !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: messages, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("module_id", id)
    .eq("type", "text")
    .eq("is_summary", false)
    .neq("content", "[The learner just entered this module for the first time. Introduce the topic and start teaching.]")
    .order("created_at");

  if (error) {
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }

  return NextResponse.json({ messages: messages || [] });
}
