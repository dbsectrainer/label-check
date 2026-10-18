# TTB COLA Label Verification Assistant

An AI/OCR-powered standalone compliance verification web application for the **Alcohol and Tobacco Tax and Trade Bureau (TTB)**. Built to accelerate Certificate of Label Approval (**TTB Form 5100.31**) reviews and enforce **27 CFR Part 4, 5, 7, and 16** regulations.

---

## 🎯 How Stakeholder & Regulatory Requirements Were Addressed

Every architectural and UX decision in this prototype directly maps to the discovery interview notes with the Compliance Division and IT:

| Stakeholder                                               | Key Requirement / Pain Point                                                                                                                                                                                                                                                                                                                     | Engineering & Design Solution                                                                                                                                                                                                                                                                                                                                                                                   |
| :-------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sarah Chen**<br>_(Deputy Director of Label Compliance)_ | **1. Speed SLA (< 5 Seconds):** Previous vendor failed because 30–40s scans were slower than manual review.<br>**2. Accessibility ("73-year-old mother benchmark"):** Half the 47-agent team is over 50; needs clean, obvious buttons.<br>**3. Peak-Season Batch Queue:** Importers dump 200–300 labels at once (requested by Janet in Seattle). | • **Pre-warmed WebAssembly OCR Worker** processes a label in **under 1 second warm** (measured: see Performance below) with a live SLA badge (`≤ 5.0s SLA Met`).<br>• **USWDS-inspired high-contrast UI** with large `Public Sans` typography, zero hidden menus, and a single giant primary action button.<br>• **Batch Importer Queue Tab** pairs a CSV of applications with uploaded label images (`imageFilename` column), verifies 2 labels at a time with a Stop control, and exports a CSV audit file. |
| **Marcus Williams**<br>_(IT Systems Administrator)_       | **1. Strict Outbound Firewall:** Government network blocks outbound traffic to external ML endpoints.<br>**2. Standalone PoC:** No direct `.NET` COLA database coupling or PII storage.                                                                                                                                                          | • **100% Client-Side Local OCR Default** (`Tesseract.js` WebAssembly) runs inside the browser. The OCR worker, WASM core, and English model are **served from the app itself** (`public/tesseract/`, copied by `npm run copy-ocr-assets`), so OCR makes no outbound requests.<br>• **Optional BYOK Cloud Vision Upgrade** (Google Gemini 2.0 Flash / OpenAI GPT-4o-mini) available in the settings drawer when outbound access is permitted.<br>• **Static SPA Architecture** deploys directly to **GitHub Pages** or Azure Static Web Apps.            |
| **Dave Morrison**<br>_(Senior Compliance Agent, 28 yrs)_  | **Nuance & Human Judgment:** Application says `"Stone's Throw"`, label says `"STONE'S THROW"`. Pattern matching shouldn't blindly reject capitalization or `"Alc./Vol."` vs `"ALC. BY VOL."` differences.                                                                                                                                        | • **Multi-Tier Smart Matching Engine:** Distinguishes between harmless capitalization/abbreviation variations (`PASS` with nuance note) and true regulatory violations (`FAIL`).<br>• **Human-in-the-Loop Override Bar:** Agents retain final authority to Approve, Reject, or Override automated flags with audit notes.                                                                                       |
| **Jenny Park**<br>_(Junior Compliance Agent, 8 mos)_      | **1. Strict 27 CFR Part 16 Warning Check:** Must be word-for-word exact, and `"GOVERNMENT WARNING:"` must be in **ALL CAPS** (catching `"Government Warning:"` title-case traps).<br>**2. Imperfect Label Photos:** Handles tilted angles, glare, and bad lighting.                                                                              | • **Dedicated 27 CFR § 16.21 & § 16.22 Validator:** Enforces strict case-sensitive `"GOVERNMENT WARNING:"` header validation plus word-for-word verification of Clauses `(1)` and `(2)`.<br>• **Interactive Image Preprocessor:** Built-in rotation/deskew slider (`-10°` to `+10°`), bottle glare suppression, and high-contrast OCR thresholding.                                                             |

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js** `v18+` (tested on `v20` and `v26`)
- **npm** `v9+`

### Installation & Run

```bash
cd ttb-label-verifier
npm install
npm run dev
```

Open the local URL printed in the terminal (typically `http://localhost:5173`).

### Run Unit Tests

The core regulatory verification engine (`src/utils/verificationEngine.ts`) includes a unit test suite covering compliant labels, case nuance (`"STONE'S THROW"`), title-case `"Government Warning:"` violations, ABV numeric mismatches, and net contents parsing:

