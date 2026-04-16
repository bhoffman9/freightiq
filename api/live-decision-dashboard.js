import {
  defaultInputs,
  formatNumber,
  formatPercent,
  getLiveStatus,
  toQueryString,
} from './strategy-live-engine.js';

const title = 'Live Trading Decision Dashboard';

function h(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function badge(label, tone) {
  return `<span class="badge ${tone}">${h(label)}</span>`;
}

function metric(label, value, tone = '') {
  return `<div class="metric ${tone}"><div class="label">${h(label)}</div><div class="value">${value}</div></div>`;
}

function formInput(label, name, value, type = 'text', step = '') {
  const stepAttr = step ? ` step="${step}"` : '';
  return `<label class="field"><span>${h(label)}</span><input name="${h(name)}" value="${h(value)}" type="${h(type)}"${stepAttr}></label>`;
}

function formSelect(label, name, current, options) {
  return `<label class="field"><span>${h(label)}</span><select name="${h(name)}">${options.map((option) => `<option value="${h(option.value)}"${option.value === current ? ' selected' : ''}>${h(option.label)}</option>`).join('')}</select></label>`;
}

function formToggle(label, name, current) {
  return `<label class="toggle"><input type="checkbox" name="${h(name)}" value="true"${current ? ' checked' : ''}><span>${h(label)}</span></label>`;
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${h(item)}</li>`).join('')}</ul>`;
}

function improvementCards(items) {
  return items.map((item) => `<article class="card mini"><h3>${h(item.title)}</h3><p>${h(item.detail)}</p></article>`).join('');
}

function triggerRows(items) {
  return items.map((item) => `<tr><td>${h(item.label)}</td><td>${item.active ? 'Active' : 'Inactive'}</td></tr>`).join('');
}

function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function render(status) {
  const { inputs, gPlus, svix, summary, recommendations, links } = status;
  const defaultQuery = toQueryString(defaultInputs);
  const currentQuery = toQueryString(inputs);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      :root { --bg:#f6f2e9; --panel:rgba(255,252,246,.96); --ink:#152733; --muted:#60707a; --line:rgba(21,39,51,.12); --go:#0f6b50; --watch:#9b5a18; --warn:#8a2f2f; --wait:#4d6170; --navy:#173f5c; --shadow:0 20px 56px rgba(21,39,51,.08); }
      * { box-sizing:border-box; }
      body { margin:0; color:var(--ink); font-family:"Segoe UI",Arial,sans-serif; background:radial-gradient(circle at top left, rgba(15,107,80,.11), transparent 28%), radial-gradient(circle at bottom right, rgba(23,63,92,.12), transparent 30%), linear-gradient(180deg,#fcfaf5 0%,var(--bg) 100%); }
      .page { max-width:1280px; margin:0 auto; padding:28px 18px 48px; }
      .hero, .grid { display:grid; gap:18px; }
      .hero { grid-template-columns:1.15fr .85fr; }
      .grid { grid-template-columns:repeat(12,minmax(0,1fr)); margin-top:18px; }
      .panel { background:var(--panel); border:1px solid var(--line); border-radius:24px; box-shadow:var(--shadow); }
      .section { padding:22px; }
      .span-12 { grid-column:span 12; } .span-8 { grid-column:span 8; } .span-7 { grid-column:span 7; } .span-6 { grid-column:span 6; } .span-5 { grid-column:span 5; } .span-4 { grid-column:span 4; }
      .eyebrow { text-transform:uppercase; letter-spacing:.14em; font-size:11px; color:var(--navy); margin-bottom:12px; font-weight:700; }
      h1,h2,h3 { margin:0; line-height:1.06; } h1 { font-size:clamp(2rem,4vw,3.4rem); margin-bottom:10px; } h2 { font-size:clamp(1.2rem,2vw,1.9rem); } h3 { font-size:1rem; margin-bottom:8px; }
      p { margin:0; color:var(--muted); line-height:1.56; } p + p { margin-top:10px; }
      .row { display:flex; flex-wrap:wrap; gap:10px; }
      .pill { padding:9px 12px; border-radius:999px; background:rgba(23,63,92,.08); color:var(--navy); font-size:13px; }
      .badge { display:inline-flex; align-items:center; padding:7px 11px; border-radius:999px; font-size:12px; font-weight:700; }
      .badge.go { background:rgba(15,107,80,.12); color:var(--go); } .badge.watch { background:rgba(155,90,24,.13); color:var(--watch); } .badge.warn { background:rgba(138,47,47,.12); color:var(--warn); } .badge.wait { background:rgba(77,97,112,.12); color:var(--wait); }
      .metric-grid, .data-grid, .form-grid, .improve-grid { display:grid; gap:12px; }
      .metric-grid, .data-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .form-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .improve-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .metric, .card, .data { border-radius:18px; padding:16px; border:1px solid rgba(21,39,51,.08); background:#fffdfa; }
      .metric.go, .card.go { background:rgba(15,107,80,.08); } .metric.watch, .card.watch { background:rgba(155,90,24,.08); } .metric.warn, .card.warn { background:rgba(138,47,47,.08); } .metric.wait, .card.wait { background:rgba(77,97,112,.08); }
      .label { color:var(--muted); text-transform:uppercase; font-size:12px; letter-spacing:.08em; margin-bottom:8px; }
      .value { font-weight:700; font-size:clamp(1.05rem,2vw,1.8rem); }
      .field { display:grid; gap:6px; font-size:13px; color:var(--muted); }
      .field input, .field select { width:100%; border:1px solid rgba(21,39,51,.12); border-radius:12px; background:#fffdfa; padding:11px 12px; font:inherit; color:var(--ink); }
      .toggle { display:grid; grid-template-columns:auto 1fr; align-items:center; gap:8px; padding:10px 12px; border-radius:12px; border:1px solid rgba(21,39,51,.12); background:#fffdfa; color:var(--muted); }
      .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
      .button { border:none; border-radius:999px; padding:10px 14px; font:inherit; font-weight:700; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; }
      .button.primary { background:var(--navy); color:#fff; } .button.secondary { background:rgba(23,63,92,.08); color:var(--navy); }
      .subhead { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }
      .table-shell { overflow:auto; border-radius:18px; border:1px solid var(--line); }
      table { width:100%; border-collapse:collapse; min-width:520px; } th,td { padding:12px 14px; text-align:left; border-bottom:1px solid rgba(21,39,51,.08); font-size:14px; } th { color:var(--muted); background:rgba(21,39,51,.04); } tr:last-child td { border-bottom:none; }
      ul { margin:0; padding-left:18px; color:var(--muted); } li + li { margin-top:10px; }
      .small { font-size:13px; color:var(--muted); } code { font-family:Consolas,monospace; font-size:12px; }
      a.link { color:var(--navy); text-decoration:none; font-weight:700; } a.link:hover { text-decoration:underline; }
      @media (max-width:1024px) { .hero { grid-template-columns:1fr; } .span-8,.span-7,.span-6,.span-5,.span-4 { grid-column:span 12; } .form-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:700px) { .page { padding:18px 12px 36px; } .metric-grid,.data-grid,.form-grid,.improve-grid { grid-template-columns:1fr; } .section { padding:18px; } }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <article class="panel section">
          <div class="eyebrow">Live Operations</div>
          <h1>${title}</h1>
          <p>This page is now wired to a shared decision engine and a JSON status feed, so the dashboard and the API are reading the same trading logic.</p>
          <p>As of <strong>${h(status.asOf)}</strong>, the system sees <strong>${summary.actionCount}</strong> sleeves with an actionable state.</p>
          <div class="row" style="margin-top:14px;">
            <span class="pill">Shared engine</span>
            <span class="pill">JSON status endpoint</span>
            <span class="pill">Review dashboard linked</span>
            <span class="pill">Policy-compatible workflow</span>
          </div>
          <div class="row" style="margin-top:14px;">
            <a class="link" href="${links.review}">Open review dashboard</a>
            <a class="link" href="${links.json}" id="top-json-link">Open JSON status</a>
            <a class="link" href="/api/strategy-comparison-dashboard">Open comparison dashboard</a>
          </div>
        </article>
        <aside class="panel section">
          <div class="metric-grid">
            ${metric('As of', h(status.asOf))}
            ${metric('G+ status', h(gPlus.label), gPlus.tone)}
            ${metric('G+ target', h(gPlus.targetMix), gPlus.tone)}
            ${metric('SVIX size', `${svix.effectiveSize}%`, svix.tone)}
            ${metric('SVIX regime', h(svix.regime.label), svix.regime.tone)}
            ${metric('Caution level', h(summary.cautionLevel), summary.cautionLevel === 'elevated' ? 'warn' : 'go')}
          </div>
        </aside>
      </section>

      <section class="grid">
        <article class="panel section span-8">
          <div class="subhead"><h2>Live Controls</h2>${badge('Updates dashboard and JSON link', 'go')}</div>
          <form id="controls" action="/api/live-decision-dashboard" method="GET">
            <div class="form-grid">
              ${formInput('As of', 'as_of', inputs.asOf, 'date')}
              ${formInput('SPY close', 'spy_close', formatNumber(inputs.spyClose), 'number', '0.01')}
              ${formInput('SPY 200-day SMA', 'spy_sma_200', formatNumber(inputs.spySma200), 'number', '0.01')}
              ${formSelect('Previous G+ state', 'previous_g_state', inputs.previousGState, [{ value: 'risk_on', label: 'Risk on' }, { value: 'defensive', label: 'Defensive' }])}
              ${formInput('VIX', 'vix', formatNumber(inputs.vix, 1), 'number', '0.1')}
              ${formInput('Basis', 'basis', formatNumber(inputs.basis, 1), 'number', '0.1')}
              ${formInput('Front roll %', 'front_roll_pct', formatNumber(inputs.frontRollPct, 1), 'number', '0.1')}
              ${formInput('Recent VIX peak', 'recent_vix_peak', formatNumber(inputs.recentVixPeak, 1), 'number', '0.1')}
              ${formInput('Days since peak', 'days_since_vix_peak', formatNumber(inputs.daysSinceVixPeak, 0), 'number', '1')}
              ${formInput('SKEW', 'skew', formatNumber(inputs.skew, 0), 'number', '1')}
              ${formInput('MOVE', 'move', formatNumber(inputs.move, 0), 'number', '1')}
              ${formInput('SVIX conviction', 'svix_conviction', formatNumber(inputs.svixConviction, 0), 'number', '1')}
            </div>
            <div class="form-grid" style="margin-top:12px;">
              ${formToggle('RSP breadth thrust', 'rsp_breadth_thrust', inputs.rspBreadthThrust)}
              ${formToggle('HYG recovery', 'hyg_recovery', inputs.hygRecovery)}
              ${formToggle('IWM/SPY collapse', 'iwm_spy_collapse', inputs.iwmSpyCollapse)}
              ${formInput('Notes', 'notes', inputs.notes)}
            </div>
            <div class="actions">
              <button class="button primary" type="submit">Refresh dashboard</button>
              <button class="button secondary" type="button" id="reset-button">Load default snapshot</button>
              <a class="button secondary" href="${links.json}" id="json-link">JSON status</a>
              <a class="button secondary" href="/api/live-decision-dashboard?${defaultQuery}">Default snapshot</a>
            </div>
          </form>
          <p class="small" style="margin-top:12px;">Current query string: <code id="query-string">${h(currentQuery)}</code></p>
        </article>

        <article class="panel section span-4">
          <div class="subhead"><h2>Today's Calls</h2><div class="row">${badge(gPlus.label, gPlus.tone)}${badge(svix.decision, svix.tone)}</div></div>
          <div class="card ${gPlus.tone}">
            <h3>G+ Sleeve</h3>
            <p>${h(gPlus.action)}. ${h(gPlus.context)}</p>
          </div>
          <div class="card ${svix.tone}" style="margin-top:12px;">
            <h3>SVIX Overlay</h3>
            <p>${h(svix.decision)}. ${h(svix.rationale)}</p>
          </div>
        </article>

        <article class="panel section span-6">
          <div class="subhead"><h2>G+ Readout</h2>${badge(gPlus.stateChanged ? 'State changed' : 'No change', gPlus.stateChanged ? 'watch' : 'go')}</div>
          <div class="data-grid">
            <div class="data"><div class="label">SPY close</div><div class="value">${formatNumber(inputs.spyClose)}</div></div>
            <div class="data"><div class="label">200-day SMA</div><div class="value">${formatNumber(inputs.spySma200)}</div></div>
            <div class="data"><div class="label">Spread</div><div class="value">${formatNumber(gPlus.spread)} (${formatPercent(gPlus.spreadPct)})</div></div>
            <div class="data"><div class="label">Target mix</div><div class="value">${h(gPlus.targetMix)}</div></div>
          </div>
          <p style="margin-top:14px;">The G+ sleeve stays a small overlay. The dashboard reports the rule state but does not authorize discretionary changes to the rule itself.</p>
        </article>

        <article class="panel section span-6">
          <div class="subhead"><h2>SVIX Readout</h2>${badge(`${svix.effectiveSize}% effective size`, svix.tone)}</div>
          <div class="data-grid">
            <div class="data"><div class="label">VIX</div><div class="value">${formatNumber(inputs.vix, 1)}</div></div>
            <div class="data"><div class="label">Basis</div><div class="value">${formatNumber(inputs.basis, 1)}</div></div>
            <div class="data"><div class="label">Front roll</div><div class="value">${formatPercent(inputs.frontRollPct, 1)}</div></div>
            <div class="data"><div class="label">Regime</div><div class="value">${h(svix.regime.label)} (${svix.regime.multiplier.toFixed(1)}x)</div></div>
            <div class="data"><div class="label">Conviction</div><div class="value">${formatNumber(inputs.svixConviction, 0)}/100</div></div>
            <div class="data"><div class="label">Recent peak</div><div class="value">${formatNumber(inputs.recentVixPeak, 1)} / ${formatNumber(inputs.daysSinceVixPeak, 0)}d ago</div></div>
          </div>
          <p style="margin-top:14px;">${h(svix.regime.note)}</p>
        </article>

        <article class="panel section span-7">
          <div class="subhead"><h2>SVIX Trigger Board</h2>${badge('Simplify correlated triggers', 'watch')}</div>
          <div class="table-shell">
            <table>
              <thead><tr><th>Trigger</th><th>Status</th></tr></thead>
              <tbody>${triggerRows(svix.triggers)}</tbody>
            </table>
          </div>
        </article>

        <article class="panel section span-5">
          <div class="subhead"><h2>Execution Guardrails</h2>${badge('Policy first', 'warn')}</div>
          ${list([
            'Check signals once after the close. No intraday interpretation.',
            'If the G+ state changed, execute next open with marketable limits in the 9:31 ET to 9:40 ET window.',
            'Keep order aggressiveness within the 25 bps limit through NBBO.',
            'Each SVIX tranche keeps its own -20% stop.',
            'If data is stale, incomplete, or contradictory, no new trade is allowed.',
          ])}
        </article>

        <article class="panel section span-12">
          <div class="subhead"><h2>Expanded Improvements</h2>${badge('Highest-value next steps', 'go')}</div>
          <div class="improve-grid">${improvementCards(recommendations.implementation)}</div>
        </article>

        <article class="panel section span-6">
          <div class="subhead"><h2>Operate Now</h2>${badge('Current context', 'go')}</div>
          ${list(recommendations.operatingNow)}
        </article>

        <article class="panel section span-6">
          <div class="subhead"><h2>Research Next</h2>${badge('Backlog', 'watch')}</div>
          ${list(recommendations.researchNext)}
        </article>
      </section>
    </main>
    <script>
      const controls = document.getElementById('controls');
      const resetButton = document.getElementById('reset-button');
      const jsonLink = document.getElementById('json-link');
      const topJsonLink = document.getElementById('top-json-link');
      const queryNode = document.getElementById('query-string');
      const defaultQuery = ${jsonScript(defaultQuery)};
      function syncLinks() {
        const formData = new FormData(controls);
        const params = new URLSearchParams();
        for (const [key, value] of formData.entries()) params.append(key, value);
        ['rsp_breadth_thrust', 'hyg_recovery', 'iwm_spy_collapse'].forEach((name) => {
          if (!formData.has(name)) params.set(name, 'false');
        });
        const query = params.toString();
        const jsonHref = '/api/live-strategy-status?' + query;
        jsonLink.href = jsonHref;
        topJsonLink.href = jsonHref;
        queryNode.textContent = query;
      }
      controls.addEventListener('input', syncLinks);
      controls.addEventListener('change', syncLinks);
      resetButton.addEventListener('click', () => { window.location.href = '/api/live-decision-dashboard?' + defaultQuery; });
      syncLinks();
    </script>
  </body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const status = getLiveStatus(req.query || {});
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(render(status));
}
