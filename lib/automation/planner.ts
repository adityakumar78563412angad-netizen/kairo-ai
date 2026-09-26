import { createClient } from "@/lib/supabase";

export type AutomationToolName =
  | "web_search"
  | "web_research"
  | "browser"
  | "email"
  | "calendar"
  | "file_read"
  | "file_write"
  | "document"
  | "spreadsheet"
  | "data_transform"
  | "crm"
  | "http_request"
  | "notification";

export type AutomationPlanStep = {
  step_number: number;
  name: string;
  description: string;
  tool_name: AutomationToolName;
  input: Record<string, unknown>;
  dependencies: number[];
  requires_approval: boolean;
  max_retries: number;
};

export type AutomationPlan = {
  goal: string;
  summary: string;
  steps: AutomationPlanStep[];
};

type PlannerResult =
  | {
      success: true;
      plan: AutomationPlan;
      usage?: {
        provider: string;
        model: string;
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
    }
  | {
      success: false;
      error: string;
      errorCode?: string;
    };

const MAX_STEPS = 30;
const MAX_PROMPT_LENGTH = 10000;

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

function isAllowedTool(value: unknown): value is AllowedTool {
  return (
    typeof value === "string" &&
    (ALLOWED_TOOLS as readonly string[]).includes(value)
  );
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizePlan(raw: unknown): AutomationPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const source = raw as Record<string, unknown>;

  const goal = cleanString(source.goal, 2000);
  const summary = cleanString(source.summary, 4000);

  if (!goal || !Array.isArray(source.steps)) {
    return null;
  }

  if (source.steps.length === 0 || source.steps.length > MAX_STEPS) {
    return null;
  }

  const steps: AutomationPlanStep[] = [];

  for (let index = 0; index < source.steps.length; index += 1) {
    const rawStep = source.steps[index];

    if (
      !rawStep ||
      typeof rawStep !== "object" ||
      Array.isArray(rawStep)
    ) {
      return null;
    }

    const step = rawStep as Record<string, unknown>;

    const stepNumber =
      typeof step.step_number === "number"
        ? Math.floor(step.step_number)
        : index + 1;

    const name = cleanString(step.name, 200);
    const description = cleanString(step.description, 2000);
    const toolName = cleanString(step.tool_name, 100);

    if (
      stepNumber !== index + 1 ||
      !name ||
      !description ||
      !isAllowedTool(toolName)
    ) {
      return null;
    }

    const dependencies = Array.isArray(step.dependencies)
      ? Array.from(
          new Set(
            step.dependencies
              .filter(
                (dependency): dependency is number =>
                  typeof dependency === "number" &&
                  Number.isInteger(dependency) &&
                  dependency >= 1 &&
                  dependency < stepNumber
              )
              .slice(0, 10)
          )
        )
      : [];

    const requiresApproval =
      typeof step.requires_approval === "boolean"
        ? step.requires_approval
        : false;

    const maxRetries =
      typeof step.max_retries === "number" &&
      Number.isInteger(step.max_retries)
        ? Math.min(Math.max(step.max_retries, 0), 5)
        : 2;

    steps.push({
      step_number: stepNumber,
      name,
      description,
      tool_name: toolName,
      input: cleanRecord(step.input),
      dependencies,
      requires_approval: requiresApproval,
      max_retries: maxRetries,
    });
  }

  return {
    goal,
    summary: summary || goal,
    steps,
  };
}

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue below and attempt to extract a JSON object.
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace <= firstBrace
  ) {
    return null;
  }

  try {
    return JSON.parse(
      cleaned.slice(firstBrace, lastBrace + 1)
    );
  } catch {
    return null;
  }
}

