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

export type VerificationFindingSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type VerificationFindingCategory =
  | "metadata"
  | "visual"
  | "video"
  | "package"
  | "consistency"
  | "security"
  | "claim";

export type VerificationFinding = {
  severity: VerificationFindingSeverity;
  category: VerificationFindingCategory;
  title: string;
  description: string;
};

export type VerificationEvidenceSource =
  | "metadata"
  | "thumbnail"
  | "screenshot"
  | "demo_video"
  | "package";

export type VerificationEvidence = {
  source: VerificationEvidenceSource;
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

export type NormalizedVerificationResult = {
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

export type VerificationMediaInput = {
  source:
    | "thumbnail"
    | "screenshot"
    | "demo_video";
  mimeType: string;
  fileUri: string;
};

export type VerificationTemplateMetadata = {
  id: string;
  name: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  features: string[] | null;
  requirements: string[] | null;
  tech_stack: string[] | null;
  license: string | null;
};