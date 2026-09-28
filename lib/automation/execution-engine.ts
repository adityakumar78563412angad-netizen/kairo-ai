import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { AutomationPlanStep } from "@/lib/automation/planner";
import { executeAutomationTool } from "@/lib/automation/tool-router";

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

type ToolExecutionResult = {
  success: boolean;
  output?: unknown;
  error?: string;
  errorCode?: string;
};

/**
 * The planner's AutomationPlanStep is the canonical type.
 *
 * planner.ts currently requires:
 * - step_number
 * - name
 * - description
 * - tool_name
 * - input
 * - depends_on
 * - requires_approval
 *
 * Persisted JSON can still be malformed or missing optional values,
 * so planner output is normalized before execution.
 */

function safeObject(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizePlanStep(
  value: unknown,
  fallbackStepNumber: number
): AutomationPlanStep {
  const object = safeObject(value);

  const stepNumber =
    typeof object.step_number === "number" &&
    Number.isFinite(object.step_number)
      ? Math.floor(object.step_number)
      : fallbackStepNumber;

  const name =
    typeof object.name === "string" &&
    object.name.trim().length > 0
      ? object.name.trim()
      : `Automation step ${fallbackStepNumber}`;

  const description =
    typeof object.description === "string"
      ? object.description
      : "";

  const toolName =
    typeof object.tool_name === "string"
      ? object.tool_name
      : typeof object.tool === "string"
        ? object.tool
        : "";

  const input =
    object.input &&
    typeof object.input === "object" &&
    !Array.isArray(object.input)
      ? (object.input as Record<string, unknown>)
      : {};

  const rawDependencies = Array.isArray(
    object.depends_on
  )
    ? object.depends_on
    : Array.isArray(object.dependencies)
      ? object.dependencies
      : [];

  const dependsOn: number[] =
    rawDependencies
      .filter(
        (
          dependency: unknown
        ): dependency is number =>
          typeof dependency === "number" &&
          Number.isFinite(dependency)
      )
      .map(
        (dependency: number) =>
          Math.floor(dependency)
      );

  const requiresApproval =
    typeof object.requires_approval ===
    "boolean"
      ? object.requires_approval
      : false;

  const maxRetries =
    typeof object.max_retries === "number" &&
    Number.isFinite(object.max_retries)
      ? Math.max(
          0,
          Math.min(
            10,
            Math.floor(
              object.max_retries
            )
          )
        )
      : undefined;

  const normalized = {
    step_number: stepNumber,
    name,
    description,
    tool_name: toolName,
    input,
    depends_on: dependsOn,
    requires_approval:
      requiresApproval,
    ...(maxRetries !== undefined
      ? {
          max_retries:
            maxRetries,
        }
      : {}),
  };

  return normalized as AutomationPlanStep;
}

function getPlanSteps(
  plan: unknown
): AutomationPlanStep[] {
  const planObject =
    safeObject(plan);

  const candidates = [
    planObject.steps,
    planObject.plan,
    planObject.actions,
    planObject.execution_plan,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      !Array.isArray(candidate)
    ) {
      continue;
    }

    return candidate.map(
      (
        item: unknown,
        index: number
      ) =>
        normalizePlanStep(
          item,
          index + 1
        )
    );
  }

  return [];
}

function isTerminalStatus(
  status: AutomationStatus
): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  );
}

function isStepTerminal(
  status: AutomationStepStatus
): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "skipped" ||
    status === "cancelled"
  );
}

function getMaxRetries(
  planStep:
    | AutomationPlanStep
    | undefined,
  databaseRetries:
    | number
    | null
    | undefined
): number {
  const planStepWithRetries =
    planStep as
      | (AutomationPlanStep & {
          max_retries?: unknown;
        })
      | undefined;

  if (
    planStepWithRetries &&
    typeof planStepWithRetries.max_retries ===
      "number" &&
    Number.isFinite(
      planStepWithRetries.max_retries
    )
  ) {
    return Math.max(
      0,
      Math.min(
        10,
        Math.floor(
          planStepWithRetries.max_retries
        )
      )
    );
  }

  if (
    typeof databaseRetries ===
      "number" &&
    Number.isFinite(
      databaseRetries
    )
  ) {
    return Math.max(
      0,
      Math.min(
        10,
        Math.floor(
          databaseRetries
        )
      )
    );
  }

  return 2;
}

