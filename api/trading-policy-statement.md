# Ben Hoffman Personal Trading Policy Statement

Version: 1.0
Effective date: 2026-04-15
Review cycle: Annual, unless a forced review is triggered under Section 12
Owner: Ben Hoffman

## 1. Purpose

This document defines the rules, execution standards, risk limits, and override policy for the personal trading program described as:

- Core: passive SPY holdings
- G+ sleeve: SPXL / SHY regime-following overlay
- SVIX tactical overlay: post-volatility-spike short-vol entries

The purpose of this policy is to:

- preserve discipline
- prevent in-the-moment rule changes
- separate research from live trading
- define what constitutes a valid signal and valid execution

This is a rules-based program, not a discretionary macro book.

## 2. Governing Principle

Capital preservation and process integrity take priority over maximizing backtested return.

If live results conflict with backtests, the default response is not immediate optimization. The default response is observation, logging, and review under the rules below.

## 3. Portfolio Structure

Target structure:

- Core sleeve: 90% of strategy capital in buy-and-hold SPY
- G+ sleeve: 10% of strategy capital in SPXL / SHY rotation
- SVIX tactical overlay: separate, pre-budgeted allocation outside the 90/10 core-plus-overlay structure

Funding rules:

- G+ sleeve must remain at 10% or less until at least 3 full years of live out-of-sample results are recorded or a credible synthetic pre-2009 stress test is completed and reviewed.
- G+ sleeve should be funded only in tax-deferred accounts when possible because turnover creates short-term taxable events.
- SVIX capital must be independently budgeted and must never be sourced by reducing required liquidity for the Core or G+ sleeve.

## 4. Strategy Definitions

### 4.1 Core Sleeve

Rule:

- Hold SPY passively.
- Rebalance only when required by annual portfolio rebalance or external cash flow needs.

Purpose:

- provide broad market beta
- anchor portfolio behavior
- reduce the risk that tactical sleeves dominate long-term outcomes

### 4.2 G+ Sleeve

Signal source:

- SPY daily close
- SPY 200-day simple moving average

Allocation rule:

- If SPY close is greater than SPY 200-day SMA, hold 100% SPXL in the G+ sleeve.
- If SPY close is less than or equal to SPY 200-day SMA, hold 25% SPXL and 75% SHY in the G+ sleeve.

Execution rule:

- Signals are checked once per trading day after the market close.
- State changes are executed at the next market open.
- Use marketable limit orders during the 9:31 ET to 9:40 ET window.
- Maximum aggressiveness is 25 basis points through NBBO.

Non-rules:

- No intraday overrides
- No discretionary confirmation filters
- No take-profit trims
- No parameter changes during the freeze period

### 4.3 SVIX Tactical Overlay

Purpose:

- participate in post-spike volatility normalization
- avoid continuous short-vol exposure

General rule:

- Only long SVIX during qualified post-spike fade conditions.
- Never systematically flip into long-vol products based on this framework.
- If conditions are unclear, stand aside.

Base position ladder:

- Stage 1: scout size at 25%
- Stage 2: medium size at 50%
- Stage 3 or bonus trigger: full size at 100% of the SVIX overlay budget

Risk rule:

- Each SVIX tranche carries an independent hard stop at -20% from entry.

Time rule:

- Standard holding period target is about 20 trading days unless stopped out earlier or factor failure requires exit.

## 5. Allowed Instruments

Approved instruments:

- SPY
- SPXL
- SHY
- BIL as an acceptable substitute for SHY if operationally required
- SVIX

Restricted instruments:

- TLT, GLD, options, futures, or inverse / long-vol ETFs are not permitted within this policy unless the policy is formally revised.

## 6. Daily Operating Procedure

### 6.1 End-of-Day Checklist

At each trading day close:

1. Record SPY close.
2. Record SPY 200-day SMA.
3. Determine current G+ target state.
4. Record VIX, front-month term structure, front roll, and any SVIX trigger inputs used by the live dashboard.
5. Determine whether a new trade signal exists.
6. Log all decisions, including "no action."

