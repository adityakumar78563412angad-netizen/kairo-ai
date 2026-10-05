export type VerificationResult =
  | "verified"
  | "review_required"
  | "rejected";

export type VerificationCheckStatus =
  | "pass"
  | "warning"
  | "fail"
  | "not_checked";

export type VerificationCheck = {
  key: string;
  label: string;
  status: VerificationCheckStatus;
  score: number;
  explanation: string;
};

export type VerificationFinding = {
  severity: "low" | "medium" | "high" | "critical";
  category:
    | "metadata"
    | "visual"
    | "video"
    | "package"
    | "consistency"
    | "security"
    | "claim";
  title: string;
  description: string;
};

export type VerificationEvidence = {
  source:
    | "metadata"
    | "thumbnail"
    | "screenshot"
    | "demo_video"
    | "package";

  description: string;

  timestamp?: string;

  confidence: number;
};

export type TemplateVerificationAIResult = {
  result: VerificationResult;

  overall_score: number;

  summary: string;

  checks: VerificationCheck[];

  findings: VerificationFinding[];

  evidence: VerificationEvidence[];

  claimed_features_supported: string[];

  unsupported_claims: string[];

  suspicious_signals: string[];

  recommendations: string[];
};