import type {
  TemplateVerificationAIResult,
  VerificationCheck,
  VerificationResult,
} from "./types";

const RESULT_PRIORITY: Record<VerificationResult, number> = {
  verified: 1,
  review_required: 2,
  rejected: 3,
};

export function calculateVerificationResult(
  aiResult: TemplateVerificationAIResult
): VerificationResult {
  const hasCriticalFinding = aiResult.findings.some(
    (finding) => finding.severity === "critical"
  );

  if (hasCriticalFinding) {
    return "rejected";
  }

  const hasHighFinding = aiResult.findings.some(
    (finding) => finding.severity === "high"
  );

  if (hasHighFinding) {
    return "review_required";
  }

  if (aiResult.overall_score < 60) {
    return "rejected";
  }

  if (aiResult.overall_score < 82) {
    return "review_required";
  }

  const failedChecks = aiResult.checks.filter(
    (check) => check.status === "fail"
  );

  if (failedChecks.length > 0) {
    return "review_required";
  }

  return "verified";
}

export function normalizeAIResult(
  result: TemplateVerificationAIResult
): TemplateVerificationAIResult {
  const checks: VerificationCheck[] = Array.isArray(result.checks)
    ? result.checks
    : [];

  const findings = Array.isArray(result.findings)
    ? result.findings
    : [];

  const evidence = Array.isArray(result.evidence)
    ? result.evidence
    : [];

  const overallScore = Math.max(
    0,
    Math.min(
      100,
      Number.isFinite(Number(result.overall_score))
        ? Number(result.overall_score)
        : 0
    )
  );

  const normalized: TemplateVerificationAIResult = {
    result: "review_required",
    overall_score: overallScore,
    summary:
      typeof result.summary === "string"
        ? result.summary.trim()
        : "Verification completed without a usable summary.",

    checks,

    findings,

    evidence,

    claimed_features_supported: Array.isArray(
      result.claimed_features_supported
    )
      ? result.claimed_features_supported.filter(
          (value): value is string => typeof value === "string"
        )
      : [],

    unsupported_claims: Array.isArray(result.unsupported_claims)
      ? result.unsupported_claims.filter(
          (value): value is string => typeof value === "string"
        )
      : [],

    suspicious_signals: Array.isArray(result.suspicious_signals)
      ? result.suspicious_signals.filter(
          (value): value is string => typeof value === "string"
        )
      : [],

    recommendations: Array.isArray(result.recommendations)
      ? result.recommendations.filter(
          (value): value is string => typeof value === "string"
        )
      : [],
  };

  normalized.result = calculateVerificationResult(normalized);

  return normalized;
}

export function getVerificationPriority(
  result: VerificationResult
): number {
  return RESULT_PRIORITY[result];
}