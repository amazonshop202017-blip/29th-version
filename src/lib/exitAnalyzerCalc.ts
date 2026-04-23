import { Trade, calculateTradeMetrics } from '@/types/trade';

export interface HeatmapCell {
  sl: number;
  tp: number;
  expectancy: number;
  winRate: number;
  avgR: number;
  tradesCount: number;
}

export interface ExitAnalyzerTrade {
  side: 'LONG' | 'SHORT';
  mfe: number;
  mae: number;
  realizedR: number;
}

/**
 * Prepare trades for exit analysis. Filters and normalizes.
 */
export function prepareExitTrades(
  trades: Trade[],
  treatMissingAsZero: boolean
): ExitAnalyzerTrade[] {
  const result: ExitAnalyzerTrade[] = [];

  for (const trade of trades) {
    const mfe = trade.preMfeTickPip;
    const mae = trade.preMaeTickPip;

    // Both missing → always skip
    if (mfe == null && mae == null) continue;

    let mfeVal: number;
    let maeVal: number;

    if (mfe != null && mae != null) {
      // Both present → always include
      mfeVal = mfe;
      maeVal = mae;
    } else if (treatMissingAsZero) {
      // One present, one missing, checkbox ticked → treat missing as 0
      mfeVal = mfe ?? 0;
      maeVal = mae ?? 0;
    } else {
      // One missing, checkbox not ticked → skip
      continue;
    }

    const metrics = calculateTradeMetrics(trade);
    // Use savedRMultiple if available, otherwise compute from metrics
    const realizedR = trade.savedRMultiple ?? (trade.tradeRisk > 0 ? metrics.netPnl / trade.tradeRisk : 0);

    result.push({
      side: trade.side,
      mfe: mfeVal,
      mae: maeVal,
      realizedR,
    });
  }

  return result;
}

/**
 * Simulate exit for a single trade given SL/TP in ticks.
 * Returns the R result of the simulated exit.
 */
function simulateExit(trade: ExitAnalyzerTrade, sl: number, tp: number): number {
  // MAE >= SL means stop loss would have been hit
  if (trade.mae >= sl) {
    return -1; // Lost 1R
  }
  // MFE >= TP means take profit would have been hit
  if (trade.mfe >= tp) {
    return tp / sl; // Won TP/SL ratio in R
  }
  // Neither hit → use realized R
  return trade.realizedR;
}

/**
 * Compute the full heatmap grid.
 */
export function computeHeatmap(
  trades: ExitAnalyzerTrade[],
  minSL: number,
  maxSL: number,
  slStep: number,
  minTP: number,
  maxTP: number,
  tpStep: number
): HeatmapCell[] {
  if (trades.length === 0 || slStep <= 0 || tpStep <= 0) return [];

  const cells: HeatmapCell[] = [];

  for (let sl = minSL; sl <= maxSL; sl += slStep) {
    for (let tp = minTP; tp <= maxTP; tp += tpStep) {
      let totalR = 0;
      let wins = 0;
      let relevantCount = 0;

      for (const trade of trades) {
        const r = simulateExit(trade, sl, tp);
        totalR += r;
        if (r > 0) wins++;
        relevantCount++;
      }

      if (relevantCount === 0) continue;

      cells.push({
        sl,
        tp,
        expectancy: totalR / relevantCount,
        winRate: (wins / relevantCount) * 100,
        avgR: totalR / relevantCount,
        tradesCount: relevantCount,
      });
    }
  }

  return cells;
}

export interface SweepPoint {
  value: number;       // The SL or TP tick value
  expectancy: number;
  winRate: number;
  tradesCount: number;
}

/**
 * Sweep SL values while holding TP fixed.
 */
export function computeSLSweep(
  trades: ExitAnalyzerTrade[],
  fixedTP: number,
  minSL: number,
  maxSL: number,
  step: number
): SweepPoint[] {
  if (trades.length === 0 || step <= 0 || fixedTP <= 0) return [];
  const points: SweepPoint[] = [];
  for (let sl = minSL; sl <= maxSL; sl += step) {
    let totalR = 0;
    let wins = 0;
    for (const trade of trades) {
      const r = simulateExit(trade, sl, fixedTP);
      totalR += r;
      if (r > 0) wins++;
    }
    points.push({
      value: sl,
      expectancy: totalR / trades.length,
      winRate: (wins / trades.length) * 100,
      tradesCount: trades.length,
    });
  }
  return points;
}

/**
 * Sweep TP values while holding SL fixed.
 */
export function computeTPSweep(
  trades: ExitAnalyzerTrade[],
  fixedSL: number,
  minTP: number,
  maxTP: number,
  step: number
): SweepPoint[] {
  if (trades.length === 0 || step <= 0 || fixedSL <= 0) return [];
  const points: SweepPoint[] = [];
  for (let tp = minTP; tp <= maxTP; tp += step) {
    let totalR = 0;
    let wins = 0;
    for (const trade of trades) {
      const r = simulateExit(trade, fixedSL, tp);
      totalR += r;
      if (r > 0) wins++;
    }
    points.push({
      value: tp,
      expectancy: totalR / trades.length,
      winRate: (wins / trades.length) * 100,
      tradesCount: trades.length,
    });
  }
  return points;
}
