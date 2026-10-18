import { SamplePreset, LabelRenderConfig } from "../types";
import {
  FULL_STANDARD_GOV_WARNING,
  STANDARD_GOV_WARNING_CLAUSE_1,
  STANDARD_GOV_WARNING_CLAUSE_2,
} from "./verificationEngine";

export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: "preset-compliant-bourbon",
    title: "1. Old Tom Distillery (Compliant)",
    subtitle: "Kentucky Straight Bourbon • 45% ABV • 750 mL",
    badge: "100% COMPLIANT",
    badgeColor: "green",
    description:
      "Matches the exact specification in the TTB take-home instructions. All fields and the ALL CAPS Government Warning match word-for-word.",
    stakeholderRef:
      "Reference: Take-Home Prompt Sample Distilled Spirits Label",
    application: {
      id: "APP-2026-001",
      ttbId: "26014001000412",
      beverageType: "distilled_spirits",
      brandName: "OLD TOM DISTILLERY",
      fancifulName: "Reserve Barrel #42",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      bottlerNameAddress:
        "Distilled and Bottled by Old Tom Distillery, Louisville, KY",
      isImported: false,
      governmentWarning: FULL_STANDARD_GOV_WARNING,
      submittedDate: "2026-10-15",
      applicantName: "Old Tom Distilling Co.",
    },
    labelRenderConfig: {
      backgroundStyle: "bourbon",
      brandText: "OLD TOM DISTILLERY",
      fancifulText: "Reserve Barrel #42",
      classText: "Kentucky Straight Bourbon Whiskey",
      abvText: "45% Alc./Vol. (90 Proof)",
      netContentsText: "750 mL",
      bottlerText:
        "Distilled and Bottled by Old Tom Distillery, Louisville, KY",
      warningPrefix: "GOVERNMENT WARNING:",
      warningBody: `${STANDARD_GOV_WARNING_CLAUSE_1} ${STANDARD_GOV_WARNING_CLAUSE_2}`,
    },
  },
  {
    id: "preset-dave-nuance",
    title: "2. Stone's Throw Reserve (Case Nuance)",
    subtitle: "Label in ALL CAPS vs. Title Case on COLA Form",
    badge: "CASE NUANCE (PASS)",
    badgeColor: "blue",
    description:
      'Demonstrates Senior Agent Dave Morrison\'s feedback: Application says "Stone\'s Throw", label artwork uses "STONE\'S THROW" and "45% ALC. BY VOL.". Smart matching approves without false-positive rejection.',
    stakeholderRef:
      "Reference: Dave Morrison (Senior Compliance Agent, 28 yrs)",
    application: {
      id: "APP-2026-002",
      ttbId: "26014001000589",
      beverageType: "wine",
      brandName: "Stone's Throw",
      fancifulName: "Autumn Harvest",
      classType: "Napa Valley Cabernet Sauvignon",
      alcoholContent: "13.5% Alc./Vol.",
      netContents: "750 mL",
      bottlerNameAddress:
        "Cellared and Bottled by Stone's Throw Vineyards, St. Helena, CA",
      isImported: false,
      governmentWarning: FULL_STANDARD_GOV_WARNING,
      submittedDate: "2026-10-16",
      applicantName: "Stone's Throw Vineyards LLC",
    },
    labelRenderConfig: {
      backgroundStyle: "wine",
      brandText: "STONE'S THROW",
      fancifulText: "AUTUMN HARVEST",
      classText: "NAPA VALLEY CABERNET SAUVIGNON",
      abvText: "13.5% ALC. BY VOL.",
      netContentsText: "750 ML",
      bottlerText:
        "Cellared and Bottled by Stone's Throw Vineyards, St. Helena, CA",
      warningPrefix: "GOVERNMENT WARNING:",
      warningBody: `${STANDARD_GOV_WARNING_CLAUSE_1} ${STANDARD_GOV_WARNING_CLAUSE_2}`,
    },
  },
  {
    id: "preset-jenny-warning-trap",
    title: "3. Cascade Hops IPA (Warning Violation)",
    subtitle: 'Title-case "Government Warning:" instead of ALL CAPS',
    badge: "VIOLATION: 27 CFR § 16.22",
    badgeColor: "red",
    description:
      'Demonstrates Junior Agent Jenny Park\'s real-world catch: The brewer used "Government Warning:" in title case instead of mandatory ALL CAPS "GOVERNMENT WARNING:". Automatically flagged for rejection.',
    stakeholderRef: "Reference: Jenny Park (Junior Compliance Agent, 8 mos)",
    application: {
      id: "APP-2026-003",
      ttbId: "26014001000703",
      beverageType: "malt_beverage",
      brandName: "CASCADE PEAK BREWING",
      fancifulName: "Foggy Timber",
      classType: "India Pale Ale",
      alcoholContent: "6.8% Alc./Vol.",
      netContents: "12 FL OZ",
      bottlerNameAddress:
        "Brewed and Canned by Cascade Peak Brewing, Seattle, WA",
      isImported: false,
      governmentWarning: FULL_STANDARD_GOV_WARNING,
      submittedDate: "2026-10-16",
      applicantName: "Cascade Peak Brewing Co.",
    },
    labelRenderConfig: {
      backgroundStyle: "ipa",
      brandText: "CASCADE PEAK BREWING",
      fancifulText: "Foggy Timber",
      classText: "India Pale Ale",
      abvText: "6.8% Alc./Vol.",
      netContentsText: "12 FL OZ",
      bottlerText: "Brewed and Canned by Cascade Peak Brewing, Seattle, WA",
      warningPrefix: "Government Warning:",
      warningBody: `${STANDARD_GOV_WARNING_CLAUSE_1} ${STANDARD_GOV_WARNING_CLAUSE_2}`,
    },
  },
  {
    id: "preset-abv-mismatch",
    title: "4. Highland Mist Gin (ABV Mismatch)",
    subtitle: "Form states 40% ABV • Label prints 47% ABV",
    badge: "VIOLATION: ABV MISMATCH",
    badgeColor: "red",
    description:
      "Demonstrates numeric discrepancy detection: Importer entered 40% Alc./Vol. (80 Proof) on the COLA application, but the bottle artwork states 47% Alc./Vol. (94 Proof).",
    stakeholderRef:
      "Reference: Sarah Chen (Deputy Director of Label Compliance)",
    application: {
      id: "APP-2026-004",
      ttbId: "26014001000819",
      beverageType: "distilled_spirits",
      brandName: "HIGHLAND MIST",
      fancifulName: "Botanical Reserve",
      classType: "London Dry Gin",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      bottlerNameAddress: "Imported by Atlantic Spirits Imports, New York, NY",
      countryOfOrigin: "Product of Scotland",
      isImported: true,
      governmentWarning: FULL_STANDARD_GOV_WARNING,
      submittedDate: "2026-10-17",
      applicantName: "Atlantic Spirits Imports Inc.",
    },
    labelRenderConfig: {
      backgroundStyle: "import_gin",
      brandText: "HIGHLAND MIST",
      fancifulText: "Botanical Reserve",
      classText: "London Dry Gin",
      abvText: "47% Alc./Vol. (94 Proof)",
      netContentsText: "750 mL",
      bottlerText: "Imported by Atlantic Spirits Imports, New York, NY",
      countryText: "Product of Scotland",
      warningPrefix: "GOVERNMENT WARNING:",
      warningBody: `${STANDARD_GOV_WARNING_CLAUSE_1} ${STANDARD_GOV_WARNING_CLAUSE_2}`,
    },
  },
  {
    id: "preset-tilted-glare",
    title: "5. Imperfect Bottle Photo (Tilted + Glare)",
    subtitle: "Rotated photo with lighting glare & low contrast",
    badge: "PREPROCESSOR DEMO",
    badgeColor: "amber",
    description:
      "Demonstrates Jenny Park's wishlist feature: Handles an imperfectly shot label photographed at an angle with bottle glare. Toggle the Image Enhancer to deskew and boost contrast for OCR.",
    stakeholderRef: "Reference: Jenny Park — Imperfectly Shot Label Photos",
    application: {
      id: "APP-2026-005",
      ttbId: "26014001000955",
      beverageType: "distilled_spirits",
      brandName: "COPPER STILL",
      fancifulName: "Small Batch",
      classType: "Straight Rye Whiskey",
      alcoholContent: "50% Alc./Vol. (100 Proof)",
      netContents: "750 mL",
      bottlerNameAddress: "Bottled by Copper Still Distilling, Frankfort, KY",
      isImported: false,
      governmentWarning: FULL_STANDARD_GOV_WARNING,
      submittedDate: "2026-10-17",
      applicantName: "Copper Still Distilling",
    },
    labelRenderConfig: {
      backgroundStyle: "glare_photo",
      brandText: "COPPER STILL",
      fancifulText: "Small Batch",
      classText: "Straight Rye Whiskey",
      abvText: "50% Alc./Vol. (100 Proof)",
      netContentsText: "750 mL",
      bottlerText: "Bottled by Copper Still Distilling, Frankfort, KY",
      warningPrefix: "GOVERNMENT WARNING:",
      warningBody: `${STANDARD_GOV_WARNING_CLAUSE_1} ${STANDARD_GOV_WARNING_CLAUSE_2}`,
      simulateAngleDeg: -3.5,
      simulateGlare: true,
    },
  },
];

