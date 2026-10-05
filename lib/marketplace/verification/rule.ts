import type {
  NormalizedVerificationResult,
  TemplateVerificationAIResult,
  VerificationCheck,
  VerificationFinding,
} from "./type";

function clampScore(value: unknown): number {
  const numberValue =
    typeof value === "number"
      ? value
      : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, numberValue)
  );
}

function normalizeStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item: unknown): item is string =>
        typeof item === "string"
    )
    .map((item: string) => item.trim())
    .filter(Boolean);
}

function normalizeCheck(
  value: unknown
): VerificationCheck {
  const check =
    typeof value === "object" &&
    value !== null
      ? (value as Record<string, unknown>)
      : {};

  const rawStatus =
    typeof check.status === "string"
      ? check.status
      : "not_checked";

  const allowedStatuses = new Set([
    "pass",
    "warning",
    "fail",
    "not_checked",
  ]);

  const status = allowedStatuses.has(rawStatus)
    ? (rawStatus as VerificationCheck["status"])
    : "not_checked";

  return {
    key:
      typeof check.key === "string"
        ? check.key.trim()
        : "unknown",
    label:
      typeof check.label === "string"
        ? check.label.trim()
        : "Verification check",
    status,
    score: clampScore(check.score),
    explanation:
      typeof check.explanation === "string"
        ? check.explanation.trim()
        : "",
  };
}

function normalizeFinding(
  value: unknown
): VerificationFinding {
  const finding =
    typeof value === "object" &&
    value !== null
      ? (value as Record<string, unknown>)
      : {};

  const severities = new Set([
    "low",
    "medium",
    "high",
    "critical",
  ]);

  const categories = new Set([
    "metadata",
    "visual",
    "video",
    "package",
    "consistency",
    "security",
    "claim",
  ]);

  const rawSeverity =
    typeof finding.severity === "string"
      ? finding.severity
      : "medium";

  const rawCategory =
    typeof finding.category === "string"
      ? finding.category
      : "metadata";

  return {
    severity: severities.has(rawSeverity)
      ? (rawSeverity as VerificationFinding["severity"])
      : "medium",

    category: categories.has(rawCategory)
      ? (rawCategory as VerificationFinding["category"])
      : "metadata",

    title:
      typeof finding.title === "string"
        ? finding.title.trim()
        : "Verification finding",

    description:
      typeof finding.description === "string"
        ? finding.description.trim()
        : "",
  };
}

function determineResult(
  score: number,
  checks: VerificationCheck[],
  findings: VerificationFinding[]
): "verified" | "review_required" | "rejected" {
  const hasCriticalFinding = findings.some(
    (finding: VerificationFinding) =>
      finding.severity === "critical"
  );

  if (hasCriticalFinding) {
    return "rejected";
  }

  const hasHighFinding = findings.some(
    (finding: VerificationFinding) =>
      finding.severity === "high"
  );

  if (hasHighFinding) {
    return "review_required";
  }

  if (score < 60) {
    return "rejected";
  }

  if (score < 82) {
    return "review_required";
  }

  const hasFailedCheck = checks.some(
    (check: VerificationCheck) =>
      check.status === "fail"
  );

  if (hasFailedCheck) {
    return "review_required";
  }

  return "verified";
}

export function normalizeVerificationResult(
  input: TemplateVerificationAIResult
): NormalizedVerificationResult {
  const rawChecks = Array.isArray(input.checks)
    ? input.checks
    : [];

  const rawFindings = Array.isArray(input.findings)
    ? input.findings
    : [];

  const checks = rawChecks.map(
    (check: unknown) => normalizeCheck(check)
  );

  const findings = rawFindings.map(
    (finding: unknown) =>
      normalizeFinding(finding)
  );

  const overallScore = clampScore(
    input.overall_score
  );

  const result = determineResult(
    overallScore,
    checks,
    findings
  );

  return {
    result,
    overall_score: overallScore,

    summary:
      typeof input.summary === "string"
        ? input.summary.trim()
        : "Template verification completed.",

    checks,

    findings,

    evidence: Array.isArray(input.evidence)
      ? input.evidence
          .filter(
            (item: unknown) =>
              typeof item === "object" &&
              item !== null
          )
          .map((item: unknown) => {
            const evidence =
              item as Record<string, unknown>;

            const validSources = new Set([
              "metadata",
              "thumbnail",
              "screenshot",
              "demo_video",
              "package",
            ]);

            const rawSource =
              typeof evidence.source === "string"
                ? evidence.source
                : "metadata";

            return {
              source: validSources.has(rawSource)
                ? (rawSource as
                    | "metadata"
                    | "thumbnail"
                    | "screenshot"
                    | "demo_video"
                    | "package")
                : "metadata",

              description:
                typeof evidence.description ===
                "string"
                  ? evidence.description.trim()
                  : "",

              ...(typeof evidence.timestamp ===
              "string"
                ? {
                    timestamp:
                      evidence.timestamp.trim(),
                  }
                : {}),

              confidence: clampScore(
                evidence.confidence
              ),
            };
          })
      : [],

    claimed_features_supported:
      normalizeStringArray(
        input.claimed_features_supported
      ),

    unsupported_claims:
      normalizeStringArray(
        input.unsupported_claims
      ),

    suspicious_signals:
      normalizeStringArray(
        input.suspicious_signals
      ),

    recommendations:
      normalizeStringArray(
        input.recommendations
      ),
  };
}