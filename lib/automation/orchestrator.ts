
import { createClient } from "@/lib/supabase";

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
};

const MAX_PROMPT_LENGTH = 10000;

function createTitle(prompt: string) {
  const cleaned = prompt.trim().replace(/\s+/g, " ");

  if (cleaned.length <= 80) {
    return cleaned;
  }

  return `${cleaned.slice(0, 77)}...`;
}

export async function createAutomationTask(
  input: CreateAutomationInput
): Promise<AutomationResult> {
  const supabase = createClient();

  const prompt = input.prompt?.trim();

  if (!prompt) {
    return {
      success: false,
      error: "Automation request is required.",
    };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      success: false,
      error: `Automation request cannot exceed ${MAX_PROMPT_LENGTH} characters.`,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const title =
    input.title?.trim().slice(0, 120) || createTitle(prompt);

  const { data: task, error: taskError } = await supabase
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
    console.error("Automation task creation failed:", taskError);

    return {
      success: false,
      error: "Unable to create automation task.",
    };
  }

  const { data: run, error: runError } = await supabase
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
    console.error("Automation run creation failed:", runError);

    await supabase
      .from("automation_tasks")
      .update({
        status: "failed",
        error_code: "RUN_CREATION_FAILED",
        error_message: "Unable to create automation run.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    return {
      success: false,
      taskId: task.id,
      status: "failed",
      error: "Unable to initialize automation run.",
    };
  }

  return {
    success: true,
    taskId: task.id,
    runId: run.id,
    status: "queued",
  };
}

