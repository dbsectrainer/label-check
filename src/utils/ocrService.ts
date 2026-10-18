import { createScheduler, createWorker, Scheduler, Worker } from "tesseract.js";

let scheduler: Scheduler | null = null;
let workerPromises: Promise<Worker>[] = [];

function getScheduler(): Scheduler {
  scheduler ??= createScheduler();
  return scheduler;
}

function createLocalWorker(): Promise<Worker> {
  // Self-hosted assets (copied by scripts/copy-tesseract-assets.mjs); Tesseract.js defaults to jsdelivr otherwise,
  // which the TTB firewall would block.
  const assetBase = new URL("tesseract/", document.baseURI).href;
  return createWorker("eng", undefined, {
    workerPath: `${assetBase}worker.min.js`,
    corePath: `${assetBase}core`,
    langPath: `${assetBase}lang`,
  });
}

/**
 * Starts local OCR workers until `count` exist, so batch jobs can run in parallel.
 * A worker that fails to start is dropped so the next call can retry it.
 */
export function ensureOcrWorkers(count: number): Promise<Worker[]> {
  while (workerPromises.length < count) {
    const pending: Promise<Worker> = createLocalWorker().then((worker) => {
      getScheduler().addWorker(worker);
      return worker;
    });
    pending.catch(() => {
      workerPromises = workerPromises.filter((p) => p !== pending);
    });
    workerPromises.push(pending);
  }
  return Promise.all(workerPromises.slice(0, count));
}

/**
 * Initializes a warm Tesseract.js WebWorker so subsequent label scans skip model loading
 */
export async function getOcrWorker(): Promise<Worker> {
  const [worker] = await ensureOcrWorkers(1);
  return worker;
}

export interface ImagePreprocessOptions {
  rotationDeg: number;
  highContrast: boolean;
  removeGlare: boolean;
}

/**
 * Preprocesses an image DataURL (rotation / deskew, adaptive contrast, glare reduction)
 * to support Jenny Park's request for handling imperfectly shot bottle photos.
 */
export async function preprocessImageDataUrl(
  sourceDataUrl: string,
  options: ImagePreprocessOptions,
): Promise<string> {
  if (
    options.rotationDeg === 0 &&
    !options.highContrast &&
    !options.removeGlare
  ) {
    return sourceDataUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(sourceDataUrl);
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      if (options.rotationDeg !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((options.rotationDeg * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }
      ctx.drawImage(img, 0, 0);
      ctx.restore();

      if (options.highContrast || options.removeGlare) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Luminance grayscale
          let lum = 0.299 * r + 0.587 * g + 0.114 * b;

          if (options.removeGlare) {
            // Pull mid-high washed out text pixels darker before thresholding
            if (lum < 215) {
              lum = Math.max(0, (lum - 110) * 1.6 + 60);
            }
          }

          if (options.highContrast) {
            // Crisp S-curve contrast boost for OCR accuracy
            lum =
              lum < 165
                ? Math.max(0, lum * 0.45)
                : Math.min(255, 210 + (lum - 165) * 0.5);
          }

          data[i] = lum;
          data[i + 1] = lum;
          data[i + 2] = lum;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (err) => reject(err);
    img.src = sourceDataUrl;
  });
}

export interface OcrConfig {
  mode: "local_tesseract" | "gemini_vision" | "openai_vision";
  apiKey?: string;
}

/**
 * Extracts text from a label image using either local in-browser Tesseract.js (firewall-safe default)
 * or optional Gemini / OpenAI Vision API if configured by the user.
 */
export async function extractTextFromLabelImage(
  imageDataUrl: string,
  config: OcrConfig,
  onProgress?: (statusText: string) => void,
): Promise<{ text: string; engineLabel: string }> {
  if (config.mode === "gemini_vision" && config.apiKey?.trim()) {
    onProgress?.("Running Gemini 3.8 Flash Vision extraction...");
    const mimeType =
      imageDataUrl.match(/^data:(image\/[\w+.-]+);base64,/)?.[1] ?? "image/png";
    const base64Data = imageDataUrl.replace(
      /^data:image\/[\w+.-]+;base64,/,
      "",
    );
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        // Key in a header, not the query string, so it stays out of URL logs and history
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.apiKey.trim(),
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Transcribe all visible text on this alcohol beverage label verbatim, preserving exact capitalization (especially GOVERNMENT WARNING:) and punctuation. Return only the raw transcribed text.",
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini Vision API returned HTTP ${response.status}`);
    }
    const json = await response.json();
    const extracted = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return {
      text: extracted,
      engineLabel: "Cloud AI Vision (Gemini 3.8 Flash)",
    };
  }

  if (config.mode === "openai_vision" && config.apiKey?.trim()) {
    onProgress?.("Running OpenAI GPT-4o-mini Vision extraction...");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe all visible text on this alcohol beverage label verbatim, preserving exact capitalization (especially GOVERNMENT WARNING:) and punctuation. Return only the raw transcribed text.",
              },
              {
                type: "image_url",
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Vision API returned HTTP ${response.status}`);
    }
    const json = await response.json();
    const extracted = json?.choices?.[0]?.message?.content || "";
    return {
      text: extracted,
      engineLabel: "Cloud AI Vision (OpenAI GPT-4o-mini)",
    };
  }

  // Default: 100% Firewall-Safe Local In-Browser Tesseract.js Worker
  onProgress?.("Running Local WebAssembly OCR (Firewall-Safe)...");
  await getOcrWorker();
  const ret = await getScheduler().addJob("recognize", imageDataUrl);
  return {
    text: ret.data.text,
    engineLabel: "Local Browser OCR (Tesseract.js WASM • Zero Outbound Calls)",
  };
}
