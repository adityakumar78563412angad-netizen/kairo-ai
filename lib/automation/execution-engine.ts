import { createServerSupabaseClient } from "@/lib/supabase-server";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

type AutomationStatus =
  | "queued"
  | "planning"
  | "planned"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

type AutomationStepStatus =
  | "queued"
  | "ready"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

type AutomationTask = {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  status: AutomationStatus;
  priority?: string | null;
  plan?: unknown;
  context?: unknown;
  result?: unknown;
  errors?: unknown;
  created_at: string;
  updated_at: string;
};

type AutomationRun = {
  id: string;
  task_id: string;
  user_id: string;
  run_number: number;
  status: AutomationStatus;
  trigger_type?: string | null;
  execution_context?: unknown;
  result?: unknown;
  errors?: unknown;
  created_at: string;
  updated_at: string;
};

type AutomationStep = {
  id: string;
  task_id: string;
  run_id: string;
  step_number: number;
  name: string;
  description?: string | null;
  tool_name?: string | null;
  status: AutomationStepStatus;
  input?: unknown;
  output?: unknown;
  dependencies?: string[] | null;
  retries?: number | null;
  errors?: unknown;
  started_at?: string | null;
  completed_at?: string | null;
};

type AutomationPlanStep = {
  step_number?: number;
  name?: string;
  description?: string;
  tool_name?: string;
  dependencies?: number[];
  max_retries?: number;
};

type ToolExecutionResult = {
  success: boolean;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
};

function safeObject(value: unknown): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getPlanSteps(plan: unknown): AutomationPlanStep[] {
  const planObject = safeObject(plan);

  const candidates = [
    planObject.steps,
    planObject.plan,
    planObject.actions,
    planObject.execution_plan,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    return candidate.map((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item)
      ) {
        return {};
      }

      const value = item as Record<string, unknown>;

      return {
        step_number:
          typeof value.step_number === "number"
            ? value.step_number
            : undefined,

        name:
          typeof value.name === "string"
            ? value.name
            : undefined,

        description:
          typeof value.description === "string"
            ? value.description
            : undefined,

        tool_name:
          typeof value.tool_name === "string"
            ? value.tool_name
            : undefined,

        dependencies: Array.isArray(value.dependencies)
          ? value.dependencies.filter(
              (dependency): dependency is number =>
                typeof dependency === "number"
            )
          : undefined,

        max_retries:
          typeof value.max_retries === "number"
            ? Math.max(0, Math.floor(value.max_retries))
            : undefined,
      };
    });
  }

  return [];
}

function isTerminalStatus(status: AutomationStatus) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  );
}

function isStepTerminal(status: AutomationStepStatus) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "skipped" ||
    status === "cancelled"
  );
}

function getMaxRetries(
  planStep: AutomationPlanStep | undefined,
  databaseRetries: number | null | undefined
) {
  if (
    planStep &&
    typeof planStep.max_retries === "number" &&
    Number.isFinite(planStep.max_retries)
  ) {
    return Math.max(
      0,
      Math.min(10, Math.floor(planStep.max_retries))
    );
  }

  if (
    typeof databaseRetries === "number" &&
    Number.isFinite(databaseRetries)
  ) {
    return Math.max(
      0,
      Math.min(10, Math.floor(databaseRetries))
    );
  }

  return 2;
}

async function getUserWithToken(
  supabase: ServerSupabaseClient,
  accessToken?: string
) {
  if (accessToken) {
    const { data, error } =
      await supabase.auth.getUser(accessToken);

    if (data.user) {
      return data.user;
    }

    if (error) {
      console.error(
        "Automation execution token auth error:",
        error
      );
    }
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error(
      "Automation execution cookie auth error:",
      error
    );
  }

  return data.user;
}

