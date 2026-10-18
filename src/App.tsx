import React from "react";
import {
  Shield,
  Sparkles,
  Upload,
  RotateCcw,
  Sun,
  Contrast,
  Layers,
  FileCheck2,
  Settings,
  Download,
  Loader2,
  Lock,
  CheckCircle,
  Info,
} from "lucide-react";
import { COLAApplication, VerificationReport } from "./types";
import { SAMPLE_PRESETS, renderLabelToDataUrl } from "./utils/labelGenerator";
import {
  extractTextFromLabelImage,
  getOcrWorker,
  OcrConfig,
  preprocessImageDataUrl,
  ImagePreprocessOptions,
} from "./utils/ocrService";
import { runLabelVerification } from "./utils/verificationEngine";
import { VerificationReportView } from "./components/VerificationReportView";
import { BatchProcessorView } from "./components/BatchProcessorView";

export function App() {
  const [activeTab, setActiveTab] = React.useState<"single" | "batch">(
    "single",
  );
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>(
    SAMPLE_PRESETS[0].id,
  );

  // Current COLA Application State
  const [application, setApplication] = React.useState<COLAApplication>(
    SAMPLE_PRESETS[0].application,
  );

  // Current Label Image DataURL (Original vs Processed)
  const [rawImageDataUrl, setRawImageDataUrl] = React.useState<string>("");
  const [displayImageDataUrl, setDisplayImageDataUrl] =
    React.useState<string>("");

  // Image Preprocessing State (Addresses Jenny Park's Imperfect Photo / Glare / Angle feedback)
  const [preprocessOpts, setPreprocessOpts] =
    React.useState<ImagePreprocessOptions>({
      rotationDeg: 0,
      highContrast: false,
      removeGlare: false,
    });

  // OCR / AI Engine Config (Addresses Marcus Williams's Firewall Note)
  const [ocrConfig, setOcrConfig] = React.useState<OcrConfig>({
    mode: "local_tesseract",
    apiKey: "",
  });
  const [showEngineSettings, setShowEngineSettings] = React.useState(false);

  // Verification Execution State
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [progressMessage, setProgressMessage] = React.useState<string>("");
  const [report, setReport] = React.useState<VerificationReport | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [workerReady, setWorkerReady] = React.useState(false);

  // Pre-warm local Tesseract WebAssembly worker on mount so scans run in ~1.2s (well under Sarah Chen's 5s SLA)
  React.useEffect(() => {
    getOcrWorker()
      .then(() => setWorkerReady(true))
      .catch(() => setWorkerReady(false));
  }, []);

  // Load initial preset image
  React.useEffect(() => {
    const preset = SAMPLE_PRESETS[0];
    const url = renderLabelToDataUrl(preset.labelRenderConfig);
    setRawImageDataUrl(url);
    setDisplayImageDataUrl(url);
  }, []);

  // Re-apply preprocessing whenever rawImageDataUrl or preprocessOpts change
  React.useEffect(() => {
    if (!rawImageDataUrl) return;
    let cancelled = false;
    preprocessImageDataUrl(rawImageDataUrl, preprocessOpts).then(
      (processedUrl) => {
        if (!cancelled) {
          setDisplayImageDataUrl(processedUrl);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [rawImageDataUrl, preprocessOpts]);

  const handleSelectPreset = async (presetId: string, autoVerify = true) => {
    const preset = SAMPLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setSelectedPresetId(preset.id);
    setApplication({ ...preset.application });

    const defaultPreprocess: ImagePreprocessOptions =
      preset.id === "preset-tilted-glare"
        ? { rotationDeg: 3.5, highContrast: true, removeGlare: true }
        : { rotationDeg: 0, highContrast: false, removeGlare: false };

    setPreprocessOpts(defaultPreprocess);

    const generatedUrl = renderLabelToDataUrl(preset.labelRenderConfig);
    setRawImageDataUrl(generatedUrl);

    const processedUrl = await preprocessImageDataUrl(
      generatedUrl,
      defaultPreprocess,
    );
    setDisplayImageDataUrl(processedUrl);

    if (autoVerify) {
      await executeVerification(preset.application, processedUrl);
    } else {
      setReport(null);
      setVerifyError(null);
    }
  };

  const executeVerification = async (
    appData: COLAApplication = application,
    imageUrl: string = displayImageDataUrl,
  ) => {
    if (!imageUrl) return;
    setIsVerifying(true);
    setVerifyError(null);
    setProgressMessage("Initializing OCR engine...");
    const startTime = performance.now();

    try {
      const { text, engineLabel } = await extractTextFromLabelImage(
        imageUrl,
        ocrConfig,
        (msg) => setProgressMessage(msg),
      );
      const elapsedMs = Math.round(performance.now() - startTime);
      const result = runLabelVerification(
        appData,
        text,
        elapsedMs,
        engineLabel,
      );
      setReport(result);
    } catch (error) {
      console.error("Verification error:", error);
      setVerifyError(
        `The label couldn't be checked${
          error instanceof Error ? ` (${error.message})` : ""
        }. Press the button to try again, or upload a clearer image.`,
      );
    } finally {
      setIsVerifying(false);
      setProgressMessage("");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setRawImageDataUrl(reader.result);
        setPreprocessOpts({
          rotationDeg: 0,
          highContrast: false,
          removeGlare: false,
        });
        setReport(null);
        setVerifyError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadLabelSpecimen = () => {
    if (!displayImageDataUrl) return;
    const a = document.createElement("a");
    a.href = displayImageDataUrl;
    a.download = `TTB-Label-Specimen-${application.ttbId}.png`;
    a.click();
  };

  const activePreset = SAMPLE_PRESETS.find((p) => p.id === selectedPresetId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* US Government / TTB Style Top Banner */}
      <div className="bg-slate-900 text-slate-200 text-xs py-1.5 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400">
              U.S. DEPARTMENT OF THE TREASURY
            </span>
            <span>•</span>
            <span>
              Alcohol and Tobacco Tax and Trade Bureau (TTB) — COLA Compliance
              Prototype
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
              <Lock className="w-3.5 h-3.5" />
              {ocrConfig.mode === "local_tesseract"
                ? "Firewall-Safe Local WASM Mode (Zero Cloud Traffic)"
                : `Cloud Vision Mode (${ocrConfig.mode})`}
            </span>
            {workerReady && (
              <span className="inline-flex items-center gap-1 text-sky-300 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" />
                OCR Engine Warm (&lt;2s SLA Ready)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="bg-[#112e51] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-extrabold shadow">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                TTB COLA Label Verification Assistant
              </h1>
              <p className="text-xs md:text-sm text-slate-300">
                Automated TTB Form 5100.31 &amp; 27 CFR Part 16 Compliance
                Review Tool
              </p>
            </div>
          </div>

          {/* Primary Mode Switcher — Large, high-contrast buttons for 100% accessibility */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab("single")}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition ${
                activeTab === "single"
                  ? "bg-amber-400 text-slate-950 shadow-sm"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              Single Application Review
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("batch")}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition ${
                activeTab === "batch"
                  ? "bg-amber-400 text-slate-950 shadow-sm"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              <Layers className="w-4 h-4" />
              Batch Importer Queue (200+ Labels)
            </button>

            <button
              type="button"
              onClick={() => setShowEngineSettings(!showEngineSettings)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600"
              title="Configure Local Firewall-Safe OCR or Optional Cloud Vision API"
            >
              <Settings className="w-4 h-4" />
              AI / OCR Engine
            </button>
          </div>
        </div>

        {/* Collapsible Engine Settings Drawer (Addresses Marcus Williams IT Firewall Constraint) */}
        {showEngineSettings && (
          <div className="bg-slate-800 border-t border-slate-700 px-4 py-4">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-400">
                  OCR / Vision Extraction Engine Configuration (IT &amp; FedRAMP
                  Firewall Settings)
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl">
                  Per IT Systems Administrator Marcus Williams, TTB network
                  firewalls block outbound traffic to external ML endpoints by
                  default. Local Browser OCR runs 100% client-side via
                  WebAssembly with zero external API calls. Optionally, you may
                  enter a Gemini or OpenAI key for cloud multimodal testing.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={ocrConfig.mode}
                  onChange={(e) =>
                    setOcrConfig({
                      ...ocrConfig,
                      mode: e.target.value as OcrConfig["mode"],
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white border border-slate-600 text-sm font-semibold"
                >
                  <option value="local_tesseract">
                    Local Browser OCR (Tesseract.js WASM — Default
                    Firewall-Safe)
                  </option>
                  <option value="gemini_vision">
                    Google Gemini 2.0 Flash Vision API
                  </option>
                  <option value="openai_vision">
                    OpenAI GPT-4o-mini Vision API
                  </option>
                </select>

                {ocrConfig.mode !== "local_tesseract" && (
                  <input
                    type="password"
                    value={ocrConfig.apiKey || ""}
                    onChange={(e) =>
                      setOcrConfig({ ...ocrConfig, apiKey: e.target.value })
                    }
                    placeholder="Paste API Key (stored in memory only)..."
                    className="px-3 py-2 rounded-lg bg-slate-900 text-white border border-slate-600 text-sm w-64"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {activeTab === "batch" ? (
          <BatchProcessorView ocrConfig={ocrConfig} />
        ) : (
          <>
            {/* 1-Click Test Scenario Selector Bar */}
            <section className="bg-white rounded-xl border-2 border-slate-300 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-700" />
                    Step 1: Select a Sample COLA Scenario (or Enter Custom Data
                    Below)
                  </h2>
                  <p className="text-xs text-slate-600">
                    Click any preset below to load both the COLA Form 5100.31
                    data and its synthetic label artwork, and immediately run
                    verification.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {SAMPLE_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  const badgeColors = {
                    green: "bg-emerald-100 text-emerald-900 border-emerald-300",
                    blue: "bg-blue-100 text-blue-900 border-blue-300",
                    red: "bg-red-100 text-red-900 border-red-300",
                    amber: "bg-amber-100 text-amber-900 border-amber-300",
                  }[preset.badgeColor];

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id, true)}
                      className={`text-left p-3.5 rounded-xl border-2 transition flex flex-col justify-between ${
                        isSelected
                          ? "border-blue-700 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-sm"
                          : "border-slate-200 hover:border-slate-400 bg-slate-50/60"
                      }`}
                    >
                      <div>
                        <span
                          className={`inline-block text-[11px] font-extrabold px-2 py-0.5 rounded border mb-2 ${badgeColors}`}
                        >
                          {preset.badge}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 leading-snug">
                          {preset.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                          {preset.subtitle}
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/80 text-[11px] font-semibold text-blue-800">
                        {isSelected
                          ? "● Active Scenario"
                          : "Click to Load & Verify →"}
                      </div>
                    </button>
                  );
                })}
              </div>

              {activePreset && (
                <div className="mt-3.5 p-3 rounded-lg bg-slate-100 border border-slate-300 flex items-start gap-2.5 text-xs text-slate-700">
                  <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900">
                      {activePreset.stakeholderRef}:{" "}
                    </span>
                    <span>{activePreset.description}</span>
                  </div>
                </div>
              )}
            </section>

            {/* Two-Column Split Workspace: Left = COLA Form + Label Artwork | Right = Verification Results */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (5 cols): Application Data & Label Image Upload */}
              <div className="lg:col-span-5 space-y-6">
                {/* Label Artwork Upload & Preprocessor Card */}
                <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Step 2: Label Artwork Specimen
                      </h3>
                      <p className="text-xs text-slate-600">
                        Upload any label image (PNG/JPG) or use the generated
                        specimen
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadLabelSpecimen}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
                        title="Download this label image to your computer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Save PNG
                      </button>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white cursor-pointer shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Label Preview Frame */}
                  <div className="bg-slate-200 rounded-xl p-3 border border-slate-300 flex items-center justify-center max-h-[420px] overflow-hidden">
                    {displayImageDataUrl ? (
                      <img
                        src={displayImageDataUrl}
                        alt="Alcohol Label Artwork Specimen"
                        className="max-h-[390px] w-auto object-contain rounded shadow-sm bg-white"
                      />
                    ) : (
                      <div className="py-16 text-sm text-slate-500">
                        No label image loaded
                      </div>
                    )}
                  </div>

                  {/* Image Quality Enhancer Controls (Addresses Jenny Park's Tilted / Bad Lighting / Glare Note) */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Imperfect Photo Enhancer (Deskew &amp; De-Glare)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPreprocessOpts({
                            rotationDeg: 0,
                            highContrast: false,
                            removeGlare: false,
                          })
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPreprocessOpts((p) => ({
                            ...p,
                            highContrast: !p.highContrast,
                          }))
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                          preprocessOpts.highContrast
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <Contrast className="w-3.5 h-3.5" />
                        High-Contrast OCR Filter
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setPreprocessOpts((p) => ({
                            ...p,
                            removeGlare: !p.removeGlare,
                          }))
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                          preprocessOpts.removeGlare
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        Suppress Bottle Glare
                      </button>

                      <div className="flex items-center gap-1.5 ml-auto">
                        <label
                          htmlFor="deskew-range"
                          className="text-xs font-semibold text-slate-700"
                        >
                          Angle ({preprocessOpts.rotationDeg}°):
                        </label>
                        <input
                          id="deskew-range"
                          type="range"
                          min="-10"
                          max="10"
                          step="0.5"
                          value={preprocessOpts.rotationDeg}
                          onChange={(e) =>
                            setPreprocessOpts((p) => ({
                              ...p,
                              rotationDeg: parseFloat(e.target.value),
                            }))
                          }
                          className="w-20 accent-blue-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLA Application Form 5100.31 Data Card */}
                <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Step 3: TTB Form 5100.31 Application Fields
                    </h3>
                    <p className="text-xs text-slate-600">
                      Edit any application field below to test live mismatch
                      detection against the label
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        TTB ID Number
                      </label>
                      <input
                        type="text"
                        value={application.ttbId}
                        onChange={(e) =>
                          setApplication({
                            ...application,
                            ttbId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Beverage Category
                      </label>
                      <select
                        value={application.beverageType}
                        onChange={(e) =>
                          setApplication({
                            ...application,
                            beverageType: e.target
                              .value as COLAApplication["beverageType"],
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                      >
                        <option value="distilled_spirits">
                          Distilled Spirits
                        </option>
                        <option value="wine">Wine</option>
                        <option value="malt_beverage">
                          Malt Beverage / Beer
                        </option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Box 6: Brand Name
                      </label>
                      <input
                        type="text"
                        value={application.brandName}
                        onChange={(e) =>
                          setApplication({
                            ...application,
                            brandName: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Class / Type Designation
                      </label>
                      <input
                        type="text"
                        value={application.classType}
                        onChange={(e) =>
                          setApplication({
                            ...application,
                            classType: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Alcohol Content (ABV / Proof)
                      </label>
                      <input
                        type="text"
                        value={application.alcoholContent}
                        onChange={(e) =>
                          setApplication({
                            ...application,
                            alcoholContent: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Net Contents
                      </label>
                      <input
                        type="text"
                        value={application.netContents}
                        onChange={(e) =>
                          setApplication({
                            ...application,
                            netContents: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Box 8: Name &amp; Address of Bottler / Producer /
                        Importer
                      </label>
                      <input
                        type="text"
                        value={application.bottlerNameAddress}
                        onChange={(e) =>
                          setApplication({
                            ...application,
                            bottlerNameAddress: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  {/* Giant Primary Action Button — Designed for Sarah Chen's "73-year-old mother benchmark" */}
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() =>
                      executeVerification(application, displayImageDataUrl)
                    }
                    className="w-full py-4 px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-extrabold text-lg shadow-md flex items-center justify-center gap-3 transition cursor-pointer"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>
                          {progressMessage || "Verifying Label Artwork..."}
                        </span>
                      </>
                    ) : (
                      <>
                        <FileCheck2 className="w-6 h-6" />
                        <span>VERIFY LABEL AGAINST APPLICATION NOW</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column (7 cols): Verification Report Output */}
              <div className="lg:col-span-7">
                {verifyError && !isVerifying && (
                  <p
                    role="alert"
                    className="mb-4 p-4 rounded-xl bg-red-50 border-2 border-red-300 text-base font-semibold text-red-900"
                  >
                    {verifyError}
                  </p>
                )}
                {isVerifying ? (
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-12 text-center space-y-4 shadow-sm">
                    <Loader2 className="w-12 h-12 text-blue-700 animate-spin mx-auto" />
                    <h3 className="text-xl font-extrabold text-slate-900">
                      Scanning Label Artwork &amp; Checking 27 CFR
                      Regulations...
                    </h3>
                    <p className="text-sm text-slate-600 max-w-md mx-auto">
                      {progressMessage ||
                        "Extracting text via WebAssembly OCR and verifying Brand, Class/Type, ABV, Net Contents, and mandatory Government Warning formatting."}
                    </p>
                  </div>
                ) : report ? (
                  <VerificationReportView
                    report={report}
                    onUpdateDecision={(decision, notes) =>
                      setReport({
                        ...report,
                        agentDecision: decision,
                        agentNotes: notes,
                      })
                    }
                  />
                ) : (
                  <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center space-y-4">
                    <Shield className="w-12 h-12 text-slate-400 mx-auto" />
                    <h3 className="text-xl font-bold text-slate-800">
                      Ready to Verify Label Compliance
                    </h3>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto">
                      Select any of the 5 stakeholder presets at the top of the
                      page or click{" "}
                      <span className="font-bold text-blue-800">
                        "VERIFY LABEL AGAINST APPLICATION NOW"
                      </span>{" "}
                      to run an instant compliance check.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        executeVerification(application, displayImageDataUrl)
                      }
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-base shadow"
                    >
                      <FileCheck2 className="w-5 h-5" />
                      Run Verification Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-5 px-4 mt-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            TTB AI-Powered Alcohol Label Verification Prototype • Standalone
            Proof-of-Concept
          </div>
          <div>
            Checks 27 CFR Part 4 (Wine), Part 5 (Distilled Spirits), Part 7
            (Malt Beverages), &amp; Part 16 (Health Warning)
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
