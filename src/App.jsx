import { useMemo, useState } from 'react';
import {
  SCENARIOS,
  applyScenarioAdjustments,
  buildCombinedResults,
  calculateFreeBetRisk,
  calculateSensitivity,
  calculateWagerBackRisk,
  clampPercentage,
  currencyFormat,
} from './calculations';

const DEFAULT_FREE_BET = {
  issuedFreeBets: 1000,
  freeBetAmount: 25,
  optInRate: 60,
  redemptionRate: 85,
  expiryRate: 10,
  winRate: 45,
  averageOdds: -110,
  share10x: 70,
  share35x: 30,
  conversion10x: 30,
  conversion35x: 15,
  noDepositBlockRate: 20,
  holdPercent: 7,
  maxProfitMultiple: 1,
};

const DEFAULT_WAGER_BACK = {
  eligibleUsers: 1000,
  averageFirstWagerAmount: 50,
  averageDepositAmount: 100,
  lossRate: 52,
  refundRedemptionRate: 80,
  refundWinRate: 45,
  refundAverageOdds: -110,
  refundCashConversionRate: 20,
  holdPercent: 7,
  worstCaseProfitMultiple: 1,
};

const inputGroups = {
  free: [
    ['issuedFreeBets', 'Number of free bets issued'],
    ['freeBetAmount', 'Free bet amount ($)'],
    ['optInRate', 'Opt-in rate %'],
    ['redemptionRate', 'Redemption rate %'],
    ['expiryRate', 'Expiry / non-use rate %'],
    ['winRate', 'Win rate %'],
    ['averageOdds', 'Average American odds'],
    ['share10x', '% users on 10x rollover'],
    ['share35x', '% users on 35x rollover'],
    ['conversion10x', 'Cash conversion rate 10x %'],
    ['conversion35x', 'Cash conversion rate 35x %'],
    ['noDepositBlockRate', 'No-deposit block rate %'],
    ['holdPercent', 'Hold % on rollover handle'],
    ['maxProfitMultiple', 'Max profit multiple for worst-case'],
  ],
  wager: [
    ['eligibleUsers', 'Number of eligible users'],
    ['averageFirstWagerAmount', 'Average first wager amount ($)'],
    ['averageDepositAmount', 'Average deposit amount ($)'],
    ['lossRate', 'Loss rate on first wager %'],
    ['refundRedemptionRate', 'Refund redemption rate %'],
    ['refundWinRate', 'Refund free-play win rate %'],
    ['refundAverageOdds', 'Refund average American odds'],
    ['refundCashConversionRate', 'Refund cash conversion rate %'],
    ['holdPercent', 'Hold % on rollover handle'],
    ['worstCaseProfitMultiple', 'Worst-case profit multiple'],
  ],
};

const percentFieldsFree = new Set([
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
]);

const percentFieldsWager = new Set([
  'lossRate',
  'refundRedemptionRate',
  'refundWinRate',
  'refundCashConversionRate',
  'holdPercent',
]);

