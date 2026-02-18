import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/auth";

// GET /api/courses — List all courses for the logged-in user.
// Used by the course header dropdown to show available courses.

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, topic, status, end_goal, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }

  return NextResponse.json({ courses: courses || [] });
}

// POST /api/courses — Create a new course + its Course Setup module.
// The Course Setup module is the special first module that scopes the topic
// and builds the curriculum by calling add_module.

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic } = await req.json();

  if (!topic || typeof topic !== "string") {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Create the course with the authenticated user's ID
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      topic,
      user_id: user.id,
      status: "scoping",
      learner_profile: {},
    })
    .select()
    .single();

  if (courseError) {
    console.error("Course creation error:", courseError);
    return NextResponse.json(
      { error: "Failed to create course" },
      { status: 500 }
    );
  }

  // 2. Create the Course Setup module — position 0, is_course_setup = true.
  // This module's "material" tells the agent what to do: scope the topic
  // and generate modules. The agent reads this via the blackboard.
  const { data: setupModule, error: moduleError } = await supabase
    .from("modules")
    .insert({
      course_id: course.id,
      position: 0,
      title: "Course Setup",
      goal: "Scope the learning topic and generate a structured curriculum",
      is_course_setup: true,
      status: "in_progress",
      material: `You are the course setup agent. The learner wants to learn about: "${topic}"

Your job:
1. Ask 1-3 brief clarifying questions to understand their goal, current knowledge, and desired depth.
2. Once you have enough context, design a curriculum using backwards design:
   - Define the end state (what should they be able to do after the course?)
   - Work backwards to identify prerequisites
   - Sequence into 4-6 chunky modules (each module = a deep tutoring session)
3. Create each module by calling the add_module tool. Include:
   - A clear title
   - A specific goal ("by the end, the learner can...")
   - Detailed material (subtopics to cover, depth level, key concepts, examples to use)
4. After creating all modules, update the course end_goal using what you learned.

Important:
- Modules should be substantial (each is a 1-2 hour interactive session, not a 5-minute topic)
- Prefer fewer, deeper modules over many shallow ones
- Use web_search if you need to verify curriculum structure for unfamiliar topics
- Keep the scoping conversation SHORT — 1-3 questions max, then build the curriculum`,
    })
    .select()
    .single();

  if (moduleError) {
    console.error("Module creation error:", moduleError);
    // Rollback: delete the orphaned course
    await supabase.from("courses").delete().eq("id", course.id);
    return NextResponse.json(
      { error: "Failed to create setup module" },
      { status: 500 }
    );
  }

  return NextResponse.json({ course, setupModule });
}
