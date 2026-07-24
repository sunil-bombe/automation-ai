// ---------------------------------------------------------------------------
// Feature Parser MCP
//
// Responsibility: read a .feature file and turn each scenario's plain-English
// Gherkin steps into structured ParsedStep objects the rest of the pipeline
// can act on. No step definitions to write — the parser infers intent from
// sentence shape (quoted values, verbs like "enters"/"clicks"/"should be
// displayed").
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import type { ParsedScenario, ParsedStep, StepAction } from "../../types/index.js";

const QUOTED = /"([^"]*)"/g;

function extractQuoted(line: string): string[] {
  const matches = [...line.matchAll(QUOTED)];
  return matches.map((m) => m[1]);
}

/**
 * Infers the action + target/value for a single Gherkin step line based on
 * common phrasing. This is intentionally a small rule engine rather than a
 * fixed keyword map, so new phrasing can be added without touching every
 * step definition (there are none) elsewhere in the codebase.
 */
function inferStep(rawLine: string, keyword: ParsedStep["keyword"]): ParsedStep {
  const line = rawLine.trim();
  const lower = line.toLowerCase();
  const quoted = extractQuoted(line);

  let action: StepAction = "wait";
  let target: string | undefined;
  let value: string | undefined;

  if (lower.includes("opens")) {
    action = "navigate";
    target = quoted[0];
  } else if (lower.includes("enters")) {
    action = "fill";
    const fieldMatch = lower.match(/enters\s+([a-z0-9 _-]+?)\s*"/);
    const rawTarget = fieldMatch ? fieldMatch[1].trim() : "field";
    target = normalizeTarget(rawTarget);
    value = quoted[0];
  } else if (lower.includes("selects")) {
    action = "select";
    const fieldMatch = lower.match(/selects\s+([a-z0-9 _-]+?)\s*"/);
    target = fieldMatch ? fieldMatch[1].trim() : "field";
    value = quoted[0];
  } else if (lower.includes("checks") || lower.includes("clicks the checkbox")) {
    action = "check";
    target = quoted[0];
  } else if (lower.includes("clicks")) {
    action = "click";
    const clickTarget = quoted[0] ?? line.replace(/^\s*(and|when)\s+/i, "").replace(/^clicks\s+/i, "").trim();
    target = normalizeTarget(clickTarget);
  } else if (lower.includes("should be displayed") || lower.includes("should appear") || lower.includes("should exist")) {
    action = "verify";
    target = quoted[0] ?? line.replace(/^then\s+/i, "").split(" should")[0].trim();
  } else if (lower.includes("wait")) {
    action = "wait";
    value = quoted[0];
  }

  return { raw: line, keyword, action, target, value };
}

function normalizeTarget(target: string): string {
  const normalized = target.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "username": "username",
    "user name": "username",
    "password": "password",
    "login": "Login",
    "submit": "Submit",
    "dashboard": "Dashboard",
    "pim": "PIM",
    "add employee": "Add Employee",
    "add employee button": "Add Employee",
    "save": "Save",
    "search": "Search",
    "welcome admin": "Welcome Admin",
    "logout": "Logout",
    "first name": "First Name",
    "last name": "Last Name",
    "employee name": "Employee Name",
  };

  return aliases[normalized] ?? target.trim();
}

export interface ParserMCP {
  parseFile(path: string): ParsedScenario[];
  parseText(text: string): ParsedScenario[];
}

export function createParserMCP(): ParserMCP {
  function parseText(text: string): ParsedScenario[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let featureName = "Untitled Feature";
    const scenarios: ParsedScenario[] = [];
    let current: ParsedScenario | null = null;
    let lastKeyword: ParsedStep["keyword"] = "Given";

    for (const line of lines) {
      if (/^Feature:/i.test(line)) {
        featureName = line.replace(/^Feature:/i, "").trim();
      } else if (/^Scenario:/i.test(line)) {
        if (current) scenarios.push(current);
        current = {
          feature: featureName,
          scenario: line.replace(/^Scenario:/i, "").trim(),
          steps: [],
        };
      } else if (/^(Given|When|Then|And|But)\b/i.test(line)) {
        const keywordMatch = line.match(/^(Given|When|Then|And|But)\b/i);
        const keywordRaw = keywordMatch![1];
        // "And"/"But" inherit the previous concrete keyword (Given/When/Then)
        const keyword: ParsedStep["keyword"] =
          keywordRaw === "And" || keywordRaw === "But"
            ? lastKeyword
            : (keywordRaw as ParsedStep["keyword"]);
        lastKeyword = keyword;

        const step = inferStep(line, keyword);
        current?.steps.push(step);
      }
      // Comments, blank lines, tags (@smoke etc.) are ignored for now.
    }
    if (current) scenarios.push(current);

    return scenarios;
  }

  function parseFile(path: string): ParsedScenario[] {
    const text = readFileSync(path, "utf-8");
    return parseText(text);
  }

  return { parseFile, parseText };
}
