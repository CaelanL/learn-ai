import OpenAI from "openai";
import { SupabaseClient } from "@supabase/supabase-js";
import { toolDefinitions } from "./tools/definitions";
import { toolHandlers } from "./tools/handlers";
import { buildSystemPrompt } from "./prompts";

const openai = new OpenAI();

// Max tool-calling round trips before we force a text response.
// Safety valve — prevents infinite loops if the model keeps calling tools.
const MAX_TOOL_ROUNDS = 10;

// -------------------------------------------------------------------
// Blackboard assembly (minimal for now — Step 3 will expand this)
// -------------------------------------------------------------------

// Builds the developer message that gives the agent all its context.
// This is the "blackboard view" — everything the agent needs to know
// about the course, its assignment, and what other modules have covered.
async function assembleBlackboard(
  supabase: SupabaseClient,
  moduleId: string
): Promise<{ developerMessage: string; courseId: string; isCourseSetup: boolean }> {
  // Fetch the module and its course in one go
  const { data: module, error: modError } = await supabase
    .from("modules")
    .select("*, courses(*)")
    .eq("id", moduleId)
    .single();

  if (modError || !module) {
    throw new Error(`Failed to load module ${moduleId}: ${modError?.message}`);
  }

  const course = module.courses;
  const courseId = course.id as string;
  const isCourseSetup = module.is_course_setup as boolean;

  // Fetch all modules for this course (for the overview)
  const { data: allModules } = await supabase
    .from("modules")
    .select("id, position, title, goal, status, summary, is_course_setup")
    .eq("course_id", courseId)
    .order("position");

  // Build the module overview — so the agent knows what exists
  // Include module IDs so the agent can make cross-module tool calls
  const moduleOverview = (allModules || [])
    .map((m) => {
      const marker = m.id === moduleId ? " ← YOU ARE HERE" : "";
      const summaryLine = m.summary ? `\n    Summary: ${m.summary}` : "";
      return `  ${m.position}. [${m.status}] ${m.title} (id: ${m.id})${marker}${summaryLine}`;
    })
    .join("\n");

  // Build the learner profile section
  const profile = course.learner_profile;
  const profileSection =
    profile && Object.keys(profile).length > 0
      ? `\n\nLEARNER PROFILE:\n${Object.entries(profile)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join("\n")}`
      : "";

  // Build the developer message
  const developerMessage = `COURSE: ${course.topic}
End Goal: ${course.end_goal || "Not yet defined"}
Status: ${course.status}
Course ID: ${courseId}
${profileSection}

MODULE OVERVIEW:
${moduleOverview}

YOUR ASSIGNMENT:
Module ID: ${moduleId}
Title: ${module.title}
Goal: ${module.goal || "Not yet defined"}
${module.material ? `\nMATERIAL:\n${module.material}` : ""}`;

  return { developerMessage, courseId, isCourseSetup };
}

// -------------------------------------------------------------------
// Load conversation history from Supabase
// -------------------------------------------------------------------

async function loadConversationHistory(
  supabase: SupabaseClient,
  moduleId: string
): Promise<OpenAI.Responses.ResponseInputItem[]> {
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content, type, metadata, is_summary")
    .eq("module_id", moduleId)
    .order("created_at");

  if (!messages || messages.length === 0) return [];

  // Convert to OpenAI input format.
  // Each row type maps to a different OpenAI input item format.
  const items: OpenAI.Responses.ResponseInputItem[] = [];

  for (const msg of messages) {
    if (msg.type === "tool_call" && msg.metadata?.call_id && msg.metadata?.name && msg.metadata?.arguments) {
      // Replay as a function_call item so the model remembers it called this tool
      items.push({
        type: "function_call",
        call_id: msg.metadata.call_id,
        name: msg.metadata.name,
        arguments: msg.metadata.arguments,
      } as OpenAI.Responses.ResponseInputItem);
    } else if (msg.type === "tool_result" && msg.metadata?.call_id) {
      // Replay as a function_call_output so the model sees the result
      items.push({
        type: "function_call_output",
        call_id: msg.metadata.call_id,
        output: msg.content || "",
      } as OpenAI.Responses.ResponseInputItem);
    } else if (msg.type === "text") {
      // Regular text message (user or assistant)
      items.push({
        role: msg.role as "user" | "assistant",
        content: msg.is_summary
          ? `[Summary of earlier conversation]: ${msg.content}`
          : msg.content,
      });
    }
  }

  return items;
}