async function getUserWithToken(
  supabase: ServerSupabaseClient,
  accessToken?: string
) {
  if (accessToken) {
    const {
      data,
      error,
    } =
      await supabase.auth.getUser(
        accessToken
      );

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

  const {
    data,
    error,
  } =
    await supabase.auth.getUser();

  if (error) {
    console.error(
      "Automation execution cookie auth error:",
      error
    );
  }

  return data.user;
}

async function updateTask(
  supabase: ServerSupabaseClient,
  taskId: string,
  userId: string,
  values: Record<
    string,
    unknown
  >
) {
  const { error } =
    await supabase
      .from(
        "automation_tasks"
      )
      .update(values)
      .eq(
        "id",
        taskId
      )
      .eq(
        "user_id",
        userId
      );

  if (error) {
    throw new Error(
      error.message
    );
  }
}

async function updateRun(
  supabase: ServerSupabaseClient,
  runId: string,
  userId: string,
  values: Record<
    string,
    unknown
  >
) {
  const { error } =
    await supabase
      .from(
        "automation_runs"
      )
      .update(values)
      .eq(
        "id",
        runId
      )
      .eq(
        "user_id",
        userId
      );

  if (error) {
    throw new Error(
      error.message
    );
  }
}

async function updateStep(
  supabase: ServerSupabaseClient,
  stepId: string,
  runId: string,
  taskId: string,
  values: Record<
    string,
    unknown
  >
) {
  const { error } =
    await supabase
      .from(
        "automation_steps"
      )
      .update(values)
      .eq(
        "id",
        stepId
      )
      .eq(
        "run_id",
        runId
      )
      .eq(
        "task_id",
        taskId
      );

  if (error) {
    throw new Error(
      error.message
    );
  }
}

async function loadTask(
  supabase: ServerSupabaseClient,
  taskId: string,
  userId: string
): Promise<AutomationTask> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "automation_tasks"
      )
      .select("*")
      .eq(
        "id",
        taskId
      )
      .eq(
        "user_id",
        userId
      )
      .single();

  if (
    error ||
    !data
  ) {
    throw new Error(
      error?.message ||
        "Automation task not found."
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
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "automation_runs"
      )
      .select("*")
      .eq(
        "id",
        runId
      )
      .eq(
        "task_id",
        taskId
      )
      .eq(
        "user_id",
        userId
      )
      .single();

  if (
    error ||
    !data
  ) {
    throw new Error(
      error?.message ||
        "Automation run not found."
    );
  }

  return data as AutomationRun;
}

async function loadSteps(
  supabase: ServerSupabaseClient,
  taskId: string,
  runId: string
): Promise<AutomationStep[]> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "automation_steps"
      )
      .select("*")
      .eq(
        "task_id",
        taskId
      )
      .eq(
        "run_id",
        runId
      )
      .order(
        "step_number",
        {
          ascending: true,
        }
      );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return (data ||
    []) as AutomationStep[];
}

function dependenciesCompleted(
  step: AutomationStep,
  allSteps: AutomationStep[]
): boolean {
  if (
    !step.dependencies ||
    step.dependencies.length ===
      0
  ) {
    return true;
  }

  return step.dependencies.every(
    (
      dependencyId: string
    ) => {
      const dependency =
        allSteps.find(
          (
            candidate: AutomationStep
          ) =>
            candidate.id ===
            dependencyId
        );

      return (
        dependency?.status ===
        "completed"
      );
    }
  );
}

function buildExecutionInput(
  step: AutomationStep,
  completedSteps: AutomationStep[]
) {
  const input =
    safeObject(step.input);

  return {
    ...input,

    automation: {
      step_id:
        step.id,
      step_number:
        step.step_number,
      task_id:
        step.task_id,
      run_id:
        step.run_id,
    },

    previous_steps:
      completedSteps.map(
        (
          previousStep: AutomationStep
        ) => ({
          step_number:
            previousStep.step_number,
          name:
            previousStep.name,
          tool_name:
            previousStep.tool_name,
          output:
            previousStep.output,
        })
      ),
  };
}

