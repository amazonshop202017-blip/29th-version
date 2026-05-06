import { useFilteredTrades } from "@/hooks/useFilteredTrades";

/**
 * Returns aggregate trading stats derived from the user's currently filtered
 * trades. Used by simulator pages (Monte Carlo, Streak Analysis) to auto-fill
 * inputs from the user's actual performance.
 */
export function useStatsFromTrades() {
  const { stats } = useFilteredTrades();
  const avgLossAbs = Math.abs(stats.avgLoss ?? 0);
  const avgWin = stats.avgWin ?? 0;
  return {
    hasData: (stats.totalTrades ?? 0) > 0 && avgLossAbs > 0,
    winRate: stats.tradeWinRate ?? 0,
    avgWin,
    avgLoss: avgLossAbs,
    riskReward: avgLossAbs > 0 ? avgWin / avgLossAbs : 0,
    totalTrades: stats.totalTrades ?? 0,
  };
}