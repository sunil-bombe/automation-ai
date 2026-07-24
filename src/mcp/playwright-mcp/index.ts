// ---------------------------------------------------------------------------
// Playwright MCP
//
// Responsibility: launch a browser and execute an ExecutionPlan's steps.
// Every "find this element" moment is delegated to the AI Locator Engine
// instead of a hardcoded selector — that's what removes Page Objects from
// the picture. Screenshots are captured on every failure automatically.
// ---------------------------------------------------------------------------

import { chromium, firefox, webkit, type Browser, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import type { ExecutionPlan, ExecutionStep, StepResult } from "../../types/index.js";
import { resolveLocator } from "./locator-engine.js";
import type { KnowledgeMCP } from "../knowledge-mcp/index.js";

export interface PlaywrightMCPOptions {
  headless?: boolean;
  screenshotDir?: string;
}

export interface PlaywrightMCP {
  runPlan(plan: ExecutionPlan, knowledge: KnowledgeMCP): Promise<StepResult[]>;
}

const BROWSERS = { chromium, firefox, webkit };

export function createPlaywrightMCP(options: PlaywrightMCPOptions = {}): PlaywrightMCP {
  const { headless = true, screenshotDir = "reports/screenshots" } = options;

  async function runStep(
    page: Page,
    step: ExecutionStep,
    knowledge: KnowledgeMCP
  ): Promise<StepResult> {
    const started = Date.now();
    const base: Pick<StepResult, "stepId" | "raw"> = { stepId: step.stepId, raw: step.raw };

    async function captureStepScreenshot(status: StepResult["status"]): Promise<string | undefined> {
      if (status === "FAILED") {
        return captureFailureScreenshot(page, step.stepId, screenshotDir);
      }

      if (step.action === "navigate" || step.action === "fill" || step.action === "click" || step.action === "select" || step.action === "check" || step.action === "verify") {
        return captureFailureScreenshot(page, step.stepId, screenshotDir);
      }

      return undefined;
    }

    try {
      switch (step.action) {
        case "navigate": {
          if (!step.target) throw new Error("navigate step missing a URL");
          await page.goto(step.target, { timeout: step.timeoutMs });
          const screenshotPath = await captureStepScreenshot("PASSED");
          return { ...base, status: "PASSED", durationMs: Date.now() - started, screenshotPath };
        }

        case "fill": {
          if (!step.target) throw new Error("fill step missing a target field");
          const known = knowledge.get(step.target);
          const resolved = await resolveLocator(page, step.target, known);
          if (!resolved.locator) {
            return failResult(base, started, resolved.attempts, `Could not locate field "${step.target}"`);
          }
          await resolved.locator.fill(step.value ?? "", { timeout: step.timeoutMs });
          recordHealing(knowledge, step.target, known, resolved);
          const screenshotPath = await captureStepScreenshot(known && known.strategy !== resolved.strategy ? "HEALED" : "PASSED");
          return {
            ...base,
            status: known && known.strategy !== resolved.strategy ? "HEALED" : "PASSED",
            durationMs: Date.now() - started,
            locatorAttempts: resolved.attempts,
            healedFrom: known?.selector,
            healedTo: known && known.strategy !== resolved.strategy ? resolved.selector : undefined,
            confidence: resolved.confidence,
            screenshotPath,
          };
        }

        case "click": {
          if (!step.target) throw new Error("click step missing a target");
          const known = knowledge.get(step.target);
          const resolved = await resolveLocator(page, step.target, known);
          if (!resolved.locator) {
            return failResult(base, started, resolved.attempts, `Could not locate clickable "${step.target}"`);
          }
          await resolved.locator.click({ timeout: step.timeoutMs });
          recordHealing(knowledge, step.target, known, resolved);
          const screenshotPath = await captureStepScreenshot(known && known.strategy !== resolved.strategy ? "HEALED" : "PASSED");
          return {
            ...base,
            status: known && known.strategy !== resolved.strategy ? "HEALED" : "PASSED",
            durationMs: Date.now() - started,
            locatorAttempts: resolved.attempts,
            confidence: resolved.confidence,
            screenshotPath,
          };
        }

        case "select": {
          if (!step.target) throw new Error("select step missing a target");
          const known = knowledge.get(step.target);
          const resolved = await resolveLocator(page, step.target, known);
          if (!resolved.locator) {
            return failResult(base, started, resolved.attempts, `Could not locate dropdown "${step.target}"`);
          }
          await resolved.locator.selectOption(step.value ?? "", { timeout: step.timeoutMs });
          recordHealing(knowledge, step.target, known, resolved);
          const screenshotPath = await captureStepScreenshot("PASSED");
          return { ...base, status: "PASSED", durationMs: Date.now() - started, screenshotPath };
        }

        case "check": {
          if (!step.target) throw new Error("check step missing a target");
          const known = knowledge.get(step.target);
          const resolved = await resolveLocator(page, step.target, known);
          if (!resolved.locator) {
            return failResult(base, started, resolved.attempts, `Could not locate checkbox "${step.target}"`);
          }
          await resolved.locator.check({ timeout: step.timeoutMs });
          const screenshotPath = await captureStepScreenshot("PASSED");
          return { ...base, status: "PASSED", durationMs: Date.now() - started, screenshotPath };
        }

        case "verify": {
          if (!step.target) throw new Error("verify step missing text/element to check");
          const resolved = await resolveLocator(page, step.target);
          if (!resolved.locator) {
            return failResult(base, started, resolved.attempts, `Expected "${step.target}" to be visible, but it was not found`);
          }
          const visible = await resolved.locator.isVisible();
          if (!visible) {
            return failResult(base, started, resolved.attempts, `"${step.target}" was found but is not visible`);
          }
          const screenshotPath = await captureStepScreenshot("PASSED");
          return {
            ...base,
            status: "PASSED",
            durationMs: Date.now() - started,
            locatorAttempts: resolved.attempts,
            confidence: resolved.confidence,
            screenshotPath,
          };
        }

        case "wait": {
          const ms = step.value ? Number(step.value) : 1000;
          await page.waitForTimeout(ms);
          const screenshotPath = await captureStepScreenshot("PASSED");
          return { ...base, status: "PASSED", durationMs: Date.now() - started, screenshotPath };
        }

        default:
          return { ...base, status: "SKIPPED", durationMs: Date.now() - started, error: `Unknown action ${step.action}` };
      }
    } catch (err) {
      const screenshotPath = await captureFailureScreenshot(page, step.stepId, screenshotDir);
      return {
        ...base,
        status: "FAILED",
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
        screenshotPath,
      };
    }
  }

  async function runPlan(plan: ExecutionPlan, knowledge: KnowledgeMCP): Promise<StepResult[]> {
    const launcher = BROWSERS[plan.browser];
    const browser: Browser = await launcher.launch({ headless });
    const context = await browser.newContext();
    const page = await context.newPage();

    const results: StepResult[] = [];
    try {
      for (const step of plan.steps) {
        let attempt = 0;
        let result: StepResult;
        do {
          result = await runStep(page, step, knowledge);
          attempt++;
        } while (result.status === "FAILED" && attempt <= step.retries);
        results.push(result);

        // Stop the scenario early once a step fails after exhausting retries
        // -- matches typical BDD "fail fast within a scenario" behavior.
        if (result.status === "FAILED") break;
      }
    } finally {
      await context.close();
      await browser.close();
    }
    return results;
  }

  return { runPlan };
}

function failResult(
  base: Pick<StepResult, "stepId" | "raw">,
  started: number,
  attempts: StepResult["locatorAttempts"],
  error: string
): StepResult {
  return {
    ...base,
    status: "FAILED",
    durationMs: Date.now() - started,
    locatorAttempts: attempts,
    error,
  };
}

function recordHealing(
  knowledge: KnowledgeMCP,
  target: string,
  known: ReturnType<KnowledgeMCP["get"]>,
  resolved: Awaited<ReturnType<typeof resolveLocator>>
) {
  if (!resolved.strategy || !resolved.selector) return;
  // Only re-persist when the strategy actually changed, or we've never seen
  // this target before -- avoids rewriting the knowledge file every step.
  if (!known || known.strategy !== resolved.strategy) {
    knowledge.remember({
      target,
      strategy: resolved.strategy,
      selector: resolved.selector,
      confidence: resolved.confidence,
    });
  }
}

async function captureFailureScreenshot(page: Page, stepId: string, dir: string): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const path = `${dir}/${stepId}-${Date.now()}.png`;
  try {
    await page.screenshot({ path, fullPage: true });
  } catch {
    // best-effort; a screenshot failure shouldn't mask the real step error
  }
  return path;
}
