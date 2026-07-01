import fs from 'node:fs/promises';
import path from 'node:path';
import type { EvalMode, EvalResult, EvalReport } from './types.js';

function formatPercent(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${Math.round(value * 100)}%`;
}

function formatNumber(value: number | undefined, digits = 3): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  return value.toFixed(digits);
}

function clamp01(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function scoreClass(score: number): string {
  if (score >= 0.85) return 'good';
  if (score >= 0.6) return 'warn';
  return 'bad';
}

function metricBar(label: string, value: number | undefined): string {
  const safeValue = clamp01(value);
  return `
    <div class="metric-row">
      <div class="metric-label">
        <span>${escapeHtml(label)}</span>
        <strong>${formatPercent(value)}</strong>
      </div>
      <div class="bar-track" aria-hidden="true">
        <div class="bar-fill ${scoreClass(safeValue)}" style="width: ${safeValue * 100}%"></div>
      </div>
    </div>
  `;
}

function donutChart(label: string, value: number | undefined, detail: string, className = 'good'): string {
  const safeValue = clamp01(value);
  const degrees = Math.round(safeValue * 360);
  return `
    <div class="donut-card">
      <div class="donut ${className}" style="--value: ${degrees}deg">
        <span>${formatPercent(value)}</span>
      </div>
      <div>
        <h3>${escapeHtml(label)}</h3>
        <p>${escapeHtml(detail)}</p>
      </div>
    </div>
  `;
}

function scoreDistribution(results: EvalResult[]): number[] {
  const buckets = new Array<number>(10).fill(0);
  for (const result of results) {
    const index = Math.min(9, Math.max(0, Math.floor(clamp01(result.overallScore) * 10)));
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return buckets;
}

function histogram(results: EvalResult[]): string {
  const buckets = scoreDistribution(results);
  const maxBucket = Math.max(1, ...buckets);

  return `
    <div class="histogram" aria-label="Score distribution">
      ${buckets.map((count, index) => {
    const min = index * 10;
    const max = index === 9 ? 100 : min + 9;
    const height = Math.max(6, (count / maxBucket) * 100);
    return `
          <div class="histogram-bin">
            <div class="histogram-count">${count}</div>
            <div class="histogram-bar ${scoreClass((index + 1) / 10)}" style="height: ${height}%"></div>
            <div class="histogram-label">${min}-${max}</div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

function miniStat(label: string, value: string): string {
  return `
    <div class="mini-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function badge(label: string, passed: boolean): string {
  return `<span class="badge ${passed ? 'pass' : 'fail'}">${escapeHtml(label)}</span>`;
}

function judgeBadge(result: EvalResult): string {
  const semantic = result.metrics.semantic;
  if (!semantic) {
    return '<span class="badge neutral">Not run</span>';
  }

  if (semantic.winner === 'generated') {
    return '<span class="badge pass">Generated</span>';
  }
  if (semantic.winner === 'reference') {
    return '<span class="badge fail">Reference</span>';
  }
  if (semantic.winner === 'tie') {
    return '<span class="badge neutral">Tie</span>';
  }
  return '<span class="badge neutral">Inconclusive</span>';
}

function buildResultsRows(results: EvalResult[]): string {
  const hasSemantic = results.some((result) => result.metrics.semantic !== undefined);

  return results.map((result, index) => {
    const similarity = result.metrics.similarity;
    const syntaxPassed = result.metrics.syntax?.markersClean === true;
    const durationSeconds = result.harness.durationMs / 1000;
    const semanticCells = hasSemantic ? `
        <td>${judgeBadge(result)}</td>
        <td>${formatPercent(result.metrics.semantic?.score)}</td>
        <td class="reasoning">${escapeHtml(result.metrics.semantic?.reasoning ?? '')}</td>
    ` : '';

    return `
      <tr class="result-row" data-result-index="${index}">
        <td class="muted">${index + 1}</td>
        <td><button class="case-link" type="button" data-result-index="${index}"><code>${escapeHtml(result.caseId)}</code></button></td>
        <td>
          <div class="score-pill ${scoreClass(result.overallScore)}">${formatPercent(result.overallScore)}</div>
        </td>
        <td>${formatPercent(similarity.score)}</td>
        <td>${formatPercent(similarity.editDistance)}</td>
        <td>${formatPercent(similarity.winnowing)}</td>
        <td>${badge(similarity.exactMatch ? 'Exact' : 'Different', similarity.exactMatch)}</td>
        <td>${badge(syntaxPassed ? 'Clean' : 'Markers', syntaxPassed)}</td>
        ${semanticCells}
        <td>${formatNumber(durationSeconds, 2)}s</td>
        <td>${result.harness.tokenUsage.totalTokens.toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}

function buildHtmlReport(report: EvalReport, config: { dataset: string }): string {
  const generatedAt = new Date(report.timestamp).toLocaleString();
  const sortedResults = [...report.results].sort((a, b) => a.overallScore - b.overallScore);
  const weakestResults = sortedResults.slice(0, 5);
  const totalTokens = report.results.reduce((sum, result) => sum + result.harness.tokenUsage.totalTokens, 0);
  const averageDurationMs = report.results.reduce((sum, result) => sum + result.harness.durationMs, 0) / report.results.length;
  const averageTokens = totalTokens / report.results.length;
  const averageToolEfficiency = report.results.reduce((sum, result) => sum + result.metrics.efficiency.toolEfficiency, 0) / report.results.length;
  const passCount = report.results.filter((result) => result.metrics.syntax?.markersClean === true).length;
  const exactCount = report.results.filter((result) => result.metrics.similarity.exactMatch).length;
  const highScoreCount = report.results.filter((result) => result.overallScore >= 0.85).length;
  const midScoreCount = report.results.filter((result) => result.overallScore >= 0.6 && result.overallScore < 0.85).length;
  const lowScoreCount = report.results.filter((result) => result.overallScore < 0.6).length;
  const hasSemantic = report.results.some((result) => result.metrics.semantic !== undefined);
  const detailResults = report.results.map((result) => ({
    caseId: result.caseId,
    dataset: result.dataset,
    agent: result.agent,
    model: result.model,
    case: result.case,
    overallScore: result.overallScore,
    resolution: result.harness.resolution,
    reasoning: result.harness.reasoning ?? '',
    toolCalls: result.harness.toolCalls,
    durationMs: result.harness.durationMs,
    tokenUsage: result.harness.tokenUsage,
    metrics: result.metrics
  }));
  const semanticHeaderCells = hasSemantic ? `
              <th>Judge</th>
              <th>Judge Score</th>
              <th>Reasoning</th>
  ` : '';
  const semanticSummaryCard = hasSemantic ? `
      <div class="card">
        <div class="stat-label">Judge Score</div>
        <div class="stat-value">${formatPercent(report.summary.averageJudgeScore)}</div>
      </div>
  ` : '';
  const summaryGridClass = hasSemantic ? 'grid five' : 'grid';
  const semanticBars = hasSemantic ? `
        ${metricBar('Judge score', report.summary.averageJudgeScore)}
        ${metricBar('Generated preferred', report.summary.judgeGeneratedWinRate)}
        ${metricBar('Reference preferred', report.summary.judgeReferenceWinRate)}
        ${metricBar('Judge tie', report.summary.judgeTieRate)}
        ${metricBar('Judge inconclusive', report.summary.judgeInconclusiveRate)}
  ` : '';
  const judgeDonut = hasSemantic ? donutChart(
    'Judge Preference',
    report.summary.judgeGeneratedWinRate,
    `${formatPercent(report.summary.judgeReferenceWinRate)} reference, ${formatPercent(report.summary.judgeTieRate)} tie`,
    'blue'
  ) : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Evaluation Report - ${escapeHtml(config.dataset)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #627083;
      --line: #d9dee7;
      --green: #168a5b;
      --green-bg: #e8f6ef;
      --amber: #b96b00;
      --amber-bg: #fff2db;
      --red: #c43d3d;
      --red-bg: #ffe8e8;
      --blue: #2764c5;
      --blue-bg: #eaf1ff;
      --violet: #7357c8;
      --violet-bg: #f0edff;
      --shadow: 0 12px 34px rgba(31, 41, 55, 0.08);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.45;
    }

    .shell {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }

    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 30px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    h2 {
      margin: 0 0 14px;
      font-size: 16px;
      letter-spacing: 0;
    }

    .subtitle, .muted {
      color: var(--muted);
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .chip {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 999px;
      padding: 6px 10px;
      color: var(--muted);
      white-space: nowrap;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 14px;
    }

    .grid.five {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .analytics-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      gap: 14px;
      margin-bottom: 14px;
    }

    .donut-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: 18px;
    }

    .stat-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 760;
      line-height: 1;
    }

    .wide-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 0.55fr);
      gap: 14px;
      margin-bottom: 14px;
    }

    .insight-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 16px;
    }

    .mini-stat {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fbfcfe;
    }

    .mini-stat span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 4px;
    }

    .mini-stat strong {
      font-size: 18px;
    }

    .metric-row + .metric-row { margin-top: 14px; }

    .metric-label {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 6px;
      color: var(--muted);
    }

    .metric-label strong { color: var(--text); }

    .bar-track {
      height: 10px;
      border-radius: 999px;
      background: #e8ecf2;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: inherit;
    }

    .good { background: var(--green); }
    .warn { background: var(--amber); }
    .bad { background: var(--red); }
    .blue { background: var(--blue); }

    .donut-card {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      align-items: center;
      gap: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: #fbfcfe;
    }

    .donut {
      width: 86px;
      height: 86px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: conic-gradient(var(--green) var(--value), #e8ecf2 0);
      position: relative;
    }

    .donut.warn {
      background: conic-gradient(var(--amber) var(--value), #e8ecf2 0);
    }

    .donut.bad {
      background: conic-gradient(var(--red) var(--value), #e8ecf2 0);
    }

    .donut.blue {
      background: conic-gradient(var(--blue) var(--value), #e8ecf2 0);
    }

    .donut::after {
      content: "";
      position: absolute;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: var(--panel);
    }

    .donut span {
      position: relative;
      z-index: 1;
      font-weight: 800;
      color: var(--text);
    }

    .donut-card h3 {
      margin: 0 0 4px;
      font-size: 14px;
    }

    .donut-card p {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
    }

    .histogram {
      height: 260px;
      display: grid;
      grid-template-columns: repeat(10, minmax(0, 1fr));
      gap: 8px;
      align-items: end;
      padding-top: 22px;
    }

    .histogram-bin {
      height: 100%;
      display: grid;
      grid-template-rows: 22px 1fr 20px;
      align-items: end;
      justify-items: center;
      min-width: 0;
    }

    .histogram-count {
      color: var(--muted);
      font-size: 12px;
      align-self: start;
    }

    .histogram-bar {
      width: 100%;
      min-height: 6px;
      border-radius: 6px 6px 0 0;
    }

    .histogram-label {
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }

    .score-pill {
      display: inline-flex;
      min-width: 58px;
      justify-content: center;
      color: white;
      font-weight: 700;
      border-radius: 999px;
      padding: 4px 8px;
    }

    .badge {
      display: inline-flex;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 700;
    }

    .badge.pass {
      color: var(--green);
      background: var(--green-bg);
    }

    .badge.fail {
      color: var(--red);
      background: var(--red-bg);
    }

    .badge.neutral {
      color: var(--blue);
      background: var(--blue-bg);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: 11px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
    }

    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: #fbfcfe;
      position: sticky;
      top: 0;
    }

    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      color: #263445;
    }

    .reasoning {
      min-width: 260px;
      color: var(--muted);
    }

    .case-link {
      border: 0;
      background: transparent;
      padding: 0;
      cursor: pointer;
      text-align: left;
    }

    .case-link code {
      color: var(--blue);
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .result-row {
      cursor: pointer;
    }

    .result-row:hover {
      background: #f7faff;
    }

    dialog {
      width: min(1080px, calc(100vw - 28px));
      max-height: min(840px, calc(100vh - 28px));
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 24px 70px rgba(17, 24, 39, 0.22);
      padding: 0;
    }

    dialog::backdrop {
      background: rgba(15, 23, 42, 0.46);
    }

    .detail-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--line);
      background: #fbfcfe;
    }

    .detail-head h2 {
      margin: 0 0 6px;
      font-size: 18px;
    }

    .close-button {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: white;
      padding: 7px 10px;
      cursor: pointer;
    }

    .detail-body {
      padding: 18px 20px 20px;
      overflow: auto;
      max-height: calc(min(840px, 100vh - 28px) - 82px);
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }

    .detail-section + .detail-section {
      margin-top: 16px;
    }

    .detail-section h3 {
      margin: 0 0 8px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #0f172a;
      color: #dbeafe;
      padding: 14px;
      max-height: 360px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.55;
    }

    .tool-list {
      display: grid;
      gap: 10px;
    }

    .tool-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fbfcfe;
    }

    .tool-item strong {
      display: block;
      margin-bottom: 6px;
    }

    .table-wrap {
      overflow: auto;
      max-height: 640px;
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    .weak-list {
      display: grid;
      gap: 10px;
    }

    .weak-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
    }

    .weak-item:last-child { border-bottom: 0; }

    @media (max-width: 860px) {
      header, .wide-grid, .analytics-grid { grid-template-columns: 1fr; display: grid; }
      .meta { justify-content: flex-start; }
      .grid, .grid.five { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .insight-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 560px) {
      .shell { width: min(100vw - 20px, 1180px); padding-top: 20px; }
      .grid, .grid.five { grid-template-columns: 1fr; }
      .donut-grid, .insight-grid { grid-template-columns: 1fr; }
      .detail-grid { grid-template-columns: 1fr; }
      h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <h1>Evaluation Report</h1>
        <div class="subtitle">${escapeHtml(config.dataset)} / ${escapeHtml(report.mode)} / ${escapeHtml(report.model)}</div>
      </div>
      <div class="meta">
        <span class="chip">Generated ${escapeHtml(generatedAt)}</span>
        <span class="chip">${report.summary.totalCases.toLocaleString()} cases</span>
        <span class="chip">${totalTokens.toLocaleString()} tokens</span>
      </div>
    </header>

    <section class="${summaryGridClass}" aria-label="Summary">
      <div class="card">
        <div class="stat-label">Average Score</div>
        <div class="stat-value">${formatPercent(report.summary.averageScore)}</div>
      </div>
      <div class="card">
        <div class="stat-label">Syntax Pass</div>
        <div class="stat-value">${formatPercent(report.summary.syntaxPassRate)}</div>
      </div>
      <div class="card">
        <div class="stat-label">Exact Match</div>
        <div class="stat-value">${formatPercent(report.summary.exactMatchRate)}</div>
      </div>
      <div class="card">
        <div class="stat-label">Avg Duration</div>
        <div class="stat-value">${formatNumber(averageDurationMs / 1000, 2)}s</div>
      </div>
      ${semanticSummaryCard}
    </section>

    <section class="analytics-grid">
      <div class="card">
        <h2>Outcome Mix</h2>
        <div class="donut-grid">
          ${donutChart('Syntax Clean', report.summary.syntaxPassRate, `${passCount} of ${report.summary.totalCases} cases passed marker cleanup`, 'good')}
          ${donutChart('Exact Match', report.summary.exactMatchRate, `${exactCount} exact reference matches`, 'blue')}
          ${donutChart('High Scores', highScoreCount / report.results.length, `${highScoreCount} high, ${midScoreCount} medium, ${lowScoreCount} low`, 'good')}
          ${judgeDonut}
        </div>
      </div>

      <div class="card">
        <h2>Score Distribution</h2>
        ${histogram(report.results)}
        <div class="insight-grid">
          ${miniStat('High >= 85%', highScoreCount.toLocaleString())}
          ${miniStat('Medium 60-84%', midScoreCount.toLocaleString())}
          ${miniStat('Low < 60%', lowScoreCount.toLocaleString())}
          ${miniStat('Avg Tokens', Math.round(averageTokens).toLocaleString())}
          ${miniStat('Tool Efficiency', formatPercent(averageToolEfficiency))}
        </div>
      </div>
    </section>

    <section class="wide-grid">
      <div class="card">
        <h2>Metric Breakdown</h2>
        ${metricBar('Overall score', report.summary.averageScore)}
        ${metricBar('Syntax pass rate', report.summary.syntaxPassRate)}
        ${metricBar('Edit similarity', report.summary.averageEditDistance)}
        ${metricBar('Winnowing similarity', report.summary.averageWinnowing)}
        ${metricBar('Exact match rate', report.summary.exactMatchRate)}
        ${metricBar('Tool efficiency', report.summary.averageToolEfficiency)}
        ${semanticBars}
      </div>

      <div class="card">
        <h2>Weakest Cases</h2>
        <div class="weak-list">
          ${weakestResults.map((result) => `
            <div class="weak-item">
              <code>${escapeHtml(result.caseId)}</code>
              <span class="score-pill ${scoreClass(result.overallScore)}">${formatPercent(result.overallScore)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Case Results</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Case</th>
              <th>Overall</th>
              <th>Similarity</th>
              <th>Edit</th>
              <th>Winnowing</th>
              <th>Exact</th>
              <th>Syntax</th>
              ${semanticHeaderCells}
              <th>Time</th>
              <th>Tokens</th>
            </tr>
          </thead>
          <tbody>
            ${buildResultsRows(report.results)}
          </tbody>
        </table>
      </div>
    </section>

    <dialog id="case-detail">
      <div class="detail-head">
        <div>
          <h2 id="detail-title">Case detail</h2>
          <div id="detail-subtitle" class="subtitle"></div>
        </div>
        <button class="close-button" type="button" id="detail-close">Close</button>
      </div>
      <div class="detail-body">
        <div class="detail-grid" id="detail-stats"></div>
        <div class="detail-section">
          <h3>Conflict / Input</h3>
          <pre id="detail-conflict"></pre>
        </div>
        <div class="detail-section">
          <h3>Resolution</h3>
          <pre id="detail-resolution"></pre>
        </div>
        <div class="detail-section">
          <h3>Reasoning</h3>
          <pre id="detail-reasoning"></pre>
        </div>
        <div class="detail-section">
          <h3>Metrics and Errors</h3>
          <pre id="detail-metrics"></pre>
        </div>
        <div class="detail-section">
          <h3>Tool Calls</h3>
          <div class="tool-list" id="detail-tools"></div>
        </div>
      </div>
    </dialog>
  </main>
  <script>
    const detailResults = ${escapeScriptJson(detailResults)};
    const dialog = document.getElementById('case-detail');
    const closeButton = document.getElementById('detail-close');
    const title = document.getElementById('detail-title');
    const subtitle = document.getElementById('detail-subtitle');
    const stats = document.getElementById('detail-stats');
    const resolution = document.getElementById('detail-resolution');
    const conflict = document.getElementById('detail-conflict');
    const reasoning = document.getElementById('detail-reasoning');
    const metrics = document.getElementById('detail-metrics');
    const tools = document.getElementById('detail-tools');

    function percent(value) {
      return Number.isFinite(value) ? Math.round(value * 100) + '%' : 'n/a';
    }

    function stat(label, value) {
      return '<div class="mini-stat"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function openDetail(index) {
      const item = detailResults[index];
      if (!item) return;

      title.textContent = item.caseId;
      subtitle.textContent = [item.dataset, item.agent, item.model].filter(Boolean).join(' / ');
      stats.innerHTML = [
        stat('Overall', percent(item.overallScore)),
        stat('Syntax', item.metrics.syntax?.markersClean ? 'Clean' : 'Markers'),
        stat('Time', ((item.durationMs || 0) / 1000).toFixed(2) + 's'),
        stat('Tool calls', String(item.toolCalls?.length ?? 0))
      ].join('');
      resolution.textContent = item.resolution || 'No resolution output captured.';
      conflict.textContent = item.case?.conflictText || JSON.stringify(item.case?.metadata ?? {}, null, 2) || 'No conflict input captured.';
      reasoning.textContent = item.reasoning || item.metrics.semantic?.reasoning || 'No reasoning captured.';
      metrics.textContent = JSON.stringify({
        syntax: item.metrics.syntax,
        similarity: item.metrics.similarity,
        semantic: item.metrics.semantic,
        efficiency: item.metrics.efficiency,
        tokenUsage: item.tokenUsage
      }, null, 2);
      tools.innerHTML = (item.toolCalls || []).map((tool) => (
        '<div class="tool-item"><strong>' + escapeHtml(tool.toolName) + '</strong><pre>' +
        escapeHtml(JSON.stringify({ args: tool.args, result: tool.result, error: tool.error, durationMs: tool.durationMs }, null, 2)) +
        '</pre></div>'
      )).join('') || '<div class="muted">No tool calls captured.</div>';

      dialog.showModal();
    }

    document.querySelectorAll('[data-result-index]').forEach((node) => {
      node.addEventListener('click', (event) => {
        const target = event.currentTarget;
        openDetail(Number(target.dataset.resultIndex));
      });
    });

    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  </script>
</body>
</html>
`;
}

export async function generateReport(results: EvalResult[], config: { dataset: string, mode: EvalMode, model: string, outDir?: string }): Promise<void> {
  const totalCases = results.length;
  if (totalCases === 0) {
    console.log('No results to report.');
    return;
  }

  const avgScore = results.reduce((acc, r) => acc + r.overallScore, 0) / totalCases;
  const avgEditDist = results.reduce((acc, r) => acc + r.metrics.similarity.editDistance, 0) / totalCases;
  const avgWinnowing = results.reduce((acc, r) => acc + r.metrics.similarity.winnowing, 0) / totalCases;
  const exactMatchRate = results.filter(r => r.metrics.similarity.exactMatch).length / totalCases;
  const syntaxPassRate = results.filter(r => r.metrics.syntax?.markersClean).length / totalCases;
  const averageToolEfficiency = results.reduce((acc, result) => acc + result.metrics.efficiency.toolEfficiency, 0) / totalCases;
  const semanticResults = results.map((result) => result.metrics.semantic).filter((result) => result !== undefined);
  const semanticTotal = semanticResults.length;
  const semanticSummary = semanticTotal > 0 ? {
    judgeGeneratedWinRate: semanticResults.filter((result) => result.winner === 'generated').length / semanticTotal,
    judgeReferenceWinRate: semanticResults.filter((result) => result.winner === 'reference').length / semanticTotal,
    judgeTieRate: semanticResults.filter((result) => result.winner === 'tie').length / semanticTotal,
    judgeInconclusiveRate: semanticResults.filter((result) => result.winner === 'inconclusive').length / semanticTotal,
    averageJudgeScore: semanticResults.reduce((acc, result) => acc + result.score, 0) / semanticTotal
  } : {};

  const report: EvalReport = {
    timestamp: new Date().toISOString(),
    model: config.model,
    mode: config.mode,
    summary: {
      totalCases,
      averageScore: avgScore,
      averageEditDistance: avgEditDist,
      averageWinnowing: avgWinnowing,
      exactMatchRate,
      syntaxPassRate,
      averageToolEfficiency,
      ...semanticSummary
    },
    results
  };

  const reportsDir = path.resolve(process.cwd(), config.outDir || 'eval-results');
  await fs.mkdir(reportsDir, { recursive: true });

  const baseName = `eval-${config.dataset}-${Date.now()}`;
  const jsonPath = path.join(reportsDir, `${baseName}.json`);
  const htmlPath = path.join(reportsDir, `${baseName}.html`);

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(htmlPath, buildHtmlReport(report, { dataset: config.dataset }));
  console.log(`JSON report saved to ${jsonPath}`);
  console.log(`HTML report saved to ${htmlPath}`);
}

interface ModelComparisonInput {
  model: string;
  results: EvalResult[];
}

interface ModelComparisonSummary {
  model: string;
  totalCases: number;
  averageScore: number;
  markerCleanRate: number;
  averageDurationMs: number;
  averageToolCalls: number;
  averageToolEfficiency: number;
}

export async function generateComparisonReport(runs: ModelComparisonInput[], config: { dataset: string, mode: EvalMode, outDir?: string }): Promise<void> {
  const summaries = runs.map((run) => summarizeModelRun(run)).sort((a, b) => b.averageScore - a.averageScore);
  const reportsDir = path.resolve(process.cwd(), config.outDir || 'eval-results');
  await fs.mkdir(reportsDir, { recursive: true });

  const report = {
    timestamp: new Date().toISOString(),
    dataset: config.dataset,
    mode: config.mode,
    summaries
  };

  const baseName = `eval-comparison-${config.dataset}-${Date.now()}`;
  const jsonPath = path.join(reportsDir, `${baseName}.json`);
  const htmlPath = path.join(reportsDir, `${baseName}.html`);

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(htmlPath, buildComparisonHtml(report));
  console.log(`Comparison JSON report saved to ${jsonPath}`);
  console.log(`Comparison HTML report saved to ${htmlPath}`);
}

function summarizeModelRun(run: ModelComparisonInput): ModelComparisonSummary {
  const totalCases = run.results.length;
  if (totalCases === 0) {
    return {
      model: run.model,
      totalCases: 0,
      averageScore: 0,
      markerCleanRate: 0,
      averageDurationMs: 0,
      averageToolCalls: 0,
      averageToolEfficiency: 0
    };
  }

  return {
    model: run.model,
    totalCases,
    averageScore: run.results.reduce((sum, result) => sum + result.overallScore, 0) / totalCases,
    markerCleanRate: run.results.filter((result) => result.metrics.syntax?.markersClean === true).length / totalCases,
    averageDurationMs: run.results.reduce((sum, result) => sum + result.harness.durationMs, 0) / totalCases,
    averageToolCalls: run.results.reduce((sum, result) => sum + result.harness.toolCalls.length, 0) / totalCases,
    averageToolEfficiency: run.results.reduce((sum, result) => sum + result.metrics.efficiency.toolEfficiency, 0) / totalCases
  };
}

function buildComparisonHtml(report: { timestamp: string; dataset: string; mode: EvalMode; summaries: ModelComparisonSummary[] }): string {
  const rows = report.summaries.map((summary, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(summary.model)}</td>
      <td>${summary.totalCases.toLocaleString()}</td>
      <td>${formatPercent(summary.averageScore)}</td>
      <td>${formatPercent(summary.markerCleanRate)}</td>
      <td>${Math.round(summary.averageDurationMs).toLocaleString()} ms</td>
      <td>${formatNumber(summary.averageToolCalls, 1)}</td>
      <td>${formatPercent(summary.averageToolEfficiency)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Model Comparison - ${escapeHtml(report.dataset)}</title>
  <style>
    body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f6f8fb; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 20px; }
    h1 { margin: 0 0 4px; font-size: 28px; }
    .subtitle { color: #647089; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #dfe5ef; }
    th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #edf1f6; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #526078; background: #f9fbfd; }
    tr:last-child td { border-bottom: 0; }
  </style>
</head>
<body>
  <main>
    <h1>Model Comparison</h1>
    <div class="subtitle">${escapeHtml(report.dataset)} / ${escapeHtml(report.mode)} / ${escapeHtml(new Date(report.timestamp).toLocaleString())}</div>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Model</th>
          <th>Cases</th>
          <th>Avg score</th>
          <th>Marker clean</th>
          <th>Avg duration</th>
          <th>Avg tools</th>
          <th>Tool efficiency</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
}
