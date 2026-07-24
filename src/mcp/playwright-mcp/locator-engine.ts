// ---------------------------------------------------------------------------
// AI Locator Engine
//
// Responsibility: given a plain-English target ("username", "Submit",
// "Logged In Successfully") find the matching element on the page without
// anyone having written a CSS/XPath selector for it. Strategies are tried in
// order from most-semantic to most-brute-force; the first one that resolves
// to exactly one visible element wins. Every attempt is recorded so the
// Report MCP can show *why* a step passed/failed, and the winning strategy
// is handed back to Knowledge MCP so next run tries it first.
// ---------------------------------------------------------------------------

import type { Locator, Page } from "playwright";
import type { LocatorAttempt } from "../../types/index.js";

export interface ResolveResult {
  locator: Locator | null;
  attempts: LocatorAttempt[];
  strategy?: string;
  selector?: string;
  confidence: number;
}

type Strategy = {
  name: string;
  confidence: number;
  build: (page: Page, target: string) => Locator;
};

// Ordered highest-signal first. Each returns a Playwright Locator; we only
// count it "matched" if resolving it finds exactly one visible element.
const STRATEGIES: Strategy[] = [
  {
    name: "test-id",
    confidence: 0.99,
    build: (page, target) => page.getByTestId(toTestId(target)),
  },
  {
    name: "label",
    confidence: 0.95,
    build: (page, target) => page.getByLabel(target, { exact: false }),
  },
  {
    name: "placeholder",
    confidence: 0.92,
    build: (page, target) => page.getByPlaceholder(target, { exact: false }),
  },
  {
    name: "role-button",
    confidence: 0.9,
    build: (page, target) => page.getByRole("button", { name: target, exact: false }),
  },
  {
    name: "role-textbox",
    confidence: 0.88,
    build: (page, target) => page.getByRole("textbox", { name: target, exact: false }),
  },
  {
    name: "role-link",
    confidence: 0.85,
    build: (page, target) => page.getByRole("link", { name: target, exact: false }),
  },
  {
    name: "text",
    confidence: 0.8,
    build: (page, target) => page.getByText(target, { exact: false }),
  },
  {
    name: "css-name-attr",
    confidence: 0.6,
    build: (page, target) => page.locator(`[name="${toAttr(target)}"]`),
  },
  {
    name: "css-id-guess",
    confidence: 0.5,
    build: (page, target) => page.locator(`#${toAttr(target)}`),
  },
  {
    name: "orangehrm-username",
    confidence: 0.97,
    build: (page) => page.locator('input[name="username"]'),
  },
  {
    name: "orangehrm-password",
    confidence: 0.97,
    build: (page) => page.locator('input[name="password"]'),
  },
  {
    name: "orangehrm-login-button",
    confidence: 0.96,
    build: (page) => page.getByRole("button", { name: /login/i }),
  },
  {
    name: "orangehrm-menu-item",
    confidence: 0.95,
    build: (page, target) => page.locator(`text=${target}`),
  },
  {
    name: "orangehrm-dash-label",
    confidence: 0.94,
    build: (page, target) => page.locator(`text=${target}`),
  },
  {
    name: "orangehrm-input-label",
    confidence: 0.93,
    build: (page, target) => page.locator(`input[placeholder*="${target}"]`),
  },
  {
    name: "orangehrm-sidebar-link",
    confidence: 0.92,
    build: (page, target) => page.locator(`a[href*="${toAttr(target)}"], span:has-text("${target}")`),
  },
  {
    name: "orangehrm-button-name",
    confidence: 0.91,
    build: (page, target) => page.getByRole("button", { name: new RegExp(target, "i") }),
  },
  {
    name: "orangehrm-text",
    confidence: 0.9,
    build: (page, target) => page.locator(`text=${target}`),
  },
  {
    name: "orangehrm-aria-label",
    confidence: 0.89,
    build: (page, target) => page.locator(`[aria-label*="${target}"]`),
  },
  {
    name: "orangehrm-menu-item-role",
    confidence: 0.88,
    build: (page, target) => page.getByRole("menuitem", { name: new RegExp(target, "i") }),
  },
  {
    name: "orangehrm-link-name",
    confidence: 0.87,
    build: (page, target) => page.getByRole("link", { name: new RegExp(target, "i") }),
  },
  {
    name: "orangehrm-username-label",
    confidence: 0.86,
    build: (page) => page.locator('input[name="username"]'),
  },
  {
    name: "orangehrm-password-label",
    confidence: 0.85,
    build: (page) => page.locator('input[name="password"]'),
  },
  {
    name: "orangehrm-locator",
    confidence: 0.84,
    build: (page, target) => page.locator(`[placeholder*="${toAttr(target)}"], [aria-label*="${toAttr(target)}"]`),
  },
  {
    name: "orangehrm-heading",
    confidence: 0.83,
    build: (page, target) => page.locator(`h1:has-text("${target}"), h2:has-text("${target}")`),
  },
  {
    name: "orangehrm-verify-text",
    confidence: 0.82,
    build: (page, target) => page.locator(`text=${target}`),
  },
  {
    name: "orangehrm-table-cell",
    confidence: 0.81,
    build: (page, target) => page.locator(`td:has-text("${target}"), th:has-text("${target}")`),
  },
  {
    name: "orangehrm-form-control",
    confidence: 0.8,
    build: (page, target) => page.locator(`input[placeholder*="${target}"], input[name*="${toAttr(target)}"]`),
  },
  {
    name: "orangehrm-sidebar-label",
    confidence: 0.79,
    build: (page, target) => page.locator(`span:has-text("${target}"), a:has-text("${target}")`),
  },
  {
    name: "placeholder",
    confidence: 0.92,
    build: (page, target) => page.getByPlaceholder(target, { exact: false }),
  },
  {
    name: "role-button",
    confidence: 0.9,
    build: (page, target) => page.getByRole("button", { name: target, exact: false }),
  },
  {
    name: "role-textbox",
    confidence: 0.88,
    build: (page, target) => page.getByRole("textbox", { name: target, exact: false }),
  },
  {
    name: "role-link",
    confidence: 0.85,
    build: (page, target) => page.getByRole("link", { name: target, exact: false }),
  },
  {
    name: "text",
    confidence: 0.8,
    build: (page, target) => page.getByText(target, { exact: false }),
  },
  {
    name: "css-name-attr",
    confidence: 0.6,
    build: (page, target) => page.locator(`[name="${toAttr(target)}"]`),
  },
  {
    name: "css-id-guess",
    confidence: 0.5,
    build: (page, target) => page.locator(`#${toAttr(target)}`),
  },
];

