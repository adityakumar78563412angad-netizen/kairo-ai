import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutomationTaskRow = {
  id: string;
  prompt: string | null;
  title: string | null;
  summary: string | null;
  status: string | null;
};

type AutomationRunRow = {
  id: string;
  task_id: string;
  status: string | null;
  result: unknown;
  error: string | null;
};

type AutomationStepRow = {
  id: string;
  task_id: string;
  run_id: string | null;
  step_number: number;
  name: string;
  description: string | null;
  tool_name: string;
  status: string | null;
  requires_approval: boolean | null;
  input: unknown;
  output: unknown;
  error: string | null;
};

function normalizeError(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return null;
}

function isCompletedStatus(status: string | null): boolean {
  return (
    status === "completed" ||
    status === "success"
  );
}

function isFailedStatus(status: string | null): boolean {
  return status === "failed";
}

function isWaitingApprovalStatus(status: string | null): boolean {
  return (
    status === "waiting_approval" ||
    status === "approval_required" ||
    status === "waiting"
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const taskId = searchParams.get("taskId")?.trim();
    const runId = searchParams.get("runId")?.trim();

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: "taskId is required",
          code: "INVALID_STATUS_REQUEST",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 1. Load task
     * ---------------------------------------------------------
     *
     * The task is the ownership boundary.
     *
     * We verify that this task belongs to the authenticated
     * user before loading its runs or steps.
     */
    const {
      data: task,
      error: taskError,
    } = await supabase
      .from("automation_tasks")
      .select(
        "id,prompt,title,summary,status"
      )
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle<AutomationTaskRow>();

    if (taskError) {
      console.error(
        "[Automation Status] Task query failed:",
        taskError
      );

      return NextResponse.json(
        {
          success: false,
          error: taskError.message,
          code: "TASK_QUERY_FAILED",
          details: taskError.code ?? null,
        },
        { status: 500 }
      );
    }

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: "Automation task not found",
          code: "TASK_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. Load automation run
     * ---------------------------------------------------------
     *
     * IMPORTANT:
     * automation_runs is intentionally NOT filtered by
     * user_id here.
     *
     * Ownership has already been verified through
     * automation_tasks.id + automation_tasks.user_id.
     */
    let run: AutomationRunRow | null = null;

    if (runId) {
      const {
        data,
        error,
      } = await supabase
        .from("automation_runs")
        .select(
          "id,task_id,status,result,error"
        )
        .eq("id", runId)
        .eq("task_id", taskId)
        .maybeSingle<AutomationRunRow>();

      if (error) {
        console.error(
          "[Automation Status] Run query failed:",
          error
        );

        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: "RUN_QUERY_FAILED",
            details: error.code ?? null,
          },
          { status: 500 }
        );
      }

      run = data;
    } else {
      const {
        data,
        error,
      } = await supabase
        .from("automation_runs")
        .select(
          "id,task_id,status,result,error"
        )
        .eq("task_id", taskId)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle<AutomationRunRow>();

      if (error) {
        console.error(
          "[Automation Status] Latest run query failed:",
          error
        );

        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: "LATEST_RUN_QUERY_FAILED",
            details: error.code ?? null,
          },
          { status: 500 }
        );
      }

      run = data;
    }

    /*
     * ---------------------------------------------------------
     * 3. Load automation steps
     * ---------------------------------------------------------
     */
    let stepsQuery = supabase
      .from("automation_steps")
      .select(
        "id,task_id,run_id,step_number,name,description,tool_name,status,requires_approval,input,output,error"
      )
      .eq("task_id", taskId)
      .order("step_number", {
        ascending: true,
      });

    if (run?.id) {
      stepsQuery = stepsQuery.eq(
        "run_id",
        run.id
      );
    }

    const {
      data: steps,
      error: stepsError,
    } = await stepsQuery.returns<
      AutomationStepRow[]
    >();

    if (stepsError) {
      console.error(
        "[Automation Status] Steps query failed:",
        stepsError
      );

      return NextResponse.json(
        {
          success: false,
          error: stepsError.message,
          code: "STEPS_QUERY_FAILED",
          details: stepsError.code ?? null,
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. Normalize steps
     * ---------------------------------------------------------
     */
    const normalizedSteps = (
      steps ?? []
    ).map((step) => ({
      id: step.id,
      step_number: step.step_number,
      name: step.name,
      description:
        step.description ?? "",
      tool_name: step.tool_name,
      status:
        step.status ?? "queued",
      requires_approval:
        Boolean(
          step.requires_approval
        ),
      input:
        step.input ?? null,
      output:
        step.output ?? null,
      error:
        normalizeError(step.error),
    }));

    /*
     * ---------------------------------------------------------
     * 5. Calculate progress
     * ---------------------------------------------------------
     */
    const completedSteps =
      normalizedSteps.filter((step) =>
        isCompletedStatus(step.status)
      ).length;

    const runningSteps =
      normalizedSteps.filter(
        (step) =>
          step.status === "running" ||
          step.status === "executing" ||
          step.status === "ready"
      ).length;

    const failedSteps =
      normalizedSteps.filter((step) =>
        isFailedStatus(step.status)
      ).length;

    const waitingSteps =
      normalizedSteps.filter((step) =>
        isWaitingApprovalStatus(
          step.status
        )
      ).length;

    const totalSteps =
      normalizedSteps.length;

    const progress =
      totalSteps > 0
        ? Math.round(
            (completedSteps /
              totalSteps) *
              100
          )
        : 0;

    /*
     * ---------------------------------------------------------
     * 6. Calculate overall state
     * ---------------------------------------------------------
     */
    const taskStatus =
      task.status ?? "unknown";

    const runStatus =
      run?.status ?? null;

    const completed =
      taskStatus === "completed" ||
      runStatus === "completed";

    const failed =
      taskStatus === "failed" ||
      runStatus === "failed" ||
      failedSteps > 0;

    const waitingApproval =
      taskStatus ===
        "waiting_approval" ||
      runStatus ===
        "waiting_approval" ||
      waitingSteps > 0;

    const terminal =
      completed || failed;

    /*
     * ---------------------------------------------------------
     * 7. Return live automation state
     * ---------------------------------------------------------
     */
    return NextResponse.json(
      {
        success: true,

        task: {
          id: task.id,
          prompt:
            task.prompt ?? "",
          title:
            task.title ?? null,
          summary:
            task.summary ?? null,
          status: taskStatus,
        },

        run: run
          ? {
              id: run.id,
              task_id:
                run.task_id,
              status:
                run.status ??
                "unknown",
              result:
                run.result ?? null,
              error:
                normalizeError(
                  run.error
                ),
            }
          : null,

        steps:
          normalizedSteps,

        progress: {
          completed:
            completedSteps,
          running:
            runningSteps,
          failed:
            failedSteps,
          waiting:
            waitingSteps,
          total:
            totalSteps,
          percentage:
            progress,
        },

        terminal,
        completed,
        failed,
        waiting_approval:
          waitingApproval,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[Automation Status] Unexpected error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unable to load automation status.";

    return NextResponse.json(
      {
        success: false,
        error: message,
        code:
          "AUTOMATION_STATUS_EXCEPTION",
      },
      { status: 500 }
    );
  }
}