async function executeTool(
  step: AutomationStep,
  task: AutomationTask,
  userId: string
): Promise<ToolExecutionResult> {
  if (
    !step.tool_name
  ) {
    return {
      success: false,
      error:
        "Automation step does not have a tool_name.",
      errorCode:
        "MISSING_TOOL_NAME",
    };
  }

  try {
    const planStep =
      normalizePlanStep(
        {
          step_number:
            step.step_number,
          name:
            step.name,
          description:
            step.description ||
            "",
          tool_name:
            step.tool_name,
          input:
            step.input,
          depends_on: [],
          requires_approval:
            false,
        },
        step.step_number
      );

    const result =
      await executeAutomationTool(
        planStep,
        {
          taskId:
            task.id,
          runId:
            step.run_id,
          stepId:
            step.id,
          userId,
        }
      );

    return result;
  } catch (
    error
  ) {
    console.error(
      `Automation tool execution error [${step.tool_name}]:`,
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown tool execution error.",
      errorCode:
        "TOOL_EXECUTION_FAILED",
    };
  }
}

async function executeSingleStep(
  supabase: ServerSupabaseClient,
  task: AutomationTask,
  step: AutomationStep,
  allSteps: AutomationStep[],
  userId: string
) {
  const planSteps =
    getPlanSteps(
      task.plan
    );

  const planStep =
    planSteps.find(
      (
        candidate: AutomationPlanStep
      ) =>
        candidate.step_number ===
        step.step_number
    );

  const maxRetries =
    getMaxRetries(
      planStep,
      step.retries
    );

  if (
    planStep?.requires_approval
  ) {
    await updateStep(
      supabase,
      step.id,
      step.run_id,
      step.task_id,
      {
        status:
          "waiting_approval",
        errors:
          null,
      }
    );

    return {
      success: false,
      error:
        "This automation step requires approval before execution.",
      errorCode:
        "APPROVAL_REQUIRED",
      attempts: 0,
    };
  }

  let attempt = 0;

  while (
    attempt <= maxRetries
  ) {
    attempt += 1;

    await updateStep(
      supabase,
      step.id,
      step.run_id,
      step.task_id,
      {
        status:
          "running",
        started_at:
          new Date().toISOString(),
        errors:
          null,
      }
    );

    const completedSteps =
      allSteps.filter(
        (
          candidate: AutomationStep
        ) =>
          candidate.status ===
            "completed" &&
          candidate.id !==
            step.id
      );

    const executionInput =
      buildExecutionInput(
        step,
        completedSteps
      );

    await updateStep(
      supabase,
      step.id,
      step.run_id,
      step.task_id,
      {
        input:
          executionInput,
      }
    );

    const executionStep:
      AutomationStep =
      {
        ...step,
        input:
          executionInput,
      };

    const result =
      await executeTool(
        executionStep,
        task,
        userId
      );

    if (
      result.success
    ) {
      await updateStep(
        supabase,
        step.id,
        step.run_id,
        step.task_id,
        {
          status:
            "completed",
          output:
            result.output ??
            null,
          errors:
            null,
          retries:
            attempt - 1,
          completed_at:
            new Date().toISOString(),
        }
      );

      return {
        success: true,
        output:
          result.output,
        attempts:
          attempt,
      };
    }

    if (
      result.errorCode ===
      "APPROVAL_REQUIRED"
    ) {
      await updateStep(
        supabase,
        step.id,
        step.run_id,
        step.task_id,
        {
          status:
            "waiting_approval",
          errors:
            result.error ||
            "Approval required.",
          retries:
            attempt - 1,
        }
      );

      return {
        success: false,
        error:
          result.error ||
          "Approval required.",
        errorCode:
          "APPROVAL_REQUIRED",
        attempts:
          attempt,
      };
    }

    if (
      attempt >
      maxRetries
    ) {
      await updateStep(
        supabase,
        step.id,
        step.run_id,
        step.task_id,
        {
          status:
            "failed",
          errors:
            result.error ||
            "Step execution failed.",
          retries:
            attempt - 1,
          completed_at:
            new Date().toISOString(),
        }
      );

      return {
        success: false,
        error:
          result.error ||
          "Step execution failed.",
        errorCode:
          result.errorCode,
        attempts:
          attempt,
      };
    }

    await updateStep(
      supabase,
      step.id,
      step.run_id,
      step.task_id,
      {
        retries:
          attempt,
        errors:
          result.error ||
          `Retrying automation step (${attempt}/${maxRetries}).`,
      }
    );
  }

  return {
    success: false,
    error:
      "Unexpected execution state.",
    attempts:
      attempt,
  };
}