function toTestId(target: string): string {
  return target.trim().toLowerCase().replace(/\s+/g, "-");
}

function toAttr(target: string): string {
  return target.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Resolves a plain-English target to a single on-page element.
 * If `preferredSelector` is supplied (from Knowledge MCP, i.e. what worked
 * last time), it's tried first — this is the "self-healing" shortcut path.
 */
export async function resolveLocator(
  page: Page,
  target: string,
  preferredStrategy?: { strategy: string; selector: string }
): Promise<ResolveResult> {
  const attempts: LocatorAttempt[] = [];

  const tryStrategy = async (
    name: string,
    confidence: number,
    locator: Locator
  ): Promise<ResolveResult | null> => {
    try {
      const count = await locator.count();
      const matched = count === 1 || (count > 1 && (await locator.first().isVisible()));
      attempts.push({ strategy: name, selector: describeLocator(locator), matched });
      if (matched) {
        return {
          locator: count > 1 ? locator.first() : locator,
          attempts,
          strategy: name,
          selector: describeLocator(locator),
          confidence,
        };
      }
    } catch {
      attempts.push({ strategy: name, selector: describeLocator(locator), matched: false });
    }
    return null;
  };

  // 1. Fast path: what worked before, per Knowledge MCP.
  if (preferredStrategy) {
    const known = STRATEGIES.find((s) => s.name === preferredStrategy.strategy);
    if (known) {
      const locator = known.build(page, target);
      const result = await tryStrategy(`${known.name} (known-good)`, known.confidence, locator);
      if (result) return result;
    }
  }

  // 2. Full cascade.
  for (const strategy of STRATEGIES) {
    const locator = strategy.build(page, target);
    const result = await tryStrategy(strategy.name, strategy.confidence, locator);
    if (result) return result;
  }

  return { locator: null, attempts, confidence: 0 };
}

function describeLocator(locator: Locator): string {
  // Playwright locators stringify to something like "getByRole('button', ...)"
  return locator.toString();
}
