// ---------------------------------------------------------------------------
// Orchestrator
//
// This is the only file a user runs. It wires the MCP servers together in
// the order described in the README:
//
//   Feature File -> Parser MCP -> Planner MCP -> Playwright MCP
//                -> Validation (built into Playwright MCP's verify steps)
//                -> Knowledge MCP (locator memory / self-healing)
//                -> Report MCP -> HTML report
//
// Usage:
//   npm run build && npm run run -- features/login.feature
//   (or, for quick iteration:  npm start -- features/login.feature)
// ---------------------------------------------------------------------------

import { createParserMCP } from "./mcp/parser-mcp/index.js";
import { createPlannerMCP } from "./mcp/planner-mcp/index.js";
import { createPlaywrightMCP } from "./mcp/playwright-mcp/index.js";
import { createKnowledgeMCP } from "./mcp/knowledge-mcp/index.js";
import { createReportMCP } from "./mcp/report-mcp/index.js";
import type { ScenarioResult } from "./types/index.js";

async function main() {
  const featurePath = process.argv[2] ?? "features/login.feature";
  const headless = process.argv.includes("--headed") ? false : true;

  console.log(`\n▶ Running feature file: ${featurePath}\n`);

  const parser = createParserMCP();
  const planner = createPlannerMCP();
  const playwright = createPlaywrightMCP({ headless });
  const knowledge = createKnowledgeMCP();
  const report = createReportMCP();

  const scenarios = parser.parseFile(featurePath);
  console.log(`Parsed ${scenarios.length} scenario(s).`);

  const results: ScenarioResult[] = [];

  for (const scenario of scenarios) {
    console.log(`\n— Scenario: ${scenario.scenario}`);
    const plan = planner.plan(scenario);
    const startedAt = new Date().toISOString();
    const stepResults = await playwright.runPlan(plan, knowledge);
    const finishedAt = new Date().toISOString();

    const status = stepResults.some((s) => s.status === "FAILED")
      ? "FAILED"
      : stepResults.some((s) => s.status === "HEALED")
      ? "HEALED"
      : "PASSED";

    for (const s of stepResults) {
      const icon = s.status === "PASSED" ? "✅" : s.status === "HEALED" ? "🔧" : s.status === "FAILED" ? "❌" : "⏭";
      console.log(`  ${icon} ${s.raw}  (${s.durationMs}ms)`);
      if (s.error) console.log(`     ↳ ${s.error}`);
    }

    results.push({
      feature: scenario.feature,
      scenario: scenario.scenario,
      status,
      startedAt,
      finishedAt,
      steps: stepResults,
    });
  }

  const outPath = report.generateHtml(results);
  console.log(`\n📄 Report written to ${outPath}`);

  const anyFailed = results.some((r) => r.status === "FAILED");
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error running automation-ai:", err);
  process.exit(1);
});