async function executeTool(
  step: AutomationStep,
  task: AutomationTask
): Promise<ToolExecutionResult> {
  const toolName = step.tool_name;

  if (!toolName) {
    return {
      success: false,
      error: "Automation step does not have a tool_name.",
    };
  }

  try {
    if (toolName === "web_search") {
      const module = await import(
        "@/lib/automation/tools/web-search"
      );

      const input = safeObject(step.input);

      const query =
        typeof input.query === "string" &&
        input.query.trim().length > 0
          ? input.query
          : task.prompt;

      const searchDepth =
        input.search_depth === "advanced"
          ? "advanced"
          : "basic";

      const topic =
        input.topic === "news"
          ? "news"
          : "general";

      const maxResults =
        typeof input.max_results === "number"
          ? Math.max(
              1,
              Math.min(10, Math.floor(input.max_results))
            )
          : 5;

      const result = await module.executeWebSearch({
        query,
        search_depth: searchDepth,
        topic,
        max_results: maxResults,
      });

      return {
        success: true,
        output: result,
      };
    }

    if (toolName === "web_research") {
      const module = await import(
        "@/lib/automation/tools/web-research"
      );

      const input = safeObject(step.input);

      const queries = Array.isArray(input.queries)
        ? input.queries.filter(
            (query): query is string =>
              typeof query === "string" &&
              query.trim().length > 0
          )
        : [];

      const fallbackQuery =
        typeof input.query === "string" &&
        input.query.trim().length > 0
          ? input.query
          : task.prompt;

      const finalQueries =
        queries.length > 0
          ? queries
          : [fallbackQuery];

      const maxResultsPerQuery =
        typeof input.max_results_per_query === "number"
          ? Math.max(
              1,
              Math.min(
                10,
                Math.floor(input.max_results_per_query)
              )
            )
          : 10;

      const result = await module.executeWebResearch({
        queries: finalQueries,
        max_results_per_query:
          maxResultsPerQuery,
      });

      return {
        success: true,
        output: result,
      };
    }

    return {
      success: false,
      error: `Tool "${toolName}" is not connected yet.`,
      metadata: {
        tool_name: toolName,
        task_id: task.id,
      },
    };
  } catch (error) {
    console.error(
      `Automation tool execution error [${toolName}]:`,
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown tool execution error.",
    };
  }
}

async function updateTask(
  supabase: ServerSupabaseClient,
  taskId: string,
  userId: string,
  values: Record<string, unknown>
) {
  const { error } = await supabase
    .from("automation_tasks")
    .update(values)
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateRun(
  supabase: ServerSupabaseClient,
  runId: string,
  userId: string,
  values: Record<string, unknown>
) {
  const { error } = await supabase
    .from("automation_runs")
    .update(values)
    .eq("id", runId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateStep(
  supabase: ServerSupabaseClient,
  stepId: string,
  runId: string,
  taskId: string,
  values: Record<string, unknown>
) {
  const { error } = await supabase
    .from("automation_steps")
    .update(values)
    .eq("id", stepId)
    .eq("run_id", runId)
    .eq("task_id", taskId);

  if (error) {
    throw new Error(error.message);
  }
}

async function loadTask(
  supabase: ServerSupabaseClient,
  taskId: string,
  userId: string
): Promise<AutomationTask> {
  const { data, error } = await supabase
    .from("automation_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "Automation task not found."
    );
  }

  return data as AutomationTask;
}

async function loadRun(
  supabase: ServerSupabaseClient,
  taskId: string,
  runId: string,
  userId: string
): Promise<AutomationRun> {
  const { data, error } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("id", runId)
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "Automation run not found."
    );
  }

  return data as AutomationRun;
}