// -------------------------------------------------------------------
// Save messages to Supabase
// -------------------------------------------------------------------

async function saveMessage(
  supabase: SupabaseClient,
  moduleId: string,
  role: "user" | "assistant",
  content: string
) {
  await supabase.from("messages").insert({
    module_id: moduleId,
    role,
    type: "text",
    content,
    is_summary: false,
  });
}

// Persist tool calls and their results as message rows.
// This lets future turns replay the full tool-calling history.
async function saveToolCalls(
  supabase: SupabaseClient,
  moduleId: string,
  toolCalls: { call_id: string; name: string; arguments: string }[],
  toolResults: { call_id: string; output: string }[]
) {
  const rows: {
    module_id: string;
    role: string;
    type: string;
    content: string | null;
    metadata: Record<string, string>;
    is_summary: boolean;
  }[] = [];

  // One row per tool call (what the model asked for)
  for (const tc of toolCalls) {
    rows.push({
      module_id: moduleId,
      role: "assistant",
      type: "tool_call",
      content: null,
      metadata: { call_id: tc.call_id, name: tc.name, arguments: tc.arguments },
      is_summary: false,
    });
  }

  // One row per tool result (what we returned)
  for (const tr of toolResults) {
    const callName = toolCalls.find((tc) => tc.call_id === tr.call_id)?.name || "unknown";
    rows.push({
      module_id: moduleId,
      role: "tool",
      type: "tool_result",
      content: tr.output,
      metadata: { call_id: tr.call_id, name: callName },
      is_summary: false,
    });
  }

  if (rows.length > 0) {
    await supabase.from("messages").insert(rows);
  }
}

// -------------------------------------------------------------------
// The orchestrator loop
// -------------------------------------------------------------------

// This is the core function. It:
// 1. Assembles the blackboard context
// 2. Loads conversation history
// 3. Runs the tool-calling loop (non-streaming) until tools are done
// 4. Makes one final streaming call to get the text response
// 5. Returns a ReadableStream of the text for the client

