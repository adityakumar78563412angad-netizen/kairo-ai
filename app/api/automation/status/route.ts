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
     * Load the task belonging to the
     * authenticated user.
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
     * Load the requested run when available.
     *
     * If runId is omitted, use the latest run
     * for this task.
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
        .eq("user_id", user.id)
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
        .eq("user_id", user.id)
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
          },
          { status: 500 }
        );
      }

      run = data;
    }

    /*
     * Load all steps for the task/run.
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
        },
        { status: 500 }
      );
    }

    const normalizedSteps = (
      steps ?? []
    ).map(step => ({
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
        normalizeError(
          step.error
        ),
    }));

    const completedSteps =
      normalizedSteps.filter(
        step =>
          step.status ===
            "completed" ||
          step.status === "success"
      ).length;

    const runningSteps =
      normalizedSteps.filter(
        step =>
          step.status ===
            "running" ||
          step.status === "executing"
      ).length;

    const failedSteps =
      normalizedSteps.filter(
        step =>
          step.status === "failed"
      ).length;

    const waitingSteps =
      normalizedSteps.filter(
        step =>
          step.status ===
            "waiting_approval" ||
          step.status ===
            "approval_required" ||
          step.status === "waiting"
      ).length;

    const totalSteps =
      normalizedSteps.length;

    let progress = 0;

    if (totalSteps > 0) {
      progress = Math.round(
        (completedSteps /
          totalSteps) *
          100
      );
    }

    const taskStatus =
      task.status ?? "unknown";

    const runStatus =
      run?.status ?? null;

    const completed =
      taskStatus === "completed" ||
      runStatus === "completed";

    const failed =
      taskStatus === "failed" ||
      runStatus === "failed";

    const waitingApproval =
      taskStatus ===
        "waiting_approval" ||
      runStatus ===
        "waiting_approval" ||
      waitingSteps > 0;

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
                run.result ??
                null,
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

        terminal:
          completed ||
          failed,

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
        code: "AUTOMATION_STATUS_EXCEPTION",
      },
      { status: 500 }
    );
  }
}