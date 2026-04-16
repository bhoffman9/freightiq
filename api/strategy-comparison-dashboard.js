const title = 'Strategy Comparison Dashboard';

const strategies = [
  { name: 'Buy-hold SPY', ann: 14.5, sharpe: 0.76, dd: -33.7, trades: 0, note: 'Best risk-adjusted anchor' },
  { name: 'G (100/0)', ann: 25.9, sharpe: 0.65, dd: -52.6, trades: 4.7, note: 'Cleaner defensive logic' },
  { name: 'G+ (100/25)', ann: 28.5, sharpe: 0.62, dd: -53.1, trades: 4.7, note: 'Higher CAGR, weaker conceptual purity' },
  { name: 'Buy-hold SPXL', ann: 30.1, sharpe: 0.71, dd: -76.9, trades: 0, note: 'Highest raw return, brutal path risk' },
];

const blends = [
  { blend: '100% SPY', ann: 14.46, sharpe: 0.74, dd: -33.7, worst: -18.6, verdict: 'Clean benchmark' },
  { blend: '90/10 SPY/G+', ann: 15.58, sharpe: 0.71, dd: -33.2, worst: -21.7, verdict: 'Best fundable mix' },
  { blend: '85/15 SPY/G+', ann: 16.11, sharpe: 0.70, dd: -32.9, worst: -23.3, verdict: 'Fine if conviction is higher' },
  { blend: '80/20 SPY/G+', ann: 16.62, sharpe: 0.68, dd: -32.7, worst: -24.8, verdict: 'Trade quality down, stress up' },
  { blend: '70/30 SPY/G+', ann: 17.57, sharpe: 0.65, dd: -32.2, worst: -27.9, verdict: 'Too aggressive before live proof' },
];

const defensiveLegs = [
  { asset: 'SHY', ann: 25.93, dd: -52.6, fit: 'Current implementation', take: 'Acceptable, but carries duration bleed' },
  { asset: 'BIL', ann: 25.91, dd: -51.2, fit: 'Best direct challenger', take: 'Cleaner parking asset for a defensive sleeve' },
  { asset: 'SGOV', ann: 32.53, dd: -51.2, fit: 'Too short a history', take: 'Promising, but insufficient full-cycle evidence' },
  { asset: 'TLT', ann: null, dd: null, fit: 'Macro diversifier', take: 'Adds duration bet, not a neutral parking choice' },
  { asset: 'GLD', ann: null, dd: null, fit: 'Crisis diversifier', take: 'Useful diversifier, but not a like-for-like defensive leg' },
];

const improvements = [
  {
    idea: 'Conditional 25% floor',
    why: 'Keeps rebound capture thesis alive while reducing bleed in grinding bears.',
    next: 'Test 0% below 200d, then restore 25% only after recapture plus positive 20-day slope.',
  },
  {
    idea: 'BIL as primary defensive challenger',
    why: 'Likely reduces rate-hike pain without changing the role of the defensive sleeve.',
    next: 'Run the full frozen-data backtest with BIL as the first alternate, not a side note.',
  },
  {
    idea: 'Execution-luck study',
    why: 'With only ~5 G+ trades per year, entry timing can materially distort realized results.',
    next: 'Compare next-open, split-tranche, and VWAP-window execution around every state change.',
  },
  {
    idea: 'Simplify SVIX signals',
    why: 'Twenty-nine signals is too dense for the amount of independent vol-event history available.',
    next: 'Reduce to one feature per family and re-rank by out-of-sample contribution.',
  },
];

