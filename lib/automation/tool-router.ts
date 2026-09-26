import type {
  AutomationPlanStep,
} from "@/lib/automation/planner";

import {
  executeWebSearch,
} from "@/lib/automation/tools/web-search";

export type ToolExecutionContext = {
  taskId: string;
  runId: string;
  stepId: string;
  userId: string;
};

export type ToolExecutionResult = {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  errorCode?: string;
};

export type AutomationTool = {
  name: AutomationPlanStep["tool_name"];

  execute: (
    step: AutomationPlanStep,
    context: ToolExecutionContext
  ) => Promise<ToolExecutionResult>;
};

async function unavailableTool(
  toolName: string
): Promise<ToolExecutionResult> {
  return {
    success: false,
    error:
      `Automation tool "${toolName}" is not connected yet.`,
    errorCode:
      "TOOL_NOT_CONNECTED",
  };
}

function getSearchInput(
  step: AutomationPlanStep
) {
  const input =
    step.input &&
    typeof step.input === "object"
      ? step.input as Record<
          string,
          unknown
        >
      : {};

  const query =
    typeof input.query === "string"
      ? input.query.trim()
      : "";

  const searchDepth:
    | "basic"
    | "advanced" =
    input.search_depth ===
    "advanced"
      ? "advanced"
      : "basic";

  const topic:
    | "general"
    | "news"
    | "finance" =
    input.topic === "news"
      ? "news"
      : input.topic === "finance"
        ? "finance"
        : "general";

  const maxResults =
    typeof input.max_results ===
    "number"
      ? input.max_results
      : 5;

  const includeAnswer =
    typeof input.include_answer ===
    "boolean"
      ? input.include_answer
      : true;

  const includeRawContent =
    typeof input.include_raw_content ===
    "boolean"
      ? input.include_raw_content
      : false;

  const includeImages =
    typeof input.include_images ===
    "boolean"
      ? input.include_images
      : false;

  const includeDomains =
    Array.isArray(
      input.include_domains
    )
      ? input.include_domains.filter(
          (
            value
          ): value is string =>
            typeof value ===
            "string"
        )
      : undefined;

  const excludeDomains =
    Array.isArray(
      input.exclude_domains
    )
      ? input.exclude_domains.filter(
          (
            value
          ): value is string =>
            typeof value ===
            "string"
        )
      : undefined;

  return {
    query,
    search_depth: searchDepth,
    max_results: maxResults,
    topic,
    include_answer: includeAnswer,
    include_raw_content:
      includeRawContent,
    include_images: includeImages,
    include_domains:
      includeDomains,
    exclude_domains:
      excludeDomains,
  };
}

const tools: Record<
  string,
  AutomationTool
> = {
  web_search: {
    name: "web_search",

    execute: async (
      step,
      _context
    ) => {
      const input =
        getSearchInput(step);

      const result =
        await executeWebSearch(
          input
        );

      return {
        success:
          result.success,

        output:
          result.output
            ? {
                ...result.output,
              }
            : undefined,

        error:
          result.error,

        errorCode:
          result.errorCode,
      };
    },
  },

  web_research: {
    name: "web_research",

    execute: async () =>
      unavailableTool(
        "web_research"
      ),
  },

  browser: {
    name: "browser",

    execute: async () =>
      unavailableTool(
        "browser"
      ),
  },

  email: {
    name: "email",

    execute: async () =>
      unavailableTool(
        "email"
      ),
  },

  calendar: {
    name: "calendar",

    execute: async () =>
      unavailableTool(
        "calendar"
      ),
  },

  file_read: {
    name: "file_read",

    execute: async () =>
      unavailableTool(
        "file_read"
      ),
  },

  file_write: {
    name: "file_write",

    execute: async () =>
      unavailableTool(
        "file_write"
      ),
  },

  document: {
    name: "document",

    execute: async () =>
      unavailableTool(
        "document"
      ),
  },

  spreadsheet: {
    name: "spreadsheet",

    execute: async () =>
      unavailableTool(
        "spreadsheet"
      ),
  },

  data_transform: {
    name: "data_transform",

    execute: async () =>
      unavailableTool(
        "data_transform"
      ),
  },

  crm: {
    name: "crm",

    execute: async () =>
      unavailableTool(
        "crm"
      ),
  },

  http_request: {
    name: "http_request",

    execute: async () =>
      unavailableTool(
        "http_request"
      ),
  },

  notification: {
    name: "notification",

    execute: async () =>
      unavailableTool(
        "notification"
      ),
  },
};

export async function executeAutomationTool(
  step: AutomationPlanStep,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const tool =
    tools[step.tool_name];

  if (!tool) {
    return {
      success: false,
      error:
        `Unknown automation tool: ${step.tool_name}`,
      errorCode:
        "UNKNOWN_TOOL",
    };
  }

  try {
    return await tool.execute(
      step,
      context
    );
  } catch (error) {
    console.error(
      "Automation tool execution error:",
      {
        tool: step.tool_name,
        taskId: context.taskId,
        runId: context.runId,
        stepId: context.stepId,
        error,
      }
    );

    return {
      success: false,
      error:
        `Tool "${step.tool_name}" failed unexpectedly.`,
      errorCode:
        "TOOL_EXECUTION_FAILED",
    };
  }
}

export function isAutomationToolAvailable(
  toolName: string
) {
  return Boolean(
    tools[toolName]
  );
}