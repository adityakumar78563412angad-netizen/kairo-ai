export type WebSearchInput = {
  query: string;
  search_depth?: "basic" | "advanced";
  max_results?: number;
  topic?: "general" | "news" | "finance";
  include_answer?: boolean;
  include_raw_content?: boolean;
  include_images?: boolean;
  include_domains?: string[];
  exclude_domains?: string[];
};

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
  raw_content?: string;
};

export type WebSearchOutput = {
  query: string;
  answer?: string | null;
  results: WebSearchResult[];
  response_time?: string;
};

const TAVILY_ENDPOINT =
  "https://api.tavily.com/search";

const DEFAULT_MAX_RESULTS = 5;
const MAX_RESULTS = 10;
const SEARCH_TIMEOUT_MS = 30000;

function normalizeString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function clampResults(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_MAX_RESULTS;
  }

  return Math.min(
    Math.max(Math.floor(value), 1),
    MAX_RESULTS
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
      (domain): domain is string =>
        typeof domain === "string"
    )
    .map((domain) => domain.trim())
    .filter(Boolean)
    .slice(0, 20);

  return domains.length > 0
    ? domains
    : undefined;
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

function normalizeSearchDepth(
  value: unknown
): "basic" | "advanced" {
  return value === "advanced"
    ? "advanced"
    : "basic";
}

export async function executeWebSearch(
  input: WebSearchInput
): Promise<{
  success: boolean;
  output?: WebSearchOutput;
  error?: string;
  errorCode?: string;
}> {
  const apiKey =
    process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error:
        "Tavily API key is not configured.",
      errorCode:
        "TAVILY_API_KEY_MISSING",
    };
  }

  const query =
    normalizeString(input.query);

  if (!query) {
    return {
      success: false,
      error:
        "Web search query is required.",
      errorCode:
        "SEARCH_QUERY_REQUIRED",
    };
  }

  if (query.length > 2000) {
    return {
      success: false,
      error:
        "Web search query is too long.",
      errorCode:
        "SEARCH_QUERY_TOO_LONG",
    };
  }

  const searchDepth =
    normalizeSearchDepth(
      input.search_depth
    );

  const topic =
    normalizeTopic(input.topic);

  const maxResults =
    clampResults(input.max_results);

  const includeDomains =
    cleanDomains(
      input.include_domains
    );

  const excludeDomains =
    cleanDomains(
      input.exclude_domains
    );

  const requestBody: Record<
    string,
    unknown
  > = {
    api_key: apiKey,
    query,
    search_depth: searchDepth,
    topic,
    max_results: maxResults,
    include_answer:
      input.include_answer ?? true,
    include_raw_content:
      input.include_raw_content ?? false,
    include_images:
      input.include_images ?? false,
  };

  if (includeDomains) {
    requestBody.include_domains =
      includeDomains;
  }

  if (excludeDomains) {
    requestBody.exclude_domains =
      excludeDomains;
  }

  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      TAVILY_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          requestBody
        ),
        signal: controller.signal,
        cache: "no-store",
      }
    );

    const rawText =
      await response.text();

    let data: unknown = {};

    try {
      data = rawText
        ? JSON.parse(rawText)
        : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      const errorData =
        data &&
        typeof data === "object"
          ? (data as Record<
              string,
              unknown
            >)
          : {};

      const providerMessage =
        normalizeString(
          errorData.message
        ) ||
        normalizeString(
          errorData.detail
        ) ||
        normalizeString(
          errorData.error
        );

      return {
        success: false,
        error:
          providerMessage ||
          `Tavily search failed with status ${response.status}.`,
        errorCode:
          `TAVILY_HTTP_${response.status}`,
      };
    }

    const payload =
      data &&
      typeof data === "object"
        ? (data as Record<
            string,
            unknown
          >)
        : {};

    const rawResults =
      Array.isArray(payload.results)
        ? payload.results
        : [];

    const results: WebSearchResult[] =
      [];

    for (
      const item of rawResults
    ) {
      if (
        !item ||
        typeof item !== "object"
      ) {
        continue;
      }

      const result =
        item as Record<
          string,
          unknown
        >;

      const title =
        normalizeString(
          result.title
        );

      const url =
        normalizeString(
          result.url
        );

      const content =
        normalizeString(
          result.content
        );

      if (!title || !url) {
        continue;
      }

      const normalizedResult: WebSearchResult =
        {
          title,
          url,
          content,
        };

      if (
        typeof result.score ===
        "number"
      ) {
        normalizedResult.score =
          result.score;
      }

      const publishedDate =
        normalizeString(
          result.published_date
        );

      if (publishedDate) {
        normalizedResult.published_date =
          publishedDate;
      }

      if (
        typeof result.raw_content ===
        "string"
      ) {
        normalizedResult.raw_content =
          result.raw_content;
      }

      results.push(
        normalizedResult
      );
    }

    return {
      success: true,
      output: {
        query,
        answer:
          typeof payload.answer ===
          "string"
            ? payload.answer
            : null,
        results,
        response_time:
          typeof payload.response_time ===
          "string"
            ? payload.response_time
            : undefined,
      },
    };
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      return {
        success: false,
        error:
          "Web search timed out.",
        errorCode:
          "TAVILY_TIMEOUT",
      };
    }

    console.error(
      "Tavily web search error:",
      error
    );

    return {
      success: false,
      error:
        "Unable to complete web search.",
      errorCode:
        "TAVILY_REQUEST_FAILED",
    };
  } finally {
    clearTimeout(timeout);
  }
}