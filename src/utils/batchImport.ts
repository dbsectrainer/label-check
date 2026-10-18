import { COLAApplication } from "../types";
import { FULL_STANDARD_GOV_WARNING } from "./verificationEngine";

export interface BatchRow {
  index: number;
  application: COLAApplication;
  /** Label image named in the CSV; rows without one get a synthetic demo label */
  imageFilename?: string;
  /** Name of the uploaded file paired with this row */
  imageFile?: string;
  /** Raw CSV row, kept for synthetic demo label text (labelBrandText, warningHeader, ...) */
  raw: Record<string, string>;
  error?: string;
}

const REQUIRED_COLUMNS = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
] as const;

/** Accepts the template column names plus a few common alternates */
function readColumn(row: Record<string, string>, key: string): string {
  const aliases: Record<string, string[]> = {
    brandName: ["brandName", "BrandName"],
    classType: ["classType", "ClassType"],
    alcoholContent: ["alcoholContent", "ABV"],
    netContents: ["netContents", "NetContents"],
    bottlerNameAddress: ["bottlerNameAddress", "Bottler"],
    imageFilename: ["imageFilename", "image", "ImageFile"],
  };
  for (const name of aliases[key] ?? [key]) {
    const value = row[name]?.trim();
    if (value) return value;
  }
  return "";
}

export function parseBatchRows(rows: Record<string, string>[]): BatchRow[] {
  return rows.map((raw, idx) => {
    const missing = REQUIRED_COLUMNS.filter((col) => !readColumn(raw, col));
    const country = raw.countryOfOrigin?.trim() || undefined;

    const application: COLAApplication = {
      id: `CSV-${idx + 1}`,
      ttbId: raw.ttbId?.trim() || `Row ${idx + 1}`,
      beverageType: "distilled_spirits",
      brandName: readColumn(raw, "brandName"),
      fancifulName: raw.fancifulName?.trim() || undefined,
      classType: readColumn(raw, "classType"),
      alcoholContent: readColumn(raw, "alcoholContent"),
      netContents: readColumn(raw, "netContents"),
      bottlerNameAddress: readColumn(raw, "bottlerNameAddress"),
      isImported: Boolean(country),
      countryOfOrigin: country,
      governmentWarning: FULL_STANDARD_GOV_WARNING,
      submittedDate: new Date().toISOString().slice(0, 10),
      applicantName: "CSV Batch Import",
    };

    return {
      index: idx,
      application,
      imageFilename: readColumn(raw, "imageFilename") || undefined,
      raw,
      error:
        missing.length > 0
          ? `Missing required column(s): ${missing.join(", ")}`
          : undefined,
    };
  });
}

/**
 * Pairs each row's imageFilename with an uploaded file (case-insensitive).
 * Rows naming a file that wasn't uploaded get an error; uploaded files no row uses are returned.
 */
export function pairRowsWithImages(
  rows: BatchRow[],
  uploadedFileNames: string[],
): { rows: BatchRow[]; unusedFiles: string[] } {
  const byLowerName = new Map(
    uploadedFileNames.map((name) => [name.toLowerCase(), name]),
  );
  const used = new Set<string>();

  const paired = rows.map((row) => {
    if (!row.imageFilename) return { ...row, imageFile: undefined };
    const match = byLowerName.get(row.imageFilename.toLowerCase());
    if (!match) {
      return {
        ...row,
        imageFile: undefined,
        error: row.error ?? `Image "${row.imageFilename}" was not uploaded`,
      };
    }
    used.add(match);
    return { ...row, imageFile: match };
  });

  return {
    rows: paired,
    unusedFiles: uploadedFileNames.filter((name) => !used.has(name)),
  };
}
