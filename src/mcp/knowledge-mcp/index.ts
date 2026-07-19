// ---------------------------------------------------------------------------
// Knowledge MCP
//
// Responsibility: remember what worked. When the AI Locator Engine finds a
// selector for "Submit button" via a fallback strategy, it's saved here
// keyed by (page/target). Next run, Playwright MCP asks Knowledge MCP first
// — so repeated runs get *faster* and more stable instead of re-discovering
// the element from scratch every time. This is what "Self-Healing" means in
// practice: the healed selector becomes the new preferred selector.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface KnownLocator {
  target: string;
  strategy: string;
  selector: string;
  confidence: number;
  lastSeenAt: string;
  timesUsed: number;
}

export interface KnowledgeMCP {
  get(target: string): KnownLocator | undefined;
  remember(entry: Omit<KnownLocator, "lastSeenAt" | "timesUsed">): void;
  all(): KnownLocator[];
}

export function createKnowledgeMCP(storePath = "knowledge/locators.json"): KnowledgeMCP {
  let store: Record<string, KnownLocator> = {};

  if (existsSync(storePath)) {
    try {
      store = JSON.parse(readFileSync(storePath, "utf-8"));
    } catch {
      store = {};
    }
  }

  function persist() {
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, JSON.stringify(store, null, 2), "utf-8");
  }

  function get(target: string): KnownLocator | undefined {
    return store[target.toLowerCase()];
  }

  function remember(entry: Omit<KnownLocator, "lastSeenAt" | "timesUsed">) {
    const key = entry.target.toLowerCase();
    const existing = store[key];
    store[key] = {
      ...entry,
      lastSeenAt: new Date().toISOString(),
      timesUsed: (existing?.timesUsed ?? 0) + 1,
    };
    persist();
  }

  function all(): KnownLocator[] {
    return Object.values(store);
  }

  return { get, remember, all };
}
