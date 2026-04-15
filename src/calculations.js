export const SCENARIOS = {
  EXPECTED: 'Expected',
  STRESS: 'Stress',
  WORST: 'Worst Case',
};

const DEFAULT_STRESS_MULTIPLIERS = {
  redemption: 1.15,
  winRate: 1.1,
  cashConversion: 1.2,
  blockRate: 0.85,
};

export function percentToDecimal(value) {
  return Number(value || 0) / 100;
}

export function clampPercentage(value) {
  return Math.min(100, Math.max(0, Number(value || 0)));
}

export function americanOddsToProfitMultiple(odds) {
  const numericOdds = Number(odds);
  if (numericOdds === 0) {
    return 0;
  }
  if (numericOdds > 0) {
    return numericOdds / 100;
  }
  return 100 / Math.abs(numericOdds);
}

export function currencyFormat(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function clampPercentFields(inputs, fields) {
  return fields.reduce(
    (acc, field) => ({ ...acc, [field]: clampPercentage(inputs[field]) }),
    { ...inputs },
  );
}

export function applyScenarioAdjustments(inputs, scenario, type, stressMultipliers = DEFAULT_STRESS_MULTIPLIERS) {
  const adjusted = { ...inputs };

  if (scenario === SCENARIOS.STRESS) {
    if (type === 'freeBet') {
      adjusted.redemptionRate = clampPercentage(inputs.redemptionRate * stressMultipliers.redemption);
      adjusted.winRate = clampPercentage(inputs.winRate * stressMultipliers.winRate);
      adjusted.conversion10x = clampPercentage(inputs.conversion10x * stressMultipliers.cashConversion);
      adjusted.conversion35x = clampPercentage(inputs.conversion35x * stressMultipliers.cashConversion);
      adjusted.noDepositBlockRate = clampPercentage(inputs.noDepositBlockRate * stressMultipliers.blockRate);
    } else {
      adjusted.refundRedemptionRate = clampPercentage(inputs.refundRedemptionRate * stressMultipliers.redemption);
      adjusted.refundWinRate = clampPercentage(inputs.refundWinRate * stressMultipliers.winRate);
      adjusted.refundCashConversionRate = clampPercentage(inputs.refundCashConversionRate * stressMultipliers.cashConversion);
    }
  }

  if (scenario === SCENARIOS.WORST) {
    if (type === 'freeBet') {
      adjusted.optInRate = 100;
      adjusted.redemptionRate = 100;
      adjusted.expiryRate = 0;
      adjusted.winRate = 100;
      adjusted.conversion10x = 100;
      adjusted.conversion35x = 100;
      adjusted.noDepositBlockRate = 0;
    } else {
      adjusted.lossRate = 100;
      adjusted.refundRedemptionRate = 100;
      adjusted.refundWinRate = 100;
      adjusted.refundCashConversionRate = 100;
    }
  }

  const fields =
    type === 'freeBet'
      ? [
          'optInRate',
          'redemptionRate',
          'expiryRate',
          'winRate',
          'share10x',
          'share35x',
          'conversion10x',
          'conversion35x',
          'noDepositBlockRate',
          'holdPercent',
        ]
      : [
          'lossRate',
          'refundRedemptionRate',
          'refundWinRate',
          'refundCashConversionRate',
          'holdPercent',
        ];

  return clampPercentFields(adjusted, fields);
}

export function calculateFreeBetRisk(inputs) {
  const issuedFreeBets = Number(inputs.issuedFreeBets || 0);
  const freeBetAmount = Number(inputs.freeBetAmount || 0);
  const optInRate = percentToDecimal(inputs.optInRate);
  const redemptionRate = percentToDecimal(inputs.redemptionRate);
  const expiryRate = percentToDecimal(inputs.expiryRate);
  const winRate = percentToDecimal(inputs.winRate);
  const share10x = percentToDecimal(inputs.share10x);
  const share35x = percentToDecimal(inputs.share35x);
  const conversion10x = percentToDecimal(inputs.conversion10x);
  const conversion35x = percentToDecimal(inputs.conversion35x);
  const noDepositBlockRate = percentToDecimal(inputs.noDepositBlockRate);
  const holdPercent = percentToDecimal(inputs.holdPercent);
  const profitMultiple = americanOddsToProfitMultiple(inputs.averageOdds);

  const grossExposure = issuedFreeBets * freeBetAmount;
  const redeemedFreeBets = issuedFreeBets * optInRate * redemptionRate * (1 - expiryRate);
  const expectedRedeemedValue = redeemedFreeBets * freeBetAmount;
  const creditedWinnings = redeemedFreeBets * winRate * freeBetAmount * profitMultiple;
  const weightedConversion = share10x * conversion10x + share35x * conversion35x;
  const adjustedConversion = weightedConversion * (1 - noDepositBlockRate);
  const cashLiability = creditedWinnings * adjustedConversion;
  const effectiveRollover = share10x * 10 + share35x * 35;
  const rolloverHandle = creditedWinnings * effectiveRollover;
  const holdRecapture = rolloverHandle * holdPercent;
  const netRisk = cashLiability - holdRecapture;

  const maxProfitMultiple = Number(inputs.maxProfitMultiple || 1);
  const grossWorstCase = issuedFreeBets * freeBetAmount * maxProfitMultiple;
  const operationalWorstCase = issuedFreeBets * freeBetAmount;

  return {
    grossExposure,
    expectedRedeemedValue,
    redeemedFreeBets,
    profitMultiple,
    creditedWinnings,
    weightedConversion,
    adjustedConversion,
    cashLiability,
    effectiveRollover,
    rolloverHandle,
    holdRecapture,
    netRisk,
    netDownsideRisk: Math.max(netRisk, 0),
    grossWorstCase,
    operationalWorstCase,
    worstCaseLiability: grossWorstCase,
    riskPerUser: issuedFreeBets ? netRisk / issuedFreeBets : 0,
    riskPer100Users: issuedFreeBets ? (netRisk / issuedFreeBets) * 100 : 0,
  };
}

export function calculateWagerBackRisk(inputs) {
  const eligibleUsers = Number(inputs.eligibleUsers || 0);
  const averageFirstWagerAmount = Number(inputs.averageFirstWagerAmount || 0);
  const averageDepositAmount = Number(inputs.averageDepositAmount || 0);
  const lossRate = percentToDecimal(inputs.lossRate);
  const refundRedemptionRate = percentToDecimal(inputs.refundRedemptionRate);
  const refundWinRate = percentToDecimal(inputs.refundWinRate);
  const refundCashConversionRate = percentToDecimal(inputs.refundCashConversionRate);
  const holdPercent = percentToDecimal(inputs.holdPercent);

  const refundCapRule = inputs.refundCapRule || 'greater_of';
  const refundCap = refundCapRule === 'lower_of' ? Math.min(500, averageDepositAmount) : Math.max(500, averageDepositAmount);
  const refundBase = Math.min(averageFirstWagerAmount, refundCap);
  const grossExposure = eligibleUsers * refundBase;
  const refundIssued = eligibleUsers * lossRate * refundBase;
  const refundProfitMultiple = americanOddsToProfitMultiple(inputs.refundAverageOdds);
  const expectedRedeemedValue = refundIssued * refundRedemptionRate;
  const refundCredited = refundIssued * refundRedemptionRate * refundWinRate * refundProfitMultiple;
  const refundCashLiability = refundCredited * refundCashConversionRate;
  const refundRolloverHandle = refundCredited * 5;
  const refundHoldRecapture = refundRolloverHandle * holdPercent;
  const refundNetRisk = refundCashLiability - refundHoldRecapture;

  const worstCaseProfitMultiple = Number(inputs.worstCaseProfitMultiple || 1);
  const refundWorstCase = eligibleUsers * refundBase * worstCaseProfitMultiple;
  const refundOperationalCeiling = eligibleUsers * refundBase;

  return {
    grossExposure,
    refundCap,
    refundCapRule,
    refundBase,
    refundIssued,
    refundProfitMultiple,
    expectedRedeemedValue,
    refundCredited,
    refundCashLiability,
    refundRolloverHandle,
    refundHoldRecapture,
    refundNetRisk,
    netDownsideRisk: Math.max(refundNetRisk, 0),
    refundWorstCase,
    refundOperationalCeiling,
    worstCaseLiability: refundWorstCase,
    riskPerUser: eligibleUsers ? refundNetRisk / eligibleUsers : 0,
    riskPer100Users: eligibleUsers ? (refundNetRisk / eligibleUsers) * 100 : 0,
  };
}

export function calculateSensitivity(baseFreeInputs, baseWagerInputs) {
  const deltas = [0.9, 1, 1.1];
  const labels = ['-10%', 'Base', '+10%'];

  const createRows = (key, type) =>
    deltas.map((delta, idx) => {
      const freeInputs = { ...baseFreeInputs };
      const wagerInputs = { ...baseWagerInputs };

      if (type === 'free') {
        freeInputs[key] = clampPercentage(baseFreeInputs[key] * delta);
      }
      if (type === 'wager') {
        wagerInputs[key] = clampPercentage(baseWagerInputs[key] * delta);
      }
      if (type === 'both') {
        freeInputs[key.free] = clampPercentage(baseFreeInputs[key.free] * delta);
        wagerInputs[key.wager] = clampPercentage(baseWagerInputs[key.wager] * delta);
      }

      const free = calculateFreeBetRisk(freeInputs);
      const wager = calculateWagerBackRisk(wagerInputs);

      return {
        label: labels[idx],
        netRisk: free.netRisk + wager.refundNetRisk,
      };
    });

  return {
    redemptionRate: createRows('redemptionRate', 'free'),
    winRate: createRows({ free: 'winRate', wager: 'refundWinRate' }, 'both'),
    cashConversionRate: createRows({ free: 'conversion10x', wager: 'refundCashConversionRate' }, 'both').map((row, idx) => {
      const freeInputs = {
        ...baseFreeInputs,
        conversion10x: clampPercentage(baseFreeInputs.conversion10x * deltas[idx]),
        conversion35x: clampPercentage(baseFreeInputs.conversion35x * deltas[idx]),
      };
      const wagerInputs = {
        ...baseWagerInputs,
        refundCashConversionRate: clampPercentage(baseWagerInputs.refundCashConversionRate * deltas[idx]),
      };
      const free = calculateFreeBetRisk(freeInputs);
      const wager = calculateWagerBackRisk(wagerInputs);
      return { label: labels[idx], netRisk: free.netRisk + wager.refundNetRisk };
    }),
  };
}

export function buildCombinedResults(freeBetResults, wagerBackResults) {
  const combinedNetRisk = freeBetResults.netRisk + wagerBackResults.refundNetRisk;
  const totalRisk = combinedNetRisk || 1;

  return {
    grossExposure: freeBetResults.grossExposure + wagerBackResults.grossExposure,
    expectedRedeemedValue: freeBetResults.expectedRedeemedValue + wagerBackResults.expectedRedeemedValue,
    expectedCreditedWinnings: freeBetResults.creditedWinnings + wagerBackResults.refundCredited,
    cashLiability: freeBetResults.cashLiability + wagerBackResults.refundCashLiability,
    holdRecapture: freeBetResults.holdRecapture + wagerBackResults.refundHoldRecapture,
    netRisk: combinedNetRisk,
    worstCaseLiability: freeBetResults.worstCaseLiability + wagerBackResults.worstCaseLiability,
    stressCaseLiability: 0,
    riskPerUser:
      (freeBetResults.riskPerUser + wagerBackResults.riskPerUser) / 2,
    riskPer100Users:
      (freeBetResults.riskPer100Users + wagerBackResults.riskPer100Users) / 2,
    freeBetShare: (freeBetResults.netRisk / totalRisk) * 100,
    wagerBackShare: (wagerBackResults.refundNetRisk / totalRisk) * 100,
  };
}
