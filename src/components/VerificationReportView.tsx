import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  FileText,
  Download,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { VerificationReport, FieldCheckResult } from "../types";

interface VerificationReportViewProps {
  report: VerificationReport;
  onUpdateDecision: (
    decision: "APPROVED" | "REJECTED" | "OVERRIDDEN",
    notes: string,
  ) => void;
}

export const VerificationReportView: React.FC<VerificationReportViewProps> = ({
  report,
  onUpdateDecision,
}) => {
  const [showRawOcr, setShowRawOcr] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [agentNotes, setAgentNotes] = React.useState(report.agentNotes || "");

  React.useEffect(() => {
    setAgentNotes(report.agentNotes || "");
  }, [report.applicationId, report.timestamp, report.agentNotes]);

  const passCount = report.fields.filter((f) => f.status === "pass").length;
  const warnCount = report.fields.filter((f) => f.status === "warning").length;
  const failCount = report.fields.filter((f) => f.status === "fail").length;

  const isUnderFiveSeconds = report.processingTimeMs <= 5000;

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TTB-COLA-${report.ttbId}-Verification.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    const lines = [
      `TTB COLA VERIFICATION REPORT — TTB ID: ${report.ttbId}`,
      `Brand: ${report.brandName}`,
      `Automated Recommendation: ${report.overallStatus}`,
      `Agent Final Decision: ${report.agentDecision || "Pending"}`,
      `Processing Time: ${(report.processingTimeMs / 1000).toFixed(2)}s (${report.engineUsed})`,
      `----------------------------------------`,
      ...report.fields.map(
        (f) =>
          `[${f.status.toUpperCase()}] ${f.fieldLabel}: Expected "${f.expectedValue}" | Found "${f.detectedSnippet}" — ${f.message}`,
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBanner = () => {
    if (report.overallStatus === "APPROVED") {
      return {
        bg: "bg-emerald-50 border-emerald-600",
        badgeBg: "bg-emerald-700 text-white",
        icon: <CheckCircle2 className="w-8 h-8 text-emerald-700 shrink-0" />,
        title: "READY FOR APPROVAL — All Mandatory TTB Fields Verified",
        subtitle:
          "All COLA Form 5100.31 fields and the mandatory 27 CFR Part 16 Health Warning match the label artwork.",
      };
    }
    if (report.overallStatus === "NEEDS_REVIEW") {
      return {
        bg: "bg-amber-50 border-amber-500",
        badgeBg: "bg-amber-600 text-white",
        icon: <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />,
        title: "AGENT JUDGMENT REQUIRED — Minor Formatting or OCR Nuance",
        subtitle:
          "Core requirements appear present, but minor typography/character differences require human compliance review.",
      };
    }
    return {
      bg: "bg-red-50 border-red-600",
      badgeBg: "bg-red-700 text-white",
      icon: <XCircle className="w-8 h-8 text-red-700 shrink-0" />,
      title: "DISCREPANCY DETECTED — Recommend COLA Rejection / Correction",
      subtitle:
        "One or more mandatory label elements failed verification against the application or 27 CFR regulations.",
    };
  };

  const banner = getStatusBanner();

  const renderFieldStatusBadge = (field: FieldCheckResult) => {
    if (field.status === "pass") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          MATCH
        </span>
      );
    }
    if (field.status === "warning") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          REVIEW NUANCE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-900 border border-red-300">
        <XCircle className="w-4 h-4 text-red-700" />
        MISMATCH / VIOLATION
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Status Banner */}
      <div className={`p-5 rounded-xl border-2 ${banner.bg} shadow-sm`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {banner.icon}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`px-3 py-0.5 rounded text-xs font-extrabold tracking-wider uppercase ${banner.badgeBg}`}
                >
                  {report.overallStatus.replace("_", " ")}
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  TTB ID: <span className="font-mono">{report.ttbId}</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    isUnderFiveSeconds
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : "bg-amber-100 text-amber-900 border-amber-300"
                  }`}
                  title="Sarah Chen SLA Benchmark: Must return results in under 5 seconds"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {(report.processingTimeMs / 1000).toFixed(2)}s{" "}
                  {isUnderFiveSeconds ? "(≤ 5.0s SLA Met)" : "(> 5.0s SLA)"}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mt-1.5">
                {banner.title}
              </h3>
              <p className="text-sm text-slate-700 mt-0.5">{banner.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-sm"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Copied Summary" : "Copy Audit Note"}
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </button>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200/80">
          <div className="bg-white/90 rounded-lg px-3.5 py-2 border border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Passed Checks
            </span>
            <span className="text-lg font-extrabold text-emerald-700">
              {passCount}
            </span>
          </div>
          <div className="bg-white/90 rounded-lg px-3.5 py-2 border border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Nuance Warnings
            </span>
            <span className="text-lg font-extrabold text-amber-600">
              {warnCount}
            </span>
          </div>
          <div className="bg-white/90 rounded-lg px-3.5 py-2 border border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Violations
            </span>
            <span className="text-lg font-extrabold text-red-700">
              {failCount}
            </span>
          </div>
        </div>
      </div>

      {/* Field-by-Field Checklist */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
        <div className="bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h4 className="font-bold text-base">
              COLA Form 5100.31 &amp; 27 CFR Part 16 Verification Checklist
            </h4>
          </div>
          <span className="text-xs text-slate-300 font-mono">
            {report.engineUsed}
          </span>
        </div>

        <div className="divide-y divide-slate-200">
          {report.fields.map((field) => (
            <div
              key={field.fieldKey}
              className={`p-5 transition-colors ${
                field.status === "fail"
                  ? "bg-red-50/40"
                  : field.status === "warning"
                    ? "bg-amber-50/40"
                    : "hover:bg-slate-50/80"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h5 className="text-base font-bold text-slate-900">
                    {field.fieldLabel}
                  </h5>
                  {field.regulatoryNote && (
                    <p className="text-xs text-slate-500 font-medium">
                      {field.regulatoryNote}
                    </p>
                  )}
                </div>
                {renderFieldStatusBadge(field)}
              </div>

              {/* Comparison Grid: Application vs Label Artwork */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-2">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    COLA Application (Expected)
                  </span>
                  <p className="font-mono text-sm text-slate-900 break-words font-medium">
                    {field.expectedValue}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-lg border ${
                    field.status === "fail"
                      ? "bg-red-50 border-red-300"
                      : field.status === "warning"
                        ? "bg-amber-50 border-amber-300"
                        : "bg-emerald-50/60 border-emerald-200"
                  }`}
                >
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Detected on Label Artwork
                  </span>
                  <p className="font-mono text-sm text-slate-900 break-words font-semibold">
                    {field.detectedSnippet}
                  </p>
                </div>
              </div>

              <p
                className={`text-sm font-medium mt-2 ${
                  field.status === "fail"
                    ? "text-red-800 font-semibold"
                    : field.status === "warning"
                      ? "text-amber-900"
                      : "text-slate-700"
                }`}
              >
                {field.message}
              </p>

              {/* Sub-checks for Government Health Warning */}
              {field.subChecks && field.subChecks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                    27 CFR § 16.21 &amp; § 16.22 Mandatory Warning Sub-Checks:
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {field.subChecks.map((sub, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-sm ${
                          sub.passed
                            ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                            : "bg-red-100/80 border-red-300 text-red-950 font-semibold"
                        }`}
                      >
                        {sub.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-bold">{sub.label}: </span>
                          <span>{sub.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Agent Final Determination & Override Panel (Addresses Dave Morrison's Human-in-the-Loop Judgment Requirement) */}
      <div className="bg-white rounded-xl border-2 border-slate-300 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-bold text-slate-900">
              Compliance Agent Final Determination (Human-in-the-Loop)
            </h4>
            <p className="text-xs text-slate-600">
              AI assists with routine matching; final COLA approval or rejection
              authority rests with the TTB Compliance Agent.
            </p>
          </div>
          {report.agentDecision && (
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-slate-900 text-white">
              Recorded Decision: {report.agentDecision}
            </span>
          )}
        </div>

        <div className="mt-3">
          <label
            htmlFor="agent-notes"
            className="block text-xs font-bold uppercase text-slate-700 mb-1"
          >
            Agent Review Notes / Override Justification (Optional)
          </label>
          <input
            id="agent-notes"
            type="text"
            value={agentNotes}
            onChange={(e) => setAgentNotes(e.target.value)}
            placeholder="e.g., Approved per Dave Morrison nuance rule — capitalization difference only..."
            className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => onUpdateDecision("APPROVED", agentNotes)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition ${
              report.agentDecision === "APPROVED"
                ? "bg-emerald-800 text-white ring-2 ring-offset-2 ring-emerald-700"
                : "bg-emerald-700 hover:bg-emerald-800 text-white"
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
            Approve COLA Application
          </button>

          <button
            type="button"
            onClick={() => onUpdateDecision("REJECTED", agentNotes)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition ${
              report.agentDecision === "REJECTED"
                ? "bg-red-800 text-white ring-2 ring-offset-2 ring-red-700"
                : "bg-red-700 hover:bg-red-800 text-white"
            }`}
          >
            <ThumbsDown className="w-4 h-4" />
            Reject / Send Correction Notice
          </button>

          {report.overallStatus !== "APPROVED" && (
            <button
              type="button"
              onClick={() =>
                onUpdateDecision(
                  "OVERRIDDEN",
                  agentNotes ||
                    "Agent manually overrode automated flag after visual inspection.",
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
            >
              Override Flag &amp; Approve
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Raw OCR Transcript */}
      <div className="bg-white rounded-xl border border-slate-300 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowRawOcr(!showRawOcr)}
          className="w-full px-5 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            View Raw Extracted Label Text (OCR Transcript)
          </span>
          <span className="text-xs text-blue-700 underline">
            {showRawOcr ? "Hide Transcript" : "Show Transcript"}
          </span>
        </button>
        {showRawOcr && (
          <div className="p-4 bg-slate-900 text-slate-100 font-mono text-xs whitespace-pre-wrap border-t border-slate-300">
            {report.rawExtractedText || "(No text extracted)"}
          </div>
        )}
      </div>
    </div>
  );
};
