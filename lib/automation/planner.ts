import { createServerSupabaseClient } from "@/lib/supabase-server";

export type AutomationPlanStep = {
  step_number: number;
  name: string;
  description: string;
  tool_name: string;
  input: Record<string, unknown>;
  dependencies: number[];
  requires_approval?: boolean;
};

export type AutomationPlan = {
  objective: string;
  steps: AutomationPlanStep[];
};

export type AutomationPlannerResult = {
  success: boolean;
  plan?: AutomationPlan;
  usage?: {
    provider: string;
    model: string;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: string;
  errorCode?: string;
};

const DEFAULT_MODEL =
  process.env.GROQ_AUTOMATION_PLANNER_MODEL ||
  "llama-3.3-70b-versatile";

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

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

type AllowedTool =
  (typeof ALLOWED_TOOLS)[number];

function isAllowedTool(
  value: unknown
): value is AllowedTool {
  return (
    typeof value === "string" &&
    (ALLOWED_TOOLS as readonly string[]).includes(
      value
    )
  );
}

function extractJson(
  content: string
): unknown {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace =
      cleaned.indexOf("{");

    const lastBrace =
      cleaned.lastIndexOf("}");

    if (
      firstBrace >= 0 &&
      lastBrace > firstBrace
    ) {
      return JSON.parse(
        cleaned.slice(
          firstBrace,
          lastBrace + 1
        )
      );
    }

    throw new Error(
      "Planner returned invalid JSON."
    );
  }
}

function normalizePlan(
  value: unknown
): AutomationPlan {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new Error(
      "Planner returned an invalid plan."
    );
  }

  const raw =
    value as Record<string, unknown>;

  const objective =
    typeof raw.objective === "string"
      ? raw.objective.trim()
      : "";

  const rawSteps =
    Array.isArray(raw.steps)
      ? raw.steps
      : [];

  if (!objective) {
    throw new Error(
      "Planner returned no objective."
    );
  }

  if (
    rawSteps.length === 0
  ) {
    throw new Error(
      "Planner returned no execution steps."
    );
  }

  if (rawSteps.length > 50) {
    throw new Error(
      "Automation plan cannot contain more than 50 steps."
    );
  }

  const steps: AutomationPlanStep[] =
    rawSteps.map(
      (rawStep, index) => {
        if (
          !rawStep ||
          typeof rawStep !== "object"
        ) {
          throw new Error(
            `Invalid automation step ${index + 1}.`
          );
        }

        const step =
          rawStep as Record<
            string,
            unknown
          >;

        const stepNumber =
          typeof step.step_number ===
          "number"
            ? Math.floor(
                step.step_number
              )
            : index + 1;

        const name =
          typeof step.name === "string"
            ? step.name.trim()
            : `Step ${stepNumber}`;

        const description =
          typeof step.description ===
          "string"
            ? step.description.trim()
            : "";

        const toolName =
          typeof step.tool_name ===
          "string"
            ? step.tool_name.trim()
            : "";

        if (!isAllowedTool(toolName)) {
          throw new Error(
            `Unsupported automation tool: ${toolName || "unknown"}`
          );
        }

        const input =
          step.input &&
          typeof step.input === "object" &&
          !Array.isArray(step.input)
            ? (step.input as Record<
                string,
                unknown
              >)
            : {};

        const dependencies =
          Array.isArray(
            step.dependencies
          )
            ? step.dependencies
                .filter(
                  (dependency) =>
                    typeof dependency ===
                    "number" &&
                    Number.isInteger(
                      dependency
                    )
                )
                .map((dependency) =>
                  Math.floor(
                    dependency
                  )
                )
            : [];

        const requiresApproval =
          step.requires_approval === true;

        return {
          step_number: stepNumber,
          name,
          description,
          tool_name: toolName,
          input,
          dependencies,
          requires_approval:
            requiresApproval,
        };
      }
    );

  /*
   * Normalize step numbers.
   */

  steps.forEach(
    (step, index) => {
      step.step_number =
        index + 1;
    }
  );

  /*
   * Remove invalid/self/future dependencies.
   */

  for (
    let index = 0;
    index < steps.length;
    index++
  ) {
    const currentStep =
      steps[index];

    currentStep.dependencies =
      currentStep.dependencies.filter(
        (dependency) =>
          dependency >= 1 &&
          dependency <= index &&
          dependency !==
            currentStep.step_number
      );
  }

  return {
    objective,
    steps,
  };
}