### 6.2 Next-Open Execution Checklist

If a valid signal change exists:

1. Confirm the target state from the prior close.
2. Confirm there was no logging error or missing data.
3. Enter orders in the approved execution window.
4. Record fill price, time, and estimated slippage.
5. Update sleeve state immediately after execution.

## 7. Risk Limits

Portfolio-level limits:

- G+ sleeve maximum allocation: 10% of total strategy capital
- SVIX overlay maximum allocation: pre-funded fixed budget, reviewed annually

Behavioral and process limits:

- If the G+ sleeve declines 40% from its own peak, new discretionary changes are prohibited for 30 calendar days.
- If two consecutive signals are missed due to process failure, live deployment pauses until the operational cause is corrected.
- If live execution repeatedly exceeds the slippage cap, order procedure must be reviewed before the next trade.

Instrument-specific cautions:

- SPXL is a daily-reset 3x product and is expected to experience path dependency and volatility drag.
- SVIX is a short-volatility product with gap and tail-event risk that may exceed stop assumptions.

## 8. Prohibited Actions

The following are prohibited unless this policy is formally revised:

- ad hoc parameter changes
- adding new filters because of recent underperformance
- skipping valid signals because of "gut feel"
- increasing size after losses to recover faster
- using unapproved instruments to hedge around the rules
- reallocating capital from Core to SVIX in reaction to market stress

## 9. Data and Signal Integrity

Approved data principles:

- frozen snapshots for research
- next-day execution assumptions in backtests
- explicit slippage assumptions
- maintained audit trail of parameter values

Live signal integrity requirements:

- Every signal must be reproducible from logged inputs.
- Any missing or suspect input means "no new trade" until resolved.
- No live rule changes may be made based on a dashboard display alone; the dashboard is an aid, not the source of truth.

## 10. Performance Evaluation

Primary evaluation lens:

- blended portfolio outcomes versus 100% SPY

Secondary evaluation lens:

- G+ sleeve performance versus its research expectations
- SVIX overlay hit rate, average gain/loss, and regime behavior

Required performance records:

- monthly return
- rolling drawdown
- realized slippage
- signal count
- missed signal count
- realized allocation versus policy allocation

## 11. Review and Change Control

Normal review cycle:

- once per year

Permitted review topics:

- operational improvements
- data vendor integrity
- execution quality
- tax implementation

Parameter freeze:

- The 200-day lookback, the 25% defensive floor, and the approved defensive asset must remain unchanged for 12 months after live funding unless a forced review is triggered.

## 12. Forced Review Triggers

A formal review is required if any of the following occurs:

- live drawdown materially exceeds tested expectations
- a product sponsor changes structure, fee, leverage objective, or trading mechanics
- repeated slippage exceeds assumptions
- data vendor methodology changes create signal instability
- regulatory, tax, or account restrictions impair implementation

Forced review does not automatically authorize a strategy change. It authorizes analysis and a written decision.

## 13. Decision Rights

Research decisions:

- Ben Hoffman may perform research at any time

Live trading decisions:

- Only policy-compliant signals may drive live trades

Override policy:

- Discretionary overrides are not allowed except for broken market conditions, account restrictions, or confirmed bad data
- Any override must be documented on the same day with reason, timestamp, and corrective plan

## 14. Current Implementation Notes

Current operating stance:

- The G+ sleeve is treated as a conservative overlay because deflated Sharpe significance has not been established after multiple testing.
- The SVIX overlay is treated as experimental and should remain smaller than the G+ sleeve until a simpler live-validated framework is established.
- BIL should be included in the next research cycle as the primary defensive-leg challenger to SHY.

## 15. Sign-Off

I affirm that this policy exists to constrain behavior, preserve research integrity, and ensure that any future strategy changes are deliberate rather than reactive.

Signed:

Ben Hoffman

Date: __________________
