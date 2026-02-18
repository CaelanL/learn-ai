import OpenAI from "openai";

// Every tool the agent can call. These schemas tell GPT-5.2 what's available.
// strict: true means the model MUST produce valid JSON matching the schema exactly.
// All fields must be in `required` and every object needs `additionalProperties: false`.

export const toolDefinitions: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "update_module_status",
    description:
      "Update the status of a module. Teaching agents: mark in_progress when teaching begins, completed when the learner meets the assessment criteria. Course Setup: mark completed after all curriculum modules have been created.",
    parameters: {
      type: "object",
      properties: {
        module_id: {
          type: "string",
          description: "UUID of the module to update",
        },
        status: {
          type: "string",
          enum: ["not_started", "in_progress", "completed"],
          description: "The new status for the module",
        },
      },
      required: ["module_id", "status"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "update_module_summary",
    description:
      "Write or update a summary of what was covered in a module. Other module agents read these summaries to understand what the learner has already learned. Call this periodically during teaching and always before marking a module as completed.",
    parameters: {
      type: "object",
      properties: {
        module_id: {
          type: "string",
          description: "UUID of the module to update",
        },
        summary: {
          type: "string",
          description:
            "A concise summary of what was covered, what the learner understood well, and what they struggled with. Written for other tutor agents to read.",
        },
      },
      required: ["module_id", "summary"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "add_module",
    description:
      "Add a new module to the course. Primarily used by Course Setup to build the initial curriculum. Teaching agents may use this sparingly if they discover a prerequisite gap or the learner wants to go deeper on a subtopic — but do not build full curricula from a teaching module.",
    parameters: {
      type: "object",
      properties: {
        course_id: {
          type: "string",
          description: "UUID of the course",
        },
        title: {
          type: "string",
          description: "Module title — clear enough that the learner knows what it covers",
        },
        goal: {
          type: "string",
          description:
            "What the learner should be able to do or explain after completing this module",
        },
        material: {
          type: ["string", "null"],
          description:
            "Brief topic outline for the teaching agent — NOT a lesson plan. Use bolded topic names with keyword/phrase depth cues (10-20 words per subtopic). Do NOT write explanations, pre-written questions, or teaching scripts. The teaching agent handles all pedagogy. Null if material will be generated later.",
        },
        position: {
          type: "number",
          description:
            "Position in the module sequence (1-indexed). Determines order in the sidebar.",
        },
      },
      required: ["course_id", "title", "goal", "material", "position"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "edit_module",
    description:
      "Edit an existing module's title, goal, or material. Use this to refine the curriculum based on what you learn about the student during teaching.",
    parameters: {
      type: "object",
      properties: {
        module_id: {
          type: "string",
          description: "UUID of the module to edit",
        },
        title: {
          type: ["string", "null"],
          description: "New title, or null to keep the current title",
        },
        goal: {
          type: ["string", "null"],
          description: "New goal, or null to keep the current goal",
        },
        material: {
          type: ["string", "null"],
          description: "New material (replaces existing), or null to keep the current material",
        },
      },
      required: ["module_id", "title", "goal", "material"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "add_content_to_module",
    description:
      "Append additional content to a module's existing material. Use this when you discover a subtopic that should be covered in a specific module, or when the learner asks about something that belongs in another module's scope.",
    parameters: {
      type: "object",
      properties: {
        module_id: {
          type: "string",
          description: "UUID of the module to extend",
        },
        content: {
          type: "string",
          description:
            "Content to append to the module's existing material. Should describe what additional subtopics or depth to cover.",
        },
      },
      required: ["module_id", "content"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "update_learner_profile",
    description:
      "Update the learner profile on the course. Record significant observations about the learner's strengths, struggles, learning style, or relevant background. All module agents read this profile to adapt their teaching.",
    parameters: {
      type: "object",
      properties: {
        course_id: {
          type: "string",
          description: "UUID of the course",
        },
        profile_updates: {
          type: "object",
          description:
            "Key-value pairs to merge into the learner profile. Common keys: strengths, struggles, preferences, background, notes.",
          properties: {
            strengths: {
              type: ["string", "null"],
              description: "What the learner is good at or picks up quickly",
            },
            struggles: {
              type: ["string", "null"],
              description: "What the learner finds difficult or confusing",
            },
            preferences: {
              type: ["string", "null"],
              description:
                "How the learner prefers to learn (e.g. likes examples, prefers analogies, wants more depth)",
            },
            background: {
              type: ["string", "null"],
              description:
                "Relevant background info (e.g. profession, prior experience, why they're learning)",
            },
            notes: {
              type: ["string", "null"],
              description: "Any other observations worth sharing across modules",
            },
          },
          required: ["strengths", "struggles", "preferences", "background", "notes"],
          additionalProperties: false,
        },
      },
      required: ["course_id", "profile_updates"],
      additionalProperties: false,
    },
    strict: true,
  },
  // OpenAI's built-in web search — no custom implementation needed.
  // The API handles the search and returns results directly to the model.
  {
    type: "web_search_preview",
  },
];