function pct(value, digits = 1) {
  if (value == null) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

function num(value, digits = 2) {
  if (value == null) return 'n/a';
  return value.toFixed(digits);
}

function barChart(rows, key, color) {
  const width = 760;
  const height = 220;
  const pad = 34;
  const values = rows.map((row) => Math.abs(row[key] ?? 0));
  const max = Math.max(...values, 1);
  const step = (width - pad * 2) / rows.length;
  const baseline = key === 'dd' ? 36 : height - 34;

  const bars = rows.map((row, index) => {
    const value = row[key] ?? 0;
    const bar = Math.abs(value) / max * (height - 90);
    const x = pad + index * step + 10;
    const y = key === 'dd' ? baseline : baseline - bar;
    return `
      <g>
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(step - 20).toFixed(1)}" height="${bar.toFixed(1)}" rx="8" fill="${color}"></rect>
        <text x="${(x + (step - 20) / 2).toFixed(1)}" y="${key === 'dd' ? (y + bar + 16).toFixed(1) : (baseline + 16).toFixed(1)}" text-anchor="middle" font-size="11" fill="#62717d">${row.name || row.blend}</text>
        <title>${row.name || row.blend}: ${pct(value, 1)}</title>
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart" role="img">
      <line x1="${pad}" y1="${baseline}" x2="${width - pad}" y2="${baseline}" stroke="#93a0aa" stroke-width="1.2"></line>
      ${bars}
    </svg>
  `;
}

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
  `;
}

function card(titleText, bodyText) {
  return `<article class="mini-card"><h3>${titleText}</h3><p>${bodyText}</p></article>`;
}

function render() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      :root {
        --bg: #f5efe6;
        --panel: rgba(255, 252, 246, 0.95);
        --ink: #163140;
        --muted: #62717d;
        --line: rgba(22, 49, 64, 0.12);
        --teal: #0d766d;
        --orange: #9b551f;
        --navy: #1a3d69;
        --red: #a22c2c;
        --shadow: 0 18px 52px rgba(22, 49, 64, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        font-family: "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(13,118,109,.12), transparent 30%),
          radial-gradient(circle at bottom right, rgba(155,85,31,.12), transparent 28%),
          linear-gradient(180deg, #fbf8f1 0%, var(--bg) 100%);
      }
      .page { max-width: 1260px; margin: 0 auto; padding: 28px 18px 48px; }
      .hero, .grid { display: grid; gap: 18px; }
      .hero { grid-template-columns: 1.15fr .85fr; }
      .grid { grid-template-columns: repeat(12, minmax(0, 1fr)); margin-top: 18px; }
      .span-12 { grid-column: span 12; } .span-8 { grid-column: span 8; } .span-7 { grid-column: span 7; } .span-6 { grid-column: span 6; } .span-5 { grid-column: span 5; } .span-4 { grid-column: span 4; }
      .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 24px; box-shadow: var(--shadow); padding: 22px; }
      .eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: 11px; color: var(--teal); font-weight: 700; margin-bottom: 12px; }
      h1, h2, h3 { margin: 0; line-height: 1.05; }
      h1 { font-size: clamp(2rem, 4vw, 3.5rem); margin-bottom: 10px; }
      h2 { font-size: clamp(1.2rem, 2vw, 1.9rem); }
      h3 { font-size: 1rem; margin-bottom: 8px; }
      p { margin: 0; color: var(--muted); line-height: 1.56; }
      p + p { margin-top: 10px; }
      .pill-row, .stat-row, .link-row, .subhead { display: flex; flex-wrap: wrap; gap: 10px; }
      .subhead { justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .pill { padding: 9px 12px; border-radius: 999px; background: rgba(26,61,105,.08); color: var(--navy); font-size: 13px; }
      .pill a { color: inherit; text-decoration: none; font-weight: 700; }
      .pill a:hover { text-decoration: underline; }
      .stat-grid, .mini-grid { display: grid; gap: 12px; }
      .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .stat, .mini-card { border-radius: 18px; padding: 16px; border: 1px solid rgba(22,49,64,.08); background: #fffdfa; }
      .stat .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; }
      .stat .value { font-size: clamp(1.05rem, 2vw, 1.8rem); font-weight: 700; }
      .table-wrap { overflow: auto; border-radius: 18px; border: 1px solid var(--line); }
      table { width: 100%; border-collapse: collapse; min-width: 620px; }
      th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid rgba(22,49,64,.08); font-size: 14px; }
      th { color: var(--muted); background: rgba(22,49,64,.04); }
      tr:last-child td { border-bottom: none; }
      .chart { width: 100%; height: auto; display: block; border-radius: 18px; border: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,.75)); padding: 8px; }
      ul { margin: 0; padding-left: 18px; color: var(--muted); }
      li + li { margin-top: 10px; }
      @media (max-width: 1024px) {
        .hero { grid-template-columns: 1fr; }
        .span-8, .span-7, .span-6, .span-5, .span-4 { grid-column: span 12; }
      }
      @media (max-width: 700px) {
        .page { padding: 18px 12px 36px; }
        .panel { padding: 18px; }
        .stat-grid, .mini-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <article class="panel">
          <div class="eyebrow">Comparison View</div>
          <h1>${title}</h1>
          <p>This page compares the candidate sleeves and blends side by side, so the decision is framed around trade quality, path risk, and fundability rather than raw CAGR alone.</p>
          <p>The highest-conviction conclusion remains the same: the strongest use of this research is a small overlay on top of SPY, not a stand-alone bet on the sleeve itself.</p>
          <div class="pill-row" style="margin-top: 14px;">
            <div class="pill"><a href="/api/live-decision-dashboard">Open live dashboard</a></div>
            <div class="pill"><a href="/api/live-strategy-status">Open JSON status</a></div>
            <div class="pill"><a href="/api/strategy-dashboard">Open review dashboard</a></div>
          </div>
        </article>
        <aside class="panel">
          <div class="stat-grid">
            <div class="stat"><div class="label">Best raw CAGR</div><div class="value">Buy-hold SPXL</div></div>
            <div class="stat"><div class="label">Best risk-adjusted anchor</div><div class="value">Buy-hold SPY</div></div>
            <div class="stat"><div class="label">Best fundable blend</div><div class="value">90/10 SPY/G+</div></div>
            <div class="stat"><div class="label">Most important improvement</div><div class="value">Retest the 25% floor</div></div>
          </div>
        </aside>
      </section>

      <section class="grid">
        <article class="panel span-7">
          <div class="subhead"><h2>Strategy Scorecard</h2><div class="pill">Standalone sleeves</div></div>
          ${table(
            ['Strategy', 'Ann Ret', 'Sharpe', 'Max DD', 'Trades/Yr', 'Take'],
            strategies.map((row) => [row.name, pct(row.ann), num(row.sharpe), pct(row.dd), num(row.trades, 1), row.note])
          )}
        </article>

        <article class="panel span-5">
          <div class="subhead"><h2>What Actually Wins</h2><div class="pill">My read</div></div>
          <ul>
            <li>Buy-hold SPXL wins the backtest beauty contest, but it loses the implementation contest because the path is too violent.</li>
            <li>G+ improves CAGR versus G, but the 25% floor is where I would spend the next research cycle.</li>
            <li>SPY remains the clean benchmark because it keeps the highest Sharpe and lowest operational burden.</li>
            <li>The economic case is strongest when the sleeve is treated as a return enhancer for SPY, not a replacement.</li>
          </ul>
        </article>

        <article class="panel span-6">
          <div class="subhead"><h2>Return Comparison</h2><div class="pill">Annualized return</div></div>
          ${barChart(strategies, 'ann', '#0d766d')}
        </article>

        <article class="panel span-6">
          <div class="subhead"><h2>Drawdown Comparison</h2><div class="pill">Absolute pain</div></div>
          ${barChart(strategies, 'dd', '#a22c2c')}
        </article>

        <article class="panel span-7">
          <div class="subhead"><h2>Blend Frontier</h2><div class="pill">Sizing matters most</div></div>
          ${table(
            ['Blend', 'Ann Ret', 'Sharpe', 'Max DD', 'Worst Year', 'Verdict'],
            blends.map((row) => [row.blend, pct(row.ann, 2), num(row.sharpe), pct(row.dd), pct(row.worst), row.verdict])
          )}
        </article>

        <article class="panel span-5">
          <div class="subhead"><h2>Allocation Call</h2><div class="pill">Current answer</div></div>
          <ul>
            <li><code>90/10</code> is still the cleanest answer if funded today.</li>
            <li><code>85/15</code> is defensible only if you are personally comfortable with the DSR failure and leverage wrapper.</li>
            <li><code>20%+</code> sleeve sizing is premature without either live OOS evidence or pre-2009 synthetic stress testing.</li>
            <li><code>70/30</code> reads like performance chasing, not disciplined portfolio construction.</li>
          </ul>
        </article>

        <article class="panel span-6">
          <div class="subhead"><h2>Defensive Asset Comparison</h2><div class="pill">Below 200-day choices</div></div>
          ${table(
            ['Asset', 'Ann Ret', 'Max DD', 'Role', 'Take'],
            defensiveLegs.map((row) => [row.asset, pct(row.ann, 2), pct(row.dd), row.fit, row.take])
          )}
        </article>

        <article class="panel span-6">
          <div class="subhead"><h2>Best Next Tests</h2><div class="pill">Improvement queue</div></div>
          <div class="mini-grid">
            ${improvements.map((item) => card(item.idea, `${item.why} ${item.next}`)).join('')}
          </div>
        </article>

        <article class="panel span-12">
          <div class="subhead"><h2>Bottom Line</h2><div class="pill">Decision framing</div></div>
          <ul>
            <li>If you want the simplest robust answer, hold SPY.</li>
            <li>If you want to improve portfolio return without blowing up the risk budget, use a small G+ sleeve on top of SPY.</li>
            <li>If you want to improve the research, attack the 25% floor, the defensive asset choice, and the SVIX signal count before touching anything else.</li>
            <li>If you want this to survive real money, judge it on behavioral sustainability and implementation discipline, not just terminal wealth charts.</li>
          </ul>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(render());
}
