/**
 * HTML QA report generator — writes to reports/
 */
import fs from 'fs';
import path from 'path';

export type QaCaseResult = {
  name: string;
  suite: string;
  status: 'pass' | 'fail' | 'skip' | 'warn';
  durationMs?: number;
  detail?: string;
  screenshot?: string;
  log?: string;
};

export type QaReport = {
  generatedAt: string;
  apiBase: string;
  webBase: string;
  gitCommit?: string;
  summary: { pass: number; fail: number; skip: number; warn: number; durationMs: number };
  suites: Record<string, QaCaseResult[]>;
};

export function buildReport(suites: Record<string, QaCaseResult[]>, meta: Partial<QaReport> = {}): QaReport {
  const all = Object.values(suites).flat();
  const summary = {
    pass: all.filter((c) => c.status === 'pass').length,
    fail: all.filter((c) => c.status === 'fail').length,
    skip: all.filter((c) => c.status === 'skip').length,
    warn: all.filter((c) => c.status === 'warn').length,
    durationMs: all.reduce((n, c) => n + (c.durationMs || 0), 0),
  };
  return {
    generatedAt: new Date().toISOString(),
    apiBase: meta.apiBase || '',
    webBase: meta.webBase || '',
    gitCommit: meta.gitCommit,
    summary,
    suites,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function writeHtmlReport(report: QaReport, outDir = path.join(process.cwd(), 'reports')): string {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  const htmlPath = path.join(outDir, `qa-report-${stamp}.html`);
  const jsonPath = path.join(outDir, `qa-report-${stamp}.json`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const rows = Object.entries(report.suites)
    .flatMap(([suite, cases]) =>
      cases.map(
        (c) => `
      <tr class="status-${c.status}">
        <td>${escapeHtml(suite)}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${c.status.toUpperCase()}</td>
        <td>${c.durationMs ?? '—'}ms</td>
        <td>${escapeHtml(c.detail || '')}</td>
        <td>${c.screenshot ? `<a href="${escapeHtml(c.screenshot)}">screenshot</a>` : '—'}</td>
      </tr>`,
      ),
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>VSP Phone QA Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #0f172a; color: #e2e8f0; }
    h1 { color: #38bdf8; }
    .summary { display: flex; gap: 1rem; margin: 1rem 0; }
    .card { padding: 1rem 1.5rem; border-radius: 8px; background: #1e293b; }
    .pass { color: #4ade80; } .fail { color: #f87171; } .skip { color: #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #334155; padding: 0.5rem; text-align: left; font-size: 0.9rem; }
    th { background: #1e293b; }
    tr.status-fail { background: #450a0a; }
    tr.status-pass { background: #052e16; }
    tr.status-skip { background: #1e293b; }
    meta { color: #94a3b8; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>VSP Phone QA Report</h1>
  <meta>Generated: ${escapeHtml(report.generatedAt)} | API: ${escapeHtml(report.apiBase)} | Web: ${escapeHtml(report.webBase)}${report.gitCommit ? ` | Commit: ${escapeHtml(report.gitCommit)}` : ''}</meta>
  <div class="summary">
    <div class="card pass">Pass: ${report.summary.pass}</div>
    <div class="card fail">Fail: ${report.summary.fail}</div>
    <div class="card skip">Skip: ${report.summary.skip}</div>
    <div class="card">Duration: ${report.summary.durationMs}ms</div>
  </div>
  <table>
    <thead><tr><th>Suite</th><th>Case</th><th>Status</th><th>Duration</th><th>Detail</th><th>Screenshot</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(path.join(outDir, 'qa-report-latest.html'), html);
  fs.writeFileSync(path.join(outDir, 'qa-report-latest.json'), JSON.stringify(report, null, 2));
  return htmlPath;
}
