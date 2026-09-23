import type { RebalanceDecision } from './userStrategies';

export interface ProtocolYieldData {
  protocolId: string;
  name: string;
  type: 'blend' | 'dex_lp' | 'other';
  currentApy: number; // e.g. 0.085 for 8.5%
  historicalApy7d: number;
  historicalApy30d: number;
  tvlUsdc: number;
  volatility: number; // annualized volatility e.g. 0.02
  riskScore: number;  // 1-100 from risk scoring engine
}

export interface YieldOpportunity {
  protocolId: string;
  name: string;
  netApy: number;
  riskAdjustedScore: number;
  recommendedAllocationPercent: number;
}

export class YieldComparisonEngine {
  private readonly minImprovementThreshold: number;
  private readonly riskFreeRate: number;

  constructor(minImprovementThreshold = 0.005, riskFreeRate = 0.04) {
    this.minImprovementThreshold = minImprovementThreshold;
    this.riskFreeRate = riskFreeRate;
  }

  public calculateSharpeRatio(apy: number, volatility: number): number {
    if (volatility <= 0) return apy / 0.01;
    return (apy - this.riskFreeRate) / volatility;
  }

  public rankOpportunities(protocols: ProtocolYieldData[]): YieldOpportunity[] {
    return protocols
      .map((p) => {
        const sharpe = this.calculateSharpeRatio(p.currentApy, p.volatility);
        // Risk-adjusted metric combines sharpe with inverse risk penalty
        const riskPenalty = (100 - p.riskScore) / 100;
        const riskAdjustedScore = sharpe * riskPenalty;

        return {
          protocolId: p.protocolId,
          name: p.name,
          netApy: p.currentApy,
          riskAdjustedScore: Math.round(riskAdjustedScore * 100) / 100,
          recommendedAllocationPercent: 0,
        };
      })
      .sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);
  }

  public shouldRebalance(currentApy: number, targetApy: number): boolean {
    return targetApy - currentApy >= this.minImprovementThreshold;
  }
}

/** Minimum APY improvement, in percentage points, before a rebalance is proposed. */
export const MIN_REBALANCE_IMPROVEMENT_PCT = 0.5;

export async function fetchBlendApy(): Promise<number> {
  // TODO: Implement on-chain query to Blend protocol
  return 6.5;
}

export async function fetchDexApy(): Promise<number> {
  // TODO: Implement query to DEX liquidity pools
  return 8.2;
}

/**
 * Decide whether to move funds for a given strategy (#467).
 *
 * APYs are in percent (e.g. 6.5), matching `rebalances.apy_after`.
 * Conservative strategies stay on Blend lending; balanced/growth may use the
 * DEX when it pays more. A rebalance is proposed only when the target
 * protocol differs and improves APY by more than 0.5 percentage points.
 * Fetch failures never trigger a rebalance.
 *
 * Restored after the class refactor dropped it while `index.ts` and
 * `eventListener.ts` still called it.
 */
export async function evaluateYield(
  strategy: string,
  currentProtocol: string,
  currentApy: number,
): Promise<RebalanceDecision> {
  try {
    const [blendApy, dexApy] = await Promise.all([fetchBlendApy(), fetchDexApy()]);

    let targetProtocol = 'blend';
    let targetApy = blendApy;
    if (strategy !== 'conservative' && dexApy > blendApy) {
      targetProtocol = 'dex';
      targetApy = dexApy;
    }

    if (targetProtocol !== currentProtocol && targetApy - currentApy > MIN_REBALANCE_IMPROVEMENT_PCT) {
      return { shouldRebalance: true, targetProtocol };
    }
    return { shouldRebalance: false };
  } catch {
    return { shouldRebalance: false };
  }
}
