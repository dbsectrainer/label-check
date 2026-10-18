import React from "react";
import Papa from "papaparse";
import {
  Play,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  Eye,
  FileSpreadsheet,
  Loader2,
  Images,
  Square,
} from "lucide-react";
import { COLAApplication, VerificationReport } from "../types";
import { SAMPLE_PRESETS, renderLabelToDataUrl } from "../utils/labelGenerator";
import {
  ensureOcrWorkers,
  extractTextFromLabelImage,
  OcrConfig,
} from "../utils/ocrService";
import {
  runLabelVerification,
  FULL_STANDARD_GOV_WARNING,
} from "../utils/verificationEngine";
import {
  BatchRow,
  pairRowsWithImages,
  parseBatchRows,
} from "../utils/batchImport";
import { VerificationReportView } from "./VerificationReportView";

/** Labels processed at once; each local OCR worker is one WASM instance (~100 MB) */
const BATCH_CONCURRENCY = 2;

interface BatchItem {
  id: string;
  title: string;
  application: COLAApplication;
  /** Shown in the inspector: an object URL for uploads, a data URL for demo labels */
  imageUrl: string;
  imageFile?: File;
  /** Synthetic label drawn from the CSV row (no imageFilename given) */
  isDemoLabel: boolean;
  /** CSV/pairing problem; the row can't be verified until it's fixed */
  parseError?: string;
  status: "queued" | "processing" | "done" | "error";
  report?: VerificationReport;
  error?: string;
}

