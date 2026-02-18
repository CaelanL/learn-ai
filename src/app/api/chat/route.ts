import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/auth";
import { runOrchestrator } from "@/lib/orchestrator";
import { acquireModuleLock, releaseModuleLock } from "@/lib/module-lock";

// POST /api/chat — Send a message, get a streamed response.
// The client sends { moduleId, message }. All context assembly happens server-side.

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { moduleId, message } = await req.json();

  if (!moduleId || !message) {
    return new Response("Missing moduleId or message", { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify the user owns this module's course
  const { data: module } = await supabase
    .from("modules")
    .select("course_id, courses!inner(user_id)")
    .eq("id", moduleId)
    .single();

  const courseOwner = (module?.courses as unknown as { user_id: string })?.user_id;
  if (!module || courseOwner !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  // Prevent concurrent orchestrator runs for the same module
  if (!acquireModuleLock(moduleId)) {
    return new Response(
      JSON.stringify({ error: "This module is already processing a message." }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const stream = await runOrchestrator(
      supabase,
      moduleId,
      message,
      () => releaseModuleLock(moduleId)
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    releaseModuleLock(moduleId);
    console.error("Orchestrator error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
