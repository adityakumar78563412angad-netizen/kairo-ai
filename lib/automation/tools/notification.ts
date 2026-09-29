import { createClient } from "@/lib/supabase";

type NotificationContext = {
  userId?: string;
  taskId?: string;
  runId?: string;
  stepId?: string;
};

type NotificationInput = {
  type?: unknown;
  title?: unknown;
  message?: unknown;
  metadata?: unknown;

  task_id?: unknown;
  run_id?: unknown;
  step_id?: unknown;
};

type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error";

const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 10_000;

function getRequiredString(
  value: unknown,
  field: string
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function getOptionalString(
  value: unknown
): string | undefined {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return undefined;
  }

  return value.trim();
}

function normalizeType(
  value: unknown
): NotificationType {
  if (typeof value !== "string") {
    return "info";
  }

  const type = value
    .trim()
    .toLowerCase();

  if (
    type === "success" ||
    type === "warning" ||
    type === "error"
  ) {
    return type;
  }

  return "info";
}

function normalizeMetadata(
  value: unknown
): Record<string, unknown> {
  if (
    value === null ||
    value === undefined
  ) {
    return {};
  }

  if (
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "metadata must be an object"
    );
  }

  return value as Record<string, unknown>;
}

function validateLength(
  value: string,
  field: string,
  maxLength: number
): string {
  if (value.length > maxLength) {
    throw new Error(
      `${field} exceeds the ${maxLength.toLocaleString()} character limit`
    );
  }

  return value;
}

function extractInput(
  input: unknown
): NotificationInput {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new Error(
      "notification input is required"
    );
  }

  return input as NotificationInput;
}

function getContextValue(
  inputValue: unknown,
  contextValue: string | undefined
): string | undefined {
  return (
    getOptionalString(inputValue) ??
    getOptionalString(contextValue)
  );
}

export async function executeNotification(
  planStep: {
    input?: unknown;
  },
  context: NotificationContext
) {
  const userId = getRequiredString(
    context.userId,
    "Authenticated user"
  );

  const input = extractInput(
    planStep.input
  );

  const title = validateLength(
    getRequiredString(
      input.title,
      "title"
    ),
    "title",
    MAX_TITLE_LENGTH
  );

  const message = validateLength(
    getRequiredString(
      input.message,
      "message"
    ),
    "message",
    MAX_MESSAGE_LENGTH
  );

  const type = normalizeType(
    input.type
  );

  const metadata =
    normalizeMetadata(
      input.metadata
    );

  const taskId = getContextValue(
    input.task_id,
    context.taskId
  );

  const runId = getContextValue(
    input.run_id,
    context.runId
  );

  const stepId = getContextValue(
    input.step_id,
    context.stepId
  );

  const supabase = createClient();

  const { data, error } =
    await supabase
      .from(
        "automation_notifications"
      )
      .insert({
        user_id: userId,
        task_id: taskId ?? null,
        run_id: runId ?? null,
        step_id: stepId ?? null,
        type,
        title,
        message,
        metadata,
      })
      .select(
        "id, user_id, task_id, run_id, step_id, type, title, message, metadata, is_read, created_at, read_at"
      )
      .single();

  if (error) {
    throw new Error(
      `Failed to create notification: ${error.message}`
    );
  }

  return {
    success: true,
    notification: data,
    delivered: true,
    delivery_channel: "in_app",
  };
}