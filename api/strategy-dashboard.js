const pageTitle = 'Ben Hoffman Trading Strategy Review';

const portfolioSleeves = [
  {
    sleeve: 'Core',
    allocation: '90%',
    vehicle: 'Buy-hold SPY',
    account: 'Taxable',
    purpose: 'Market beta with the cleanest risk-adjusted profile in the pack',
  },
  {
    sleeve: 'G+',
    allocation: '10%',
    vehicle: 'SPXL / SHY rotation',
    account: 'IRA / Roth only',
    purpose: 'Leveraged trend overlay with capped position size due to DSR failure',
  },
  {
    sleeve: 'SVIX Tactical',
    allocation: 'Separate small allocation',
    vehicle: 'SVIX shares',
    account: 'Either',
    purpose: 'Event-driven short-vol overlay during post-spike fades',
  },
];

const performanceTable = [
  { name: 'G+ (100/25)', annReturn: 28.5, sharpe: null, maxDD: -53.1, tradesPerYear: 4.7, endingValue: 349671 },
  { name: 'G (100/0)', annReturn: 25.9, sharpe: 0.65, maxDD: -52.6, tradesPerYear: 4.7, endingValue: 260382 },
  { name: 'Buy-hold SPXL', annReturn: 30.1, sharpe: 0.71, maxDD: -76.9, tradesPerYear: 0, endingValue: 417911 },
  { name: 'Buy-hold SPY', annReturn: 14.5, sharpe: 0.76, maxDD: -33.7, tradesPerYear: 0, endingValue: 67727 },
];

const yearlyReturns = [
  { year: '2012', g: 42, spy: 16 },
  { year: '2013', g: 118, spy: 32 },
  { year: '2014', g: 44, spy: 14 },
  { year: '2015', g: -38, spy: 1 },
  { year: '2016', g: 52, spy: 12 },
  { year: '2017', g: 65, spy: 22 },
  { year: '2018', g: -16, spy: -4 },
  { year: '2019', g: 71, spy: 31 },
  { year: '2020', g: 178, spy: 18 },
  { year: '2021', g: 98, spy: 29 },
  { year: '2022', g: -34, spy: -18 },
  { year: '2023', g: 99, spy: 26 },
  { year: '2024', g: 62, spy: 25 },
  { year: '2025', g: 59, spy: 25 },
  { year: '2026 YTD', g: 5, spy: 6 },
];

const oosWindows = [
  { window: '2017-02 to 2018-02', gp: 73.2, spy: 22.4, dd: -11.4, beat: true },
  { window: '2018-02 to 2019-02', gp: -4.4, spy: 5.4, dd: -35.4, beat: false },
  { window: '2019-02 to 2020-02', gp: 61.1, spy: 24.4, dd: -18.9, beat: true },
  { window: '2020-02 to 2021-02', gp: 23.9, spy: 17.8, dd: -53.2, beat: true },
  { window: '2021-02 to 2022-02', gp: 40.0, spy: 16.7, dd: -26.9, beat: true },
  { window: '2022-02 to 2023-02', gp: -21.6, spy: -7.2, dd: -33.5, beat: false },
  { window: '2023-02 to 2024-02', gp: 38.9, spy: 21.8, dd: -27.3, beat: true },
  { window: '2024-02 to 2025-02', gp: 55.7, spy: 22.9, dd: -24.4, beat: true },
  { window: '2025-02 to 2026-02', gp: 21.3, spy: 15.7, dd: -32.4, beat: true },
  { window: '2026-02 to 2026-04', gp: -13.0, spy: 19.1, dd: -19.9, beat: false },
];

const blendedPortfolio = [
  { blend: '100% SPY', annReturn: 14.46, sharpe: 0.74, maxDD: -33.7, worstYear: -18.6 },
  { blend: '90/10 SPY/G+', annReturn: 15.58, sharpe: 0.71, maxDD: -33.2, worstYear: -21.7 },
  { blend: '85/15', annReturn: 16.11, sharpe: 0.70, maxDD: -32.9, worstYear: -23.3 },
  { blend: '80/20', annReturn: 16.62, sharpe: 0.68, maxDD: -32.7, worstYear: -24.8 },
  { blend: '70/30', annReturn: 17.57, sharpe: 0.65, maxDD: -32.2, worstYear: -27.9 },
  { blend: '100% G+', annReturn: 21.81, sharpe: 0.55, maxDD: -59.0, worstYear: -49.5 },
];

