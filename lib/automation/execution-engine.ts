
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  executeAutomationTool,
  type ToolExecutionContext,
} from "@/lib/automation/tool-router";

const MAX_EXECUTION_STEPS = 30;
const DEFAULT_STEP_TIMEOUT_MS = 60_000;
const MAX_STEP_TIMEOUT_MS = 120_000;

type AutomationStepStatus =
  | "queued"
  | "ready"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

type AutomationRunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

type AutomationStep = {
  id: string;
  task_id: string;
  run_id: string;
  step_number: number;
  name: string;
  description: string;
  tool_name: string;
  status: AutomationStepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  dependencies: string[];
  retry_count: number;
  max_retries: number;
};

type ExecuteAutomationResult =
  | {
      success: true;
      taskId: string;
      runId: string;
      status: AutomationRunStatus;
    }
  | {
      success: false;
      taskId?: string;
      runId?: string;
      status?: AutomationRunStatus;
      error: string;
      errorCode?: string;
    };

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("AUTOMATION_STEP_TIMEOUT"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function getStepTimeout(step: AutomationStep) {
  const configured = Number(step.input?.timeout_ms);

  if (!Number.isFinite(configured)) {
    return DEFAULT_STEP_TIMEOUT_MS;
  }

  return Math.min(
    Math.max(Math.floor(configured), 5_000),
    MAX_STEP_TIMEOUT_MS
  );
}

function dependenciesCompleted(
  step: AutomationStep,
  steps: AutomationStep[]
) {
  if (!step.dependencies?.length) {
    return true;
  }

  const dependencyIds = new Set(step.dependencies);

  const dependencies = steps.filter((candidate) =>
    dependencyIds.has(candidate.id)
  );

  if (dependencies.length !== step.dependencies.length) {
    return false;
  }

  return dependencies.every(
    (dependency) => dependency.status === "completed"
  );
}

function dependencyFailed(
  step: AutomationStep,
  steps: AutomationStep[]
) {
  if (!step.dependencies?.length) {
    return false;
  }

  const dependencyIds = new Set(step.dependencies);

  return steps
    .filter((candidate) => dependencyIds.has(candidate.id))
    .some(
      (dependency) =>
        dependency.status === "failed" ||
        dependency.status === "cancelled" ||
        dependency.status === "skipped"
    );
}

async function executeSingleStep(
  supabase: ServerSupabaseClient,
  step: AutomationStep,
  userId: string
): Promise<boolean> {
  const startedAt = Date.now();

  const { error: runningError } = await supabase
    .from("automation_steps")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq("id", step.id)
    .eq("task_id", step.task_id)
    .eq("run_id", step.run_id);

  if (runningError) {
    console.error(
      "Automation step running-state update failed:",
      runningError
    );

    return false;
  }

  const context: ToolExecutionContext = {
    taskId: step.task_id,
    runId: step.run_id,
    stepId: step.id,
    userId,
  };

  try {
    const result = await withTimeout(
      executeAutomationTool(
        {
          step_number: step.step_number,
          name: step.name,
          description: step.description,
          tool_name: step.tool_name as never,
          input: step.input || {},
          dependencies: [],
          requires_approval: false,
          max_retries: step.max_retries,
        },
        context
      ),
      getStepTimeout(step)
    );

    const durationMs = Date.now() - startedAt;

    if (!result.success) {
      const { error: stepError } = await supabase
        .from("automation_steps")
        .update({
          status: "failed",
          error_code: result.errorCode || "STEP_FAILED",
          error_message:
            result.error || "Automation step failed.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", step.id)
        .eq("task_id", step.task_id)
        .eq("run_id", step.run_id);

      if (stepError) {
        console.error(
          "Automation failed-step update failed:",
          stepError
        );
      }

      await supabase.from("automation_usage").insert({
        user_id: userId,
        task_id: step.task_id,
        run_id: step.run_id,
        step_id: step.id,
        tool_name: step.tool_name,
        api_calls: 1,
        duration_ms: durationMs,
        metadata: {
          phase: "execution",
          success: false,
          error_code: result.errorCode || "STEP_FAILED",
        },
      });

      return false;
    }

    const { error: completedError } = await supabase
      .from("automation_steps")
      .update({
        status: "completed",
        output: result.output || {},
        completed_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      })
      .eq("id", step.id)
      .eq("task_id", step.task_id)
      .eq("run_id", step.run_id);

    if (completedError) {
      console.error(
        "Automation completed-step update failed:",
        completedError
      );

      return false;
    }

    await supabase.from("automation_usage").insert({
      user_id: userId,
      task_id: step.task_id,
      run_id: step.run_id,
      step_id: step.id,
      tool_name: step.tool_name,
      api_calls: 1,
      duration_ms: durationMs,
      metadata: {
        phase: "execution",
        success: true,
      },
    });

    return true;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    const timeout =
      error instanceof Error &&
      error.message === "AUTOMATION_STEP_TIMEOUT";

    await supabase
      .from("automation_steps")
      .update({
        status: "failed",
        error_code: timeout
          ? "STEP_TIMEOUT"
          : "STEP_EXECUTION_ERROR",
        error_message: timeout
          ? "Automation step timed out."
          : "Automation step failed unexpectedly.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", step.id)
      .eq("task_id", step.task_id)
      .eq("run_id", step.run_id);

    await supabase.from("automation_usage").insert({
      user_id: userId,
      task_id: step.task_id,
      run_id: step.run_id,
      step_id: step.id,
      tool_name: step.tool_name,
      api_calls: 1,
      duration_ms: durationMs,
      metadata: {
        phase: "execution",
        success: false,
        timeout,
      },
    });

    return false;
  }
}

export async function executeAutomationRun(
  taskId: string,
  runId: string
): Promise<ExecuteAutomationResult> {
  if (!taskId || !runId) {
    return {
      success: false,
      error: "Task ID and run ID are required.",
      errorCode: "INVALID_RUN",
    };
  }

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error(
      "Automation execution authentication error:",
      userError
    );
  }

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
      errorCode: "AUTH_REQUIRED",
    };
  }

  const { data: task, error: taskError } = await supabase
    .from("automation_tasks")
    .select("id, user_id, status")
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

  const { data: run, error: runError } = await supabase
    .from("automation_runs")
    .select("id, task_id, user_id, status")
    .eq("id", runId)
    .eq("task_id", taskId)
    .eq("user_id", user.id)
    .single();

  if (runError || !run) {
    return {
      success: false,
      error: "Automation run not found.",
      errorCode: "RUN_NOT_FOUND",
    };
  }

  if (
    run.status === "completed" ||
    run.status === "cancelled"
  ) {
    return {
      success: true,
      taskId,
      runId,
      status: run.status as AutomationRunStatus,
    };
  }

  const { data: steps, error: stepsError } = await supabase
    .from("automation_steps")
    .select(
      "id, task_id, run_id, step_number, name, description, tool_name, status, input, output, dependencies, retry_count, max_retries"
    )
    .eq("task_id", taskId)
    .eq("run_id", runId)
    .order("step_number", { ascending: true });

  if (stepsError) {
    console.error(
      "Automation steps loading failed:",
      stepsError
    );

    return {
      success: false,
      taskId,
      runId,
      error: "Unable to load automation steps.",
      errorCode: "STEPS_LOAD_FAILED",
    };
  }

  const automationSteps =
    (steps || []) as unknown as AutomationStep[];

  if (
    automationSteps.length === 0 ||
    automationSteps.length > MAX_EXECUTION_STEPS
  ) {
    return {
      success: false,
      taskId,
      runId,
      error:
        "Automation run contains an invalid number of steps.",
      errorCode: "INVALID_STEP_COUNT",
    };
  }

  const startedAt = new Date().toISOString();

  await supabase
    .from("automation_runs")
    .update({
      status: "running",
      started_at: startedAt,
    })
    .eq("id", runId)
    .eq("task_id", taskId)
    .eq("user_id", user.id);

  await supabase
    .from("automation_tasks")
    .update({
      status: "running",
      started_at: startedAt,
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  let completedCount = 0;

  while (completedCount < automationSteps.length) {
    const { data: freshSteps, error: refreshError } =
      await supabase
        .from("automation_steps")
        .select(
          "id, task_id, run_id, step_number, name, description, tool_name, status, input, output, dependencies, retry_count, max_retries"
        )
        .eq("task_id", taskId)
        .eq("run_id", runId)
        .order("step_number", { ascending: true });

    if (refreshError || !freshSteps) {
      return {
        success: false,
        taskId,
        runId,
        status: "failed",
        error:
          "Unable to refresh automation execution state.",
        errorCode: "STATE_REFRESH_FAILED",
      };
    }

    const currentSteps =
      freshSteps as unknown as AutomationStep[];

    completedCount = currentSteps.filter(
      (step) => step.status === "completed"
    ).length;

    const waitingApproval = currentSteps.some(
      (step) => step.status === "waiting_approval"
    );

    if (waitingApproval) {
      await supabase
        .from("automation_runs")
        .update({
          status: "waiting_approval",
        })
        .eq("id", runId)
        .eq("task_id", taskId)
        .eq("user_id", user.id);

      await supabase
        .from("automation_tasks")
        .update({
          status: "waiting_approval",
        })
        .eq("id", taskId)
        .eq("user_id", user.id);

      return {
        success: true,
        taskId,
        runId,
        status: "waiting_approval",
      };
    }

    const failed = currentSteps.find(
      (step) => step.status === "failed"
    );

    if (failed) {
      const errorMessage = `Step ${failed.step_number} failed.`;

      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq("id", runId)
        .eq("task_id", taskId)
        .eq("user_id", user.id);

      await supabase
        .from("automation_tasks")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_code: "STEP_FAILED",
          error_message: errorMessage,
        })
        .eq("id", taskId)
        .eq("user_id", user.id);

      return {
        success: false,
        taskId,
        runId,
        status: "failed",
        error: errorMessage,
        errorCode: "STEP_FAILED",
      };
    }

    const readySteps = currentSteps.filter((step) => {
      if (
        step.status !== "queued" &&
        step.status !== "ready"
      ) {
        return false;
      }

      if (dependencyFailed(step, currentSteps)) {
        return false;
      }

      return dependenciesCompleted(step, currentSteps);
    });

    if (readySteps.length === 0) {
      const unresolved = currentSteps.some(
        (step) =>
          step.status === "queued" ||
          step.status === "ready"
      );

      if (unresolved) {
        const errorMessage =
          "Automation execution is blocked by unresolved dependencies.";

        await supabase
          .from("automation_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: errorMessage,
          })
          .eq("id", runId)
          .eq("task_id", taskId)
          .eq("user_id", user.id);

        await supabase
          .from("automation_tasks")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_code: "DEPENDENCY_DEADLOCK",
            error_message: errorMessage,
          })
          .eq("id", taskId)
          .eq("user_id", user.id);

        return {
          success: false,
          taskId,
          runId,
          status: "failed",
          error: errorMessage,
          errorCode: "DEPENDENCY_DEADLOCK",
        };
      }

      break;
    }

    const results = await Promise.all(
      readySteps.map(async (step) => {
        const success = await executeSingleStep(
          supabase,
          step,
          user.id
        );

        return {
          stepId: step.id,
          success,
        };
      })
    );

    const anyFailed = results.some(
      (result) => !result.success
    );

    if (anyFailed) {
      const failedResults = results.filter(
        (result) => !result.success
      );

      let retryScheduled = false;

      for (const failedResult of failedResults) {
        const originalStep = currentSteps.find(
          (step) => step.id === failedResult.stepId
        );

        if (
          originalStep &&
          originalStep.retry_count < originalStep.max_retries
        ) {
          await supabase
            .from("automation_steps")
            .update({
              status: "ready",
              retry_count: originalStep.retry_count + 1,
              error_code: null,
              error_message: null,
            })
            .eq("id", originalStep.id)
            .eq("task_id", taskId)
            .eq("run_id", runId);

          retryScheduled = true;
        }
      }

      if (retryScheduled) {
        continue;
      }

      const errorMessage =
        "One or more automation steps failed.";

      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq("id", runId)
        .eq("task_id", taskId)
        .eq("user_id", user.id);

      await supabase
        .from("automation_tasks")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_code: "STEP_FAILED",
          error_message: errorMessage,
        })
        .eq("id", taskId)
        .eq("user_id", user.id);

      return {
        success: false,
        taskId,
        runId,
        status: "failed",
        error: errorMessage,
        errorCode: "STEP_FAILED",
      };
    }
  }

  await supabase
    .from("automation_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("task_id", taskId)
    .eq("user_id", user.id);

  await supabase
    .from("automation_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  return {
    success: true,
    taskId,
    runId,
    status: "completed",
  };
}