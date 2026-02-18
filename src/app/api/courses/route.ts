import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/auth";
import OpenAI from "openai";

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
    .select("id, topic, title, status, end_goal, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

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
      material: `The learner wants to learn about: "${topic}"

SCOPING GUIDANCE:
The same topic produces wildly different curricula depending on the learner's goal.
- "Teach me accounting" for a small business owner vs a career changer = completely different courses.
- "Teach me to vibe code" for someone who just wants to use Cursor vs someone who wants to actually understand what the AI generates = different starting points.
Don't start designing until the WHY is clear. Catch implicit scope issues: country-specific topics (taxes, law), version-specific (frameworks), role-specific angles.

CURRICULUM DESIGN:
Use backwards design: define the end state (what should they be able to DO?), work backwards to prerequisites, identify the gap, sequence into 4-6 modules.
- Each module is a DEEP tutoring session (1-2 hours of back-and-forth). NOT a quick topic.
- Prefer fewer, deeper modules over many shallow ones. Group related concepts.
- Use web_search for unfamiliar topics to validate structure and coverage.

MODULE MATERIAL FORMAT:
Brief topic outlines — NOT lesson plans. Bolded topic names + keyword/phrase depth cues, 10-20 words per subtopic. The teaching agent handles ALL pedagogy.

GOOD example:
- **What happens when you type a URL and hit Enter?**
  - DNS lookup, IP addresses, HTTP request, server response, browser rendering
- **Servers are just computers, programs are just files**
  - Demystifying "the cloud," what a server actually is, localhost

BAD example (do NOT write this):
- 1) What is DNS? DNS stands for Domain Name System. It translates...`,
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

  // 3. Generate an AI title (non-blocking on error)
  try {
    const openai = new OpenAI();
    const response = await openai.responses.create({
      model: "gpt-4.1-nano",
      input: [
        {
          role: "user",
          content: `Generate a short, catchy course title for a course about: "${topic}".
The title should be 2-5 words, title case, no quotes, no punctuation.
Examples: "React Fundamentals", "How Databases Work", "Python for Data Science"
Return ONLY the title, nothing else.`,
        },
      ],
    });

    const textItem = response.output.find(
      (item: { type: string }) => item.type === "message"
    );
    if (textItem && textItem.type === "message") {
      const content = textItem.content[0];
      if (content.type === "output_text") {
        const title = content.text.trim();
        await supabase.from("courses").update({ title }).eq("id", course.id);
        course.title = title;
      }
    }
  } catch (err) {
    console.error("Title generation failed (non-fatal):", err);
  }

  return NextResponse.json({ course, setupModule });
}
