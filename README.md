# Promo Risk Calculator (Standalone HTML First)

## What this project is
This repository contains a **scenario-based sportsbook promo risk calculator** focused on two promotion types:

1. **Free Bet**
2. **Wager Back**

The calculator estimates **theoretical promotional liability** (not realized accounting P&L) by modeling the funnel from issued promo value through redemption, wins, conversion, hold recapture, and net risk.

---

## Main entrypoint
The project now uses the standalone HTML file as the primary experience:

- `index.html` redirects to `report-template.html`
- `report-template.html` contains the full editable calculator UI and logic

This means non-technical users can open one HTML file and:
- edit assumptions,
- load scenario presets,
- recalculate,
- export CSV.

---

## Process flow (how calculations tie together)

### 1) Choose scenario / preset
You can select:
- **Expected** (base assumptions)
- **Stress** (risk assumptions pushed higher)
- **Worst Case** (ceiling assumptions)

Preset buttons load full assumption bundles for each case.

### 2) Enter assumptions
The user can edit all major assumptions directly in the HTML form:
- Free Bet inputs
- Wager Back inputs
- Stress control multipliers

### 3) Run model
The calculator computes:
- Gross exposure
- Expected redeemed value
- Expected credited winnings
- Expected cash liability
- Hold recapture
- Net expected risk
- Worst-case liability
- Risk per user and per 100 users

### 4) Sensitivity output
The model runs ±10% on key drivers:
- Redemption rate
- Win rate
- Cash conversion rate

### 5) Export
CSV export includes core assumptions and derived metrics.

---

## Variable guide

## Free Bet variables
- `issuedFreeBets`: total free bets distributed.
- `freeBetAmount`: face amount per free bet.
- `optInRate`: % of issued users who opt in.
- `redemptionRate`: % of opted users who redeem.
- `expiryRate`: % not usable due to expiry/non-use.
- `winRate`: % of redeemed free bets that win.
- `averageOdds`: average American odds used for profit multiple conversion.
- `share10x` / `share35x`: user mix by rollover profile (must sum to 100%).
- `conversion10x` / `conversion35x`: payout conversion rates by profile.
- `noDepositBlockRate`: % blocked/friction-adjusted conversion loss.
- `holdPercent`: expected hold on rollover handle.
- `maxProfitMultiple`: cap assumption for worst-case free-bet payout math.

## Wager Back variables
- `eligibleUsers`: users eligible for first wager refund promo.
- `averageFirstWagerAmount`: average qualifying first wager.
- `averageDepositAmount`: average deposit used for refund-cap rule.
- `lossRate`: % of first wagers that lose (trigger refund issuance).
- `refundRedemptionRate`: % of refunded free-play that gets redeemed.
- `refundWinRate`: % of refund free-play bets that win.
- `refundAverageOdds`: average odds for refund free-play wins.
- `refundCashConversionRate`: % of credited refund winnings converting to withdrawable cash.
- `holdPercent`: hold used on refund rollover handle.
- `worstCaseProfitMultiple`: worst-case cap multiple for refund payout ceiling.
- `refundCapRule`: refund cap policy (`greater_of` vs `lower_of` $500 and deposit).

## Stress control multipliers
- `redemption`: multiplier applied to redemption-like rates in Stress mode.
- `winRate`: multiplier applied to win-rate assumptions in Stress mode.
- `cashConversion`: multiplier applied to conversion assumptions in Stress mode.
- `blockRate`: multiplier applied to free-bet no-deposit block/friction assumption.

---

## Formula summary

## Odds conversion
- Positive odds: `profitMultiple = odds / 100`
- Negative odds: `profitMultiple = 100 / abs(odds)`

## Free Bet
1. `redeemedFreeBets = issued * optIn * redemption * (1 - expiry)`
2. `creditedWinnings = redeemedFreeBets * winRate * freeBetAmount * profitMultiple`
3. `weightedConversion = share10x*conversion10x + share35x*conversion35x`
4. `cashLiability = creditedWinnings * weightedConversion * (1 - noDepositBlockRate)`
5. `holdRecapture = creditedWinnings * effectiveRollover * holdPercent`
6. `netRisk = cashLiability - holdRecapture`

## Wager Back
1. `refundCap = max(500, averageDepositAmount)` (or policy-adjusted)
2. `refundBase = min(averageFirstWagerAmount, refundCap)`
3. `refundIssued = eligibleUsers * lossRate * refundBase`
4. `refundCredited = refundIssued * refundRedemptionRate * refundWinRate * refundProfitMultiple`
5. `refundCashLiability = refundCredited * refundCashConversionRate`
6. `refundHoldRecapture = refundCredited * 5 * holdPercent`
7. `refundNetRisk = refundCashLiability - refundHoldRecapture`

## Combined
- `combinedNetRisk = freeBetNetRisk + wagerBackNetRisk`
- `combinedWorstCase = freeWorstCase + wagerWorstCase`

---

## Stress-case behavior update
The stress-case path was updated so:
- Stress liability is calculated from base inputs plus stress multipliers in a dedicated function.
- Preset loading now changes actual model values (not just label/scenario text), so users can see variables change immediately.

---

## Files overview
- `report-template.html`: standalone main calculator (UI + logic)
- `index.html`: redirect to standalone main calculator
- `src/*`: previous React implementation retained in repo
- `README.md`: this documentation