export async function executeAutomationRun(
  taskId: string,
  runId: string,
  accessToken?: string
) {
  const supabase =
    await createServerSupabaseClient();

  const user =
    await getUserWithToken(
      supabase,
      accessToken
    );

  if (!user) {
    throw new Error(
      "Authentication required."
    );
  }

  const userId =
    user.id;

  const task =
    await loadTask(
      supabase,
      taskId,
      userId
    );

  await loadRun(
    supabase,
    taskId,
    runId,
    userId
  );

  let steps =
    await loadSteps(
      supabase,
      taskId,
      runId
    );

  if (
    isTerminalStatus(
      task.status
    )
  ) {
    return {
      success: true,
      taskId,
      runId,
      status:
        task.status,
      message:
        "Automation is already in a terminal state.",
    };
  }

  await updateTask(
    supabase,
    taskId,
    userId,
    {
      status:
        "running",
      updated_at:
        new Date().toISOString(),
    }
  );

  await updateRun(
    supabase,
    runId,
    userId,
    {
      status:
        "running",
      updated_at:
        new Date().toISOString(),
    }
  );

  const planSteps =
    getPlanSteps(
      task.plan
    );

  if (
    steps.length === 0 &&
    planSteps.length > 0
  ) {
    const stepRows =
      planSteps.map(
        (
          planStep: AutomationPlanStep,
          index: number
        ) => ({
          task_id:
            taskId,
          run_id:
            runId,
          step_number:
            planStep.step_number ||
            index + 1,
          name:
            planStep.name ||
            `Automation step ${index + 1}`,
          description:
            planStep.description ||
            null,
          tool_name:
            planStep.tool_name ||
            null,
          status:
            "queued" as AutomationStepStatus,
          input:
            planStep.input &&
            typeof planStep.input ===
              "object"
              ? planStep.input
              : {},
          dependencies:
            [],
          retries:
            0,
        })
      );

    const {
      error,
    } =
      await supabase
        .from(
          "automation_steps"
        )
        .insert(
          stepRows
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    steps =
      await loadSteps(
        supabase,
        taskId,
        runId
      );

    /**
     * Planner dependencies use step numbers.
     *
     * Database dependencies use step UUIDs.
     *
     * Convert:
     *   depends_on: [1, 2]
     *
     * into:
     *   dependencies: ["uuid-of-step-1", "uuid-of-step-2"]
     */
    for (
      const step of steps
    ) {
      const planStep =
        planSteps.find(
          (
            candidate: AutomationPlanStep
          ) =>
            candidate.step_number ===
            step.step_number
        );

      const dependencyNumbers: number[] =
        planStep?.depends_on ??
        [];

      if (
        dependencyNumbers.length ===
        0
      ) {
        continue;
      }

      const dependencyIds: string[] =
        dependencyNumbers
          .map(
            (
              dependencyNumber: number
            ) =>
              steps.find(
                (
                  candidate: AutomationStep
                ) =>
                  candidate.step_number ===
                  dependencyNumber
              )?.id
          )
          .filter(
            (
              id: string | undefined
            ): id is string =>
              Boolean(id)
          );

      await updateStep(
        supabase,
        step.id,
        runId,
        taskId,
        {
          dependencies:
            dependencyIds,
        }
      );
    }

    steps =
      await loadSteps(
        supabase,
        taskId,
        runId
      );
  }

  if (
    steps.length ===
    0
  ) {
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
        status:
          "failed",
        result,
        errors:
          result.message,
        updated_at:
          new Date().toISOString(),
      }
    );

    await updateRun(
      supabase,
      runId,
      userId,
      {
        status:
          "failed",
        result,
        errors:
          result.message,
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

  let executionError:
    | string
    | null = null;

  while (true) {
    steps =
      await loadSteps(
        supabase,
        taskId,
        runId
      );

    const failedStep =
      steps.find(
        (
          step: AutomationStep
        ) =>
          step.status ===
          "failed"
      );

    if (
      failedStep
    ) {
      executionError =
        typeof failedStep.errors ===
        "string"
          ? failedStep.errors
          : "An automation step failed.";

      break;
    }

    const approvalStep =
      steps.find(
        (
          step: AutomationStep
        ) =>
          step.status ===
          "waiting_approval"
      );

    if (
      approvalStep
    ) {
      await updateTask(
        supabase,
        taskId,
        userId,
        {
          status:
            "waiting_approval",
          updated_at:
            new Date().toISOString(),
        }
      );

      await updateRun(
        supabase,
        runId,
        userId,
        {
          status:
            "waiting_approval",
          updated_at:
            new Date().toISOString(),
        }
      );

      return {
        success: true,
        taskId,
        runId,
        status:
          "waiting_approval" as AutomationStatus,
        message:
          "Automation is waiting for approval before continuing.",
        waiting_step_id:
          approvalStep.id,
        waiting_step_number:
          approvalStep.step_number,
      };
    }

    if (
      steps.length > 0 &&
      steps.every(
        (
          step: AutomationStep
        ) =>
          step.status ===
          "completed"
      )
    ) {
      break;
    }

    const readySteps =
      steps.filter(
        (
          step: AutomationStep
        ) =>
          (
            step.status ===
              "queued" ||
            step.status ===
              "ready"
          ) &&
          dependenciesCompleted(
            step,
            steps
          )
      );

    if (
      readySteps.length ===
      0
    ) {
      const waitingForDependencies =
        steps.some(
          (
            step: AutomationStep
          ) =>
            !isStepTerminal(
              step.status
            ) &&
            !dependenciesCompleted(
              step,
              steps
            )
        );

      if (
        waitingForDependencies
      ) {
        await new Promise(
          (
            resolve
          ) =>
            setTimeout(
              resolve,
              250
            )
        );

        continue;
      }

      executionError =
        "Automation could not determine the next executable step.";

      break;
    }

    for (
      const step of readySteps
    ) {
      await updateStep(
        supabase,
        step.id,
        runId,
        taskId,
        {
          status:
            "ready",
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
        (
          step: AutomationStep
        ) =>
          (
            step.status ===
              "ready" ||
            step.status ===
              "queued"
          ) &&
          dependenciesCompleted(
            step,
            refreshedSteps
          )
      );

    if (
      refreshedReadySteps.length ===
      0
    ) {
      continue;
    }

    const results =
      await Promise.all(
        refreshedReadySteps.map(
          (
            step: AutomationStep
          ) =>
            executeSingleStep(
              supabase,
              task,
              step,
              refreshedSteps,
              userId
            )
        )
      );

    const failedResult =
      results.find(
        (
          result
        ) =>
          !result.success
      );

    if (
      failedResult
    ) {
      executionError =
        failedResult.error ||
        "Automation step execution failed.";

      break;
    }
  }

  steps =
    await loadSteps(
      supabase,
      taskId,
      runId
    );

  const successful =
    steps.length > 0 &&
    steps.every(
      (
        step: AutomationStep
      ) =>
        step.status ===
        "completed"
    );

  if (
    !successful ||
    executionError
  ) {
    const result = {
      success: false,
      completed_steps:
        steps.filter(
          (
            step: AutomationStep
          ) =>
            step.status ===
            "completed"
        ).length,
      total_steps:
        steps.length,
      error:
        executionError ||
        "One or more automation steps failed.",
    };

    await updateTask(
      supabase,
      taskId,
      userId,
      {
        status:
          "failed",
        result,
        errors:
          result.error,
        updated_at:
          new Date().toISOString(),
      }
    );

    await updateRun(
      supabase,
      runId,
      userId,
      {
        status:
          "failed",
        result,
        errors:
          result.error,
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
    completed_steps:
      steps.length,
    total_steps:
      steps.length,
    steps:
      steps.map(
        (
          step: AutomationStep
        ) => ({
          step_number:
            step.step_number,
          name:
            step.name,
          tool_name:
            step.tool_name,
          status:
            step.status,
          output:
            step.output,
        })
      ),
  };

  await updateTask(
    supabase,
    taskId,
    userId,
    {
      status:
        "completed",
      result:
        finalResult,
      errors:
        null,
      updated_at:
        new Date().toISOString(),
    }
  );

  await updateRun(
    supabase,
    runId,
    userId,
    {
      status:
        "completed",
      result:
        finalResult,
      errors:
        null,
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
    result:
      finalResult,
  };
}