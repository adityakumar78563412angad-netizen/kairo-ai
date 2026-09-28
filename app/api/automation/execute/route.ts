import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { executeAutomationRun } from "@/lib/automation/execution-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let taskId: string | undefined;
  let runId: string | undefined;

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

    const body = await request.json();

    taskId =
      typeof body?.taskId === "string" && body.taskId.trim()
        ? body.taskId.trim()
        : undefined;

    runId =
      typeof body?.runId === "string" && body.runId.trim()
        ? body.runId.trim()
        : undefined;

    if (!taskId || !runId) {
      return NextResponse.json(
        {
          success: false,
          error: "taskId and runId are required",
          code: "INVALID_EXECUTION_REQUEST",
          taskId: taskId ?? null,
          runId: runId ?? null,
        },
        { status: 400 }
      );
    }

    console.log("[Automation Execute] Starting execution", {
      userId: user.id,
      taskId,
      runId,
    });

    const result = await executeAutomationRun(
      taskId,
      runId,
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
        undefined
    );

    console.log("[Automation Execute] Engine result", {
      taskId,
      runId,
      success: result?.success,
      status: result?.status,
      message: result?.message,
      result,
    });

    if (!result?.success) {
      const failureMessage =
        typeof result?.message === "string" && result.message.trim()
          ? result.message
          : "Automation execution failed";

      return NextResponse.json(
        {
          success: false,
          error: failureMessage,
          code: "AUTOMATION_EXECUTION_FAILED",
          taskId,
          runId,
          result,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        taskId,
        runId,
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Automation Execute] Unexpected error", {
      taskId,
      runId,
      error,
    });

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown automation execution error";

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: "AUTOMATION_EXECUTION_EXCEPTION",
        taskId: taskId ?? null,
        runId: runId ?? null,
      },
      { status: 500 }
    );
  }
}