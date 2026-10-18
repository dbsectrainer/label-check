import {
  COLAApplication,
  FieldCheckResult,
  VerificationReport,
  VerificationStatus,
} from "../types";

export const STANDARD_GOV_WARNING_PREFIX = "GOVERNMENT WARNING:";
export const STANDARD_GOV_WARNING_CLAUSE_1 =
  "(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects.";
export const STANDARD_GOV_WARNING_CLAUSE_2 =
  "(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export const FULL_STANDARD_GOV_WARNING = `${STANDARD_GOV_WARNING_PREFIX} ${STANDARD_GOV_WARNING_CLAUSE_1} ${STANDARD_GOV_WARNING_CLAUSE_2}`;

/**
 * Normalizes punctuation and whitespace for comparison while preserving case when requested
 */
export function normalizeText(str: string, keepCase = false): string {
  const cleaned = str
    .replace(/[\u2018\u2019\u201B`´]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return keepCase ? cleaned : cleaned.toLowerCase();
}

/**
 * Strips all non-alphanumeric characters for loose token comparison
 */
export function alphanumericOnly(str: string): string {
  return normalizeText(str, false).replace(/[^a-z0-9]/g, "");
}

/**
 * Lowercase words joined by single spaces, punctuation removed, for word-for-word comparison
 */
export function wordSequence(str: string): string {
  return normalizeText(str, false)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Computes Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

/**
 * Calculates similarity score between 0 and 1
 */
export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, (maxLen - dist) / maxLen);
}

/**
 * Finds the best matching window in extracted OCR text for an expected string
 */
export function findBestSnippetInText(
  expected: string,
  extractedText: string,
): {
  snippet: string;
  exactCaseMatch: boolean;
  caseInsensitiveMatch: boolean;
  similarity: number;
} {
  if (!expected.trim() || !extractedText.trim()) {
    return {
      snippet: "Not found on label",
      exactCaseMatch: false,
      caseInsensitiveMatch: false,
      similarity: 0,
    };
  }

  const normExpectedCase = normalizeText(expected, true);
  const normExtractedCase = normalizeText(extractedText, true);

  // 1. Direct exact substring match (including case)
  if (normExtractedCase.includes(normExpectedCase)) {
    return {
      snippet: normExpectedCase,
      exactCaseMatch: true,
      caseInsensitiveMatch: true,
      similarity: 1.0,
    };
  }

  // 2. Direct case-insensitive substring match (e.g., "STONE'S THROW" vs "Stone's Throw")
  const lowerExpected = normExpectedCase.toLowerCase();
  const lowerExtracted = normExtractedCase.toLowerCase();
  const idx = lowerExtracted.indexOf(lowerExpected);
  if (idx !== -1) {
    const actualSlice = normExtractedCase.slice(
      idx,
      idx + normExpectedCase.length,
    );
    return {
      snippet: actualSlice,
      exactCaseMatch: actualSlice === normExpectedCase,
      caseInsensitiveMatch: true,
      similarity: 1.0,
    };
  }

  // 3. Alphanumeric-only substring check (ignores OCR punctuation noise like apostrophes/periods)
  const words = normExtractedCase.split(" ");
  const expectedWordsCount = normExpectedCase.split(" ").length;
  let bestWindow = "";
  let bestScore = 0;

  const minWindow = Math.max(1, expectedWordsCount - 2);
  const maxWindow = Math.min(words.length, expectedWordsCount + 3);

  for (let w = minWindow; w <= maxWindow; w++) {
    for (let i = 0; i <= words.length - w; i++) {
      const candidate = words.slice(i, i + w).join(" ");
      const score = stringSimilarity(
        alphanumericOnly(expected),
        alphanumericOnly(candidate),
      );
      if (score > bestScore) {
        bestScore = score;
        bestWindow = candidate;
      }
    }
  }

  const isAlphaMatch =
    alphanumericOnly(bestWindow) === alphanumericOnly(expected);

  return {
    snippet: bestScore > 0.45 ? bestWindow : "Not detected on label",
    exactCaseMatch: false,
    caseInsensitiveMatch: isAlphaMatch,
    similarity: bestScore,
  };
}

/**
 * Verifies Alcohol Content (ABV % and optional Proof)
 * Handles variations like "45% Alc./Vol. (90 Proof)" vs "45% ALC. BY VOL."
 */
export function verifyAlcoholContent(
  expectedAbv: string,
  extractedText: string,
): FieldCheckResult {
  const normExtract = normalizeText(extractedText, true);

  // Extract percentage numbers from expected & extracted
  const expectedPercentMatch = expectedAbv.match(/(\d+(?:\.\d+)?)\s*%/);
  const expectedProofMatch = expectedAbv.match(/(\d+(?:\.\d+)?)\s*proof/i);

  const detectedAbvRegex =
    /(\d+(?:\.\d+)?)\s*%\s*(?:alc\.?\s*(?:\/|\s*by\s*)\s*vol\.?|alcohol\s*(?:by\s*volume|\/?\s*vol\.?))?(?:\s*\(?\s*(\d+(?:\.\d+)?)\s*proof\s*\)?)?/gi;
  const allMatches = Array.from(normExtract.matchAll(detectedAbvRegex));

  if (!expectedPercentMatch) {
    // Fallback to text match if expected doesn't have a % sign
    const match = findBestSnippetInText(expectedAbv, extractedText);
    return {
      fieldKey: "alcoholContent",
      fieldLabel: "Alcohol Content (ABV / Proof)",
      expectedValue: expectedAbv,
      detectedSnippet: match.snippet,
      status: match.similarity >= 0.85 ? "pass" : "fail",
      confidence: Math.round(match.similarity * 100),
      message:
        match.similarity >= 0.85
          ? "Alcohol content matches application."
          : "Alcohol content mismatch.",
      regulatoryNote:
        "27 CFR § 5.65 / § 4.36 / § 7.65 — Mandatory Alcohol Content Statement",
    };
  }

  const expectedPct = parseFloat(expectedPercentMatch[1]);
  const expectedProof = expectedProofMatch
    ? parseFloat(expectedProofMatch[1])
    : null;

  if (allMatches.length === 0) {
    return {
      fieldKey: "alcoholContent",
      fieldLabel: "Alcohol Content (ABV / Proof)",
      expectedValue: expectedAbv,
      detectedSnippet: "No ABV % statement detected",
      status: "fail",
      confidence: 0,
      message: `Expected ${expectedPct}% ABV, but no alcohol percentage was found on the label.`,
      regulatoryNote:
        "27 CFR § 5.65 — Alcohol content must be stated in percent alcohol by volume.",
    };
  }

  // Find best numeric match
  for (const m of allMatches) {
    const foundSnippet = m[0].trim();
    const foundPct = parseFloat(m[1]);
    const foundProof = m[2] ? parseFloat(m[2]) : null;

    if (Math.abs(foundPct - expectedPct) < 0.01) {
      // Check proof if both have proof
      if (
        expectedProof !== null &&
        foundProof !== null &&
        Math.abs(expectedProof - foundProof) >= 0.5
      ) {
        return {
          fieldKey: "alcoholContent",
          fieldLabel: "Alcohol Content (ABV / Proof)",
          expectedValue: expectedAbv,
          detectedSnippet: foundSnippet,
          status: "fail",
          confidence: 95,
          message: `ABV matches (${foundPct}%), but Proof mismatches: application specifies ${expectedProof} Proof, label shows ${foundProof} Proof.`,
          regulatoryNote:
            "27 CFR § 5.65 — Degrees of proof must equal twice the ABV percentage.",
        };
      }

      if (expectedProof !== null && foundProof === null) {
        return {
          fieldKey: "alcoholContent",
          fieldLabel: "Alcohol Content (ABV / Proof)",
          expectedValue: expectedAbv,
          detectedSnippet: foundSnippet,
          status: "warning",
          confidence: 80,
          message: `ABV matches (${foundPct}%), but the ${expectedProof} Proof statement on the application was not found on the label.`,
          regulatoryNote:
            "27 CFR § 5.65 — Proof is optional on labels, but the label must match the application as submitted.",
        };
      }

      const exactString =
        normalizeText(expectedAbv, false) ===
        normalizeText(foundSnippet, false);
      return {
        fieldKey: "alcoholContent",
        fieldLabel: "Alcohol Content (ABV / Proof)",
        expectedValue: expectedAbv,
        detectedSnippet: foundSnippet,
        status: "pass",
        confidence: exactString ? 100 : 96,
        message: exactString
          ? `Exact match (${foundPct}% ABV${foundProof ? `, ${foundProof} Proof` : ""}).`
          : `Numeric ABV match (${foundPct}% ABV) with standard TTB abbreviation formatting ("${foundSnippet}").`,
        regulatoryNote:
          '27 CFR § 5.65 — "Alc./Vol." and "Alc. by Vol." are interchangeable approved abbreviations.',
      };
    }
  }

  // Mismatched percentage found
  const firstFound = allMatches[0];
  const foundPct = parseFloat(firstFound[1]);
  return {
    fieldKey: "alcoholContent",
    fieldLabel: "Alcohol Content (ABV / Proof)",
    expectedValue: expectedAbv,
    detectedSnippet: firstFound[0].trim(),
    status: "fail",
    confidence: 98,
    message: `CRITICAL MISMATCH: Application states ${expectedPct}% ABV, but label displays ${foundPct}% ABV.`,
    regulatoryNote:
      "27 CFR § 5.65 — Numeric ABV on label must match COLA application.",
  };
}

/**
 * Verifies Net Contents (e.g. 750 mL, 750ml, 12 FL OZ, 1.75 L)
 */
export function verifyNetContents(
  expectedNet: string,
  extractedText: string,
): FieldCheckResult {
  const normExtract = normalizeText(extractedText, true);

  const unitRegex =
    /(\d+(?:\.\d+)?)\s*(ml|milliliters?|l|liters?|fl\.?\s*oz\.?|fluid\s*ounces?|oz\.?|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?)(?![a-z])/gi;
  const expectedMatch = unitRegex.exec(expectedNet);
  unitRegex.lastIndex = 0;

  const normalizeUnit = (u: string): string => {
    const clean = u.toLowerCase().replace(/[^a-z]/g, "");
    if (clean === "ml" || clean.startsWith("milliliter")) return "mL";
    if (clean === "l" || clean.startsWith("liter")) return "L";
    if (clean.includes("fl") || clean.includes("oz") || clean.includes("ounce"))
      return "fl oz";
    if (clean.startsWith("pt") || clean.startsWith("pint")) return "pt";
    if (clean.startsWith("qt") || clean.startsWith("quart")) return "qt";
    if (clean.startsWith("gal")) return "gal";
    return clean;
  };

  const allFound = Array.from(normExtract.matchAll(unitRegex));

  if (!expectedMatch) {
    const fallback = findBestSnippetInText(expectedNet, extractedText);
    return {
      fieldKey: "netContents",
      fieldLabel: "Net Contents",
      expectedValue: expectedNet,
      detectedSnippet: fallback.snippet,
      status: fallback.similarity >= 0.85 ? "pass" : "fail",
      confidence: Math.round(fallback.similarity * 100),
      message:
        fallback.similarity >= 0.85
          ? "Net contents match application."
          : "Net contents not found or mismatched.",
      regulatoryNote: "27 CFR § 5.70 — Mandatory Net Contents Statement",
    };
  }

  const expVal = parseFloat(expectedMatch[1]);
  const expUnit = normalizeUnit(expectedMatch[2]);

  for (const m of allFound) {
    const foundVal = parseFloat(m[1]);
    const foundUnit = normalizeUnit(m[2]);

    if (Math.abs(foundVal - expVal) < 0.01 && foundUnit === expUnit) {
      return {
        fieldKey: "netContents",
        fieldLabel: "Net Contents",
        expectedValue: expectedNet,
        detectedSnippet: m[0].trim(),
        status: "pass",
        confidence: 100,
        message: `Net contents verified (${expVal} ${expUnit}).`,
        regulatoryNote: "27 CFR § 5.70 — Metric standard of fill verified.",
      };
    }
  }

  if (allFound.length > 0) {
    const first = allFound[0];
    return {
      fieldKey: "netContents",
      fieldLabel: "Net Contents",
      expectedValue: expectedNet,
      detectedSnippet: first[0].trim(),
      status: "fail",
      confidence: 95,
      message: `Volume mismatch: Application states "${expectedNet}", but label shows "${first[0].trim()}".`,
      regulatoryNote:
        "27 CFR § 5.70 — Net contents on label must match approved container size.",
    };
  }

  return {
    fieldKey: "netContents",
    fieldLabel: "Net Contents",
    expectedValue: expectedNet,
    detectedSnippet: "No volume statement detected",
    status: "fail",
    confidence: 0,
    message: `Expected "${expectedNet}", but no net contents statement was found on the label.`,
    regulatoryNote: "27 CFR § 5.70 — Mandatory Net Contents Statement missing.",
  };
}

/**
 * Strict 27 CFR Part 16 Government Health Warning Verification
 * Directly addresses Jenny Park's interview requirement:
 * - "GOVERNMENT WARNING:" must be in ALL CAPS
 * - Word-for-word verification of both clauses (1) and (2)
 */
export function verifyGovernmentWarning(
  extractedText: string,
): FieldCheckResult {
  const normCase = normalizeText(extractedText, true);

  // Check if any warning header exists
  const headerRegex = /(government\s+warning\s*:?)/i;
  const headerMatch = normCase.match(headerRegex);

  if (!headerMatch) {
    return {
      fieldKey: "governmentWarning",
      fieldLabel: "Government Health Warning (27 CFR Part 16)",
      expectedValue: FULL_STANDARD_GOV_WARNING,
      detectedSnippet: "No Government Warning found on label",
      status: "fail",
      confidence: 0,
      message:
        "REJECT: Mandatory Government Health Warning statement is completely missing from the label.",
      regulatoryNote:
        "27 CFR § 16.21 — Mandatory Health Warning Statement required on all alcoholic beverages ≥ 0.5% ABV.",
      subChecks: [
        {
          label: '"GOVERNMENT WARNING:" in ALL CAPS',
          passed: false,
          detail: "Header not found",
        },
        {
          label: "Section (1) Surgeon General pregnancy clause",
          passed: false,
          detail: "Clause (1) missing",
        },
        {
          label: "Section (2) Impair ability / health problems clause",
          passed: false,
          detail: "Clause (2) missing",
        },
      ],
    };
  }

  const actualHeader = headerMatch[1].trim();
  const isAllCapsHeader = actualHeader.startsWith("GOVERNMENT WARNING");
  const hasColon = actualHeader.endsWith(":");

  // Extract warning block starting from headerMatch
  const startIdx = normCase.indexOf(headerMatch[0]);
  const warningSlice = normCase.slice(startIdx, startIdx + 380);

  // Check Clause 1 and Clause 2 word accuracy
  const c1Sim = findBestSnippetInText(
    STANDARD_GOV_WARNING_CLAUSE_1,
    warningSlice,
  ).similarity;
  const c2Sim = findBestSnippetInText(
    STANDARD_GOV_WARNING_CLAUSE_2,
    warningSlice,
  ).similarity;

  const sliceLower = warningSlice.toLowerCase();
  const hasSurgeonGeneral = sliceLower.includes("surgeon general");
  const hasPregnancy =
    sliceLower.includes("pregnancy") && sliceLower.includes("birth defects");
  const hasImpair =
    sliceLower.includes("impairs your ability to drive") &&
    sliceLower.includes("operate machinery");
  const hasHealthProblems = sliceLower.includes("may cause health problems");

  // Word-for-word: every statutory word, in order, with nothing added or dropped (case and punctuation ignored)
  const sliceWords = ` ${wordSequence(warningSlice)} `;
  const clause1Passed = sliceWords.includes(
    ` ${wordSequence(STANDARD_GOV_WARNING_CLAUSE_1)} `,
  );
  const clause2Passed = sliceWords.includes(
    ` ${wordSequence(STANDARD_GOV_WARNING_CLAUSE_2)} `,
  );

  // Near-miss: likely OCR noise, but could be a reworded warning, so an agent must look
  const clause1NearMiss =
    !clause1Passed && c1Sim >= 0.92 && hasSurgeonGeneral && hasPregnancy;
  const clause2NearMiss =
    !clause2Passed && c2Sim >= 0.92 && hasImpair && hasHealthProblems;

  const subChecks = [
    {
      label: '"GOVERNMENT WARNING:" Header in ALL CAPS',
      passed: isAllCapsHeader && hasColon,
      detail:
        isAllCapsHeader && hasColon
          ? `Found exact uppercase "${actualHeader}"`
          : `VIOLATION: Found "${actualHeader}" — must be all uppercase "GOVERNMENT WARNING:" (27 CFR § 16.22(a))`,
    },
    {
      label: "Clause (1): Surgeon General / Pregnancy / Birth Defects verbatim",
      passed: clause1Passed,
      detail: clause1Passed
        ? "Verbatim match"
        : `Wording differs from statute in Clause (1) (${Math.round(c1Sim * 100)}% similarity)`,
    },
    {
      label:
        "Clause (2): Drive a car / Operate machinery / Health problems verbatim",
      passed: clause2Passed,
      detail: clause2Passed
        ? "Verbatim match"
        : `Wording differs from statute in Clause (2) (${Math.round(c2Sim * 100)}% similarity)`,
    },
  ];

  const headerPassed = isAllCapsHeader && hasColon;
  const clause1Ok = clause1Passed || clause1NearMiss;
  const clause2Ok = clause2Passed || clause2NearMiss;

  let status: VerificationStatus = "pass";
  let failureReason =
    "Mandatory Government Health Warning verified word-for-word with ALL CAPS header.";
  if (!isAllCapsHeader) {
    status = "fail";
    failureReason = `AUTOMATIC REJECTION: Header appears as "${actualHeader}" (Title/Mixed Case) instead of mandatory ALL CAPS "GOVERNMENT WARNING:".`;
  } else if (!headerPassed || !clause1Ok || !clause2Ok) {
    status = "fail";
    failureReason =
      "AUTOMATIC REJECTION: Government Warning body text deviates from the exact statutory wording required by 27 CFR § 16.21.";
  } else if (!clause1Passed || !clause2Passed) {
    status = "warning";
    failureReason =
      "Government Warning is close to the statutory wording but not word-for-word. Agent must compare the label against 27 CFR § 16.21 (could be OCR noise or altered wording).";
  }

  return {
    fieldKey: "governmentWarning",
    fieldLabel: "Government Health Warning (27 CFR Part 16)",
    expectedValue: FULL_STANDARD_GOV_WARNING,
    detectedSnippet: warningSlice.slice(0, 295),
    status,
    confidence: Math.round(((c1Sim + c2Sim) / 2) * 100),
    message: failureReason,
    regulatoryNote:
      "27 CFR § 16.21 & § 16.22 — Header must be in capital letters and bold type; body text must be exact.",
    subChecks,
  };
}

/**
 * Generic smart text field verifier (Brand Name, Class/Type, Bottler, Country)
 * Implements Dave Morrison's nuance rule:
 * - Case differences ("STONE'S THROW" vs "Stone's Throw") are flagged as PASS/WARNING nuance rather than hard rejection
 */
export function verifyTextField(
  fieldKey: string,
  fieldLabel: string,
  expectedValue: string,
  extractedText: string,
  regulatoryNote: string,
): FieldCheckResult {
  const match = findBestSnippetInText(expectedValue, extractedText);

  if (match.exactCaseMatch) {
    return {
      fieldKey,
      fieldLabel,
      expectedValue,
      detectedSnippet: match.snippet,
      status: "pass",
      confidence: 100,
      message: "Exact match with COLA application.",
      regulatoryNote,
    };
  }

  if (match.caseInsensitiveMatch) {
    return {
      fieldKey,
      fieldLabel,
      expectedValue,
      detectedSnippet: match.snippet,
      status: "pass",
      confidence: 98,
      message: `Matches application text (capitalization/formatting variation: "${match.snippet}" vs "${expectedValue}" — acceptable per TTB agent review guidelines).`,
      regulatoryNote,
    };
  }

  if (match.similarity >= 0.82) {
    return {
      fieldKey,
      fieldLabel,
      expectedValue,
      detectedSnippet: match.snippet,
      status: "warning",
      confidence: Math.round(match.similarity * 100),
      message: `Close match (${Math.round(match.similarity * 100)}% similarity). Minor typography or OCR character difference — agent visual confirmation recommended.`,
      regulatoryNote,
    };
  }

  return {
    fieldKey,
    fieldLabel,
    expectedValue,
    detectedSnippet: match.snippet,
    status: "fail",
    confidence: Math.round(match.similarity * 100),
    message: `Mismatch: Expected "${expectedValue}", detected "${match.snippet}".`,
    regulatoryNote,
  };
}

/**
 * Runs complete COLA verification across all application fields
 */
/**
 * Removes the bottler/importer statement from the label text so name fields can't match inside it
 * (e.g. brand "OLD TOM DISTILLERY" inside "Distilled and Bottled by Old Tom Distillery, Louisville, KY").
 */
export function withoutBottlerStatement(
  extractedText: string,
  bottlerNameAddress?: string,
): string {
  const normText = normalizeText(extractedText, true);
  if (!bottlerNameAddress?.trim()) return normText;

  const match = findBestSnippetInText(bottlerNameAddress, normText);
  if (!match.caseInsensitiveMatch && match.similarity < 0.82) return normText;

  const idx = normText.toLowerCase().indexOf(match.snippet.toLowerCase());
  if (idx === -1) return normText;
  return `${normText.slice(0, idx)} ${normText.slice(idx + match.snippet.length)}`;
}

export function runLabelVerification(
  application: COLAApplication,
  extractedText: string,
  processingTimeMs: number,
  engineUsed: string,
): VerificationReport {
  const fields: FieldCheckResult[] = [];
  const textWithoutBottler = withoutBottlerStatement(
    extractedText,
    application.bottlerNameAddress,
  );

  // 1. Brand Name
  fields.push(
    verifyTextField(
      "brandName",
      "Brand Name (Box 6)",
      application.brandName,
      textWithoutBottler,
      "27 CFR § 5.64 / § 4.33 / § 7.64 — Brand name on label must match Item 6 on TTB Form 5100.31.",
    ),
  );

  // 2. Fanciful Name (if present on application)
  if (application.fancifulName && application.fancifulName.trim() !== "") {
    fields.push(
      verifyTextField(
        "fancifulName",
        "Fanciful Name (Box 7)",
        application.fancifulName,
        textWithoutBottler,
        "27 CFR § 5.63 — If a fanciful name is claimed in Box 7, it must appear on the label.",
      ),
    );
  }

  // 3. Class / Type Designation
  fields.push(
    verifyTextField(
      "classType",
      "Class / Type Designation",
      application.classType,
      extractedText,
      "27 CFR § 5.141 / § 4.34 / § 7.141 — Mandatory class and type designation in accordance with standards of identity.",
    ),
  );

  // 4. Alcohol Content (ABV / Proof)
  fields.push(verifyAlcoholContent(application.alcoholContent, extractedText));

  // 5. Net Contents
  fields.push(verifyNetContents(application.netContents, extractedText));

  // 6. Bottler / Producer Name & Address
  if (
    application.bottlerNameAddress &&
    application.bottlerNameAddress.trim() !== ""
  ) {
    fields.push(
      verifyTextField(
        "bottlerNameAddress",
        "Name & Address of Bottler / Importer (Box 8)",
        application.bottlerNameAddress,
        extractedText,
        "27 CFR § 5.66 — Name and address (City, State) of bottler, distiller, or importer.",
      ),
    );
  }

  // 7. Country of Origin (Required for imports)
  if (application.isImported && application.countryOfOrigin) {
    fields.push(
      verifyTextField(
        "countryOfOrigin",
        "Country of Origin (Import Requirement)",
        application.countryOfOrigin,
        extractedText,
        "19 CFR § 134.11 & 27 CFR § 5.69 — Mandatory country of origin statement for imported alcoholic beverages.",
      ),
    );
  }

  // 8. Government Health Warning Statement
  fields.push(verifyGovernmentWarning(extractedText));

  // Compute overall status
  const hasFail = fields.some((f) => f.status === "fail");
  const hasWarning = fields.some((f) => f.status === "warning");

  let overallStatus: "APPROVED" | "NEEDS_REVIEW" | "REJECTED" = "APPROVED";
  if (hasFail) {
    overallStatus = "REJECTED";
  } else if (hasWarning) {
    overallStatus = "NEEDS_REVIEW";
  }

  return {
    applicationId: application.id,
    ttbId: application.ttbId,
    brandName: application.brandName,
    overallStatus,
    processingTimeMs,
    engineUsed,
    rawExtractedText: extractedText,
    fields,
    timestamp: new Date().toISOString(),
  };
}