interface BatchProcessorViewProps {
  ocrConfig: OcrConfig;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error(`Could not read image file "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

function renderDemoLabel(row: BatchRow): string {
  const { application: app, raw } = row;
  return renderLabelToDataUrl({
    backgroundStyle: "bourbon",
    brandText: raw.labelBrandText || app.brandName,
    classText: raw.labelClassText || app.classType,
    abvText: raw.labelAbvText || app.alcoholContent,
    netContentsText: raw.labelNetText || app.netContents,
    bottlerText: app.bottlerNameAddress,
    countryText: app.countryOfOrigin,
    warningPrefix: raw.warningHeader || "GOVERNMENT WARNING:",
    warningBody: FULL_STANDARD_GOV_WARNING.replace(
      /^GOVERNMENT WARNING:\s*/,
      "",
    ),
  });
}

export const BatchProcessorView: React.FC<BatchProcessorViewProps> = ({
  ocrConfig,
}) => {
  const [items, setItems] = React.useState<BatchItem[]>(() =>
    SAMPLE_PRESETS.map((preset) => ({
      id: preset.id,
      title: preset.title,
      application: preset.application,
      imageUrl: renderLabelToDataUrl(preset.labelRenderConfig),
      isDemoLabel: true,
      status: "queued",
    })),
  );
  const [csvRows, setCsvRows] = React.useState<BatchRow[] | null>(null);
  const [imageFiles, setImageFiles] = React.useState<File[]>([]);
  const [unusedFiles, setUnusedFiles] = React.useState<string[]>([]);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const cancelRequestedRef = React.useRef(false);
  const objectUrlsRef = React.useRef<string[]>([]);
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(
    null,
  );
  const [totalBatchTimeMs, setTotalBatchTimeMs] = React.useState<number | null>(
    null,
  );

  const updateItem = (id: string, changes: Partial<BatchItem>) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...changes } : it)),
    );

  // Release object URLs for uploaded images when the view goes away
  React.useEffect(
    () => () => objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );

  // Rebuild the queue whenever the CSV or the uploaded images change
  React.useEffect(() => {
    if (!csvRows) return;
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];

    const fileByName = new Map(imageFiles.map((f) => [f.name, f]));
    const paired = pairRowsWithImages(
      csvRows,
      imageFiles.map((f) => f.name),
    );

    setItems(
      paired.rows.map((row) => {
        const file = row.imageFile ? fileByName.get(row.imageFile) : undefined;
        let imageUrl = "";
        if (file) {
          imageUrl = URL.createObjectURL(file);
          objectUrlsRef.current.push(imageUrl);
        } else if (!row.imageFilename && !row.error) {
          imageUrl = renderDemoLabel(row);
        }
        return {
          id: row.application.id,
          title: `${row.index + 1}. ${row.application.brandName || "(no brand)"} (${row.application.ttbId})`,
          application: row.application,
          imageUrl,
          imageFile: file,
          isDemoLabel: !row.imageFilename,
          parseError: row.error,
          status: row.error ? "error" : "queued",
          error: row.error,
        };
      }),
    );
    setUnusedFiles(paired.unusedFiles);
    setSelectedItemId(null);
    setTotalBatchTimeMs(null);
  }, [csvRows, imageFiles]);

  const runBatchVerification = async () => {
    const runnable = items.filter((it) => !it.parseError);
    // Resume unfinished labels (after a cancel or errors); if everything is done, run the whole queue again
    const pending = runnable.filter((it) => it.status !== "done");
    const queue = pending.length > 0 ? pending : runnable;
    if (queue.length === 0) return;

    cancelRequestedRef.current = false;
    setIsRunning(true);
    setUploadError(null);
    const batchStart = performance.now();

    try {
      if (ocrConfig.mode === "local_tesseract") {
        await ensureOcrWorkers(BATCH_CONCURRENCY);
      }
    } catch (err) {
      console.error("OCR workers failed to start:", err);
      setUploadError(
        "The OCR engine could not start. Reload the page and try again.",
      );
      setIsRunning(false);
      return;
    }

    let nextIndex = 0;
    const processNext = async () => {
      while (!cancelRequestedRef.current && nextIndex < queue.length) {
        const item = queue[nextIndex++];
        updateItem(item.id, { status: "processing", error: undefined });
        const itemStart = performance.now();
        try {
          const source = item.imageFile
            ? await readFileAsDataUrl(item.imageFile)
            : item.imageUrl;
          const { text, engineLabel } = await extractTextFromLabelImage(
            source,
            ocrConfig,
          );
          const elapsed = Math.round(performance.now() - itemStart);
          const report = runLabelVerification(
            item.application,
            text,
            elapsed,
            engineLabel,
          );
          updateItem(item.id, { status: "done", report });
        } catch (err) {
          console.error(`Batch item ${item.id} failed:`, err);
          updateItem(item.id, {
            status: "error",
            error:
              err instanceof Error
                ? err.message
                : "Text could not be read from this image.",
          });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(BATCH_CONCURRENCY, queue.length) }, processNext),
    );

    setTotalBatchTimeMs(Math.round(performance.now() - batchStart));
    setIsRunning(false);
    setIsCancelling(false);
  };

  const handleCancelBatch = () => {
    cancelRequestedRef.current = true;
    setIsCancelling(true);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      comments: "#",
      complete: (results) => {
        if (results.data.length === 0) {
          setUploadError(`"${file.name}" has no application rows.`);
          return;
        }
        setUploadError(null);
        setCsvRows(parseBatchRows(results.data));
      },
      error: (err) => {
        console.error("CSV parse failed:", err);
        setUploadError(`"${file.name}" could not be read as a CSV file.`);
      },
    });
  };

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    // Later uploads add to (and replace same-named) earlier ones
    setImageFiles((prev) => [
      ...prev.filter((p) => !files.some((f) => f.name === p.name)),
      ...files,
    ]);
  };

  const handleDownloadSampleCsvTemplate = () => {
    const csvContent = [
      "# imageFilename = name of the uploaded label image for that row. Leave it empty to test with a generated demo label (labelBrandText, labelAbvText, warningHeader control what the demo label prints).",
      "ttbId,brandName,classType,alcoholContent,netContents,bottlerNameAddress,countryOfOrigin,imageFilename,labelBrandText,labelAbvText,warningHeader",
      '26088001000101,PACIFIC HARBOR,London Dry Gin,42% Alc./Vol.,750 mL,"Imported by Seattle Beverage Co, Seattle, WA",Product of UK,,PACIFIC HARBOR,42% Alc./Vol.,GOVERNMENT WARNING:',
      '26088001000102,EMERALD SOUND,Single Malt Whisky,46% Alc./Vol.,750 mL,"Imported by Seattle Beverage Co, Seattle, WA",Product of Scotland,,EMERALD SOUND,40% Alc./Vol.,GOVERNMENT WARNING:',
      '26088001000103,RAINIER VALLEY,Vodka,40% Alc./Vol.,1.75 L,"Distilled by Rainier Spirits, Tacoma, WA",,,RAINIER VALLEY,40% Alc./Vol.,Government Warning:',
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ttb-batch-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportResultsCsv = () => {
    const rows = items.map((item) => ({
      TTB_ID: item.application.ttbId,
      Brand_Name: item.application.brandName,
      Class_Type: item.application.classType,
      Expected_ABV: item.application.alcoholContent,
      Expected_Net_Contents: item.application.netContents,
      Automated_Status: item.report?.overallStatus || "PENDING",
      Agent_Decision: item.report?.agentDecision || "",
      Processing_Time_Ms: item.report?.processingTimeMs || "",
      Error: item.error || "",
      Failed_Fields:
        item.report?.fields
          .filter((f) => f.status === "fail")
          .map((f) => `${f.fieldLabel}: ${f.message}`)
          .join(" | ") || "None",
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ttb-batch-audit-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;
  const completedCount = items.filter((i) => i.status === "done").length;
  const approvedCount = items.filter(
    (i) => i.report?.overallStatus === "APPROVED",
  ).length;
  const rejectedCount = items.filter(
    (i) => i.report?.overallStatus === "REJECTED",
  ).length;

  return (
    <div className="space-y-6">
      {/* Batch Header Card */}
      <div className="bg-white rounded-xl border-2 border-slate-300 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-900 border border-blue-200 text-xs font-bold mb-2">
              <Layers className="w-3.5 h-3.5" />
              High-Volume Importer Queue (Janet / Seattle Office Workflow)
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">
              Batch COLA Application &amp; Artwork Verifier
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Process multi-label importer submissions at once, filter
              exceptions, and export a complete compliance audit CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadSampleCsvTemplate}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download CSV Template
            </button>

            <label className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 cursor-pointer shadow-sm">
              <Upload className="w-4 h-4 text-blue-700" />
              Upload Batch CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
            </label>

            <label className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 cursor-pointer shadow-sm">
              <Images className="w-4 h-4 text-blue-700" />
              Upload Label Images
              {imageFiles.length > 0 ? ` (${imageFiles.length})` : ""}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImagesUpload}
                className="hidden"
              />
            </label>

            {isRunning && (
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelBatch}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg text-base font-bold bg-white hover:bg-slate-50 disabled:text-slate-400 text-slate-900 border-2 border-slate-400"
              >
                <Square className="w-4 h-4" />
                {isCancelling ? "Stopping..." : "Stop"}
              </button>
            )}

            <button
              type="button"
              disabled={isRunning}
              onClick={runBatchVerification}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-base font-extrabold bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white shadow-md transition"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing Queue ({completedCount}/{items.length})...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  Verify All {items.length} Applications
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-700 mt-4">
          Upload a CSV of applications and the label images it names in the{" "}
          <code className="font-mono text-xs bg-slate-100 px-1 rounded">
            imageFilename
          </code>{" "}
          column. Rows without an image name use a generated demo label.
        </p>

        {uploadError && (
          <p
            role="alert"
            className="mt-3 p-3 rounded-lg bg-red-50 border border-red-300 text-sm font-semibold text-red-900"
          >
            {uploadError}
          </p>
        )}
        {!csvRows && imageFiles.length > 0 && (
          <p className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-300 text-sm font-semibold text-amber-900">
            {imageFiles.length} image(s) uploaded. Now upload the CSV that
            lists the application for each image.
          </p>
        )}
        {unusedFiles.length > 0 && (
          <p className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-300 text-sm font-semibold text-amber-900">
            {unusedFiles.length} uploaded image(s) aren't named in the CSV and
            won't be checked: {unusedFiles.slice(0, 5).join(", ")}
            {unusedFiles.length > 5 ? ", ..." : ""}
          </p>
        )}

        {/* Summary Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-200">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-xs font-bold uppercase text-slate-500 block">
              Total Queue
            </span>
            <span className="text-2xl font-extrabold text-slate-900">
              {items.length} Labels
            </span>
          </div>
          <div className="bg-emerald-50 p-3.5 rounded-lg border border-emerald-200">
            <span className="text-xs font-bold uppercase text-emerald-800 block">
              Ready to Approve
            </span>
            <span className="text-2xl font-extrabold text-emerald-700">
              {approvedCount}
            </span>
          </div>
          <div className="bg-red-50 p-3.5 rounded-lg border border-red-200">
            <span className="text-xs font-bold uppercase text-red-800 block">
              Flagged Violations
            </span>
            <span className="text-2xl font-extrabold text-red-700">
              {rejectedCount}
            </span>
          </div>
          <div className="bg-blue-50 p-3.5 rounded-lg border border-blue-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase text-blue-800 block">
                Batch Runtime
              </span>
              <span className="text-2xl font-extrabold text-blue-900">
                {totalBatchTimeMs !== null
                  ? `${(totalBatchTimeMs / 1000).toFixed(2)}s`
                  : "—"}
              </span>
            </div>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={handleExportResultsCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">TTB ID</th>
                <th className="py-3.5 px-4">Brand &amp; Class/Type</th>
                <th className="py-3.5 px-4">ABV &amp; Volume</th>
                <th className="py-3.5 px-4">Verification Result</th>
                <th className="py-3.5 px-4">Speed</th>
                <th className="py-3.5 px-4">Key Finding</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {items.map((item) => {
                const failedFields =
                  item.report?.fields.filter((f) => f.status === "fail") || [];
                const reviewFields =
                  item.report?.fields.filter((f) => f.status === "warning") ||
                  [];
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50 transition ${
                      selectedItemId === item.id ? "bg-blue-50/70" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                      {item.application.ttbId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {item.application.brandName || "(no brand)"}
                        {item.isDemoLabel && (
                          <span className="ml-2 align-middle px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-300">
                            Demo label
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">
                        {item.application.classType}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {item.application.alcoholContent} •{" "}
                      {item.application.netContents}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.status === "queued" && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          Queued
                        </span>
                      )}
                      {item.status === "error" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300">
                          <XCircle className="w-3.5 h-3.5 text-red-700" />
                          {item.parseError ? "CAN'T CHECK" : "ERROR"}
                        </span>
                      )}
                      {item.status === "processing" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Scanning...
                        </span>
                      )}
                      {item.status === "done" &&
                        item.report?.overallStatus === "APPROVED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            APPROVED
                          </span>
                        )}
                      {item.status === "done" &&
                        item.report?.overallStatus === "NEEDS_REVIEW" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            REVIEW
                          </span>
                        )}
                      {item.status === "done" &&
                        item.report?.overallStatus === "REJECTED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300">
                            <XCircle className="w-3.5 h-3.5 text-red-700" />
                            REJECTED
                          </span>
                        )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                      {item.report ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                          <Clock className="w-3 h-3" />
                          {(item.report.processingTimeMs / 1000).toFixed(2)}s
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      {item.status === "error" ? (
                        <span className="text-xs font-semibold text-red-800">
                          {item.error}
                        </span>
                      ) : item.report ? (
                        failedFields.length > 0 ? (
                          <span className="text-xs font-semibold text-red-800">
                            {failedFields[0].fieldLabel}:{" "}
                            {failedFields[0].message}
                          </span>
                        ) : reviewFields.length > 0 ? (
                          <span className="text-xs font-semibold text-amber-800">
                            {reviewFields[0].fieldLabel}:{" "}
                            {reviewFields[0].message}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-800 font-medium">
                            All mandatory fields &amp; 27 CFR Part 16 warning
                            verified.
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">
                          Click "Verify All" to run
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.report && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedItemId(
                              selectedItemId === item.id ? null : item.id,
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {selectedItemId === item.id
                            ? "Hide Report"
                            : "Inspect"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Drilldown View for Selected Batch Row */}
      {selectedItem && selectedItem.report && (
        <div className="bg-slate-100 p-5 rounded-xl border-2 border-blue-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-slate-900">
              Detailed Inspection: {selectedItem.title}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedItemId(null)}
              className="text-sm font-bold text-slate-700 hover:text-slate-900 underline"
            >
              Close Inspection
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-4 rounded-xl border border-slate-300">
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                Submitted Label Artwork
              </h4>
              <img
                src={selectedItem.imageUrl}
                alt={selectedItem.application.brandName}
                className="w-full rounded-lg border border-slate-200"
              />
            </div>
            <div className="lg:col-span-2">
              <VerificationReportView
                report={selectedItem.report}
                onUpdateDecision={(decision, notes) => {
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === selectedItem.id && it.report
                        ? {
                            ...it,
                            report: {
                              ...it.report,
                              agentDecision: decision,
                              agentNotes: notes,
                            },
                          }
                        : it,
                    ),
                  );
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