async function getAuthenticatedUser(
  accessToken?: string
) {
  const supabase =
    await createServerSupabaseClient();

  /*
   * Prefer explicit Bearer token.
   */

  if (accessToken) {
    const {
      data,
      error,
    } = await supabase.auth.getUser(
      accessToken
    );

    if (!error && data.user) {
      return {
        supabase,
        user: data.user,
      };
    }

    if (error) {
      console.error(
        "Automation planner token authentication error:",
        error
      );
    }
  }

  /*
   * Cookie fallback.
   */

  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error(
      "Automation planner cookie authentication error:",
      error
    );
  }

  return {
    supabase,
    user: data.user,
  };
}

export async function planAutomationTask(
  taskId: string,
  accessToken?: string
): Promise<AutomationPlannerResult> {
  if (!taskId) {
    return {
      success: false,
      error:
        "Automation task ID is required.",
      errorCode: "TASK_ID_REQUIRED",
    };
  }

  const {
    supabase,
    user,
  } =
    await getAuthenticatedUser(
      accessToken
    );

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
      errorCode: "AUTH_REQUIRED",
    };
  }

  /*
   * -------------------------------------------------------
   * LOAD TASK
   * -------------------------------------------------------
   */

  const {
    data: task,
    error: taskError,
  } = await supabase
    .from("automation_tasks")
    .select(
      "id, user_id, prompt, status, context"
    )
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();

  if (taskError || !task) {
    console.error(
      "Automation planner task lookup failed:",
      taskError
    );

    return {
      success: false,
      error:
        "Automation task was not found.",
      errorCode: "TASK_NOT_FOUND",
    };
  }

  /*
   * -------------------------------------------------------
   * UPDATE TASK TO PLANNING
   * -------------------------------------------------------
   */

  const {
    error: planningUpdateError,
  } = await supabase
    .from("automation_tasks")
    .update({
      status: "planning",
    })
    .eq("id", task.id)
    .eq("user_id", user.id);

  if (planningUpdateError) {
    console.error(
      "Automation planning status update failed:",
      planningUpdateError
    );
  }

  const apiKey =
    process.env.GROQ_API_KEY;

  if (!apiKey) {
    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        error_code:
          "GROQ_API_KEY_MISSING",
        error_message:
          "Groq API key is not configured.",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return {
      success: false,
      error:
        "Groq API key is not configured.",
      errorCode:
        "GROQ_API_KEY_MISSING",
    };
  }

  /*
   * -------------------------------------------------------
   * PLANNER SYSTEM PROMPT
   * -------------------------------------------------------
   */

  const systemPrompt = `
You are the ZUQEN Automation Planner.

Your job is to convert a user's natural-language automation
request into a safe, deterministic execution plan.

Return ONLY valid JSON.

Required JSON shape:

{
  "objective": "short description of the user's objective",
  "steps": [
    {
      "step_number": 1,
      "name": "short step name",
      "description": "what this step does",
      "tool_name": "one allowed tool",
      "input": {},
      "dependencies": [],
      "requires_approval": false
    }
  ]
}

Allowed tools:

${ALLOWED_TOOLS.join(", ")}

Rules:

1. Create only steps that are necessary.
2. Step numbers must be sequential.
3. Dependencies reference previous step numbers.
4. Independent steps may have no dependencies and can execute in parallel.
5. Do not invent tools.
6. Do not claim an external action has already happened.
7. For email sending, calendar changes, file writes, CRM mutations,
   notifications, purchases, account changes, or other consequential
   external actions, set requires_approval to true when appropriate.
8. Reading/searching information normally does not require approval.
9. Use web_search for a focused search.
10. Use web_research when multiple searches or broader research are needed.
11. Use browser for browser interaction when required.
12. Use http_request only when an external HTTP API is explicitly needed.
13. Keep each input object directly usable by the selected tool.
14. Never include Markdown.
15. Never include explanations outside the JSON object.
16. Do not create fake successful results.
17. If an action cannot be performed with the available tools,
    do not pretend it can.
18. Maximum 50 steps.
`;

  const userPrompt = `
User automation request:

${task.prompt}

Create the execution plan now.
`;

  /*
   * -------------------------------------------------------
   * GROQ PLANNER REQUEST
   * -------------------------------------------------------
   */

  let response: Response;

  try {
    response = await fetch(
      GROQ_API_URL,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${apiKey}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          temperature: 0,
          max_tokens: 5000,
          response_format: {
            type: "json_object",
          },
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
        signal:
          AbortSignal.timeout(60000),
      }
    );
  } catch (error) {
    console.error(
      "Automation planner Groq request failed:",
      error
    );

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        error_code:
          "PLANNER_PROVIDER_ERROR",
        error_message:
          "Automation planner provider request failed.",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return {
      success: false,
      error:
        "Automation planner provider request failed.",
      errorCode:
        "PLANNER_PROVIDER_ERROR",
    };
  }

  if (!response.ok) {
    const providerText =
      await response.text();

    console.error(
      "Automation planner Groq error:",
      response.status,
      providerText
    );

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        error_code:
          "PLANNER_PROVIDER_ERROR",
        error_message:
          "Automation planner provider returned an error.",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return {
      success: false,
      error:
        "Automation planner provider returned an error.",
      errorCode:
        "PLANNER_PROVIDER_ERROR",
    };
  }

  let providerData: any;

  try {
    providerData =
      await response.json();
  } catch {
    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        error_code:
          "PLANNER_INVALID_PROVIDER_RESPONSE",
        error_message:
          "Automation planner returned an invalid response.",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return {
      success: false,
      error:
        "Automation planner returned an invalid response.",
      errorCode:
        "PLANNER_INVALID_PROVIDER_RESPONSE",
    };
  }

  const content =
    providerData?.choices?.[0]?.message
      ?.content;

  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        error_code:
          "PLANNER_EMPTY_RESPONSE",
        error_message:
          "Automation planner returned no plan.",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return {
      success: false,
      error:
        "Automation planner returned no plan.",
      errorCode:
        "PLANNER_EMPTY_RESPONSE",
    };
  }

  /*
   * -------------------------------------------------------
   * PARSE PLAN
   * -------------------------------------------------------
   */

  let plan: AutomationPlan;

  try {
    const parsed =
      extractJson(content);

    plan =
      normalizePlan(parsed);
  } catch (error) {
    console.error(
      "Automation planner JSON parsing failed:",
      error
    );

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        error_code:
          "PLANNER_INVALID_PLAN",
        error_message:
          error instanceof Error
            ? error.message
            : "Planner returned an invalid plan.",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Planner returned an invalid plan.",
      errorCode:
        "PLANNER_INVALID_PLAN",
    };
  }

  /*
   * -------------------------------------------------------
   * SAVE PLAN
   * -------------------------------------------------------
   */

  const {
    error: planUpdateError,
  } = await supabase
    .from("automation_tasks")
    .update({
      status: "planned",
      plan,
    })
    .eq("id", task.id)
    .eq("user_id", user.id);

  if (planUpdateError) {
    console.error(
      "Automation plan save failed:",
      planUpdateError
    );

    return {
      success: false,
      error:
        "Unable to save automation plan.",
      errorCode:
        "PLAN_SAVE_FAILED",
    };
  }

  /*
   * -------------------------------------------------------
   * CREATE AUTOMATION STEPS
   * -------------------------------------------------------
   *
   * First create all steps without UUID dependencies.
   * Then resolve dependency step numbers to UUIDs.
   */

  const stepRows = plan.steps.map(
    (step) => ({
      task_id: task.id,
      step_number:
        step.step_number,
      name: step.name,
      description:
        step.description,
      tool_name:
        step.tool_name,
      status: "queued",
      input: step.input,
      output: {},
      dependencies: [],
      retry_count: 0,
      max_retries: 2,
    })
  );

  const {
    data: insertedSteps,
    error: stepsError,
  } = await supabase
    .from("automation_steps")
    .insert(stepRows)
    .select(
      "id, step_number"
    );

  if (
    stepsError ||
    !insertedSteps
  ) {
    console.error(
      "Automation steps creation failed:",
      stepsError
    );

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        error_code:
          "STEPS_CREATION_FAILED",
        error_message:
          "Unable to create automation execution steps.",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return {
      success: false,
      error:
        "Unable to create automation execution steps.",
      errorCode:
        "STEPS_CREATION_FAILED",
    };
  }

  /*
   * -------------------------------------------------------
   * RESOLVE DEPENDENCIES
   * -------------------------------------------------------
   */

  const stepIdByNumber =
    new Map<number, string>();

  for (const step of insertedSteps) {
    stepIdByNumber.set(
      step.step_number,
      step.id
    );
  }

  for (const planStep of plan.steps) {
    const stepId =
      stepIdByNumber.get(
        planStep.step_number
      );

    if (!stepId) {
      continue;
    }

    const dependencyIds =
      planStep.dependencies
        .map(
          (dependencyNumber) =>
            stepIdByNumber.get(
              dependencyNumber
            )
        )
        .filter(
          (
            dependencyId
          ): dependencyId is string =>
            Boolean(dependencyId)
        );

    if (
      dependencyIds.length === 0
    ) {
      continue;
    }

    const {
      error:
        dependencyUpdateError,
    } = await supabase
      .from("automation_steps")
      .update({
        dependencies:
          dependencyIds,
      })
      .eq("id", stepId)
      .eq("task_id", task.id);

    if (
      dependencyUpdateError
    ) {
      console.error(
        "Automation dependency update failed:",
        dependencyUpdateError
      );

      await supabase
        .from("automation_tasks")
        .update({
          status: "failed",
          error_code:
            "DEPENDENCY_UPDATE_FAILED",
          error_message:
            "Unable to configure automation step dependencies.",
          completed_at:
            new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("user_id", user.id);

      return {
        success: false,
        error:
          "Unable to configure automation step dependencies.",
        errorCode:
          "DEPENDENCY_UPDATE_FAILED",
      };
    }
  }

  /*
   * -------------------------------------------------------
   * USAGE
   * -------------------------------------------------------
   */

  const usage = {
    provider: "groq",
    model: DEFAULT_MODEL,
    input_tokens:
      providerData?.usage?.prompt_tokens,
    output_tokens:
      providerData?.usage?.completion_tokens,
    total_tokens:
      providerData?.usage?.total_tokens,
  };

  /*
   * Save planner usage.
   *
   * If usage logging fails, the actual automation plan
   * should still remain valid, so this is intentionally
   * non-fatal.
   */

  const {
    error: usageError,
  } = await supabase
    .from("automation_usage")
    .insert({
      user_id: user.id,
      task_id: task.id,
      provider: "groq",
      tool_name: "automation_planner",
      model: DEFAULT_MODEL,
      input_tokens:
        usage.input_tokens || 0,
      output_tokens:
        usage.output_tokens || 0,
      total_tokens:
        usage.total_tokens || 0,
      api_calls: 1,
      duration_ms: null,
      metadata: {
        type: "planner",
      },
    });

  if (usageError) {
    console.error(
      "Automation planner usage logging failed:",
      usageError
    );
  }

  return {
    success: true,
    plan,
    usage,
  };
}