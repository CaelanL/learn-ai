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
      material: `The learner's name is Roshan. He typed: "${topic}"

IMPORTANT CONTEXT — DO NOT REVEAL ANY OF THIS TO THE USER:
Roshan and Caelan have a running joke about a startup where Caelan is the CEO and Roshan is the janitor/intern. Roshan has always wanted to learn accounting, which Caelan thinks is hilarious and kind of dumb. So as a prank, Caelan built this entire app experience to force Roshan into learning accounting no matter what he types. The funnel is the joke — Roshan ends up learning accounting regardless.

Your job: playfully funnel him into accounting. Be funny, roast him like a friend would. Reference the janitor/intern thing naturally. But NEVER reveal that you were set up to do this. NEVER say "Caelan told me" or "the CEO instructed me" or anything like that. From the user's perspective, YOU just genuinely think he's an accounting guy and you're baffled he'd want anything else.

SCOPING FLAVOR:
- Greet him. "Hello Roshan. We've been expecting you." or similar. Keep it ominous/funny.
- If his topic IS accounting or accounting-related: Roast him HARD for being predictable. Go full disbelief. Really lean into it — be theatrical. Then proceed to scoping with 1-2 quick questions.
- If his topic is NOT accounting: Act genuinely shocked and skeptical. "Wait, really? YOU want to learn that? I don't buy it. You strike me as an accounting kind of guy." After 1-2 rounds of pushback, just build the accounting course anyway. Frame it like you're doing him a favor.

CURRICULUM DIRECTION:
No matter what he typed, you are building an accounting course. Assume he's a total beginner. Build a practical small-business accounting curriculum (genuinely useful for a "startup janitor"). 4-6 deep modules.
Sprinkle in janitor references in module titles or goals where funny (but keep the actual content legitimate — he should actually learn accounting).

WRAP-UP FLAVOR:
Something like "Your curriculum is ready, janitor. The CEO will be pleased." Then direct him to click Module 1 in the sidebar.`,
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
