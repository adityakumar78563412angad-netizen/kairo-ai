import { createServerSupabaseClient } from "@/lib/supabase-server";

export type AutomationTaskStatus =
  | "queued"
  | "planning"
  | "planned"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type CreateAutomationInput = {
  prompt: string;
  title?: string;
};

export type AutomationResult = {
  success: boolean;
  taskId?: string;
  runId?: string;
  status?: AutomationTaskStatus;
  error?: string;
  errorCode?: string;
};

const MAX_PROMPT_LENGTH = 10000;

function createTitle(prompt: string): string {
  const cleaned = prompt
    .trim()
    .replace(/\s+/g, " ");

  if (cleaned.length <= 80) {
    return cleaned;
  }

  return `${cleaned.slice(0, 77)}...`;
}

/**
 * Authenticate using an explicit Supabase access token
 * when one is available.
 *
 * Cookie authentication remains as a fallback so existing
 * ZUQEN server-side sessions continue to work.
 */
async function getAuthenticatedUser(
  accessToken?: string
) {
  const supabase =
    await createServerSupabaseClient();

  if (accessToken) {
    const {
      data,
      error,
    } = await supabase.auth.getUser(
      accessToken
    );

    if (!error && data.user) {
      return {
        supabase,
        user: data.user,
      };
    }

    if (error) {
      console.error(
        "Automation token authentication error:",
        error
      );
    }
  }

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

  if (!data.user) {
    return {
      supabase,
      user: null,
    };
  }

  return {
    supabase,
    user: data.user,
  };
}

export async function createAutomationTask(
  input: CreateAutomationInput,
  accessToken?: string
): Promise<AutomationResult> {
  const prompt = input.prompt?.trim();

  if (!prompt) {
    return {
      success: false,
      error:
        "Automation request is required.",
      errorCode: "PROMPT_REQUIRED",
    };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      success: false,
      error:
        `Automation request cannot exceed ${MAX_PROMPT_LENGTH} characters.`,
      errorCode: "PROMPT_TOO_LONG",
    };
  }

  /*
   * Authenticate once and use this authenticated
   * Supabase client for the complete task creation.
   */

  const {
    supabase,
    user,
  } = await getAuthenticatedUser(
    accessToken
  );

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
      errorCode: "AUTH_REQUIRED",
    };
  }

  const title =
    input.title?.trim().slice(0, 120) ||
    createTitle(prompt);

  /*
   * -------------------------------------------------------
   * CREATE AUTOMATION TASK
   * -------------------------------------------------------
   */

  const {
    data: task,
    error: taskError,
  } = await supabase
    .from("automation_tasks")
    .insert({
      user_id: user.id,
      title,
      prompt,
      status: "queued",
      context: {},
    })
    .select("id, status")
    .single();

  if (taskError || !task) {
    console.error(
      "Automation task creation failed:",
      taskError
    );

    return {
      success: false,
      error:
        "Unable to create automation task.",
      errorCode: "TASK_CREATION_FAILED",
    };
  }

  /*
   * -------------------------------------------------------
   * CREATE FIRST RUN
   * -------------------------------------------------------
   */

  const {
    data: run,
    error: runError,
  } = await supabase
    .from("automation_runs")
    .insert({
      task_id: task.id,
      user_id: user.id,
      run_number: 1,
      status: "queued",
      trigger_type: "user",
      execution_context: {},
    })
    .select("id, status")
    .single();

  if (runError || !run) {
    console.error(
      "Automation run creation failed:",
      runError
    );

    /*
     * Mark the task as failed so we do not leave an
     * orphaned queued task behind.
     */

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        error_code: "RUN_CREATION_FAILED",
        error_message:
          "Unable to create automation run.",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return {
      success: false,
      taskId: task.id,
      status: "failed",
      error:
        "Unable to initialize automation run.",
      errorCode: "RUN_CREATION_FAILED",
    };
  }

  return {
    success: true,
    taskId: task.id,
    runId: run.id,
    status: "queued",
  };
}