const defensiveAssets = [
  { asset: 'SHY', annReturn: 25.93, maxDD: -52.6, note: 'Current choice; full history' },
  { asset: 'BIL', annReturn: 25.91, maxDD: -51.2, note: 'Slightly shallower drawdown; acceptable substitute' },
  { asset: 'SGOV', annReturn: 32.53, maxDD: -51.2, note: 'Too short a live history for fair comparison' },
];

const reviewPoints = [
  {
    title: 'What looks strongest',
    items: [
      'The implementation discipline is better than most retail writeups: frozen data, next-day execution, and slippage materially improve credibility.',
      'The blended portfolio result is the key economic takeaway. A 90/10 SPY/G+ mix adds return while keeping max drawdown close to SPY.',
      'Using SPY rather than SPXL for the signal source is directionally consistent with the literature: trend filters generally behave better on the underlying than on a daily-reset wrapper.',
    ],
  },
  {
    title: 'Main issues to tighten',
    items: [
      'The core sleeve thesis is stronger than the stand-alone sleeve thesis. A strategy that improves a portfolio can still be weak on a stand-alone basis, and that distinction should stay front and center.',
      'The 25% floor is still under-proven. It may be harvesting crash-rebound convexity, but it also reintroduces beta exactly when the regime filter says reduce beta.',
      'The SVIX engine is probably too feature-dense for the amount of truly independent crisis episodes available since 2022 inception and in proxy history.',
    ],
  },
  {
    title: 'Highest-conviction improvements',
    items: [
      'Add a rebalance-luck test: compare next-open execution to 3 to 5 staggered tranches over the next week for all G+ switches.',
      'Replace the static 25% floor with a slower re-risk rule, such as 0% below the 200-day and 25% only after recapture plus positive 20-day slope.',
      'Evaluate the defensive leg in return-space, not CAGR-space only: short-bill proxies usually win because their job is crash ballast, not sleeve growth.',
      'Collapse the SVIX ensemble into a much smaller set of orthogonal features and penalize signals that derive from the same underlying term-structure state.',
    ],
  },
];

const references = [
  {
    label: 'Faber, A Quantitative Approach to Tactical Asset Allocation',
    url: 'https://ssrn.com/abstract=962461',
  },
  {
    label: 'Antonacci, Absolute Momentum',
    url: 'https://ssrn.com/abstract=2244633',
  },
  {
    label: 'Antonacci, Risk Premia Harvesting Through Dual Momentum',
    url: 'https://ssrn.com/abstract=2042750',
  },
  {
    label: 'Bailey & Lopez de Prado, The Deflated Sharpe Ratio',
    url: 'https://ssrn.com/abstract=2460551',
  },
  {
    label: 'Direxion SPXL Summary Prospectus',
    url: 'https://www.sec.gov/Archives/edgar/data/1424958/000119312525039986/d898258d497k.htm',
  },
  {
    label: 'Volatility Shares SVIX Prospectus',
    url: 'https://www.volatilityshares.com/uploads/fund/2prospectus-UVIX-Prospectus-04292024.pdf',
  },
];

function formatPercent(value, digits = 1) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values) {
  return Math.max(...values);
}

function min(values) {
  return Math.min(...values);
}

