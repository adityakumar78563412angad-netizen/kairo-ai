
import { NextResponse } from "next/server";
import {
  createAutomationTask,
  type CreateAutomationInput,
} from "@/lib/automation/orchestrator";

export const runtime = "nodejs";

const MAX_BODY_SIZE = 12000;

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
          },
          { status: 413 }
        );
      }
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request.",
        },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
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

    const input: CreateAutomationInput = {
      prompt,
      title,
    };

    const result = await createAutomationTask(input);

    if (!result.success) {
      const status =
        result.error === "Authentication required."
          ? 401
          : result.error?.includes("cannot exceed")
            ? 400
            : 500;

      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Automation API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected automation error occurred.",
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
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}