function buildPlannerSystemPrompt() {
  return `
You are the ZUQEN Automation Planner.

You are NOT a general chat assistant.

Your job is to convert a user's automation request into a precise,
machine-executable plan for an independent automation engine.

IMPORTANT ARCHITECTURE RULES:

1. Do NOT use or reference existing ZUQEN agents.
2. Do NOT use Website Builder.
3. Do NOT use Image Generator.
4. Do NOT use Video Generator.
5. Do NOT use Voice Generator.
6. Do NOT use ZUQEN Chat as a tool.
7. Only use the independent Automation tools listed below.
8. Never invent a tool that is not listed.
9. Break complex tasks into small deterministic steps.
10. Steps may depend on earlier steps.
11. Independent steps should have no unnecessary dependencies.
12. External side effects such as sending email, modifying calendar events,
    writing files, CRM changes, or other consequential actions should normally
    set requires_approval=true.
13. Pure research, reading, transformation and analysis normally do not require
    approval.
14. Never claim that an action has already happened. You are only creating a plan.
15. Every step must have a concrete tool and machine-readable input.
16. Use max_retries between 0 and 5.
17. Maximum 30 steps.
18. For web_search, put the actual search query inside input.query.
19. Use search_depth="advanced" only when deeper search is actually useful.
20. Do not create unnecessary web_search steps.
21. If multiple searches are independent, keep their dependencies empty so the
    execution engine can run them in parallel.
22. A dependency number must refer only to an earlier step number.

AVAILABLE AUTOMATION TOOLS:

- web_search
  Search the public web for targeted information.

  Expected input can include:
  {
    "query": "search query",
    "search_depth": "basic" | "advanced",
    "max_results": 5,
    "topic": "general" | "news" | "finance",
    "include_answer": true,
    "include_raw_content": false,
    "include_images": false,
    "include_domains": [],
    "exclude_domains": []
  }

- web_research
  Perform deeper multi-source research.

- browser
  Navigate and interact with websites.

- email
  Read, draft, send, reply to or manage email when the integration permits it.

- calendar
  Read, create, update or cancel calendar events when the integration permits it.

- file_read
  Read files supplied through connected storage.

- file_write
  Create or update files through connected storage.

- document
  Create or transform structured documents.

- spreadsheet
  Read, create or update spreadsheet data.

- data_transform
  Clean, filter, transform, aggregate or structure data.

- crm
  Read or update CRM/business records when the integration permits it.

- http_request
  Call an explicitly configured external API/integration.

- notification
  Deliver a notification through a configured notification integration.

OUTPUT REQUIREMENTS:

Return ONLY valid JSON.

The JSON must have exactly this structure:

{
  "goal": "string",
  "summary": "string",
  "steps": [
    {
      "step_number": 1,
      "name": "string",
      "description": "string",
      "tool_name": "one allowed tool",
      "input": {},
      "dependencies": [],
      "requires_approval": false,
      "max_retries": 2
    }
  ]
}

Do not wrap the JSON in markdown.
`.trim();
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string
): Promise<{
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const model =
    process.env.AUTOMATION_PLANNER_MODEL ||
    process.env.GROQ_MODEL ||
    "llama-3.3-70b-versatile";

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 5000,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    console.error(
      "Automation Planner provider error:",
      {
        status: response.status,
        body: errorText.slice(0, 1000),
      }
    );

    throw new Error(
      "Automation planner provider request failed."
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const text =
    data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error(
      "Automation planner returned an empty response."
    );
  }

  const inputTokens = Number(
    data.usage?.prompt_tokens || 0
  );

  const outputTokens = Number(
    data.usage?.completion_tokens || 0
  );

  const totalTokens =
    Number(data.usage?.total_tokens || 0) ||
    inputTokens + outputTokens;

  return {
    text,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

export async function planAutomationTask(
  taskId: string
): Promise<PlannerResult> {
  if (!taskId || typeof taskId !== "string") {
    return {
      success: false,
      error: "Automation task ID is required.",
      errorCode: "INVALID_TASK_ID",
    };
  }

  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "Authentication required.",
      errorCode: "AUTH_REQUIRED",
    };
  }

  const {
    data: task,
    error: taskError,
  } = await supabase
    .from("automation_tasks")
    .select("id, user_id, prompt, status")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();

  if (taskError || !task) {
    return {
      success: false,
      error: "Automation task not found.",
      errorCode: "TASK_NOT_FOUND",
    };
  }

  const prompt = cleanString(
    task.prompt,
    MAX_PROMPT_LENGTH
  );

  if (!prompt) {
    return {
      success: false,
      error: "Automation task has no valid prompt.",
      errorCode: "INVALID_PROMPT",
    };
  }

  if (
    task.status !== "queued" &&
    task.status !== "planning"
  ) {
    return {
      success: false,
      error:
        "Automation task is not available for planning.",
      errorCode: "INVALID_TASK_STATUS",
    };
  }

  const { error: planningError } =
    await supabase
      .from("automation_tasks")
      .update({
        status: "planning",
        error_code: null,
        error_message: null,
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

  if (planningError) {
    console.error(
      "Unable to mark automation task as planning:",
      planningError
    );

    return {
      success: false,
      error:
        "Unable to start automation planning.",
      errorCode: "PLANNING_STATE_FAILED",
    };
  }

  try {
    const providerResult = await callGroq(
      buildPlannerSystemPrompt(),
      prompt
    );

    const rawPlan = extractJson(
      providerResult.text
    );

    const plan = normalizePlan(rawPlan);

    if (!plan) {
      await supabase
        .from("automation_tasks")
        .update({
          status: "failed",
          error_code: "INVALID_PLAN",
          error_message:
            "Automation planner returned an invalid execution plan.",
          completed_at:
            new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("user_id", user.id);

      return {
        success: false,
        error:
          "Automation planner returned an invalid plan.",
        errorCode: "INVALID_PLAN",
      };
    }

    const {
      data: run,
      error: runError,
    } = await supabase
      .from("automation_runs")
      .select("id, status")
      .eq("task_id", task.id)
      .eq("user_id", user.id)
      .eq("run_number", 1)
      .single();

    if (runError || !run?.id) {
      console.error(
        "Unable to find automation run:",
        runError
      );

      await supabase
        .from("automation_tasks")
        .update({
          status: "failed",
          error_code: "RUN_NOT_FOUND",
          error_message:
            "Automation run could not be found.",
          completed_at:
            new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("user_id", user.id);

      return {
        success: false,
        error:
          "Automation run could not be found.",
        errorCode: "RUN_NOT_FOUND",
      };
    }

    /*
     * First save the plan itself.
     */
    const {
      error: savePlanError,
    } = await supabase
      .from("automation_tasks")
      .update({
        status: "planned",
        plan,
        error_code: null,
        error_message: null,
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    if (savePlanError) {
      console.error(
        "Unable to save automation plan:",
        savePlanError
      );

      return {
        success: false,
        error:
          "Unable to save automation plan.",
        errorCode: "PLAN_SAVE_FAILED",
      };
    }

    /*
     * If steps already exist for this run, remove them before recreating
     * the execution graph. This keeps planning idempotent for a queued/
     * planning task and prevents duplicate step rows.
     */
    const {
      data: existingSteps,
      error: existingStepsError,
    } = await supabase
      .from("automation_steps")
      .select("id")
      .eq("task_id", task.id)
      .eq("run_id", run.id);

    if (existingStepsError) {
      console.error(
        "Unable to inspect existing automation steps:",
        existingStepsError
      );

      return {
        success: false,
        error:
          "Unable to initialize automation steps.",
        errorCode: "STEP_INSPECTION_FAILED",
      };
    }

    if (existingSteps && existingSteps.length > 0) {
      const {
        error: deleteStepsError,
      } = await supabase
        .from("automation_steps")
        .delete()
        .eq("task_id", task.id)
        .eq("run_id", run.id);

      if (deleteStepsError) {
        console.error(
          "Unable to replace automation steps:",
          deleteStepsError
        );

        return {
          success: false,
          error:
            "Unable to initialize automation steps.",
          errorCode:
            "STEP_REPLACEMENT_FAILED",
        };
      }
    }

    /*
     * IMPORTANT:
     *
     * The planner uses dependency STEP NUMBERS:
     * [1, 2, 3]
     *
     * The database column automation_steps.dependencies is UUID[].
     *
     * Therefore we insert all steps first with empty UUID dependencies,
     * receive their database IDs, then map step numbers -> UUIDs and
     * update each step.
     */
    const stepRows = plan.steps.map(
      (step) => ({
        task_id: task.id,
        run_id: run.id,
        step_number: step.step_number,
        name: step.name,
        description: step.description,
        tool_name: step.tool_name,
        status:
          step.dependencies.length === 0
            ? "ready"
            : "queued",
        input: step.input,
        dependencies: [],
        max_retries: step.max_retries,
        retry_count: 0,
      })
    );

    const {
      data: insertedSteps,
      error: stepsError,
    } = await supabase
      .from("automation_steps")
      .insert(stepRows)
      .select("id, step_number");

    if (
      stepsError ||
      !insertedSteps ||
      insertedSteps.length !==
        plan.steps.length
    ) {
      console.error(
        "Unable to create automation steps:",
        stepsError
      );

      await supabase
        .from("automation_tasks")
        .update({
          status: "failed",
          error_code:
            "STEP_CREATION_FAILED",
          error_message:
            "Automation plan was created but execution steps could not be initialized.",
        })
        .eq("id", task.id)
        .eq("user_id", user.id);

      return {
        success: false,
        error:
          "Unable to initialize automation steps.",
        errorCode:
          "STEP_CREATION_FAILED",
      };
    }

    const stepIdByNumber =
      new Map<number, string>();

    for (const insertedStep of insertedSteps) {
      stepIdByNumber.set(
        insertedStep.step_number,
        insertedStep.id
      );
    }

    /*
     * Convert planner dependency numbers into actual step UUIDs.
     */
    for (const plannedStep of plan.steps) {
      const currentStepId =
        stepIdByNumber.get(
          plannedStep.step_number
        );

      if (!currentStepId) {
        await supabase
          .from("automation_tasks")
          .update({
            status: "failed",
            error_code:
              "DEPENDENCY_MAPPING_FAILED",
            error_message:
              "Automation step dependency mapping failed.",
            completed_at:
              new Date().toISOString(),
          })
          .eq("id", task.id)
          .eq("user_id", user.id);

        return {
          success: false,
          error:
            "Unable to configure automation dependencies.",
          errorCode:
            "DEPENDENCY_MAPPING_FAILED",
        };
      }

      const dependencyIds =
        plannedStep.dependencies
          .map((dependencyNumber) =>
            stepIdByNumber.get(
              dependencyNumber
            )
          )
          .filter(
            (id): id is string =>
              Boolean(id)
          );

      if (
        dependencyIds.length !==
        plannedStep.dependencies.length
      ) {
        await supabase
          .from("automation_tasks")
          .update({
            status: "failed",
            error_code:
              "INVALID_DEPENDENCY_REFERENCE",
            error_message:
              "Automation plan contains an invalid dependency reference.",
            completed_at:
              new Date().toISOString(),
          })
          .eq("id", task.id)
          .eq("user_id", user.id);

        return {
          success: false,
          error:
            "Automation plan contains an invalid dependency reference.",
          errorCode:
            "INVALID_DEPENDENCY_REFERENCE",
        };
      }

      const {
        error: dependencyError,
      } = await supabase
        .from("automation_steps")
        .update({
          dependencies: dependencyIds,
        })
        .eq("id", currentStepId)
        .eq("task_id", task.id)
        .eq("run_id", run.id);

      if (dependencyError) {
        console.error(
          "Automation dependency update failed:",
          dependencyError
        );

        await supabase
          .from("automation_tasks")
          .update({
            status: "failed",
            error_code:
              "DEPENDENCY_CONFIGURATION_FAILED",
            error_message:
              "Unable to configure automation dependencies.",
            completed_at:
              new Date().toISOString(),
          })
          .eq("id", task.id)
          .eq("user_id", user.id);

        return {
          success: false,
          error:
            "Unable to configure automation dependencies.",
          errorCode:
            "DEPENDENCY_CONFIGURATION_FAILED",
        };
      }
    }

    /*
     * Record planner/provider usage.
     */
    const {
      error: usageError,
    } = await supabase
      .from("automation_usage")
      .insert({
        user_id: user.id,
        task_id: task.id,
        run_id: run.id,
        provider: "groq",
        tool_name: "automation_planner",
        model: providerResult.model,
        input_tokens:
          providerResult.inputTokens,
        output_tokens:
          providerResult.outputTokens,
        total_tokens:
          providerResult.totalTokens,
        api_calls: 1,
        metadata: {
          phase: "planning",
          step_count: plan.steps.length,
        },
      });

    if (usageError) {
      console.error(
        "Unable to record automation planner usage:",
        usageError
      );
    }

    return {
      success: true,
      plan,
      usage: {
        provider: "groq",
        model: providerResult.model,
        input_tokens:
          providerResult.inputTokens,
        output_tokens:
          providerResult.outputTokens,
        total_tokens:
          providerResult.totalTokens,
      },
    };
  } catch (error) {
    console.error(
      "Automation planning failed:",
      error
    );

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        error_code: "PLANNER_FAILED",
        error_message:
          "Automation planning failed.",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return {
      success: false,
      error: "Automation planning failed.",
      errorCode: "PLANNER_FAILED",
    };
  }
}