function makeBarChart(series, key, height = 180, colorPositive = '#0f766e', colorNegative = '#b91c1c') {
  const values = series.map((item) => item[key]);
  const maxAbs = Math.max(...values.map((value) => Math.abs(value))) || 1;
  const width = 780;
  const padding = 32;
  const step = (width - padding * 2) / series.length;
  const baseline = height / 2;

  const bars = series.map((item, index) => {
    const value = item[key];
    const barHeight = Math.abs(value) / maxAbs * (height / 2 - 18);
    const x = padding + index * step + 8;
    const y = value >= 0 ? baseline - barHeight : baseline;
    const fill = value >= 0 ? colorPositive : colorNegative;
    const label = item.year || item.window || item.blend || item.asset || String(index);
    return `
      <g>
        <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(step - 16).toFixed(2)}" height="${barHeight.toFixed(2)}" rx="6" fill="${fill}" opacity="0.9"></rect>
        <title>${label}: ${formatPercent(value)}</title>
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="Bar chart">
      <line x1="${padding}" y1="${baseline}" x2="${width - padding}" y2="${baseline}" stroke="#8b9aa6" stroke-width="1.25"></line>
      ${bars}
    </svg>
  `;
}

function makeScatterPlot(rows) {
  const width = 780;
  const height = 240;
  const padding = 34;
  const xMin = min(rows.map((row) => row.maxDD));
  const xMax = max(rows.map((row) => row.maxDD));
  const yMin = min(rows.map((row) => row.annReturn));
  const yMax = max(rows.map((row) => row.annReturn));

  const points = rows.map((row) => {
    const x = padding + ((row.maxDD - xMin) / (xMax - xMin || 1)) * (width - padding * 2);
    const y = height - padding - ((row.annReturn - yMin) / (yMax - yMin || 1)) * (height - padding * 2);
    return `
      <g>
        <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="7" fill="#0f766e"></circle>
        <text x="${(x + 10).toFixed(2)}" y="${(y - 10).toFixed(2)}" font-size="11" fill="#173042">${row.name}</text>
        <title>${row.name}: return ${formatPercent(row.annReturn)} / max DD ${formatPercent(row.maxDD)}</title>
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="Return drawdown scatter plot">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#8b9aa6" stroke-width="1.25"></line>
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#8b9aa6" stroke-width="1.25"></line>
      <text x="${width - 160}" y="${height - 12}" font-size="11" fill="#586671">less bad drawdown</text>
      <text x="12" y="${padding - 10}" font-size="11" fill="#586671">higher return</text>
      ${points}
    </svg>
  `;
}

function renderTable(headers, rows) {
  return `
    <div class="table-shell">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function metricCard(label, value, tone = '') {
  return `
    <article class="metric ${tone}">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
    </article>
  `;
}

function buildHtml() {
  const beatCount = oosWindows.filter((row) => row.beat).length;
  const oosOutperformance = average(oosWindows.map((row) => row.gp - row.spy));
  const gReturns = yearlyReturns.map((row) => row.g);
  const spyReturns = yearlyReturns.map((row) => row.spy);
  const gSpread = average(gReturns) - average(spyReturns);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${pageTitle}</title>
    <style>
      :root {
        --bg: #f4efe6;
        --panel: rgba(255, 252, 246, 0.92);
        --ink: #173042;
        --muted: #586671;
        --line: rgba(23, 48, 66, 0.12);
        --accent: #0f766e;
        --accent-2: #a04d28;
        --accent-3: #193a6a;
        --danger: #b91c1c;
        --shadow: 0 18px 48px rgba(23, 48, 66, 0.08);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 32%),
          radial-gradient(circle at top right, rgba(160, 77, 40, 0.14), transparent 28%),
          linear-gradient(180deg, #f8f3ea 0%, var(--bg) 100%);
      }

      .page {
        max-width: 1240px;
        margin: 0 auto;
        padding: 32px 20px 56px;
      }

      .hero {
        display: grid;
        grid-template-columns: 1.3fr 0.9fr;
        gap: 18px;
        margin-bottom: 18px;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(6px);
      }

      .hero-copy {
        padding: 28px;
      }

      .eyebrow {
        font-family: Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 11px;
        color: var(--accent);
        margin-bottom: 14px;
      }

      h1, h2, h3 {
        margin: 0;
        line-height: 1.05;
      }

      h1 {
        font-size: clamp(2.2rem, 4vw, 4rem);
        margin-bottom: 14px;
      }

      h2 {
        font-size: clamp(1.5rem, 2.2vw, 2.1rem);
        margin-bottom: 14px;
      }

      p, li, td, th, .small {
        font-family: Arial, sans-serif;
      }

      p {
        color: var(--muted);
        line-height: 1.58;
        margin: 0;
      }

      .hero-copy p + p {
        margin-top: 12px;
      }

      .hero-stats {
        padding: 20px;
        display: grid;
        gap: 12px;
      }

      .metric-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .metric {
        border-radius: 18px;
        padding: 16px;
        background: #fffdf8;
        border: 1px solid rgba(23, 48, 66, 0.08);
      }

      .metric.attention {
        background: rgba(160, 77, 40, 0.08);
      }

      .metric.positive {
        background: rgba(15, 118, 110, 0.08);
      }

      .metric-label {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 8px;
      }

      .metric-value {
        font-size: clamp(1.2rem, 2vw, 2rem);
        font-weight: 700;
      }

      .section-grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 18px;
        margin-top: 18px;
      }

      .span-12 { grid-column: span 12; }
      .span-8 { grid-column: span 8; }
      .span-7 { grid-column: span 7; }
      .span-6 { grid-column: span 6; }
      .span-5 { grid-column: span 5; }
      .span-4 { grid-column: span 4; }

      .section {
        padding: 22px;
      }

      .subhead {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 16px;
      }

      .tag {
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(15, 118, 110, 0.1);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        font-family: Arial, sans-serif;
      }

      .table-shell {
        overflow: auto;
        border-radius: 18px;
        border: 1px solid var(--line);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 620px;
        background: rgba(255, 255, 255, 0.72);
      }

      th, td {
        padding: 12px 14px;
        border-bottom: 1px solid rgba(23, 48, 66, 0.08);
        text-align: left;
        font-size: 14px;
      }

      th {
        background: rgba(23, 48, 66, 0.04);
        color: var(--muted);
        font-weight: 700;
      }

      tr:last-child td {
        border-bottom: none;
      }

      .chart-copy {
        margin: 0 0 12px;
      }

      .chart {
        width: 100%;
        height: auto;
        display: block;
        background: linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0.75));
        border-radius: 18px;
        border: 1px solid var(--line);
        padding: 8px;
      }

      ul {
        margin: 0;
        padding-left: 18px;
        color: var(--muted);
      }

      li + li {
        margin-top: 10px;
      }

      .split-list {
        display: grid;
        gap: 14px;
      }

      .callout {
        border-left: 4px solid var(--accent-2);
        padding: 14px 0 14px 16px;
        margin-top: 16px;
      }

      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 14px;
      }

      .pill {
        padding: 10px 12px;
        border-radius: 999px;
        background: rgba(25, 58, 106, 0.08);
        color: var(--accent-3);
        font-size: 13px;
        font-family: Arial, sans-serif;
      }

      .pill a {
        color: inherit;
        text-decoration: none;
        font-weight: 700;
      }

      .pill a:hover {
        text-decoration: underline;
      }

      .footer-links {
        display: grid;
        gap: 10px;
      }

      .footer-links a {
        color: var(--accent-3);
        text-decoration: none;
        font-family: Arial, sans-serif;
      }

      .footer-links a:hover {
        text-decoration: underline;
      }

      @media (max-width: 960px) {
        .hero {
          grid-template-columns: 1fr;
        }

        .span-8, .span-7, .span-6, .span-5, .span-4 {
          grid-column: span 12;
        }
      }

      @media (max-width: 640px) {
        .page {
          padding: 20px 14px 40px;
        }

        .hero-copy, .hero-stats, .section {
          padding: 18px;
        }

        .metric-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <article class="panel hero-copy">
          <div class="eyebrow">External Review Dashboard</div>
          <h1>${pageTitle}</h1>
          <p>This dashboard reframes the submitted strategy as an investment committee memo, not a sales deck. The big picture is favorable for the blended portfolio, mixed for the G+ sleeve alone, and still fragile for the SVIX overlay.</p>
          <p>The cleanest takeaway from the supplied backtests is that the strategy is probably more useful as a modest overlay on a passive core than as a stand-alone alpha engine. The dashboard below keeps that distinction explicit.</p>
          <div class="pill-row">
            <div class="pill">Frozen-data backtests</div>
            <div class="pill">Next-day execution</div>
            <div class="pill">Multiple-testing penalty acknowledged</div>
            <div class="pill">Dashboard endpoint built for this repo</div>
            <div class="pill"><a href="/api/live-decision-dashboard">Open live dashboard</a></div>
            <div class="pill"><a href="/api/live-strategy-status">Open JSON status</a></div>
            <div class="pill"><a href="/api/strategy-comparison-dashboard">Open comparison dashboard</a></div>
          </div>
        </article>
        <aside class="panel hero-stats">
          <div class="metric-grid">
            ${metricCard('Blend thesis', '90/10 is the fundable version', 'positive')}
            ${metricCard('OOS win rate', `${beatCount}/10 windows`, 'positive')}
            ${metricCard('Average OOS edge', formatPercent(oosOutperformance), 'positive')}
            ${metricCard('DSR status', 'Failed after 7 variants', 'attention')}
            ${metricCard('Worst tested G+ drawdown', formatPercent(-53.2), 'attention')}
            ${metricCard('Average annual spread', `${formatPercent(gSpread)} vs SPY`, 'positive')}
          </div>
        </aside>
      </section>

      <section class="section-grid">
        <article class="panel section span-6">
          <div class="subhead">
            <h2>Portfolio Structure</h2>
            <span class="tag">Allocation logic</span>
          </div>
          ${renderTable(
            ['Sleeve', 'Allocation', 'Vehicle', 'Account', 'Purpose'],
            portfolioSleeves.map((row) => [row.sleeve, row.allocation, row.vehicle, row.account, row.purpose])
          )}
          <div class="callout">
            <p>The strongest element is not the raw G+ CAGR. It is the portfolio construction choice to keep the leveraged sleeve small while letting SPY do most of the compounding heavy lifting.</p>
          </div>
        </article>

        <article class="panel section span-6">
          <div class="subhead">
            <h2>Decision Memo</h2>
            <span class="tag">My read</span>
          </div>
          <ul>
            <li>The 200-day trend filter is recognizable and defensible. The unusual part is applying it to size a daily-reset 3x ETF sleeve rather than to switch a 1x asset or multi-asset basket.</li>
            <li>The 25% floor may be directionally helpful in a rebound-heavy sample, but it is the least conceptually clean part of the G+ rule set.</li>
            <li>The 10% sleeve cap is reasonable. If anything, it is the right kind of conservative given the DSR result and the leverage wrapper.</li>
            <li>The SVIX overlay should be simplified before funding. Twenty-nine signals is too many unless they are shown to be highly orthogonal.</li>
          </ul>
        </article>

        <article class="panel section span-7">
          <div class="subhead">
            <h2>Stand-Alone Strategy Map</h2>
            <span class="tag">Return vs drawdown</span>
          </div>
          <p class="chart-copy">Higher return alone does not win here. The important question is whether extra CAGR survives the path risk and statistical penalty.</p>
          ${makeScatterPlot(performanceTable)}
        </article>

        <article class="panel section span-5">
          <div class="subhead">
            <h2>Scorecard</h2>
            <span class="tag">Corrected backtest</span>
          </div>
          ${renderTable(
            ['Strategy', 'Ann Ret', 'Sharpe', 'Max DD', 'Trades/Yr', '$10k to'],
            performanceTable.map((row) => [
              row.name,
              formatPercent(row.annReturn),
              row.sharpe == null ? 'n/a' : row.sharpe.toFixed(2),
              formatPercent(row.maxDD),
              row.tradesPerYear.toFixed(1),
              `$${formatNumber(row.endingValue)}`,
            ])
          )}
        </article>

        <article class="panel section span-8">
          <div class="subhead">
            <h2>Annual Return Pattern</h2>
            <span class="tag">G vs SPY</span>
          </div>
          <p class="chart-copy">This is the heart of the behavioral problem: when G works, it works violently; when it fails, it can badly trail a much simpler benchmark.</p>
          ${makeBarChart(yearlyReturns, 'g')}
        </article>

        <article class="panel section span-4">
          <div class="subhead">
            <h2>What That Means</h2>
            <span class="tag">Interpretation</span>
          </div>
          <ul>
            <li>Upside is heavily concentrated in a few high-convexity years like 2013 and 2020.</li>
            <li>The strategy is not "safer SPXL." It is "slightly filtered SPXL," which still carries severe path dependency.</li>
            <li>Because returns are lumpy, position sizing matters more than parameter finesse.</li>
          </ul>
        </article>

        <article class="panel section span-7">
          <div class="subhead">
            <h2>Walk-Forward Reality Check</h2>
            <span class="tag">10 OOS windows</span>
          </div>
          ${renderTable(
            ['Window', 'G+ Return', 'SPY Return', 'G+ Max DD', 'Beat SPY'],
            oosWindows.map((row) => [
              row.window,
              formatPercent(row.gp),
              formatPercent(row.spy),
              formatPercent(row.dd),
              row.beat ? 'Yes' : 'No',
            ])
          )}
        </article>

        <article class="panel section span-5">
          <div class="subhead">
            <h2>OOS Return Shape</h2>
            <span class="tag">Window bars</span>
          </div>
          <p class="chart-copy">The out-of-sample picture is better than the DSR suggests, but still vulnerable to choppy breaks and transitions.</p>
          ${makeBarChart(oosWindows, 'gp', 220, '#193a6a', '#b91c1c')}
        </article>

        <article class="panel section span-6">
          <div class="subhead">
            <h2>Portfolio Blend Frontier</h2>
            <span class="tag">Where sizing lands</span>
          </div>
          ${renderTable(
            ['Blend', 'Ann Ret', 'Sharpe', 'Max DD', 'Worst Year'],
            blendedPortfolio.map((row) => [
              row.blend,
              formatPercent(row.annReturn, 2),
              row.sharpe.toFixed(2),
              formatPercent(row.maxDD),
              formatPercent(row.worstYear),
            ])
          )}
          <div class="callout">
            <p>The blend table argues for discipline, not ambition. Moving from 90/10 to 70/30 buys return but steadily sells quality.</p>
          </div>
        </article>

        <article class="panel section span-6">
          <div class="subhead">
            <h2>Defensive Leg</h2>
            <span class="tag">Role clarity</span>
          </div>
          ${renderTable(
            ['Asset', 'Ann Ret', 'Max DD', 'Comment'],
            defensiveAssets.map((row) => [row.asset, formatPercent(row.annReturn, 2), formatPercent(row.maxDD), row.note])
          )}
          <ul style="margin-top: 14px;">
            <li>For this sleeve, the defensive asset should be judged on crash containment, rate sensitivity, liquidity, and implementation simplicity, not only total return.</li>
            <li>BIL is worth serious consideration because it reduces duration bleed without changing the spirit of the system.</li>
            <li>TLT and GLD are diversifiers, but they also introduce new macro bets instead of acting as neutral parking places.</li>
          </ul>
        </article>

        <article class="panel section span-12">
          <div class="subhead">
            <h2>Improvement Recommendations</h2>
            <span class="tag">Highest priority</span>
          </div>
          <div class="split-list">
            ${reviewPoints.map((block) => `
              <section>
                <h3 style="margin-bottom: 10px;">${block.title}</h3>
                <ul>
                  ${block.items.map((item) => `<li>${item}</li>`).join('')}
                </ul>
              </section>
            `).join('')}
          </div>
        </article>

        <article class="panel section span-7">
          <div class="subhead">
            <h2>Stress Test Roadmap</h2>
            <span class="tag">What to add next</span>
          </div>
          <ul>
            <li>Build a pre-2009 synthetic SPXL series from S&P total return, financing cost, fees, and daily 3x compounding, then rerun the exact frozen-rule backtest through 2000-2003 and 2008-2009.</li>
            <li>Run block-bootstrap and regime-bootstrap resamples to see whether a handful of rebound years dominate expected sleeve CAGR.</li>
            <li>Test execution luck explicitly: next-open, VWAP window, and weekly tranches around every state change.</li>
            <li>Measure a "pain ratio" for the blended portfolio: months of underperformance versus SPY, not just terminal performance.</li>
          </ul>
        </article>

        <article class="panel section span-5">
          <div class="subhead">
            <h2>SVIX Overlay</h2>
            <span class="tag">Main caution</span>
          </div>
          <ul>
            <li>Keep the capital slice small and independent from the G+ sleeve.</li>
            <li>Treat correlated signal families as one feature until proven otherwise.</li>
            <li>Track live paper performance by regime, not just overall win rate.</li>
            <li>Do not infer protection from the strategy name: SVIX is a short-vol futures product with its own compounding and tail mechanics.</li>
          </ul>
        </article>

        <article class="panel section span-12">
          <div class="subhead">
            <h2>References</h2>
            <span class="tag">Primary sources</span>
          </div>
          <div class="footer-links">
            ${references.map((ref) => `<a href="${ref.url}" target="_blank" rel="noreferrer">${ref.label}</a>`).join('')}
          </div>
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
  res.status(200).send(buildHtml());
}
