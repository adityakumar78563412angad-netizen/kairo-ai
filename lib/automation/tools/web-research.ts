import {
  executeWebSearch,
  type WebSearchResult,
} from "@/lib/automation/tools/web-search";

export type WebResearchInput = {
  queries: string[];
  search_depth?: "basic" | "advanced";
  topic?: "general" | "news" | "finance";
  max_results_per_query?: number;
  include_answer?: boolean;
  include_raw_content?: boolean;
  include_domains?: string[];
  exclude_domains?: string[];
};

export type WebResearchSource =
  WebSearchResult & {
    query: string;
  };

export type WebResearchOutput = {
  research_question: string;
  queries: string[];
  answer: string | null;
  sources: WebResearchSource[];
  source_count: number;
  successful_queries: number;
  failed_queries: number;
};

const MAX_QUERIES = 8;
const DEFAULT_RESULTS_PER_QUERY = 5;
const MAX_RESULTS_PER_QUERY = 10;

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanQueries(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: string[] = [];

  for (const item of value) {
    const query =
      cleanString(item);

    if (!query) {
      continue;
    }

    if (query.length > 2000) {
      continue;
    }

    if (!output.includes(query)) {
      output.push(query);
    }

    if (
      output.length >=
      MAX_QUERIES
    ) {
      break;
    }
  }

  return output;
}

function normalizeDepth(
  value: unknown
): "basic" | "advanced" {
  return value === "advanced"
    ? "advanced"
    : "basic";
}

function normalizeTopic(
  value: unknown
): "general" | "news" | "finance" {
  if (value === "news") {
    return "news";
  }

  if (value === "finance") {
    return "finance";
  }

  return "general";
}

function normalizeResultsLimit(
  value: unknown
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_RESULTS_PER_QUERY;
  }

  return Math.min(
    Math.max(
      Math.floor(value),
      1
    ),
    MAX_RESULTS_PER_QUERY
  );
}

function cleanDomains(
  value: unknown
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const domains = value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) =>
      item.trim()
    )
    .filter(Boolean)
    .slice(0, 20);

  return domains.length > 0
    ? domains
    : undefined;
}

function deduplicateSources(
  sources: WebResearchSource[]
): WebResearchSource[] {
  const seen =
    new Set<string>();

  const output: WebResearchSource[] =
    [];

  for (const source of sources) {
    const normalizedUrl =
      source.url
        .trim()
        .toLowerCase();

    if (
      !normalizedUrl ||
      seen.has(normalizedUrl)
    ) {
      continue;
    }

    seen.add(normalizedUrl);
    output.push(source);
  }

  return output;
}

export async function executeWebResearch(
  input: WebResearchInput
): Promise<{
  success: boolean;
  output?: WebResearchOutput;
  error?: string;
  errorCode?: string;
}> {
  const queries =
    cleanQueries(input.queries);

  if (queries.length === 0) {
    return {
      success: false,
      error:
        "At least one research query is required.",
      errorCode:
        "RESEARCH_QUERIES_REQUIRED",
    };
  }

  const searchDepth =
    normalizeDepth(
      input.search_depth
    );

  const topic =
    normalizeTopic(input.topic);

  const maxResults =
    normalizeResultsLimit(
      input.max_results_per_query
    );

  const includeDomains =
    cleanDomains(
      input.include_domains
    );

  const excludeDomains =
    cleanDomains(
      input.exclude_domains
    );

  const searchResults =
    await Promise.all(
      queries.map(
        async (query) => {
          const result =
            await executeWebSearch({
              query,
              search_depth:
                searchDepth,
              topic,
              max_results:
                maxResults,
              include_answer:
                input.include_answer ??
                true,
              include_raw_content:
                input.include_raw_content ??
                false,
              include_images:
                false,
              include_domains:
                includeDomains,
              exclude_domains:
                excludeDomains,
            });

          return {
            query,
            result,
          };
        }
      )
    );

  const sources: WebResearchSource[] =
    [];

  const answers: string[] = [];

  let successfulQueries = 0;
  let failedQueries = 0;

  for (const item of searchResults) {
    if (item.result.success) {
      successfulQueries += 1;
    } else {
      failedQueries += 1;
    }

    if (item.result.output?.answer) {
      const answer =
        cleanString(
          item.result.output.answer
        );

      if (answer) {
        answers.push(answer);
      }
    }

    if (
      item.result.output?.results
    ) {
      for (
        const source of
          item.result.output.results
      ) {
        sources.push({
          ...source,
          query: item.query,
        });
      }
    }
  }

  if (
    successfulQueries === 0
  ) {
    return {
      success: false,
      error:
        "All web research queries failed.",
      errorCode:
        "RESEARCH_ALL_QUERIES_FAILED",
    };
  }

  const uniqueSources =
    deduplicateSources(
      sources
    );

  const combinedAnswer =
    answers.length > 0
      ? answers.join("\n\n")
      : null;

  return {
    success: true,
    output: {
      research_question:
        queries.join(" | "),
      queries,
      answer:
        combinedAnswer,
      sources:
        uniqueSources,
      source_count:
        uniqueSources.length,
      successful_queries:
        successfulQueries,
      failed_queries:
        failedQueries,
    },
  };
}