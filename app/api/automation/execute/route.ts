
import { NextResponse } from "next/server";
import { executeAutomationRun } from "@/lib/automation/execution-engine";

export const runtime = "nodejs";

const MAX_BODY_SIZE = 12000;

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return undefined;
  }

  if (!authorization.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorization.slice(7).trim();

  return token || undefined;
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || undefined;
}

export async function POST(request: Request) {
  let taskId: string | undefined;
  let runId: string | undefined;

  try {
    /*
     * -------------------------------------------------------
     * REQUEST SIZE
     * -------------------------------------------------------
     */

    const contentLength = request.headers.get("content-length");

    if (contentLength) {
      const size = Number(contentLength);

      if (
        Number.isFinite(size) &&
        size > MAX_BODY_SIZE
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Request body is too large.",
            errorCode: "REQUEST_TOO_LARGE",
          },
          { status: 413 }
        );
      }
    }

    /*
     * -------------------------------------------------------
     * AUTHENTICATION
     * -------------------------------------------------------
     *
     * The execution engine supports both:
     *
     * Authorization: Bearer <supabase_access_token>
     *
     * and the normal Supabase cookie session.
     */

    const accessToken = getBearerToken(request);

    /*
     * -------------------------------------------------------
     * REQUEST BODY
     * -------------------------------------------------------
     */

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request.",
          errorCode: "INVALID_JSON",
        },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
          errorCode: "INVALID_BODY",
        },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;

    /*
     * -------------------------------------------------------
     * TASK / RUN IDENTIFIERS
     * -------------------------------------------------------
     */

    taskId =
      getString(payload.taskId) ??
      getString(payload.task_id);

    runId =
      getString(payload.runId) ??
      getString(payload.run_id);

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: "Automation task ID is required.",
          errorCode: "TASK_ID_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (!runId) {
      return NextResponse.json(
        {
          success: false,
          error: "Automation run ID is required.",
          errorCode: "RUN_ID_REQUIRED",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * EXECUTION
     * -------------------------------------------------------
     */

    const result = await executeAutomationRun(
      taskId,
      runId,
      accessToken
    );

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    });
  } catch (error) {
    console.error(
      "ZUQEN Automation execution API error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected automation execution error occurred.";

    if (message === "Authentication required.") {
      return NextResponse.json(
        {
          success: false,
          error: message,
          errorCode: "AUTH_REQUIRED",
          ...(taskId ? { taskId } : {}),
          ...(runId ? { runId } : {}),
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
        errorCode: "AUTOMATION_EXECUTION_ERROR",
        ...(taskId ? { taskId } : {}),
        ...(runId ? { runId } : {}),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Method not allowed.",
      errorCode: "METHOD_NOT_ALLOWED",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}