/**
 * Generates a realistic, high-resolution alcohol bottle label PNG DataURL using HTML5 Canvas.
 * Can be directly fed into Tesseract.js OCR or AI Vision API, and downloaded by the user.
 */
export function renderLabelToDataUrl(config: LabelRenderConfig): string {
  const canvas = document.createElement("canvas");
  canvas.width = 920;
  canvas.height = 1120;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Fill outer background
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  if (config.simulateAngleDeg) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((config.simulateAngleDeg * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
  }

  // Main label card background — high contrast for crisp OCR while looking like an authentic label
  const pad = 45;
  const cardW = canvas.width - pad * 2;
  const cardH = canvas.height - pad * 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(pad, pad, cardW, cardH);

  // Decorative border based on style
  const borderColors: Record<LabelRenderConfig["backgroundStyle"], string> = {
    bourbon: "#78350f",
    wine: "#881337",
    ipa: "#14532d",
    import_gin: "#1e3a8a",
    glare_photo: "#334155",
  };
  const accentColor = borderColors[config.backgroundStyle];

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 8;
  ctx.strokeRect(pad + 18, pad + 18, cardW - 36, cardH - 36);

  ctx.lineWidth = 2;
  ctx.strokeRect(pad + 28, pad + 28, cardW - 56, cardH - 56);

  // Top Header Banner
  ctx.fillStyle = accentColor;
  ctx.fillRect(pad + 45, pad + 50, cardW - 90, 44);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "OFFICIAL COLA SUBMISSION ARTWORK SPECIMEN",
    canvas.width / 2,
    pad + 79,
  );

  // Brand Name (Large, high contrast)
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 52px Georgia, serif";
  ctx.fillText(config.brandText, canvas.width / 2, 235);

  // Fanciful Name
  let currentY = 305;
  if (config.fancifulText) {
    ctx.fillStyle = accentColor;
    ctx.font = "bold 34px Georgia, serif";
    ctx.fillText(config.fancifulText, canvas.width / 2, currentY);
    currentY += 65;
  }

  // Horizontal divider
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(180, currentY - 25);
  ctx.lineTo(canvas.width - 180, currentY - 25);
  ctx.stroke();

  // Class / Type Designation
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 36px Arial, sans-serif";
  ctx.fillText(config.classText, canvas.width / 2, currentY + 25);
  currentY += 95;

  // Alcohol Content & Net Contents Row
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px Arial, sans-serif";
  ctx.fillText(
    `${config.abvText}   •   ${config.netContentsText}`,
    canvas.width / 2,
    currentY,
  );
  currentY += 75;

  // Bottler / Producer Name & Address
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 25px Arial, sans-serif";
  ctx.fillText(config.bottlerText, canvas.width / 2, currentY);
  currentY += 50;

  // Country of Origin if applicable
  if (config.countryText) {
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillText(config.countryText, canvas.width / 2, currentY);
    currentY += 45;
  } else {
    currentY += 20;
  }

  // Government Health Warning Box at bottom of label
  const boxX = pad + 50;
  const boxY = 665;
  const boxW = cardW - 100;
  const boxH = 355;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // Render Government Warning text with word wrapping
  ctx.textAlign = "left";
  ctx.fillStyle = "#000000";
  ctx.font = "bold 25px Arial, sans-serif";

  const fullWarningText = `${config.warningPrefix} ${config.warningBody}`;
  const words = fullWarningText.split(" ");
  const maxTextWidth = boxW - 48;
  let line = "";
  let textY = boxY + 46;
  const lineHeight = 38;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxTextWidth && i > 0) {
      ctx.fillText(line.trim(), boxX + 24, textY);
      line = words[i] + " ";
      textY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) {
    ctx.fillText(line.trim(), boxX + 24, textY);
  }

  // Optional simulated glare streak for preset #5
  if (config.simulateGlare) {
    const grad = ctx.createLinearGradient(120, 120, 750, 750);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.08)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.48)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.08)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(pad, pad, cardW, cardH);
  }

  ctx.restore();
  return canvas.toDataURL("image/png");
}
