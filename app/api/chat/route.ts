import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
createAutomationTask,
type CreateAutomationInput,
} from "@/lib/automation/orchestrator";
import { planAutomationTask } from "@/lib/automation/planner";

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

/*
 * =========================================================
 * AUTHENTICATION
 *
 * The Automation UI sends the Supabase access token in:
 * Authorization: Bearer <access_token>
 *
 * We authenticate with that token first.
 * If no token is supplied, we fall back to the SSR cookie
 * session so existing sessions continue to work.
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

const input: CreateAutomationInput = {
  prompt,
  title,
};

/*
 * =========================================================
 * CREATE AUTOMATION TASK
 *
 * The orchestrator performs its own authentication check
 * as an additional server-side security layer.
 * =========================================================
 */

const created =
  await createAutomationTask(input);

if (!created.success) {
  const status =
    created.error ===
    "Authentication required."
      ? 401
      : created.error?.includes(
            "cannot exceed"
          )
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
    },
    { status: 500 }
  );
}

/*
 * =========================================================
 * PLAN AUTOMATION
 * =========================================================
 */

const planned =
  await planAutomationTask(
    created.taskId
  );

if (!planned.success) {
  return NextResponse.json(
    {
      success: false,
      taskId: created.taskId,
      runId: created.runId,
      error: planned.error,
      errorCode: planned.errorCode,
    },
    { status: 500 }
  );
}

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
      "An unexpected automation error occurred.",
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
},
{
status: 405,
headers: {
Allow: "POST",
},
}
);
}
