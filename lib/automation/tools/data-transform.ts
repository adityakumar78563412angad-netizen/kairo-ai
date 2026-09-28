export type DataTransformInput = {
  previous_steps?: unknown;
  [key: string]: unknown;
};

export type TransformedSource = {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  published_date?: string;
  score?: number;
  source_type: "web_search" | "web_research" | "unknown";
  step_number?: number;
  step_name?: string;
};

export type DataTransformOutput = {
  success: true;
  transformation: {
    type: "research_synthesis";
    source_steps: number[];
    total_input_sources: number;
    unique_sources: number;
    duplicate_sources_removed: number;
  };
  research_items: TransformedSource[];
  key_findings: string[];
  source_answers: Array<{
    source_step: number;
    step_name: string;
    answer: string;
  }>;
  sources: Array<{
    title: string;
    url: string;
    published_date?: string;
    score?: number;
    source_type: string;
  }>;
  outline: string[];
  metadata: {
    generated_at: string;
    has_web_search_data: boolean;
    has_web_research_data: boolean;
  };
};

export type DataTransformResult = {
  success: boolean;
  output?: DataTransformOutput;
  error?: string;
  errorCode?: string;
};

type PreviousStep = {
  step_number?: unknown;
  name?: unknown;
  tool_name?: unknown;
  output?: unknown;
};

const MAX_SOURCES = 100;
const MAX_CONTENT_LENGTH = 12000;
const MAX_RAW_CONTENT_LENGTH = 20000;
const MAX_ANSWER_LENGTH = 12000;
const MAX_FINDINGS = 25;
const MAX_FINDING_LENGTH = 1500;

function normalizeString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeNumber(value: unknown): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return undefined;
  }

  return value;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    parsed.hash = "";

    /*
     * URL normalization is intentionally conservative.
     *
     * We do not remove arbitrary query parameters because
     * some legitimate sources use query parameters to identify
     * the actual document/resource.
     */
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url
      .trim()
      .replace(/\/$/, "");
  }
}

function truncate(
  value: string,
  maxLength: number
): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}

function cleanText(value: unknown): string {
  return normalizeString(value)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function getStepNumber(
  step: PreviousStep
): number | undefined {
  if (
    typeof step.step_number === "number" &&
    Number.isFinite(step.step_number)
  ) {
    return Math.floor(step.step_number);
  }

  if (
    typeof step.step_number === "string"
  ) {
    const parsed = Number(
      step.step_number
    );

    if (
      Number.isFinite(parsed)
    ) {
      return Math.floor(parsed);
    }
  }

  return undefined;
}

function getStepName(
  step: PreviousStep
): string {
  return (
    normalizeString(step.name) ||
    "Previous automation step"
  );
}

function getToolName(
  step: PreviousStep
): string {
  return normalizeString(
    step.tool_name
  );
}

function extractResultRecords(
  output: unknown
): Record<string, unknown>[] {
  if (!isRecord(output)) {
    return [];
  }

  const records: Record<
    string,
    unknown
  >[] = [];

  /*
   * Standard ZUQEN web_search output:
   *
   * {
   *   query,
   *   answer,
   *   results: [...]
   * }
   */
  if (
    Array.isArray(output.results)
  ) {
    for (
      const item of output.results
    ) {
      if (isRecord(item)) {
        records.push(item);
      }
    }
  }

  /*
   * Some research implementations may expose
   * research results under different names.
   *
   * We support those structures without changing
   * the existing web_search contract.
   */
  const possibleArrays = [
    output.research_results,
    output.sources,
    output.items,
    output.documents,
  ];

  for (
    const candidate of possibleArrays
  ) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    for (
      const item of candidate
    ) {
      if (isRecord(item)) {
        records.push(item);
      }
    }
  }

  return records;
}

function extractRecord(
  record: Record<string, unknown>,
  sourceType:
    | "web_search"
    | "web_research"
    | "unknown",
  stepNumber?: number,
  stepName?: string
): TransformedSource | null {
  const title =
    cleanText(
      record.title
    );

  const url =
    cleanText(
      record.url
    );

  /*
   * A web source without a valid URL is not useful
   * as a report citation/source.
   */
  if (!title || !url) {
    return null;
  }

  const content =
    cleanText(
      record.content
    ) ||
    cleanText(
      record.snippet
    ) ||
    cleanText(
      record.description
    );

  const rawContent =
    cleanText(
      record.raw_content
    );

  const publishedDate =
    cleanText(
      record.published_date
    ) ||
    cleanText(
      record.date
    );

  const score =
    normalizeNumber(
      record.score
    );

  const result: TransformedSource = {
    title: truncate(
      title,
      1000
    ),
    url: normalizeUrl(url),
    content: truncate(
      content,
      MAX_CONTENT_LENGTH
    ),
    source_type: sourceType,
  };

  if (rawContent) {
    result.raw_content =
      truncate(
        rawContent,
        MAX_RAW_CONTENT_LENGTH
      );
  }

  if (publishedDate) {
    result.published_date =
      publishedDate;
  }

  if (
    typeof score === "number"
  ) {
    result.score = score;
  }

  if (
    typeof stepNumber === "number"
  ) {
    result.step_number =
      stepNumber;
  }

  if (stepName) {
    result.step_name =
      stepName;
  }

  return result;
}