async function loadSteps(
  supabase: ServerSupabaseClient,
  taskId: string,
  runId: string
): Promise<AutomationStep[]> {
  const { data, error } = await supabase
    .from("automation_steps")
    .select("*")
    .eq("task_id", taskId)
    .eq("run_id", runId)
    .order("step_number", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as AutomationStep[];
}

function dependenciesCompleted(
  step: AutomationStep,
  allSteps: AutomationStep[]
) {
  if (
    !step.dependencies ||
    step.dependencies.length === 0
  ) {
    return true;
  }

  return step.dependencies.every((dependencyId) => {
    const dependency = allSteps.find(
      (candidate) => candidate.id === dependencyId
    );

    return dependency?.status === "completed";
  });
}

function buildExecutionInput(
  step: AutomationStep,
  completedSteps: AutomationStep[]
) {
  const input = safeObject(step.input);

  return {
    ...input,
    automation: {
      step_id: step.id,
      step_number: step.step_number,
      task_id: step.task_id,
      run_id: step.run_id,
    },
    previous_steps: completedSteps.map(
      (previousStep) => ({
        step_number: previousStep.step_number,
        name: previousStep.name,
        tool_name: previousStep.tool_name,
        output: previousStep.output,
      })
    ),
  };
}

async function executeSingleStep(
  supabase: ServerSupabaseClient,
  task: AutomationTask,
  step: AutomationStep,
  allSteps: AutomationStep[]
) {
  const planSteps = getPlanSteps(task.plan);

  const planStep = planSteps.find(
    (candidate) =>
      candidate.step_number === step.step_number
  );

  const maxRetries = getMaxRetries(
    planStep,
    step.retries
  );

  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt += 1;

    const stepStartedAt =
      new Date().toISOString();

    await updateStep(
      supabase,
      step.id,
      step.run_id,
      step.task_id,
      {
        status: "running",
        started_at: stepStartedAt,
        errors: null,
      }
    );

    const completedSteps = allSteps.filter(
      (candidate) =>
        candidate.status === "completed" &&
        candidate.id !== step.id
    );

    const executionInput = buildExecutionInput(
      step,
      completedSteps
    );

    await updateStep(
      supabase,
      step.id,
      step.run_id,
      step.task_id,
      {
        input: executionInput,
      }
    );

    const result = await executeTool(
      {
        ...step,
        input: executionInput,
      },
      task
    );

    if (result.success) {
      await updateStep(
        supabase,
        step.id,
        step.run_id,
        step.task_id,
        {
          status: "completed",
          output: result.output ?? null,
          errors: null,
          retries: attempt - 1,
          completed_at:
            new Date().toISOString(),
        }
      );

      return {
        success: true,
        output: result.output,
        attempts: attempt,
      };
    }

    if (attempt > maxRetries) {
      await updateStep(
        supabase,
        step.id,
        step.run_id,
        step.task_id,
        {
          status: "failed",
          errors:
            result.error ||
            "Step execution failed.",
          retries: attempt - 1,
          completed_at:
            new Date().toISOString(),
        }
      );

      return {
        success: false,
        error:
          result.error ||
          "Step execution failed.",
        attempts: attempt,
      };
    }

    await updateStep(
      supabase,
      step.id,
      step.run_id,
      step.task_id,
      {
        retries: attempt,
        errors:
          result.error ||
          `Retrying automation step (${attempt}/${maxRetries}).`,
      }
    );
  }

  return {
    success: false,
    error: "Unexpected execution state.",
    attempts: attempt,
  };
}

