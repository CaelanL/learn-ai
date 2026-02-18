import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/auth";

// GET /api/courses/[id] — Fetch a course with all its modules.
// Used by the frontend to populate the sidebar and know which modules exist.

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

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (courseError || !course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { data: modules } = await supabase
    .from("modules")
    .select("id, position, title, goal, status, is_course_setup")
    .eq("course_id", id)
    .order("position");

  return NextResponse.json({ course, modules: modules || [] });
}
