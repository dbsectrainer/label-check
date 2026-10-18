// Run with: node matcher.test.js
const assert = require("node:assert/strict");
const M = require("./matcher.js");

let n = 0;
function t(name, fn) {
  fn();
  n++;
  console.log("ok  " + name);
}

const good = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottlerNameAddress:
    "Distilled and bottled by Old Tom Distillery, Bardstown, KY",
  countryOfOrigin: null,
  governmentWarning: M.WARNING_TEXT,
  warningHeadingBold: true,
  imageQuality: "good",
  notes: "",
};
const app = {
  brand: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  abv: "45%",
  net: "750 mL",
  bottler: "Old Tom Distillery, Bardstown, KY",
  country: "",
};

t("clean label matches", () => {
  const r = M.verify(app, good);
  assert.equal(r.verdict, "match");
  assert.equal(r.counts.fail, 0);
});

t("brand case difference passes with a note (STONE'S THROW)", () => {
  const r = M.compareText("Stone's Throw", "STONE'S THROW");
  assert.equal(r.status, "pass");
  assert.match(r.note, /capitalization/);
});

t("curly apostrophe is treated the same", () => {
  assert.equal(M.compareText("Stone's Throw", "STONE’S THROW").status, "pass");
});

t("near-miss spelling goes to review", () => {
  assert.equal(
    M.compareText("Old Tom Distillery", "Old Tom Distilery").status,
    "review",
  );
});

t("different brand fails", () => {
  assert.equal(
    M.compareText("Old Tom Distillery", "Young Bill Brewing").status,
    "fail",
  );
});

t("abv mismatch fails", () => {
  const r = M.compareAbv("45%", "40% Alc./Vol. (80 Proof)");
  assert.equal(r.status, "fail");
});

t("abv plain number and proof-only are understood", () => {
  assert.equal(M.compareAbv("45", "45% Alc./Vol.").status, "pass");
  assert.equal(M.compareAbv("45%", "90 Proof").status, "pass");
});

t("proof that is not twice abv is flagged", () => {
  assert.equal(
    M.compareAbv("45%", "45% Alc./Vol. (80 Proof)").status,
    "review",
  );
});

t("net contents across units", () => {
  assert.equal(M.compareNet("750 mL", "75 cL").status, "pass");
  assert.equal(M.compareNet("1 L", "1000 ML").status, "pass");
  assert.equal(M.compareNet("750 mL", "700 mL").status, "fail");
  assert.equal(M.compareNet("12 fl oz", "355 mL").status, "pass");
  assert.equal(M.compareNet("1.75 L", "1.75L").status, "pass");
});

t('bottler ignores "Bottled by" wording but catches other names', () => {
  assert.equal(
    M.compareBottler(
      "Old Tom Distillery, Bardstown, KY",
      "Bottled by Old Tom Distillery, Bardstown, KY",
    ).status,
    "pass",
  );
  assert.equal(
    M.compareBottler(
      "Old Tom Distillery, Bardstown, KY",
      "Bottled by Rival Spirits, Louisville, KY",
    ).status,
    "fail",
  );
});

t("country aliases", () => {
  assert.equal(M.compareCountry("France", "Product of France").status, "pass");
  assert.equal(
    M.compareCountry("USA", "Product of United States").status,
    "pass",
  );
  assert.equal(M.compareCountry("France", "Product of Italy").status, "fail");
});

t("warning: title case heading is rejected", () => {
  const text = M.WARNING_TEXT.replace(
    "GOVERNMENT WARNING:",
    "Government Warning:",
  );
  const w = M.checkWarning(text, true);
  assert.equal(w.checks.find((c) => c.key === "caps").status, "fail");
  assert.equal(w.checks.find((c) => c.key === "wording").status, "pass");
});

t("warning: changed wording is rejected and diffed", () => {
  const text = M.WARNING_TEXT.replace(
    "impairs your ability",
    "may impair your ability",
  );
  const w = M.checkWarning(text, true);
  assert.equal(w.checks.find((c) => c.key === "wording").status, "fail");
  assert.ok(w.diff.some((o) => o.t === "extra"));
  assert.ok(w.diff.some((o) => o.t === "missing"));
});

t("warning: missing statement fails", () => {
  assert.equal(M.checkWarning(null, "unclear").checks[0].status, "fail");
});

t("warning: all caps body is allowed", () => {
  assert.equal(
    M.checkWarning(M.WARNING_TEXT.toUpperCase(), true).checks.find(
      (c) => c.key === "wording",
    ).status,
    "pass",
  );
});

t("warning: unclear bold goes to review, not fail", () => {
  const r = M.verify(
    app,
    Object.assign({}, good, { warningHeadingBold: "unclear" }),
  );
  assert.equal(r.verdict, "review");
});

t("non-bold heading fails the label", () => {
  const r = M.verify(
    app,
    Object.assign({}, good, { warningHeadingBold: false }),
  );
  assert.equal(r.verdict, "mismatch");
});

t("unreadable fields on a poor image are review, not fail", () => {
  const r = M.verify(
    app,
    Object.assign({}, good, { netContents: null, imageQuality: "poor" }),
  );
  assert.equal(r.fields.find((f) => f.key === "net").status, "review");
  assert.equal(r.verdict, "review");
});

t("warning wording difference on a poor image is review, not fail", () => {
  const cutOff = M.WARNING_TEXT.split(" ").slice(0, -4).join(" ");
  const wording = (q) =>
    M.verify(
      app,
      Object.assign({}, good, { governmentWarning: cutOff, imageQuality: q }),
    ).warning.checks.find((c) => c.key === "wording");
  assert.equal(wording("good").status, "fail");
  assert.equal(wording("poor").status, "review");
  assert.equal(
    M.verify(
      app,
      Object.assign({}, good, {
        governmentWarning: cutOff,
        imageQuality: "poor",
      }),
    ).verdict,
    "review",
  );
});

t("missing field on a good image fails", () => {
  const r = M.verify(app, Object.assign({}, good, { netContents: null }));
  assert.equal(r.fields.find((f) => f.key === "net").status, "fail");
});

t("country row appears only for imports", () => {
  assert.ok(!M.verify(app, good).fields.some((f) => f.key === "country"));
  const r = M.verify(
    Object.assign({}, app, { country: "France" }),
    Object.assign({}, good, { countryOfOrigin: "Product of France" }),
  );
  assert.equal(r.fields.find((f) => f.key === "country").status, "pass");
});

t("normalizeExtraction tolerates junk", () => {
  const x = M.normalizeExtraction({
    brandName: "  A  B ",
    warningHeadingBold: "maybe",
    imageQuality: "blurry",
    netContents: false,
  });
  assert.equal(x.brandName, "A B");
  assert.equal(x.warningHeadingBold, "unclear");
  assert.equal(x.imageQuality, "fair");
  assert.equal(x.netContents, null);
});

console.log("\n" + n + " tests passed");