export async function executeAutomationRun(
  taskId: string,
  runId: string,
  accessToken?: string
) {
  const supabase =
    await createServerSupabaseClient();

  const user = await getUserWithToken(
    supabase,
    accessToken
  );

  if (!user) {
    throw new Error("Authentication required.");
  }

  const userId = user.id;

  const task = await loadTask(
    supabase,
    taskId,
    userId
  );

  const run = await loadRun(
    supabase,
    taskId,
    runId,
    userId
  );

  let steps = await loadSteps(
    supabase,
    taskId,
    runId
  );

  if (isTerminalStatus(task.status)) {
    return {
      success: true,
      taskId,
      runId,
      status: task.status,
      message:
        "Automation is already in a terminal state.",
    };
  }

  await updateTask(
    supabase,
    taskId,
    userId,
    {
      status: "running",
      updated_at:
        new Date().toISOString(),
    }
  );

  await updateRun(
    supabase,
    runId,
    userId,
    {
      status: "running",
      updated_at:
        new Date().toISOString(),
    }
  );

  const planSteps = getPlanSteps(task.plan);

  if (
    steps.length === 0 &&
    planSteps.length > 0
  ) {
    const stepRows = planSteps.map(
      (planStep, index) => ({
        task_id: taskId,
        run_id: runId,
        step_number:
          planStep.step_number ||
          index + 1,
        name:
          planStep.name ||
          `Automation step ${index + 1}`,
        description:
          planStep.description || null,
        tool_name:
          planStep.tool_name || null,
        status:
          "queued" as AutomationStepStatus,
        input: {},
        dependencies: [],
        retries: 0,
      })
    );

    const { error } = await supabase
      .from("automation_steps")
      .insert(stepRows);

    if (error) {
      throw new Error(error.message);
    }

    steps = await loadSteps(
      supabase,
      taskId,
      runId
    );
  }

  if (steps.length === 0) {
    const result = {
      success: false,
      message:
        "Automation plan contains no executable steps.",
    };

    await updateTask(
      supabase,
      taskId,
      userId,
      {
        status: "failed",
        result,
        errors: result.message,
        updated_at:
          new Date().toISOString(),
      }
    );

    await updateRun(
      supabase,
      runId,
      userId,
      {
        status: "failed",
        result,
        errors: result.message,
        updated_at:
          new Date().toISOString(),
      }
    );

    return {
      success: false,
      taskId,
      runId,
      status:
        "failed" as AutomationStatus,
      result,
    };
  }

  let executionError: string | null =
    null;

  while (true) {
    steps = await loadSteps(
      supabase,
      taskId,
      runId
    );

    const failedStep = steps.find(
      (step) => step.status === "failed"
    );

    if (failedStep) {
      executionError =
        typeof failedStep.errors === "string"
          ? failedStep.errors
          : "An automation step failed.";

      break;
    }

    if (
      steps.every(
        (step) =>
          step.status === "completed"
      )
    ) {
      break;
    }

    const readySteps = steps.filter(
      (step) =>
        (step.status === "queued" ||
          step.status === "ready") &&
        dependenciesCompleted(
          step,
          steps
        )
    );

    if (readySteps.length === 0) {
      const waitingForDependencies =
        steps.some(
          (step) =>
            !isStepTerminal(
              step.status
            ) &&
            !dependenciesCompleted(
              step,
              steps
            )
        );

      if (waitingForDependencies) {
        await new Promise((resolve) =>
          setTimeout(resolve, 250)
        );

        continue;
      }

      executionError =
        "Automation could not determine the next executable step.";

      break;
    }

    for (const step of readySteps) {
      await updateStep(
        supabase,
        step.id,
        runId,
        taskId,
        {
          status: "ready",
        }
      );
    }

    const refreshedSteps =
      await loadSteps(
        supabase,
        taskId,
        runId
      );

    const refreshedReadySteps =
      refreshedSteps.filter(
        (step) =>
          (step.status === "ready" ||
            step.status === "queued") &&
          dependenciesCompleted(
            step,
            refreshedSteps
          )
      );

    if (
      refreshedReadySteps.length === 0
    ) {
      continue;
    }

    const results = await Promise.all(
      refreshedReadySteps.map(
        (step) =>
          executeSingleStep(
            supabase,
            task,
            step,
            refreshedSteps
          )
      )
    );

    const failedResult =
      results.find(
        (result) => !result.success
      );

    if (failedResult) {
      executionError =
        failedResult.error ||
        "Automation step execution failed.";

      break;
    }
  }

  steps = await loadSteps(
    supabase,
    taskId,
    runId
  );

  const successful = steps.every(
    (step) =>
      step.status === "completed"
  );

  if (!successful || executionError) {
    const result = {
      success: false,
      completed_steps:
        steps.filter(
          (step) =>
            step.status === "completed"
        ).length,
      total_steps: steps.length,
      error:
        executionError ||
        "One or more automation steps failed.",
    };

    await updateTask(
      supabase,
      taskId,
      userId,
      {
        status: "failed",
        result,
        errors: result.error,
        updated_at:
          new Date().toISOString(),
      }
    );

    await updateRun(
      supabase,
      runId,
      userId,
      {
        status: "failed",
        result,
        errors: result.error,
        updated_at:
          new Date().toISOString(),
      }
    );

    return {
      success: false,
      taskId,
      runId,
      status:
        "failed" as AutomationStatus,
      result,
    };
  }

  const finalResult = {
    success: true,
    completed_steps: steps.length,
    total_steps: steps.length,
    steps: steps.map(
      (step) => ({
        step_number:
          step.step_number,
        name: step.name,
        tool_name:
          step.tool_name,
        status: step.status,
        output: step.output,
      })
    ),
  };

  await updateTask(
    supabase,
    taskId,
    userId,
    {
      status: "completed",
      result: finalResult,
      errors: null,
      updated_at:
        new Date().toISOString(),
    }
  );

  await updateRun(
    supabase,
    runId,
    userId,
    {
      status: "completed",
      result: finalResult,
      errors: null,
      updated_at:
        new Date().toISOString(),
    }
  );

  return {
    success: true,
    taskId,
    runId,
    status:
      "completed" as AutomationStatus,
    result: finalResult,
  };
}