function extractAnswer(
  output: unknown
): string {
  if (!isRecord(output)) {
    return "";
  }

  return truncate(
    cleanText(
      output.answer
    ),
    MAX_ANSWER_LENGTH
  );
}

function buildFindingCandidates(
  source: TransformedSource
): string[] {
  const findings: string[] = [];

  const content =
    cleanText(
      source.content
    );

  if (content) {
    /*
     * Preserve the actual source text instead of
     * inventing a conclusion.
     *
     * The document/AI synthesis stage can later
     * interpret these source-backed passages.
     */
    const sentences =
      content
        .split(
          /(?<=[.!?])\s+/
        )
        .map(
          (sentence) =>
            sentence.trim()
        )
        .filter(
          (sentence) =>
            sentence.length >= 40
        );

    for (
      const sentence of sentences
    ) {
      findings.push(
        truncate(
          sentence,
          MAX_FINDING_LENGTH
        )
      );

      if (
        findings.length >= 3
      ) {
        break;
      }
    }
  }

  return findings;
}

function buildOutline(
  hasWebSearchData: boolean,
  hasWebResearchData: boolean,
  sourceCount: number
): string[] {
  const outline: string[] = [];

  if (
    hasWebSearchData ||
    hasWebResearchData
  ) {
    outline.push(
      "Executive Summary"
    );
  }

  if (
    hasWebSearchData
  ) {
    outline.push(
      "Initial Web Search Findings"
    );
  }

  if (
    hasWebResearchData
  ) {
    outline.push(
      "In-Depth Research Findings"
    );
  }

  if (sourceCount > 0) {
    outline.push(
      "Evidence and Sources"
    );
  }

  outline.push(
    "Conclusion"
  );

  return outline;
}

function getPreviousSteps(
  value: unknown
): PreviousStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is PreviousStep =>
      isRecord(item)
  );
}

