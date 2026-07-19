// ---------------------------------------------------------------------------
// Shared contracts between MCP servers.
// Every server takes one of these in and returns one of these out — this is
// what lets Parser -> Planner -> Playwright -> Validation -> Report plug
// together without any glue code per-project.
// ---------------------------------------------------------------------------

export type StepAction =
  | "navigate"
  | "fill"
  | "click"
  | "verify"
  | "select"
  | "check"
  | "wait";

export interface ParsedStep {
  raw: string;               // original Gherkin line, kept for reporting
  keyword: "Given" | "When" | "Then" | "And" | "But";
  action: StepAction;
  target?: string;            // field name / button label / text to find
  value?: string;             // value to fill / select
}

export interface ParsedScenario {
  feature: string;
  scenario: string;
  steps: ParsedStep[];
}

export interface ExecutionStep extends ParsedStep {
  stepId: string;
  retries: number;
  timeoutMs: number;
}

export interface ExecutionPlan {
  feature: string;
  scenario: string;
  browser: "chromium" | "firefox" | "webkit";
  steps: ExecutionStep[];
}

export type StepStatus = "PASSED" | "FAILED" | "SKIPPED" | "HEALED";

export interface LocatorAttempt {
  strategy: string;
  selector: string;
  matched: boolean;
}

export interface StepResult {
  stepId: string;
  raw: string;
  status: StepStatus;
  durationMs: number;
  locatorAttempts?: LocatorAttempt[];
  healedFrom?: string;
  healedTo?: string;
  confidence?: number;
  error?: string;
  screenshotPath?: string;
}

export interface ScenarioResult {
  feature: string;
  scenario: string;
  status: StepStatus;
  startedAt: string;
  finishedAt: string;
  steps: StepResult[];
}
