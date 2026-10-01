import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createAutomationTask,
  type CreateAutomationInput,
} from "@/lib/automation/orchestrator";
import { planAutomationTask } from "@/lib/automation/planner";

export const runtime = "nodejs";

const MAX_BODY_SIZE = 12000;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "An unexpected automation error occurred.";
}

function getErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "errorCode" in error &&
    typeof error.errorCode === "string"
  ) {
    return error.errorCode;
  }

  return "AUTOMATION_API_ERROR";
}

function getStatusFromError(error: unknown): number {
  const message = getErrorMessage(error).toLowerCase();

  if (
    message.includes("authentication required") ||
    message.includes("unauthorized") ||
    message.includes("not authenticated")
  ) {
    return 401;
  }

  if (
    message.includes("cannot exceed") ||
    message.includes("too large") ||
    message.includes("invalid request") ||
    message.includes("invalid prompt")
  ) {
    return 400;
  }

  return 500;
}

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get("content-length");

    if (contentLength) {
      const size = Number(contentLength);

      if (Number.isFinite(size) && size > MAX_BODY_SIZE) {
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
     * =========================================================
     * AUTHENTICATION
     *
     * The Automation UI can send the Supabase access token
     * through:
     *
     * Authorization: Bearer <access_token>
     *
     * If a bearer token is not supplied, we fall back to the
     * existing SSR cookie session.
     * =========================================================
     */

    const authorization =
      request.headers.get("authorization");

    const bearerToken =
      authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";

    const supabase =
      await createServerSupabaseClient();

    let user = null;

    if (bearerToken) {
      const {
        data,
        error,
      } = await supabase.auth.getUser(
        bearerToken
      );

      if (error) {
        console.error(
          "Automation bearer authentication error:",
          error
        );
      }

      user = data.user;
    }

    if (!user) {
      const {
        data,
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error(
          "Automation cookie authentication error:",
          error
        );
      }

      user = data.user;
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your ZUQEN session is not available. Please refresh the page and try again.",
          errorCode: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    /*
     * =========================================================
     * REQUEST BODY
     * =========================================================
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

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
          errorCode: "INVALID_REQUEST_BODY",
        },
        { status: 400 }
      );
    }

    const payload =
      body as Record<string, unknown>;

    const prompt =
      typeof payload.prompt === "string"
        ? payload.prompt.trim()
        : "";

    const title =
      typeof payload.title === "string"
        ? payload.title.trim()
        : undefined;

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Automation prompt is required.",
          errorCode: "PROMPT_REQUIRED",
        },
        { status: 400 }
      );
    }

    const input: CreateAutomationInput = {
      prompt,
      title,
    };

    /*
     * =========================================================
     * CREATE AUTOMATION TASK
     *
     * IMPORTANT:
     * createAutomationTask() currently returns the created
     * task object directly:
     *
     * {
     *   taskId,
     *   runId,
     *   plan,
     *   usage
     * }
     *
     * It does NOT return:
     * {
     *   success,
     *   error,
     *   errorCode
     * }
     *
     * Therefore we handle failures through try/catch instead
     * of checking created.success.
     * =========================================================
     */

    let created: Awaited<
      ReturnType<typeof createAutomationTask>
    >;

    try {
      created =
        await createAutomationTask(input);
    } catch (error) {
      console.error(
        "Automation task creation error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: getErrorMessage(error),
          errorCode: getErrorCode(error),
        },
        {
          status:
            getStatusFromError(error),
        }
      );
    }

    if (!created.taskId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Automation task was created without a task ID.",
          errorCode: "TASK_ID_MISSING",
        },
        { status: 500 }
      );
    }

    /*
     * =========================================================
     * PLAN AUTOMATION
     * =========================================================
     */

    let planned: Awaited<
      ReturnType<typeof planAutomationTask>
    >;

    try {
      planned =
        await planAutomationTask(
          created.taskId
        );
    } catch (error) {
      console.error(
        "Automation planning error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          taskId: created.taskId,
          runId: created.runId,
          error:
            getErrorMessage(error),
          errorCode:
            getErrorCode(error),
        },
        {
          status:
            getStatusFromError(error),
        }
      );
    }

    /*
     * =========================================================
     * FINAL RESPONSE
     *
     * The planner's current return contract is used directly.
     * =========================================================
     */

    return NextResponse.json(
      {
        success: true,
        taskId: created.taskId,
        runId: created.runId,
        status: "planned",
        plan: planned.plan,
        usage: planned.usage,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Automation API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          getErrorMessage(error),
        errorCode:
          getErrorCode(error),
      },
      {
        status:
          getStatusFromError(error),
      }
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