function App() {
  const [scenario, setScenario] = useState(SCENARIOS.EXPECTED);
  const [freeBetInputs, setFreeBetInputs] = useState(DEFAULT_FREE_BET);
  const [wagerBackInputs, setWagerBackInputs] = useState(DEFAULT_WAGER_BACK);

  const adjustedFreeBetInputs = useMemo(
    () => applyScenarioAdjustments(freeBetInputs, scenario, 'freeBet'),
    [freeBetInputs, scenario],
  );

  const adjustedWagerInputs = useMemo(
    () => applyScenarioAdjustments(wagerBackInputs, scenario, 'wagerBack'),
    [wagerBackInputs, scenario],
  );

  const freeResults = useMemo(
    () => calculateFreeBetRisk(adjustedFreeBetInputs),
    [adjustedFreeBetInputs],
  );
  const wagerResults = useMemo(
    () => calculateWagerBackRisk(adjustedWagerInputs),
    [adjustedWagerInputs],
  );

  const stressFree = useMemo(
    () => calculateFreeBetRisk(applyScenarioAdjustments(freeBetInputs, SCENARIOS.STRESS, 'freeBet')),
    [freeBetInputs],
  );
  const stressWager = useMemo(
    () => calculateWagerBackRisk(applyScenarioAdjustments(wagerBackInputs, SCENARIOS.STRESS, 'wagerBack')),
    [wagerBackInputs],
  );

  const worstFree = useMemo(
    () => calculateFreeBetRisk(applyScenarioAdjustments(freeBetInputs, SCENARIOS.WORST, 'freeBet')),
    [freeBetInputs],
  );
  const worstWager = useMemo(
    () => calculateWagerBackRisk(applyScenarioAdjustments(wagerBackInputs, SCENARIOS.WORST, 'wagerBack')),
    [wagerBackInputs],
  );

  const combined = useMemo(() => {
    const base = buildCombinedResults(freeResults, wagerResults);
    return {
      ...base,
      stressCaseLiability: stressFree.netRisk + stressWager.refundNetRisk,
      worstCaseLiability: worstFree.worstCaseLiability + worstWager.worstCaseLiability,
    };
  }, [freeResults, wagerResults, stressFree, stressWager, worstFree, worstWager]);

  const sensitivity = useMemo(
    () => calculateSensitivity(adjustedFreeBetInputs, adjustedWagerInputs),
    [adjustedFreeBetInputs, adjustedWagerInputs],
  );

  const validationErrors = useMemo(() => {
    const errors = [];

    const validateOdds = (value, label) => {
      if (Number(value) === 0) {
        errors.push(`${label}: odds cannot be zero.`);
      } else if (Number(value) > 0 && Number(value) < 100) {
        errors.push(`${label}: positive odds must be at least +100.`);
      } else if (Number(value) < 0 && Number(value) > -100) {
        errors.push(`${label}: negative odds must be -100 or lower.`);
      }
    };

    if (Math.abs(Number(freeBetInputs.share10x) + Number(freeBetInputs.share35x) - 100) > 0.001) {
      errors.push('Free Bet profile shares must sum to 100%.');
    }

    validateOdds(freeBetInputs.averageOdds, 'Free Bet average odds');
    validateOdds(wagerBackInputs.refundAverageOdds, 'Wager Back refund average odds');

    Object.entries({ ...freeBetInputs, ...wagerBackInputs }).forEach(([key, value]) => {
      if (Number(value) < 0) {
        errors.push(`${key}: value cannot be negative.`);
      }
    });

    return errors;
  }, [freeBetInputs, wagerBackInputs]);

  const handleInputChange = (type, key, value) => {
    const parsed = value === '' ? '' : Number(value);
    if (type === 'free') {
      setFreeBetInputs((prev) => ({
        ...prev,
        [key]: percentFieldsFree.has(key) ? clampPercentage(parsed) : parsed,
      }));
    } else {
      setWagerBackInputs((prev) => ({
        ...prev,
        [key]: percentFieldsWager.has(key) ? clampPercentage(parsed) : parsed,
      }));
    }
  };

  const exportCsv = () => {
    const flatRow = {
      scenario,
      ...Object.fromEntries(Object.entries(adjustedFreeBetInputs).map(([k, v]) => [`free_${k}`, v])),
      ...Object.fromEntries(Object.entries(adjustedWagerInputs).map(([k, v]) => [`wager_${k}`, v])),
      free_grossExposure: freeResults.grossExposure,
      free_expectedRedeemedValue: freeResults.expectedRedeemedValue,
      free_creditedWinnings: freeResults.creditedWinnings,
      free_cashLiability: freeResults.cashLiability,
      free_holdRecapture: freeResults.holdRecapture,
      free_netRisk: freeResults.netRisk,
      free_worstCaseLiability: freeResults.worstCaseLiability,
      free_stressCaseLiability: stressFree.netRisk,
      free_riskPerUser: freeResults.riskPerUser,
      free_riskPer100Users: freeResults.riskPer100Users,
      wager_grossExposure: wagerResults.grossExposure,
      wager_expectedRedeemedValue: wagerResults.expectedRedeemedValue,
      wager_creditedWinnings: wagerResults.refundCredited,
      wager_cashLiability: wagerResults.refundCashLiability,
      wager_holdRecapture: wagerResults.refundHoldRecapture,
      wager_netRisk: wagerResults.refundNetRisk,
      wager_worstCaseLiability: wagerResults.worstCaseLiability,
      wager_stressCaseLiability: stressWager.refundNetRisk,
      wager_riskPerUser: wagerResults.riskPerUser,
      wager_riskPer100Users: wagerResults.riskPer100Users,
      combined_netRisk: combined.netRisk,
      combined_worstCaseLiability: combined.worstCaseLiability,
      combined_stressCaseLiability: combined.stressCaseLiability,
      sensitivity_redemption_minus10: sensitivity.redemptionRate[0].netRisk,
      sensitivity_redemption_base: sensitivity.redemptionRate[1].netRisk,
      sensitivity_redemption_plus10: sensitivity.redemptionRate[2].netRisk,
      sensitivity_win_minus10: sensitivity.winRate[0].netRisk,
      sensitivity_win_base: sensitivity.winRate[1].netRisk,
      sensitivity_win_plus10: sensitivity.winRate[2].netRisk,
      sensitivity_conversion_minus10: sensitivity.cashConversionRate[0].netRisk,
      sensitivity_conversion_base: sensitivity.cashConversionRate[1].netRisk,
      sensitivity_conversion_plus10: sensitivity.cashConversionRate[2].netRisk,
    };

    const headers = Object.keys(flatRow);
    const values = headers.map((h) => flatRow[h]);
    const csv = `${headers.join(',')}\n${values.join(',')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `promo-risk-${scenario.toLowerCase().replace(' ', '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderInputSection = (type) => (
    <div className="input-grid">
      {inputGroups[type].map(([key, label]) => (
        <label key={key} className="input-label">
          <span>{label}</span>
          <input
            type="number"
            step="any"
            value={type === 'free' ? freeBetInputs[key] : wagerBackInputs[key]}
            onChange={(e) => handleInputChange(type, key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );

  const outputRows = (title, data, riskKey = 'netRisk') => [
    ['Gross Exposure', data.grossExposure],
    ['Expected Redeemed Value', data.expectedRedeemedValue],
    ['Expected Credited Winnings', data.creditedWinnings ?? data.refundCredited],
    ['Expected Cash Liability', data.cashLiability ?? data.refundCashLiability],
    ['Expected Hold Recapture', data.holdRecapture ?? data.refundHoldRecapture],
    ['Net Expected Risk', data[riskKey]],
    ['Worst-Case Liability', data.worstCaseLiability],
    ['Stress-Case Liability', title === 'Free Bet' ? stressFree.netRisk : stressWager.refundNetRisk],
    ['Risk per User', data.riskPerUser],
    ['Risk per 100 Users', data.riskPer100Users],
  ];

  return (
    <main className="container">
      <header>
        <h1>Promo Risk Calculator</h1>
        <p>
          This tool is a scenario-based promo risk model. It estimates theoretical promotional liability using adjustable assumptions.
          It is not actual realized P&amp;L, accounting liability, or a substitute for historical promo performance analysis.
        </p>
        <p>Results are highly sensitive to redemption rate, win rate, and post-rollover cash conversion assumptions.</p>
      </header>

      <section className="card summary">
        <h2>Top Summary</h2>
        <div className="summary-grid">
          <div>
            <h3>Combined Net Expected Risk</h3>
            <p>{currencyFormat(combined.netRisk)}</p>
          </div>
          <div>
            <h3>Combined Worst-Case Liability</h3>
            <p>{currencyFormat(combined.worstCaseLiability)}</p>
          </div>
          <div>
            <h3>Combined Stress-Case Liability</h3>
            <p>{currencyFormat(combined.stressCaseLiability)}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Scenario Selector</h2>
        <div className="scenario-buttons">
          {Object.values(SCENARIOS).map((name) => (
            <button
              key={name}
              onClick={() => setScenario(name)}
              className={scenario === name ? 'active' : ''}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      {validationErrors.length > 0 && (
        <section className="card error">
          <h3>Validation Issues</h3>
          <ul>
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Free Bet Inputs</h2>
        {renderInputSection('free')}
      </section>

      <section className="card">
        <h2>Wager Back Inputs</h2>
        {renderInputSection('wager')}
      </section>

      <section className="card">
        <h2>Results</h2>
        <div className="results-grid">
          <div>
            <h3>Free Bet</h3>
            <table>
              <tbody>
                {outputRows('Free Bet', freeResults).map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{currencyFormat(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note" title="Stake-not-returned free bet logic">
              Only profit from a winning free bet is credited; the original free bet stake is not returned.
            </p>
            <p className="note">Operational worst-case ceiling: {currencyFormat(freeResults.operationalWorstCase)}</p>
          </div>
          <div>
            <h3>Wager Back</h3>
            <table>
              <tbody>
                {outputRows('Wager Back', wagerResults, 'refundNetRisk').map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{currencyFormat(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note" title="Cash conversion rate and rollover impact">
              Refund is issued as free play, not cash, and still requires rollover before becoming withdrawable.
            </p>
            <p className="note">Operational worst-case ceiling: {currencyFormat(wagerResults.refundOperationalCeiling)}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Combined Breakdown</h2>
        <table>
          <tbody>
            <tr><td>Gross Exposure</td><td>{currencyFormat(combined.grossExposure)}</td></tr>
            <tr><td>Expected Redeemed Value</td><td>{currencyFormat(combined.expectedRedeemedValue)}</td></tr>
            <tr><td>Expected Credited Winnings</td><td>{currencyFormat(combined.expectedCreditedWinnings)}</td></tr>
            <tr><td>Expected Cash Liability</td><td>{currencyFormat(combined.cashLiability)}</td></tr>
            <tr><td>Expected Hold Recapture</td><td>{currencyFormat(combined.holdRecapture)}</td></tr>
            <tr><td>Net Expected Risk</td><td>{currencyFormat(combined.netRisk)}</td></tr>
            <tr><td>Net Downside Risk (floored)</td><td>{currencyFormat(Math.max(combined.netRisk, 0))}</td></tr>
            <tr><td>Free Bet share of total risk</td><td>{combined.freeBetShare.toFixed(2)}%</td></tr>
            <tr><td>Wager Back share of total risk</td><td>{combined.wagerBackShare.toFixed(2)}%</td></tr>
          </tbody>
        </table>
        <p className="note" title="Difference between gross exposure and expected net risk">
          Gross exposure is not equivalent to expected cost. The model flows from issue → redeem → win → credit → cash conversion → hold recapture → net risk.
        </p>
        <p className="note" title="Why worst case is not realistic expected cost">
          Worst case is a ceiling scenario, not a realistic expected cost forecast.
        </p>
      </section>

      <section className="card">
        <h2>Sensitivity Table (Net Risk)</h2>
        <div className="results-grid">
          {Object.entries(sensitivity).map(([metric, rows]) => (
            <div key={metric}>
              <h3>{metric}</h3>
              <table>
                <thead>
                  <tr><th>Assumption</th><th>Net Risk</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{currencyFormat(row.netRisk)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <button onClick={exportCsv}>Export CSV</button>
      </section>
    </main>
  );
}

export default App;
