export type BeverageType = "distilled_spirits" | "wine" | "malt_beverage";

export interface COLAApplication {
  id: string;
  ttbId: string;
  beverageType: BeverageType;
  brandName: string;
  fancifulName?: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  bottlerNameAddress: string;
  countryOfOrigin?: string;
  isImported: boolean;
  governmentWarning: string;
  submittedDate: string;
  applicantName: string;
}

export type VerificationStatus = "pass" | "warning" | "fail";

export interface FieldCheckResult {
  fieldKey: string;
  fieldLabel: string;
  expectedValue: string;
  detectedSnippet: string;
  status: VerificationStatus;
  confidence: number;
  message: string;
  regulatoryNote?: string;
  subChecks?: {
    label: string;
    passed: boolean;
    detail: string;
  }[];
}

export interface VerificationReport {
  applicationId: string;
  ttbId: string;
  brandName: string;
  overallStatus: "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
  processingTimeMs: number;
  engineUsed: string;
  rawExtractedText: string;
  fields: FieldCheckResult[];
  timestamp: string;
  agentDecision?: "APPROVED" | "REJECTED" | "OVERRIDDEN";
  agentNotes?: string;
}

export interface SamplePreset {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: "green" | "amber" | "red" | "blue";
  description: string;
  stakeholderRef: string;
  application: COLAApplication;
  labelRenderConfig: LabelRenderConfig;
}

export interface LabelRenderConfig {
  backgroundStyle: "bourbon" | "wine" | "ipa" | "import_gin" | "glare_photo";
  brandText: string;
  fancifulText?: string;
  classText: string;
  abvText: string;
  netContentsText: string;
  bottlerText: string;
  countryText?: string;
  warningPrefix: string; // e.g. "GOVERNMENT WARNING:" or "Government Warning:"
  warningBody: string;
  simulateAngleDeg?: number;
  simulateGlare?: boolean;
  simulateLowContrast?: boolean;
}