export async function runOrchestrator(
  supabase: SupabaseClient,
  moduleId: string,
  userMessage: string,
  onComplete?: () => void
): Promise<ReadableStream<Uint8Array>> {
  // 1. Assemble context
  const { developerMessage, isCourseSetup } =
    await assembleBlackboard(supabase, moduleId);

  // 2. Build system prompt from role-specific pieces
  const systemPrompt = buildSystemPrompt(isCourseSetup);

  // 3. Load conversation history + append the new user message
  const history = await loadConversationHistory(supabase, moduleId);
  history.push({ role: "user", content: userMessage });

  // 4. Save the user message to DB
  await saveMessage(supabase, moduleId, "user", userMessage);

  // 5. Build the full input array
  // Developer message goes first (highest authority), then conversation history
  const input: OpenAI.Responses.ResponseInputItem[] = [
    { role: "developer", content: developerMessage },
    ...history,
  ];

  // 6. Pick reasoning effort based on module type
  const reasoningEffort = isCourseSetup ? "high" : ("none" as const);

  // 7. Tool-calling loop (non-streaming)
  // We loop because the model might call tools, and after we return results,
  // it might call more tools. We keep going until it just responds with text.
  let currentInput = input;
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await openai.responses.create({
      model: "gpt-5.2",
      instructions: systemPrompt,
      input: currentInput,
      tools: toolDefinitions,
      reasoning: { effort: reasoningEffort },
      store: false, // We manage our own conversation state in Supabase
    });

    // Check if there are any tool calls in the output
    const toolCalls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCallItem =>
        item.type === "function_call"
    );

    console.log(`[orchestrator] Round ${rounds}: ${toolCalls.length} tool call(s)`);

    // No tool calls — model wants to respond with text.
    // But instead of using this non-streamed response, we'll make one
    // final streaming call to get the text incrementally.
    if (toolCalls.length === 0) {
      break;
    }

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall) => {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.arguments);
        } catch (parseError) {
          console.error(`[orchestrator] Failed to parse args for ${toolCall.name}:`, parseError);
          return {
            type: "function_call_output" as const,
            call_id: toolCall.call_id,
            output: `Error: failed to parse arguments for ${toolCall.name}`,
          };
        }

        const handler = toolHandlers[toolCall.name];

        let result: string;
        if (handler) {
          try {
            result = await handler(args, supabase);
          } catch (handlerError) {
            console.error(`[orchestrator] Tool handler error for ${toolCall.name}:`, handlerError);
            result = `Error executing ${toolCall.name}: ${handlerError instanceof Error ? handlerError.message : String(handlerError)}`;
          }
        } else {
          result = `Unknown tool: ${toolCall.name}`;
        }

        console.log(`[orchestrator] ${toolCall.name}: ${result.slice(0, 80)}`);

        return {
          type: "function_call_output" as const,
          call_id: toolCall.call_id,
          output: result,
        };
      })
    );

    // Persist tool calls + results to DB so future turns can replay them
    await saveToolCalls(supabase, moduleId, toolCalls, toolResults)
      .catch((e) => console.error("[orchestrator] Failed to save tool calls:", e));

    // Append the model's tool calls + our tool results to the input for the next round.
    // IMPORTANT: Filter out reasoning items — their IDs reference server-side storage
    // that doesn't exist when store: false. Only pass back function_call items.
    const outputForInput = response.output.filter(
      (item) => item.type !== "reasoning"
    );
    currentInput = [...currentInput, ...outputForInput, ...toolResults];
  }

  // 8. Final streaming call — now that all tools are done, get the text response.
  // tool_choice: "none" forces text output — tools stay for context but can't be called.
  const stream = await openai.responses.create({
    model: "gpt-5.2",
    instructions: systemPrompt,
    input: currentInput,
    tools: toolDefinitions,
    tool_choice: "none",
    reasoning: { effort: reasoningEffort },
    stream: true,
    store: false,
  });

  // 9. Convert the OpenAI stream into a ReadableStream for Next.js
  // We also collect the full text so we can save it to Supabase when done.
  let fullText = "";
  const encoder = new TextEncoder();

  let completeCalled = false;
  const signalComplete = () => {
    if (!completeCalled) {
      completeCalled = true;
      onComplete?.();
    }
  };

  const readableStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let clientDisconnected = false;
      let messageSaved = false;
      try {
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") {
            fullText += event.delta;
            if (!clientDisconnected) {
              try {
                controller.enqueue(encoder.encode(event.delta));
              } catch {
                clientDisconnected = true;
              }
            }
          }
        }

        // Save the complete assistant message
        if (fullText) {
          await saveMessage(supabase, moduleId, "assistant", fullText);
          messageSaved = true;
        }

        if (!clientDisconnected) controller.close();
      } catch (error) {
        if (!clientDisconnected) {
          try { controller.error(error); } catch { /* already closed */ }
        }
        if (fullText && !messageSaved) {
          await saveMessage(supabase, moduleId, "assistant", fullText)
            .catch((e) => console.error("[orchestrator] Failed to save on error:", e));
        }
      } finally {
        signalComplete();
      }
    },
  });

  return readableStream;
}
