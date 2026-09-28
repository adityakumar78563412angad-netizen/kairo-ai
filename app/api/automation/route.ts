import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createAutomationTask,
  type CreateAutomationInput,
} from "@/lib/automation/orchestrator";
import { planAutomationTask } from "@/lib/automation/planner";

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

    // =====================================================
    // AUTHENTICATION
    // =====================================================

    const accessToken = getBearerToken(request);

    const supabase = await createServerSupabaseClient();

    let user = null;

    if (accessToken) {
      const { data, error } =
        await supabase.auth.getUser(accessToken);

      if (error) {
        console.error(
          "Automation bearer authentication error:",
          error
        );
      }

      user = data.user;
    }

    // Cookie fallback
    if (!user) {
      const { data, error } =
        await supabase.auth.getUser();

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

    // =====================================================
    // REQUEST BODY
    // =====================================================

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
          errorCode: "INVALID_BODY",
        },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;

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
          error: "Automation request is required.",
          errorCode: "PROMPT_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (prompt.length > 10000) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Automation request cannot exceed 10000 characters.",
          errorCode: "PROMPT_TOO_LONG",
        },
        { status: 400 }
      );
    }

    const input: CreateAutomationInput = {
      prompt,
      title,
    };

    // =====================================================
    // CREATE AUTOMATION TASK
    // =====================================================

    const created = await createAutomationTask(
      input,
      accessToken
    );

    if (!created.success) {
      const status =
        created.error === "Authentication required."
          ? 401
          : created.error?.includes("cannot exceed")
            ? 400
            : 500;

      return NextResponse.json(
        created,
        { status }
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

    // =====================================================
    // PLAN AUTOMATION TASK
    // =====================================================
    //
    // planAutomationTask() throws on failure.
    // It does NOT return { success, error, errorCode }.
    //
    // Therefore we directly use its returned:
    // taskId, runId, plan and usage.
    // =====================================================

    const planned = await planAutomationTask(
      created.taskId,
      accessToken
    );

    return NextResponse.json(
      {
        success: true,
        taskId: planned.taskId,
        runId: planned.runId,
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

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected automation error occurred.";

    return NextResponse.json(
      {
        success: false,
        error: message,
        errorCode: "AUTOMATION_API_ERROR",
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