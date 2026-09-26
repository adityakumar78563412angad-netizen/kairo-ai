import { createServerSupabaseClient } from "@/lib/supabase-server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL =
  process.env.AUTOMATION_PLANNER_MODEL ||
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-120b";

const ALLOWED_TOOLS = [
  "web_search",
  "web_research",
  "browser",
  "email",
  "calendar",
  "file_read",
  "file_write",
  "document",
  "spreadsheet",
  "data_transform",
  "crm",
  "http_request",
  "notification",
] as const;

type AllowedTool = (typeof ALLOWED_TOOLS)[number];

type AutomationPlanStep = {
  step_number: number;
  name: string;
  description: string;
  tool_name: AllowedTool;
  input: Record<string, unknown>;
  depends_on: number[];
  requires_approval: boolean;
  max_retries?: number;
};

type AutomationPlan = {
  title: string;
  summary: string;
  steps: AutomationPlanStep[];
};

type GroqResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

function extractJson(text: string): AutomationPlan {
  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Planner returned invalid JSON.");
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  const parsed = JSON.parse(cleaned) as AutomationPlan;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Planner returned an invalid plan.");
  }

  if (!Array.isArray(parsed.steps)) {
    throw new Error("Planner plan does not contain steps.");
  }

  return parsed;
}

function normalizePlan(plan: AutomationPlan): AutomationPlan {
  const normalizedSteps: AutomationPlanStep[] = plan.steps.map(
    (step, index) => {
      const toolName = String(step.tool_name || "").trim();

      if (!ALLOWED_TOOLS.includes(toolName as AllowedTool)) {
        throw new Error(
          `Planner selected unsupported tool: ${toolName || "unknown"}`
        );
      }

      const dependsOn = Array.isArray(step.depends_on)
        ? step.depends_on
            .map((value) => Number(value))
            .filter(
              (value) =>
                Number.isInteger(value) &&
                value >= 1 &&
                value <= plan.steps.length
            )
        : [];

      return {
        step_number: index + 1,
        name:
          typeof step.name === "string" && step.name.trim()
            ? step.name.trim()
            : `Step ${index + 1}`,
        description:
          typeof step.description === "string"
            ? step.description.trim()
            : "",
        tool_name: toolName as AllowedTool,
        input:
          step.input && typeof step.input === "object"
            ? step.input
            : {},
        depends_on: [...new Set(dependsOn)],
        requires_approval: Boolean(step.requires_approval),
        max_retries:
          Number.isInteger(step.max_retries) &&
          Number(step.max_retries) >= 0
            ? Math.min(Number(step.max_retries), 10)
            : 2,
      };
    }
  );

  return {
    title:
      typeof plan.title === "string" && plan.title.trim()
        ? plan.title.trim()
        : "Automation Task",
    summary:
      typeof plan.summary === "string"
        ? plan.summary.trim()
        : "Automation plan created.",
    steps: normalizedSteps,
  };
}

async function getUserWithToken(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  accessToken?: string
) {
  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (data.user) {
      return data.user;
    }

    if (error) {
      console.error("Automation planner token auth error:", error);
    }
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Automation planner cookie auth error:", error);
  }

  return data.user;
}

function buildPlannerSystemPrompt() {
  return `
You are the ZUQEN AI Automation Planner.

Your job is to convert a user's automation request into a precise executable plan.

You MUST return ONLY valid JSON.

Available tools:
${ALLOWED_TOOLS.map((tool) => `- ${tool}`).join("\n")}

Rules:

1. Use only the available tools listed above.
2. Create the minimum number of steps required.
3. Every step must have a unique sequential step_number.
4. Use depends_on to describe step dependencies.
5. Use an empty array when a step has no dependencies.
6. Never invent a tool.
7. Never claim that an unavailable tool is connected.
8. requires_approval must be true for sensitive or externally consequential actions such as:
   - sending email
   - modifying calendar events
   - writing files
   - CRM mutations
   - external HTTP actions
   - notifications that cause an external action
9. web_search is for normal web searching.
10. web_research is for multi-query research.
11. browser is for browser-oriented tasks.
12. file_read is for reading files.
13. file_write is for writing files.
14. document is for document operations.
15. spreadsheet is for spreadsheet operations.
16. data_transform is for transforming data.
17. crm is for CRM operations.
18. http_request is for external HTTP requests.
19. notification is for notifications.
20. Do not execute anything yourself. Only create the plan.

Return exactly this JSON structure:

{
  "title": "short task title",
  "summary": "short explanation of the overall plan",
  "steps": [
    {
      "step_number": 1,
      "name": "short step name",
      "description": "what this step does",
      "tool_name": "one allowed tool",
      "input": {},
      "depends_on": [],
      "requires_approval": false,
      "max_retries": 2
    }
  ]
}
`;
}

