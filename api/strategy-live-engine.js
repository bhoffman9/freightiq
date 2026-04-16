export const snapshotDate = '2026-04-15';

export const defaultInputs = {
  asOf: snapshotDate,
  spyClose: 519.0,
  spySma200: 556.0,
  previousGState: 'risk_on',
  vix: 17.8,
  basis: -1.4,
  frontRollPct: 1.8,
  skew: 121,
  move: 108,
  svixConviction: 28,
  recentVixPeak: 27.0,
  daysSinceVixPeak: 18,
  rspBreadthThrust: false,
  hygRecovery: false,
  iwmSpyCollapse: false,
  notes: 'Update close data before acting on any signal.',
};

export const implementationImprovements = [
  {
    title: 'Test a conditional floor, not a permanent one',
    detail: 'The 25% SPXL floor is probably where the extra return is coming from, but it is also the cleanest source of uncompensated downside in a grinding bear. Research a rule that restores the floor only after recapture plus positive short-term slope.',
  },
  {
    title: 'Move the defensive challenger from SHY to BIL in the next cycle',
    detail: 'For the defensive leg, duration is a cost unless it clearly earns its keep. BIL is a better default challenger because it reduces rate sensitivity while preserving the parking-lot function.',
  },
  {
    title: 'Shrink SVIX to a smaller orthogonal feature set',
    detail: 'Twenty-nine signals is too many for the number of independent vol episodes available. Keep one representative feature per family and require the rest to justify themselves out of sample.',
  },
  {
    title: 'Promote execution-luck testing to a first-class metric',
    detail: 'Because G+ trades only a few times each year, entry timing can explain a meaningful fraction of the realized result. Compare next-open, split-tranche, and VWAP-window execution on every historical flip.',
  },
];

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function pickString(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

export function normalizeInputs(raw = {}) {
  const previous = pickString(raw.previous_g_state ?? raw.previousGState, defaultInputs.previousGState)
    .trim()
    .toLowerCase();

  return {
    asOf: pickString(raw.as_of ?? raw.asOf, defaultInputs.asOf),
    spyClose: asNumber(raw.spy_close ?? raw.spyClose, defaultInputs.spyClose),
    spySma200: asNumber(raw.spy_sma_200 ?? raw.spySma200, defaultInputs.spySma200),
    previousGState: previous === 'defensive' ? 'defensive' : 'risk_on',
    vix: asNumber(raw.vix, defaultInputs.vix),
    basis: asNumber(raw.basis, defaultInputs.basis),
    frontRollPct: asNumber(raw.front_roll_pct ?? raw.frontRollPct, defaultInputs.frontRollPct),
    skew: asNumber(raw.skew, defaultInputs.skew),
    move: asNumber(raw.move, defaultInputs.move),
    svixConviction: asNumber(raw.svix_conviction ?? raw.svixConviction, defaultInputs.svixConviction),
    recentVixPeak: asNumber(raw.recent_vix_peak ?? raw.recentVixPeak, defaultInputs.recentVixPeak),
    daysSinceVixPeak: asNumber(raw.days_since_vix_peak ?? raw.daysSinceVixPeak, defaultInputs.daysSinceVixPeak),
    rspBreadthThrust: asBoolean(raw.rsp_breadth_thrust ?? raw.rspBreadthThrust, defaultInputs.rspBreadthThrust),
    hygRecovery: asBoolean(raw.hyg_recovery ?? raw.hygRecovery, defaultInputs.hygRecovery),
    iwmSpyCollapse: asBoolean(raw.iwm_spy_collapse ?? raw.iwmSpyCollapse, defaultInputs.iwmSpyCollapse),
    notes: pickString(raw.notes, defaultInputs.notes),
  };
}

export function formatPercent(value, digits = 1) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

export function toQueryString(inputs) {
  const params = new URLSearchParams();
  params.set('as_of', inputs.asOf);
  params.set('spy_close', String(inputs.spyClose));
  params.set('spy_sma_200', String(inputs.spySma200));
  params.set('previous_g_state', inputs.previousGState);
  params.set('vix', String(inputs.vix));
  params.set('basis', String(inputs.basis));
  params.set('front_roll_pct', String(inputs.frontRollPct));
  params.set('skew', String(inputs.skew));
  params.set('move', String(inputs.move));
  params.set('svix_conviction', String(inputs.svixConviction));
  params.set('recent_vix_peak', String(inputs.recentVixPeak));
  params.set('days_since_vix_peak', String(inputs.daysSinceVixPeak));
  params.set('rsp_breadth_thrust', String(inputs.rspBreadthThrust));
  params.set('hyg_recovery', String(inputs.hygRecovery));
  params.set('iwm_spy_collapse', String(inputs.iwmSpyCollapse));
  params.set('notes', inputs.notes);
  return params.toString();
}

export function computeGPlus(inputs) {
  const spread = inputs.spyClose - inputs.spySma200;
  const spreadPct = inputs.spySma200 === 0 ? 0 : (spread / inputs.spySma200) * 100;
  const targetState = inputs.spyClose > inputs.spySma200 ? 'risk_on' : 'defensive';
  const targetMix = targetState === 'risk_on' ? '100% SPXL' : '25% SPXL / 75% SHY';
  const stateChanged = inputs.previousGState !== targetState;

  let tone = targetState === 'risk_on' ? 'go' : 'warn';
  let label = targetState === 'risk_on' ? 'Risk On' : 'Defensive';
  let action = stateChanged ? `Rebalance next open to ${targetMix}` : `Hold ${targetMix}`;
  let context = targetState === 'risk_on'
    ? 'Trend filter is above the 200-day simple moving average.'
    : 'Trend filter is below the 200-day simple moving average.';

  if (Math.abs(spreadPct) < 1) {
    tone = 'watch';
    context += ' The market is close to the threshold, which raises whipsaw risk.';
  } else if (spreadPct < -3) {
    context += ' The market is materially below trend, so the defensive floor deserves extra scrutiny.';
  }

  return {
    spread,
    spreadPct,
    targetState,
    targetMix,
    previousState: inputs.previousGState,
    stateChanged,
    tone,
    label,
    action,
    context,
  };
}

export function classifySvixRegime(inputs) {
  if (inputs.recentVixPeak >= 40 && inputs.vix > 25) {
    return {
      label: 'CRISIS',
      multiplier: 0.5,
      tone: 'warn',
      note: 'Volatility remains stressed after a major spike. Size should stay reduced even if a fade trigger appears.',
    };
  }

  if (inputs.recentVixPeak >= 25 && inputs.vix < 22 && inputs.daysSinceVixPeak <= 30) {
    return {
      label: 'RECOVERY',
      multiplier: 1.2,
      tone: 'go',
      note: 'Post-spike normalization regime. This is the most favorable environment for the tactical short-vol overlay.',
    };
  }

  if (inputs.vix < 15 && inputs.daysSinceVixPeak > 20) {
    return {
      label: 'COMPLACENT',
      multiplier: 0.3,
      tone: 'watch',
      note: 'Carry can look attractive here, but signal quality is usually lower and gap risk is underpriced.',
    };
  }

  return {
    label: 'NORMAL',
    multiplier: 1.0,
    tone: 'wait',
    note: 'Neither stressed nor fully complacent. Position only when validated setup conditions are present.',
  };
}

function roundOverlaySize(value) {
  if (value >= 88) return 100;
  if (value >= 63) return 75;
  if (value >= 38) return 50;
  if (value >= 13) return 25;
  return 0;
}

export function computeSvix(inputs, regime) {
  const stage1 = inputs.basis >= 3;
  const stage2 = inputs.recentVixPeak >= 25 && inputs.vix < 20;
  const stage3 = inputs.basis <= -3 && inputs.vix < 16;
  const bonus = inputs.vix >= 25 && inputs.frontRollPct > 5;
  const stressSupport = inputs.vix >= 25 && Math.abs(inputs.basis) <= 1;
  const altConfirm = inputs.move > 120 || inputs.skew < 115 || inputs.hygRecovery || inputs.rspBreadthThrust;
  const breadthShock = inputs.iwmSpyCollapse;

  let baseSize = 0;
  let tone = 'wait';
  let decision = 'Stand aside';
  let rationale = 'No validated short-vol fade trigger is active.';

  if (bonus || stage3) {
    baseSize = 100;
    tone = 'go';
    decision = 'Enter full SVIX overlay';
    rationale = bonus
      ? 'Bonus trigger active: stressed spot volatility plus steep front-roll decay.'
      : 'Stage 3 active: supportive basis and calmer spot volatility after stress.';
  } else if (stage2) {
    baseSize = 50;
    tone = 'go';
    decision = 'Scale into SVIX';
    rationale = 'Stage 2 active: VIX has fallen back below 20 after a 25+ spike.';
  } else if (stage1) {
    baseSize = 25;
    tone = 'watch';
    decision = 'Scout SVIX only';
    rationale = 'Stage 1 active: early basis signal without stronger fade confirmation.';
  }

  const effectiveSize = roundOverlaySize(baseSize * regime.multiplier);

  if (baseSize > 0 && inputs.svixConviction < 35 && !altConfirm && !breadthShock) {
    tone = 'watch';
    decision = 'Reduced-confidence setup';
    rationale = 'A stage trigger exists, but corroborating evidence is still weak.';
  }

  return {
    regime,
    baseSize,
    effectiveSize,
    tone,
    decision,
    rationale,
    triggers: [
      { label: 'Stage 1: basis >= +3', active: stage1 },
      { label: 'Stage 2: recent VIX peak >= 25 and VIX < 20', active: stage2 },
      { label: 'Stage 3: basis <= -3 and VIX < 16', active: stage3 },
      { label: 'Bonus: VIX >= 25 and front roll > 5%', active: bonus },
      { label: 'Flat stressed term structure', active: stressSupport },
      { label: 'Cross-asset confirmation', active: altConfirm || breadthShock },
    ],
  };
}

export function buildRecommendations(inputs, gPlus, svix) {
  const operatingNow = [];
  const researchNext = [];

  if (gPlus.targetState === 'defensive' && gPlus.spreadPct < -3) {
    operatingNow.push('The market is materially below the 200-day. Keep the G+ sleeve defensive and do not infer safety from the 25% SPXL floor.');
    researchNext.push('This is the exact environment where a conditional or zero floor should be tested against the permanent 25% floor.');
  } else if (Math.abs(gPlus.spreadPct) < 1) {
    operatingNow.push('The G+ rule is close to the threshold. Log the decision carefully because whipsaw risk is elevated around the 200-day.');
    researchNext.push('Quantify whether a small band or confirmation rule reduces whipsaw without killing rebound capture. Keep this in research only until a formal review.');
  } else {
    operatingNow.push('The G+ sleeve has a clean regime reading today. Execution discipline matters more than fresh interpretation.');
  }

  if (svix.effectiveSize === 0) {
    operatingNow.push('No SVIX position is justified right now. Standing aside is a valid outcome, not a missed trade.');
  } else if (svix.regime.label === 'COMPLACENT') {
    operatingNow.push('Even with a trigger, the complacent regime argues for smaller effective size because carry can mask poor setup quality.');
  } else if (svix.regime.label === 'RECOVERY') {
    operatingNow.push('The current regime is the cleanest fit for the SVIX overlay, but tranche discipline still matters because gap risk remains non-linear.');
  } else {
    operatingNow.push('If taking SVIX, treat size as tactical and temporary. The stop defines the trade, not the narrative.');
  }

  if (inputs.svixConviction < 40) {
    researchNext.push('The ensemble conviction is low. This supports simplifying the SVIX model before increasing capital allocation.');
  }

  researchNext.push('Build a synthetic pre-2009 SPXL proxy and test the same frozen rule through 2000-2003 and 2008-2009.');
  researchNext.push('Track correlation by crash phase: early crash, spike peak, fade, and recovery. G+ and SVIX are not independent across those phases.');
  researchNext.push('Measure underperformance duration versus SPY, not just CAGR and max drawdown. Behavioral sustainability is part of the edge.');

  return {
    operatingNow,
    researchNext,
    implementation: implementationImprovements,
  };
}

export function getLiveStatus(raw = {}) {
  const inputs = normalizeInputs(raw);
  const gPlus = computeGPlus(inputs);
  const regime = classifySvixRegime(inputs);
  const svix = computeSvix(inputs, regime);
  const recommendations = buildRecommendations(inputs, gPlus, svix);
  const queryString = toQueryString(inputs);

  return {
    asOf: inputs.asOf,
    inputs,
    gPlus,
    svix,
    summary: {
      actionCount: Number(gPlus.stateChanged) + Number(svix.effectiveSize > 0),
      gPlusTarget: gPlus.targetMix,
      svixTargetSize: svix.effectiveSize,
      regime: regime.label,
      cautionLevel: gPlus.tone === 'warn' || regime.tone === 'warn' ? 'elevated' : 'normal',
    },
    recommendations,
    links: {
      dashboard: `/api/live-decision-dashboard?${queryString}`,
      json: `/api/live-strategy-status?${queryString}`,
      review: '/api/strategy-dashboard',
    },
  };
}