export async function executeDataTransform(
  input: DataTransformInput
): Promise<DataTransformResult> {
  try {
    const previousSteps =
      getPreviousSteps(
        input.previous_steps
      );

    if (
      previousSteps.length === 0
    ) {
      return {
        success: false,
        error:
          "No previous step data was provided for data transformation.",
        errorCode:
          "PREVIOUS_STEP_DATA_REQUIRED",
      };
    }

    const sourceMap =
      new Map<
        string,
        TransformedSource
      >();

    const sourceStepNumbers =
      new Set<number>();

    const sourceAnswers: Array<{
      source_step: number;
      step_name: string;
      answer: string;
    }> = [];

    let hasWebSearchData =
      false;

    let hasWebResearchData =
      false;

    let totalInputSources = 0;

    for (
      const step of previousSteps
    ) {
      const toolName =
        getToolName(step);

      const stepNumber =
        getStepNumber(step);

      const stepName =
        getStepName(step);

      const output =
        step.output;

      const isWebSearch =
        toolName ===
        "web_search";

      const isWebResearch =
        toolName ===
        "web_research";

      if (
        !isWebSearch &&
        !isWebResearch
      ) {
        continue;
      }

      if (isWebSearch) {
        hasWebSearchData =
          true;
      }

      if (isWebResearch) {
        hasWebResearchData =
          true;
      }

      if (
        typeof stepNumber ===
        "number"
      ) {
        sourceStepNumbers.add(
          stepNumber
        );
      }

      const answer =
        extractAnswer(output);

      if (
        answer &&
        typeof stepNumber ===
          "number"
      ) {
        sourceAnswers.push({
          source_step:
            stepNumber,
          step_name:
            stepName,
          answer,
        });
      }

      const records =
        extractResultRecords(
          output
        );

      totalInputSources +=
        records.length;

      const sourceType =
        isWebSearch
          ? "web_search"
          : isWebResearch
            ? "web_research"
            : "unknown";

      for (
        const record of records
      ) {
        const normalized =
          extractRecord(
            record,
            sourceType,
            stepNumber,
            stepName
          );

        if (!normalized) {
          continue;
        }

        const key =
          normalizeUrl(
            normalized.url
          ).toLowerCase();

        const existing =
          sourceMap.get(key);

        if (!existing) {
          if (
            sourceMap.size <
            MAX_SOURCES
          ) {
            sourceMap.set(
              key,
              normalized
            );
          }

          continue;
        }

        /*
         * If the same URL appeared in multiple
         * research steps, keep the richer record.
         */
        const existingContentLength =
          (
            existing.content?.length ||
            0
          ) +
          (
            existing.raw_content
              ?.length || 0
          );

        const newContentLength =
          (
            normalized.content
              ?.length || 0
          ) +
          (
            normalized.raw_content
              ?.length || 0
          );

        if (
          newContentLength >
          existingContentLength
        ) {
          sourceMap.set(
            key,
            {
              ...normalized,
              source_type:
                existing.source_type ===
                "web_research"
                  ? existing.source_type
                  : normalized.source_type,
            }
          );
        }
      }
    }

    const researchItems =
      Array.from(
        sourceMap.values()
      );

    /*
     * Prefer higher-quality sources first when
     * Tavily supplied scores.
     *
     * This does not claim that a source is
     * factually superior; it only preserves the
     * provider's numeric relevance signal.
     */
    researchItems.sort(
      (a, b) => {
        const scoreA =
          typeof a.score ===
          "number"
            ? a.score
            : -Infinity;

        const scoreB =
          typeof b.score ===
          "number"
            ? b.score
            : -Infinity;

        if (
          scoreA !== scoreB
        ) {
          return scoreB - scoreA;
        }

        return a.title.localeCompare(
          b.title
        );
      }
    );

    const findingSet =
      new Set<string>();

    for (
      const source of researchItems
    ) {
      const candidates =
        buildFindingCandidates(
          source
        );

      for (
        const candidate of candidates
      ) {
        const normalized =
          candidate
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

        if (
          !normalized ||
          findingSet.has(
            normalized
          )
        ) {
          continue;
        }

        findingSet.add(
          normalized
        );

        if (
          findingSet.size >=
          MAX_FINDINGS
        ) {
          break;
        }
      }

      if (
        findingSet.size >=
        MAX_FINDINGS
      ) {
        break;
      }
    }

    const keyFindings =
      Array.from(
        findingSet
      );

    /*
     * Convert the normalized lowercase
     * de-duplication keys back to the original
     * source-backed sentences.
     */
    const finalFindings: string[] =
      [];

    for (
      const source of researchItems
    ) {
      const candidates =
        buildFindingCandidates(
          source
        );

      for (
        const candidate of candidates
      ) {
        const key =
          candidate
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

        if (
          keyFindings.includes(key) &&
          !finalFindings.includes(
            candidate
          )
        ) {
          finalFindings.push(
            candidate
          );
        }

        if (
          finalFindings.length >=
          MAX_FINDINGS
        ) {
          break;
        }
      }

      if (
        finalFindings.length >=
        MAX_FINDINGS
      ) {
        break;
      }
    }

    const sources =
      researchItems.map(
        (source) => {
          const result: {
            title: string;
            url: string;
            published_date?: string;
            score?: number;
            source_type: string;
          } = {
            title:
              source.title,
            url:
              source.url,
            source_type:
              source.source_type,
          };

          if (
            source.published_date
          ) {
            result.published_date =
              source.published_date;
          }

          if (
            typeof source.score ===
            "number"
          ) {
            result.score =
              source.score;
          }

          return result;
        }
      );

    const duplicateSourcesRemoved =
      Math.max(
        0,
        totalInputSources -
          researchItems.length
      );

    const output: DataTransformOutput =
      {
        success: true,

        transformation: {
          type:
            "research_synthesis",
          source_steps:
            Array.from(
              sourceStepNumbers
            ).sort(
              (a, b) => a - b
            ),
          total_input_sources:
            totalInputSources,
          unique_sources:
            researchItems.length,
          duplicate_sources_removed:
            duplicateSourcesRemoved,
        },

        research_items:
          researchItems,

        key_findings:
          finalFindings,

        source_answers:
          sourceAnswers,

        sources,

        outline:
          buildOutline(
            hasWebSearchData,
            hasWebResearchData,
            researchItems.length
          ),

        metadata: {
          generated_at:
            new Date().toISOString(),
          has_web_search_data:
            hasWebSearchData,
          has_web_research_data:
            hasWebResearchData,
        },
      };

    return {
      success: true,
      output,
    };
  } catch (error) {
    console.error(
      "Data transform tool error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to transform automation data.",
      errorCode:
        "DATA_TRANSFORM_FAILED",
    };
  }
}