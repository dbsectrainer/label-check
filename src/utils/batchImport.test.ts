import { describe, it, expect } from "vitest";
import { parseBatchRows, pairRowsWithImages } from "./batchImport";

const baseRow = {
  ttbId: "26088001000101",
  brandName: "PACIFIC HARBOR",
  classType: "London Dry Gin",
  alcoholContent: "42% Alc./Vol.",
  netContents: "750 mL",
  bottlerNameAddress: "Imported by Seattle Beverage Co, Seattle, WA",
  countryOfOrigin: "Product of UK",
};

describe("parseBatchRows", () => {
  it("builds an application from a complete row", () => {
    const [row] = parseBatchRows([
      { ...baseRow, imageFilename: "pacific.jpg" },
    ]);
    expect(row.error).toBeUndefined();
    expect(row.application.brandName).toBe("PACIFIC HARBOR");
    expect(row.application.isImported).toBe(true);
    expect(row.imageFilename).toBe("pacific.jpg");
  });

  it("reports missing required columns instead of inventing values", () => {
    const [row] = parseBatchRows([
      { ...baseRow, alcoholContent: "", netContents: " " },
    ]);
    expect(row.error).toContain("alcoholContent");
    expect(row.error).toContain("netContents");
  });
});

describe("pairRowsWithImages", () => {
  it("pairs rows to uploaded files by name, ignoring case", () => {
    const rows = parseBatchRows([
      { ...baseRow, imageFilename: "Pacific.JPG" },
      { ...baseRow, ttbId: "2", imageFilename: "missing.png" },
      { ...baseRow, ttbId: "3" },
    ]);
    const result = pairRowsWithImages(rows, ["pacific.jpg", "extra.png"]);

    expect(result.rows[0].imageFile).toBe("pacific.jpg");
    expect(result.rows[0].error).toBeUndefined();
    expect(result.rows[1].error).toContain("missing.png");
    expect(result.rows[2].imageFile).toBeUndefined();
    expect(result.rows[2].error).toBeUndefined(); // demo row: synthetic label
    expect(result.unusedFiles).toEqual(["extra.png"]);
  });
});