```bash
npm test
```

### Build Static Bundle (for GitHub Pages / Production)

```bash
npm run build
npm run preview
```

---

## 🌐 Deploying to GitHub Pages

This project is pre-configured with `base: './'` in `vite.config.ts` and includes an automated GitHub Actions deployment workflow at `.github/workflows/deploy.yml`.

1. Push the contents of `ttb-label-verifier` to a GitHub repository (`main` branch).
2. In your GitHub repository, navigate to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. The `Deploy to GitHub Pages` workflow will automatically run unit tests, build the static bundle, and publish the live URL.

---

## 🧪 Built-in Interactive Test Scenarios

For instant evaluation without needing external test files, the top bar includes **5 one-click COLA scenarios** that dynamically render high-resolution synthetic label specimens and run real OCR + compliance verification:

1. **Old Tom Distillery (Compliant artwork; see Known Limitations — OCR misses the title):** Matches the exact Distilled Spirits example from the take-home prompt (`45% Alc./Vol. (90 Proof)`, `750 mL`, exact `GOVERNMENT WARNING:`).
2. **Stone's Throw Reserve (Dave Morrison's Case Nuance):** COLA form specifies `"Stone's Throw"` and `"13.5% Alc./Vol."`, while the label displays `"STONE'S THROW"` and `"13.5% ALC. BY VOL."` — passes with a nuance note.
3. **Cascade Hops IPA (Jenny Park's Warning Trap):** Uses `"Government Warning:"` in title case instead of mandatory ALL CAPS `"GOVERNMENT WARNING:"` — automatically rejected under `27 CFR § 16.22`.
4. **Highland Mist Gin (ABV Mismatch):** COLA form states `40% Alc./Vol. (80 Proof)`, but the label artwork prints `47% Alc./Vol. (94 Proof)` — automatically rejected under `27 CFR § 5.65`.
5. **Imperfect Bottle Photo (Tilted + Glare):** Simulates a skewed (`-3.5°`) label photo with lighting glare across the surface, demonstrating the built-in deskew & contrast preprocessor.

You can also **download any generated label as a PNG**, edit any field in the COLA Form 5100.31 panel to test live mismatches, or **upload your own custom label images and batch CSVs**.

---

## ⚖️ Trade-offs & Assumptions

- **Local WASM OCR vs. Cloud Vision LLM:** By default, the app uses `Tesseract.js` in a persistent WebWorker so it works 100% offline/behind strict government firewalls with zero API key setup. OCR returns plain text, so the tool checks that `"GOVERNMENT WARNING:"` is in capitals and that both clauses match word-for-word. It does **not** check that the header is bold, with any engine. The cloud engines (Gemini / OpenAI) only transcribe text; their model IDs should be checked against each provider's current list before use.
- **Government Warning strictness:** An exact word-for-word match passes. A near-match (≥ 92% similar, all key phrases present) is marked **Needs Review** rather than passed, because it could be OCR noise or altered wording. Anything further off is rejected.
- **Standalone Prototype Scope:** Per Marcus Williams's guidance, no data is persisted to external servers; all image processing and CSV exports happen in-memory inside the browser session.

---

## ⏱️ Performance (measured)

Headless Chrome on an Apple Silicon Mac, built app (`npm run build && npm run preview`), with **every host except localhost blocked** to simulate the TTB firewall:

| Step | Time |
| :--- | :--- |
| OCR engine warm-up (page load) | ~0.7 s |
| Single label scan + verification | ~0.6–0.8 s |
| 5-label demo batch (2 workers) | ~1.8 s |

These use the generated demo labels. Real photos are larger and noisier, so expect them to take longer. Re-measure with real images before quoting a number.

## 🚧 Known Limitations

- **Large display type can be missed by OCR.** Tesseract often skips the biggest headline text on a label. On the "Old Tom Distillery" demo it doesn't read the 52px brand title, so that label is reported as *Brand Name not detected*. (It used to pass only because the brand also appears in the bottler line. The brand check now ignores the bottler line.)
- **No bold detection** for the `GOVERNMENT WARNING:` header (see above).
- **Bad photos:** rotation, contrast, and glare correction are manual sliders. There's no automatic deskew.
- **Google Fonts:** `index.html` loads Public Sans from fonts.googleapis.com. Behind a firewall this falls back to system fonts. Self-host the font if exact typography matters.
- **Batch scale:** 2 labels run at a time, and every image is held in browser memory. 300 large photos will be slow and memory-heavy. A production version would process them on a server.