export async function planAutomationTask(
  taskId: string,
  accessToken?: string
) {
  const supabase = await createServerSupabaseClient();

  const user = await getUserWithToken(supabase, accessToken);

  if (!user) {
    throw new Error("Authentication required.");
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "Automation planner is not configured: GROQ_API_KEY is missing."
    );
  }

  const { data: task, error: taskError } = await supabase
    .from("automation_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();

  if (taskError || !task) {
    console.error("Automation planner task load error:", taskError);

    throw new Error(
      taskError?.message || "Automation task could not be loaded."
    );
  }

  await supabase
    .from("automation_tasks")
    .update({
      status: "planning",
      errors: null,
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  const prompt = String(task.prompt || "").trim();

  if (!prompt) {
    throw new Error("Automation prompt is empty.");
  }

  const plannerPayload = {
    model: DEFAULT_MODEL,
    temperature: 0.1,
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: buildPlannerSystemPrompt(),
      },
      {
        role: "user",
        content: `Create an executable automation plan for this request:

${prompt}`,
      },
    ],
  };

  console.log("ZUQEN Automation Planner request:", {
    taskId,
    model: DEFAULT_MODEL,
    userId: user.id,
  });

  let response: Response;

  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(plannerPayload),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    console.error("ZUQEN Automation Planner network error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown network error.";

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        errors: {
          code: "PLANNER_NETWORK_ERROR",
          message,
        },
      })
      .eq("id", taskId)
      .eq("user_id", user.id);

    throw new Error(`Automation planner provider error: ${message}`);
  }

  const rawBody = await response.text();

  let data: GroqResponse = {};

  try {
    data = rawBody ? (JSON.parse(rawBody) as GroqResponse) : {};
  } catch {
    console.error(
      "ZUQEN Automation Planner invalid provider response:",
      rawBody
    );

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        errors: {
          code: "PLANNER_INVALID_PROVIDER_RESPONSE",
          message: rawBody.slice(0, 1000),
          http_status: response.status,
        },
      })
      .eq("id", taskId)
      .eq("user_id", user.id);

    throw new Error(
      `Automation planner provider returned invalid JSON (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    const providerMessage =
      data.error?.message ||
      `Groq returned HTTP ${response.status}.`;

    console.error("ZUQEN Automation Planner provider error:", {
      status: response.status,
      model: DEFAULT_MODEL,
      error: data.error,
      body: rawBody.slice(0, 2000),
    });

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        errors: {
          code: data.error?.code || "PLANNER_PROVIDER_ERROR",
          type: data.error?.type || null,
          message: providerMessage,
          http_status: response.status,
          model: DEFAULT_MODEL,
        },
      })
      .eq("id", taskId)
      .eq("user_id", user.id);

    throw new Error(
      `Automation planner provider error: ${providerMessage}`
    );
  }

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error(
      "ZUQEN Automation Planner returned no content:",
      JSON.stringify(data).slice(0, 4000)
    );

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        errors: {
          code: "PLANNER_EMPTY_RESPONSE",
          message: "Groq returned no planner content.",
          model: data.model || DEFAULT_MODEL,
        },
      })
      .eq("id", taskId)
      .eq("user_id", user.id);

    throw new Error("Automation planner returned an empty response.");
  }

  let plan: AutomationPlan;

  try {
    plan = normalizePlan(extractJson(content));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Planner returned an invalid plan.";

    console.error("ZUQEN Automation Planner parse error:", {
      message,
      content: content.slice(0, 5000),
    });

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        errors: {
          code: "PLANNER_INVALID_PLAN",
          message,
          raw_response: content.slice(0, 5000),
        },
      })
      .eq("id", taskId)
      .eq("user_id", user.id);

    throw new Error(`Automation planner returned an invalid plan: ${message}`);
  }

  const { data: run, error: runError } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("task_id", taskId)
    .eq("user_id", user.id)
    .order("run_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError || !run) {
    console.error("Automation planner run load error:", runError);

    throw new Error(
      runError?.message || "Automation run could not be loaded."
    );
  }

  await supabase
    .from("automation_steps")
    .delete()
    .eq("run_id", run.id)
    .eq("task_id", taskId)
    .eq("user_id", user.id);

  const insertedSteps: Array<{
    id: string;
    step_number: number;
  }> = [];

  for (const step of plan.steps) {
    const { data: inserted, error: insertError } = await supabase
      .from("automation_steps")
      .insert({
        task_id: taskId,
        run_id: run.id,
        user_id: user.id,
        step_number: step.step_number,
        name: step.name,
        description: step.description,
        tool_name: step.tool_name,
        status: "queued",
        input: step.input,
        dependencies: [],
        retries: 0,
      })
      .select("id,step_number")
      .single();

    if (insertError || !inserted) {
      console.error("Automation planner step insert error:", insertError);

      await supabase
        .from("automation_tasks")
        .update({
          status: "failed",
          errors: {
            code: "PLANNER_STEP_INSERT_ERROR",
            message:
              insertError?.message ||
              `Could not create step ${step.step_number}.`,
          },
        })
        .eq("id", taskId)
        .eq("user_id", user.id);

      throw new Error(
        insertError?.message ||
          `Could not create automation step ${step.step_number}.`
      );
    }

    insertedSteps.push(inserted);
  }

  const stepIdByNumber = new Map<number, string>(
    insertedSteps.map((step) => [step.step_number, step.id])
  );

  for (const step of plan.steps) {
    const dependencies = step.depends_on
      .map((number) => stepIdByNumber.get(number))
      .filter((id): id is string => Boolean(id));

    if (dependencies.length > 0) {
      const { error: dependencyError } = await supabase
        .from("automation_steps")
        .update({
          dependencies,
        })
        .eq("id", stepIdByNumber.get(step.step_number)!)
        .eq("task_id", taskId)
        .eq("run_id", run.id)
        .eq("user_id", user.id);

      if (dependencyError) {
        console.error(
          "Automation planner dependency update error:",
          dependencyError
        );

        throw new Error(
          dependencyError.message ||
            `Could not update dependencies for step ${step.step_number}.`
        );
      }
    }
  }

  const usage = data.usage || {};

  await supabase.from("automation_usage").insert({
    user_id: user.id,
    task_id: taskId,
    run_id: run.id,
    provider: "groq",
    tool_name: "automation_planner",
    model: data.model || DEFAULT_MODEL,
    input_tokens: usage.prompt_tokens || 0,
    output_tokens: usage.completion_tokens || 0,
    total_tokens: usage.total_tokens || 0,
    api_calls: 1,
    metadata: {
      planner: true,
    },
  });

  const { error: runUpdateError } = await supabase
    .from("automation_runs")
    .update({
      status: "running",
      execution_context: {
        plan,
        planner_model: data.model || DEFAULT_MODEL,
      },
    })
    .eq("id", run.id)
    .eq("task_id", taskId)
    .eq("user_id", user.id);

  if (runUpdateError) {
    throw new Error(
      runUpdateError.message || "Could not update automation run."
    );
  }

  const { error: taskUpdateError } = await supabase
    .from("automation_tasks")
    .update({
      title: plan.title,
      status: "planned",
      plan,
      errors: null,
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (taskUpdateError) {
    throw new Error(
      taskUpdateError.message || "Could not save automation plan."
    );
  }

  return {
    taskId,
    runId: run.id,
    plan,
    usage: {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
    },
  };
}