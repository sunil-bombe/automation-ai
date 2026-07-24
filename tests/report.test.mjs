import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReportMCP } from '../dist/mcp/report-mcp/index.js';

test('report embeds screenshots for each step', () => {
  const report = createReportMCP();
  const outPath = report.generateHtml(
    [
      {
        feature: 'Login',
        scenario: 'valid credentials',
        status: 'PASSED',
        startedAt: '2026-07-20T00:00:00Z',
        finishedAt: '2026-07-20T00:00:01Z',
        steps: [
          {
            stepId: 'step-1',
            raw: 'Given I open the login page',
            status: 'PASSED',
            durationMs: 120,
            screenshotPath: 'reports/screenshots/step-1.png',
          },
        ],
      },
    ],
    'reports/html/report.html'
  );

  const html = readFileSync(outPath, 'utf8');
  assert.match(html, /<img[^>]+src="[^"]+step-1\.png"/i);
});
