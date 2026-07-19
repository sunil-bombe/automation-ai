// ---------------------------------------------------------------------------
// Execution Planner MCP
//
// Responsibility: take a ParsedScenario and decide *how* to run it — browser
// choice, per-step retry counts, and timeouts. Today this uses simple,
// transparent heuristics (e.g. "verify" steps get more retries because
// the UI may need a moment to settle); this is the layer where scenario
// prioritization / parallelization strategy would plug in later.
// ---------------------------------------------------------------------------

import type { ExecutionPlan, ExecutionStep, ParsedScenario } from "../../types/index.js";

export interface PlannerOptions {
  browser?: "chromium" | "firefox" | "webkit";
  defaultTimeoutMs?: number;
  defaultRetries?: number;
}

export interface PlannerMCP {
  plan(scenario: ParsedScenario, options?: PlannerOptions): ExecutionPlan;
}

export function createPlannerMCP(): PlannerMCP {
  function plan(scenario: ParsedScenario, options: PlannerOptions = {}): ExecutionPlan {
    const {
      browser = "chromium",
      defaultTimeoutMs = 10_000,
      defaultRetries = 1,
    } = options;

    const steps: ExecutionStep[] = scenario.steps.map((step, idx) => {
      // Verification steps get extra retries + longer timeout since the
      // page may still be settling (network calls, animations, etc).
      const isVerify = step.action === "verify";
      return {
        ...step,
        stepId: `${scenario.scenario.replace(/\s+/g, "_")}_${idx}`,
        retries: isVerify ? defaultRetries + 2 : defaultRetries,
        timeoutMs: isVerify ? defaultTimeoutMs * 1.5 : defaultTimeoutMs,
      };
    });

    return {
      feature: scenario.feature,
      scenario: scenario.scenario,
      browser,
      steps,
    };
  }

  return { plan };
}
