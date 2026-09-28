import type {
  AutomationPlanStep,
} from "@/lib/automation/planner";

import { executeFileWrite } from "@/lib/automation/tools/file-write";
import { executeFileRead } from "@/lib/automation/tools/file-read";

import {
  executeHttpRequest,
} from "@/lib/automation/tools/http-request";

import {
  executeDocument,
} from "@/lib/automation/tools/document";

import {
  executeWebSearch,
} from "@/lib/automation/tools/web-search";

import {
  executeWebResearch,
} from "@/lib/automation/tools/web-research";

import {
  executeDataTransform,
} from "@/lib/automation/tools/data-transform";

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
  name: string;

  execute: (
    step: AutomationPlanStep,
    context: ToolExecutionContext
  ) => Promise<ToolExecutionResult>;
};

function getInput(
  step: AutomationPlanStep
): Record<string, unknown> {
  if (
    step.input &&
    typeof step.input === "object" &&
    !Array.isArray(step.input)
  ) {
    return step.input as Record<
      string,
      unknown
    >;
  }

  return {};
}

function getSearchInput(
  step: AutomationPlanStep
) {
  const input =
    getInput(step);

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
      : input.topic ===
          "finance"
        ? "finance"
        : "general";

  const maxResults =
    typeof input.max_results ===
    "number"
      ? Math.max(
          1,
          Math.min(
            10,
            Math.floor(
              input.max_results
            )
          )
        )
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
    ...input,
    query,
    search_depth:
      searchDepth,
    max_results:
      maxResults,
    topic,
    include_answer:
      includeAnswer,
    include_raw_content:
      includeRawContent,
    include_images:
      includeImages,
    include_domains:
      includeDomains,
    exclude_domains:
      excludeDomains,
  };
}

function getResearchInput(
  step: AutomationPlanStep
) {
  const input =
    getInput(step);

  const queries =
    Array.isArray(
      input.queries
    )
      ? input.queries.filter(
          (
            value
          ): value is string =>
            typeof value ===
            "string" &&
            value.trim()
              .length > 0
        )
      : [];

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
      : input.topic ===
          "finance"
        ? "finance"
        : "general";

  const maxResultsPerQuery =
    typeof input.max_results_per_query ===
    "number"
      ? Math.max(
          1,
          Math.min(
            10,
            Math.floor(
              input.max_results_per_query
            )
          )
        )
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
    ...input,
    queries,
    search_depth:
      searchDepth,
    topic,
    max_results_per_query:
      maxResultsPerQuery,
    include_answer:
      includeAnswer,
    include_raw_content:
      includeRawContent,
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
      step
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

    execute: async (
      step
    ) => {
      const input =
        getResearchInput(step);

      const result =
        await executeWebResearch(
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

  data_transform: {
    name: "data_transform",

    execute: async (
      step
    ) => {
      const input =
        getInput(step);

      const result =
        await executeDataTransform(
          input
        );

      return {
        success:
          result.success,
        output:
          result.output,
        error:
          result.error,
        errorCode:
          result.errorCode,
      };
    },
  },

  browser: {
    name: "browser",

    execute: async () => ({
      success: false,
      error:
        'Automation tool "browser" is not connected yet.',
      errorCode:
        "TOOL_NOT_CONNECTED",
    }),
  },

  email: {
    name: "email",

    execute: async () => ({
      success: false,
      error:
        'Automation tool "email" is not connected yet.',
      errorCode:
        "TOOL_NOT_CONNECTED",
    }),
  },

  calendar: {
    name: "calendar",

    execute: async () => ({
      success: false,
      error:
        'Automation tool "calendar" is not connected yet.',
      errorCode:
        "TOOL_NOT_CONNECTED",
    }),
  },

file_read: {
  name: "file_read",
  execute: async (input, context) => {
    return executeFileRead(input, {
      userId: context.userId,
    });
  },
},

 file_write: {
  name: "file_write",
  execute: async (input, context) => {
    return executeFileWrite(input, {
      userId: context.userId,
    });
  },
},

 document: {
  name: "document",

  execute: async (
    step
  ) => {
    const input =
      getInput(step);

    const result =
      await executeDocument(
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

  spreadsheet: {
    name: "spreadsheet",

    execute: async () => ({
      success: false,
      error:
        'Automation tool "spreadsheet" is not connected yet.',
      errorCode:
        "TOOL_NOT_CONNECTED",
    }),
  },

  crm: {
    name: "crm",

    execute: async () => ({
      success: false,
      error:
        'Automation tool "crm" is not connected yet.',
      errorCode:
        "TOOL_NOT_CONNECTED",
    }),
  },

 http_request: {
  name: "http_request",

  execute: async (
    step
  ) => {
    const input =
      getInput(step);

    const result =
      await executeHttpRequest(
        input as Parameters<
          typeof executeHttpRequest
        >[0]
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

  notification: {
    name: "notification",

    execute: async () => ({
      success: false,
      error:
        'Automation tool "notification" is not connected yet.',
      errorCode:
        "TOOL_NOT_CONNECTED",
    }),
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
        tool:
          step.tool_name,
        taskId:
          context.taskId,
        runId:
          context.runId,
        stepId:
          context.stepId,
        userId:
          context.userId,
        error,
      }
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `Tool "${step.tool_name}" failed unexpectedly.`,
      errorCode:
        "TOOL_EXECUTION_FAILED",
    };
  }
}

export function isAutomationToolAvailable(
  toolName: string
): boolean {
  return Boolean(
    tools[toolName]
  );
}