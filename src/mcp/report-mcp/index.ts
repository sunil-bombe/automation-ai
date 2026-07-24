// ---------------------------------------------------------------------------
// Report MCP
//
// Responsibility: turn ScenarioResult[] into a human-readable HTML report —
// pass/fail summary, per-step timeline, locator attempts (so a failure is
// debuggable without re-running), and any self-healing that happened.
// ---------------------------------------------------------------------------

import { mkdirSync, writeFileSync } from "node:fs";
import { posix } from "node:path";
import type { ScenarioResult, StepResult } from "../../types/index.js";

export interface ReportMCP {
  generateHtml(results: ScenarioResult[], outPath?: string): string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function statusColor(status: string): string {
  switch (status) {
    case "PASSED": return "#1a7f37";
    case "HEALED": return "#9a6700";
    case "FAILED": return "#cf222e";
    default: return "#6e7781";
  }
}

function makeRelativeScreenshotPath(screenshotPath: string, reportDir: string): string {
  const relative = posix.relative(reportDir, screenshotPath);
  return relative || posix.basename(screenshotPath);
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

function renderStep(step: StepResult, reportDir: string): string {
  const color = statusColor(step.status);
  const screenshotId = `screenshot-${sanitizeId(step.stepId)}`;
  const attempts = step.locatorAttempts
    ? `<details><summary>Locator attempts (${step.locatorAttempts.length})</summary><ul>${step.locatorAttempts
        .map((a) => `<li><code>${escapeHtml(a.strategy)}</code> → ${escapeHtml(a.selector)} — ${a.matched ? "✅ matched" : "❌ no match"}</li>`)
        .join("")}</ul></details>`
    : "";
  const healed = step.healedTo
    ? `<div class="healed">🔧 Self-healed: <code>${escapeHtml(step.healedFrom ?? "unknown")}</code> → <code>${escapeHtml(step.healedTo)}</code> (confidence ${(step.confidence ?? 0) * 100}%)</div>`
    : "";
  const error = step.error ? `<div class="error">${escapeHtml(step.error)}</div>` : "";
  const shot = step.screenshotPath
    ? (() => {
        const relativePath = escapeHtml(makeRelativeScreenshotPath(step.screenshotPath, reportDir));
        return `<div class="screenshot"><button type="button" class="screenshot-toggle" onclick="openScreenshotModal('${relativePath}')">View screenshot</button> <a href="${relativePath}" target="_blank">Open screenshot</a></div>`;
      })()
    : "";

  return `
    <div class="step" style="border-left-color:${color}">
      <div class="step-head">
        <span class="badge" style="background:${color}">${step.status}</span>
        <span class="raw">${escapeHtml(step.raw)}</span>
        <span class="duration">${step.durationMs}ms</span>
      </div>
      ${healed}
      ${error}
      ${shot}
      ${attempts}
    </div>`;
}

function renderScenario(scenario: ScenarioResult, reportDir: string): string {
  const color = statusColor(scenario.status);
  return `
    <section class="scenario">
      <h2 style="border-left:6px solid ${color}; padding-left:10px;">
        ${escapeHtml(scenario.feature)} — ${escapeHtml(scenario.scenario)}
        <span class="badge" style="background:${color}">${scenario.status}</span>
      </h2>
      <div class="meta">Started ${scenario.startedAt} · Finished ${scenario.finishedAt}</div>
      ${scenario.steps.map((step) => renderStep(step, reportDir)).join("\n")}
    </section>`;
}

export function createReportMCP(): ReportMCP {
  function generateHtml(results: ScenarioResult[], outPath = "reports/html/report.html"): string {
    const total = results.length;
    const passed = results.filter((r) => r.status === "PASSED" || r.status === "HEALED").length;
    const failed = results.filter((r) => r.status === "FAILED").length;

    const reportDir = posix.dirname(outPath);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Automation Report</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f6f8fa; margin:0; padding:24px; color:#1f2328; }
  h1 { margin-bottom:4px; }
  .summary { display:flex; gap:16px; margin-bottom:24px; }
  .summary .card { background:white; border-radius:8px; padding:12px 20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
  .summary .num { font-size:28px; font-weight:700; }
  .scenario { background:white; border-radius:8px; padding:16px 20px; margin-bottom:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
  .meta { color:#6e7781; font-size:13px; margin-bottom:12px; }
  .step { border-left:4px solid #ccc; padding:8px 12px; margin-bottom:8px; background:#fbfbfb; border-radius:4px; }
  .step-head { display:flex; align-items:center; gap:10px; }
  .badge { color:white; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; text-transform:uppercase; }
  .raw { font-family: SFMono-Regular, Consolas, monospace; font-size:13px; }
  .duration { margin-left:auto; color:#6e7781; font-size:12px; }
  .error { color:#cf222e; font-size:13px; margin-top:6px; }
  .healed { color:#9a6700; font-size:13px; margin-top:6px; }
  .screenshot { margin-top:8px; }
  .screenshot-toggle { border:none; color:#0969da; background:transparent; cursor:pointer; font-weight:700; text-decoration:underline; padding:0; margin-right:12px; }
  .modal-overlay { display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); align-items:center; justify-content:center; z-index:9999; }
  .modal-overlay.open { display:flex; }
  .modal-content { position:relative; max-width:90vw; max-height:90vh; background:white; padding:16px; border-radius:12px; box-shadow:0 16px 32px rgba(0,0,0,0.25); }
  .modal-content img { max-width:100%; max-height:80vh; display:block; border-radius:8px; }
  .modal-close { position:absolute; top:10px; right:10px; width:32px; height:32px; border:none; background:rgba(15,23,42,0.8); color:white; border-radius:50%; font-size:18px; line-height:1; cursor:pointer; }
  details { margin-top:6px; font-size:12px; color:#57606a; }
  code { background:#eee; padding:1px 5px; border-radius:4px; }
</style>
</head>
<body>
  <h1>AI-Native Automation Report</h1>
  <div class="summary">
    <div class="card"><div class="num">${total}</div>Scenarios</div>
    <div class="card"><div class="num" style="color:#1a7f37">${passed}</div>Passed</div>
    <div class="card"><div class="num" style="color:#cf222e">${failed}</div>Failed</div>
  </div>
  ${results.map((scenario) => renderScenario(scenario, reportDir)).join("\n")}
  <div id="screenshot-modal" class="modal-overlay" onclick="closeScreenshotModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <button type="button" class="modal-close" onclick="closeScreenshotModal(event)">×</button>
      <img id="modal-screenshot-image" src="" alt="Step screenshot" />
    </div>
  </div>
  <script>
    function openScreenshotModal(src) {
      const modal = document.getElementById('screenshot-modal');
      const image = document.getElementById('modal-screenshot-image');
      if (!modal || !image) return;
      image.src = src;
      modal.classList.add('open');
    }

    function closeScreenshotModal(event) {
      event.stopPropagation();
      const modal = document.getElementById('screenshot-modal');
      const image = document.getElementById('modal-screenshot-image');
      if (!modal || !image) return;
      modal.classList.remove('open');
      image.src = '';
    }

    window.openScreenshotModal = openScreenshotModal;
    window.closeScreenshotModal = closeScreenshotModal;
  </script>
</body>
</html>`;

    mkdirSync(outPath.substring(0, outPath.lastIndexOf("/")), { recursive: true });
    writeFileSync(outPath, html, "utf-8");
    return outPath;
  }

  return { generateHtml };
}
