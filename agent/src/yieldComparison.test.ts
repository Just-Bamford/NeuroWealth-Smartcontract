import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { YieldComparisonEngine, ProtocolYieldData, evaluateYield } from './yieldComparison';

describe('YieldComparisonEngine', () => {
  let engine: YieldComparisonEngine;

  beforeEach(() => {
    engine = new YieldComparisonEngine(0.005, 0.04);
  });

  const mockProtocols: ProtocolYieldData[] = [
    {
      protocolId: 'blend-usdc',
      name: 'Blend USDC Lending',
      type: 'blend',
      currentApy: 0.082,
      historicalApy7d: 0.081,
      historicalApy30d: 0.080,
      tvlUsdc: 5_000_000,
      volatility: 0.015,
      riskScore: 20,
    },
    {
      protocolId: 'dex-usdc-xlm',
      name: 'Soroswap USDC/XLM Pool',
      type: 'dex_lp',
      currentApy: 0.125,
      historicalApy7d: 0.118,
      historicalApy30d: 0.110,
      tvlUsdc: 1_200_000,
      volatility: 0.065,
      riskScore: 45,
    },
  ];

  it('ranks opportunities by risk-adjusted return', () => {
    const ranked = engine.rankOpportunities(mockProtocols);
    assert.strictEqual(ranked.length, 2);
    assert.ok(ranked[0].riskAdjustedScore > 0);
  });

  it('enforces 0.5% minimum improvement rebalance threshold', () => {
    assert.strictEqual(engine.shouldRebalance(0.080, 0.086), true);  // +0.6% > 0.5%
    assert.strictEqual(engine.shouldRebalance(0.080, 0.083), false); // +0.3% < 0.5%
  });
});

describe('evaluateYield (#467)', () => {
  it('moves balanced funds to the higher-yielding DEX', async () => {
    assert.deepStrictEqual(await evaluateYield('balanced', 'blend', 6.5), {
      shouldRebalance: true,
      targetProtocol: 'dex',
    });
  });

  it('keeps conservative strategies on Blend', async () => {
    assert.deepStrictEqual(await evaluateYield('conservative', 'none', 0), {
      shouldRebalance: true,
      targetProtocol: 'blend',
    });
    assert.strictEqual((await evaluateYield('conservative', 'blend', 6.5)).shouldRebalance, false);
  });

  it('does not rebalance below the 0.5pp improvement threshold', async () => {
    assert.strictEqual((await evaluateYield('growth', 'blend', 7.8)).shouldRebalance, false);
  });
});
