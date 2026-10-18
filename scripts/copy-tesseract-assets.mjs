// Copies the Tesseract.js worker, WASM core, and English language data into public/
// so OCR runs with zero outbound requests (TTB network blocks most external domains).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");
const out = join(root, "public", "tesseract");

const assets = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  [
    "tesseract.js-core/tesseract-core-lstm.wasm.js",
    "core/tesseract-core-lstm.wasm.js",
  ],
  [
    "tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "core/tesseract-core-simd-lstm.wasm.js",
  ],
  [
    "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    "lang/eng.traineddata.gz",
  ],
];

for (const [from, to] of assets) {
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(nm, from), dest);
}
console.log(`Copied ${assets.length} Tesseract assets to public/tesseract/`);
