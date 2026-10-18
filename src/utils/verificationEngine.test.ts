import { describe, it, expect } from "vitest";
import {
  verifyAlcoholContent,
  verifyNetContents,
  verifyGovernmentWarning,
  verifyTextField,
  runLabelVerification,
  FULL_STANDARD_GOV_WARNING,
} from "./verificationEngine";
import { SAMPLE_PRESETS } from "./labelGenerator";

describe("TTB COLA Verification Engine", () => {
  it("approves a 100% compliant distilled spirits label (Old Tom Distillery)", () => {
    const app = SAMPLE_PRESETS[0].application;
    const sampleOcrText = `
      OFFICIAL COLA SUBMISSION ARTWORK SPECIMEN
      OLD TOM DISTILLERY
      Reserve Barrel #42
      Kentucky Straight Bourbon Whiskey
      45% Alc./Vol. (90 Proof) • 750 mL
      Distilled and Bottled by Old Tom Distillery, Louisville, KY
      ${FULL_STANDARD_GOV_WARNING}
    `;

    const report = runLabelVerification(
      app,
      sampleOcrText,
      1150,
      "Unit Test OCR",
    );
    expect(report.overallStatus).toBe("APPROVED");
    expect(report.fields.every((f) => f.status === "pass")).toBe(true);
  });

  it("handles Dave Morrison's case nuance ('STONE'S THROW' vs 'Stone's Throw')", () => {
    const res = verifyTextField(
      "brandName",
      "Brand Name",
      "Stone's Throw",
      "STONE'S THROW AUTUMN HARVEST NAPA VALLEY",
      "27 CFR 5.64",
    );
    expect(res.status).toBe("pass");
    expect(res.confidence).toBeGreaterThanOrEqual(95);
    expect(res.message).toContain("capitalization");
  });

  it("catches Jenny Park's title-case 'Government Warning:' violation (27 CFR 16.22)", () => {
    const badWarningText = FULL_STANDARD_GOV_WARNING.replace(
      "GOVERNMENT WARNING:",
      "Government Warning:",
    );
    const res = verifyGovernmentWarning(badWarningText);
    expect(res.status).toBe("fail");
    expect(res.message).toContain("AUTOMATIC REJECTION");
    expect(res.subChecks?.[0].passed).toBe(false);
  });

  it("catches numeric ABV mismatches while accepting standard abbreviation variations", () => {
    const passAbv = verifyAlcoholContent(
      "13.5% Alc./Vol.",
      "NAPA VALLEY WINE 13.5% ALC. BY VOL. 750 ML",
    );
    expect(passAbv.status).toBe("pass");

    const failAbv = verifyAlcoholContent(
      "40% Alc./Vol. (80 Proof)",
      "HIGHLAND MIST LONDON DRY GIN 47% Alc./Vol. (94 Proof)",
    );
    expect(failAbv.status).toBe("fail");
    expect(failAbv.message).toContain("CRITICAL MISMATCH");
  });

  it("verifies Net Contents across spacing and capitalization differences", () => {
    const passNet = verifyNetContents("750 mL", "NET CONTENTS 750ML");
    expect(passNet.status).toBe("pass");

    const failNet = verifyNetContents("750 mL", "NET CONTENTS 375 mL");
    expect(failNet.status).toBe("fail");
  });

  it("does not pass a Government Warning with one word swapped", () => {
    const swapped = FULL_STANDARD_GOV_WARNING.replace("women", "people");
    const res = verifyGovernmentWarning(swapped);
    expect(res.status).not.toBe("pass");
    expect(res.subChecks?.[1].passed).toBe(false);
  });

  it("does not pass a Government Warning with one word dropped", () => {
    const dropped = FULL_STANDARD_GOV_WARNING.replace(
      "drink alcoholic beverages",
      "drink beverages",
    );
    const res = verifyGovernmentWarning(dropped);
    expect(res.status).not.toBe("pass");
  });

  it("does not count a brand name that only appears inside the bottler line", () => {
    const app = { ...SAMPLE_PRESETS[0].application };
    const ocrText = `
      RESERVE BARREL #42
      ${app.classType}
      ${app.alcoholContent} ${app.netContents}
      ${app.bottlerNameAddress}
      ${FULL_STANDARD_GOV_WARNING}
    `;
    const report = runLabelVerification(app, ocrText, 1000, "Unit Test OCR");
    const brand = report.fields.find((f) => f.fieldKey === "brandName");
    expect(brand?.status).not.toBe("pass");
  });

  it("flags a proof statement that is on the application but missing from the label", () => {
    const res = verifyAlcoholContent(
      "45% Alc./Vol. (90 Proof)",
      "OLD TOM 45% Alc./Vol. 750 mL",
    );
    expect(res.status).toBe("warning");
  });

  it("does not read a word starting with L as a liter unit", () => {
    const res = verifyNetContents("1 L", "EST. 1 LEXINGTON KY");
    expect(res.status).toBe("fail");
  });
});
