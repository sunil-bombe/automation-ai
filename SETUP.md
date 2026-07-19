# Running this project

This is a real, runnable implementation of the architecture described in the
vision README — not a mockup. It was built and reviewed in a sandbox without
network access, so dependencies could not be installed or executed here;
follow the steps below on your own machine to install and run it.

## 1. Install

```bash
npm install
npx playwright install chromium   # downloads the browser binary
```

## 2. Run a feature file

```bash
npm run start -- features/login.feature
```

Add `--headed` to watch the browser instead of running headless:

```bash
npm run start -- features/login.feature --headed
```

## 3. See the results

- Console output shows a live pass/fail/healed line per step.
- `reports/html/report.html` — open in a browser for the full report,
  including every locator strategy the AI Locator Engine tried per step.
- `reports/screenshots/` — full-page screenshot captured automatically on
  any failed step.
- `knowledge/locators.json` — the "memory" of which locator strategy worked
  for each target (e.g. "Submit" button, "username" field). Delete this file
  to force the locator engine to re-discover everything from scratch.

## What's implemented vs. the full vision

This scaffold implements the core loop end-to-end and is meant to be a
faithful, working foundation you can extend:

| MCP Server | Status |
|---|---|
| Feature Parser MCP | ✅ implemented (rule-based Gherkin → JSON steps) |
| Execution Planner MCP | ✅ implemented (retries/timeouts; browser selection) |
| Playwright MCP | ✅ implemented (real browser automation) |
| AI Locator Engine | ✅ implemented (9-strategy cascade: test-id → label → placeholder → role → text → CSS fallback) |
| Knowledge MCP | ✅ implemented (JSON-file locator memory) |
| Self-Healing MCP | ✅ folded into the Locator Engine + Knowledge MCP — a strategy change is reported as `HEALED` |
| Validation MCP | ✅ implemented for UI (`verify` steps); API/DB validation are stubs to extend |
| Report MCP | ✅ implemented (HTML report with step timeline + locator attempts) |
| API MCP / Database MCP | 🔲 not implemented — add as siblings of `playwright-mcp/` following the same `create*MCP()` factory pattern |
| Dashboard / Cloud MCP | 🔲 not implemented — the HTML report is a starting point; a dashboard would aggregate multiple report runs |

## Extending it

Every server exports a `create___MCP()` factory returning a small interface
(see `src/mcp/*/index.ts`). To add API validation, for example, create
`src/mcp/api-mcp/index.ts` with a `createApiMCP()` that exposes something
like `validateResponse(request, expectations)`, then call it from
`orchestrator.ts` alongside `playwright.runPlan(...)`.

To add a new Gherkin phrasing (e.g. "User uploads file"), add a branch to
`inferStep()` in `src/mcp/parser-mcp/index.ts` — no step-definition file
needed anywhere else.
