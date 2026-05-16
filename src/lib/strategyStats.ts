import { Trade, calculateTradeMetrics } from '@/types/trade';

export interface StrategyStats {
  totalTrades: number;
  totalNetPnL: number;
  profitFactor: number;
  winRate: number;
  avgWinner: number;
  avgLoser: number;
  expectancy: number;
  sharedStrategies: string;
  monthlyReturnPct: number;
  avgR: number;
  maxDrawdownPct: number;
  cumulativeSeries: { x: number; y: number }[];
  lastExecutionDate: string | null;
}

export function calculateStrategyStats(strategyId: string, trades: Trade[]): StrategyStats {
  // Filter trades that belong to this strategy
  const strategyTrades = trades.filter(trade => trade.strategyId === strategyId);
  
  if (strategyTrades.length === 0) {
    return {
      totalTrades: 0,
      totalNetPnL: 0,
      profitFactor: 0,
      winRate: 0,
      avgWinner: 0,
      avgLoser: 0,
      expectancy: 0,
      sharedStrategies: '-',
      monthlyReturnPct: 0,
      avgR: 0,
      maxDrawdownPct: 0,
      cumulativeSeries: [],
      lastExecutionDate: null,
    };
  }
  
  // Calculate metrics for each trade
  const tradesWithMetrics = strategyTrades.map(trade => ({
    trade,
    metrics: calculateTradeMetrics(trade),
  }));
  
  // Separate winning and losing trades
  const winningTrades = tradesWithMetrics.filter(t => t.metrics.netPnl > 0);
  const losingTrades = tradesWithMetrics.filter(t => t.metrics.netPnl < 0);
  
  // Calculate totals
  const totalNetPnL = tradesWithMetrics.reduce((sum, t) => sum + t.metrics.netPnl, 0);
  const totalProfits = winningTrades.reduce((sum, t) => sum + t.metrics.netPnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.metrics.netPnl, 0));
  
  // Calculate averages
  const avgWinner = winningTrades.length > 0 
    ? totalProfits / winningTrades.length 
    : 0;
  const avgLoser = losingTrades.length > 0 
    ? -(totalLosses / losingTrades.length) 
    : 0;
  
  // Win rate
  const winRate = (winningTrades.length / strategyTrades.length) * 100;
  const lossRate = 100 - winRate;
  
  // Profit factor
  const profitFactor = totalLosses > 0 
    ? totalProfits / totalLosses 
    : (totalProfits > 0 ? Infinity : 0);
  
  // Expectancy = (Win Rate × Avg. Win) – (Loss Rate × Avg. Loss)
  // Note: avgLoser is negative, so we use Math.abs
  const expectancy = ((winRate / 100) * avgWinner) - ((lossRate / 100) * Math.abs(avgLoser));

  // Build a chronological cumulative series for the mini chart.
  const chrono = [...tradesWithMetrics]
    .filter(t => !!t.trade.closeDate)
    .sort((a, b) => new Date(a.trade.closeDate).getTime() - new Date(b.trade.closeDate).getTime());
  let running = 0;
  const cumulativeSeries = chrono.map((t, i) => {
    running += t.metrics.netPnl;
    return { x: i, y: running };
  });

  // Max drawdown (% from peak) on the cumulative curve.
  let peak = 0;
  let maxDdPct = 0;
  for (const pt of cumulativeSeries) {
    if (pt.y > peak) peak = pt.y;
    if (peak > 0) {
      const dd = ((peak - pt.y) / peak) * 100;
      if (dd > maxDdPct) maxDdPct = dd;
    }
  }

  // Monthly: current calendar month net P&L as % of total net (proxy).
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthNet = tradesWithMetrics
    .filter(t => t.trade.closeDate && new Date(t.trade.closeDate).getTime() >= monthStart)
    .reduce((s, t) => s + t.metrics.netPnl, 0);
  const monthlyReturnPct = Math.abs(totalNetPnL) > 0 ? (monthNet / Math.abs(totalNetPnL)) * 100 : 0;

  // Avg R (proxy): avg winner / |avg loser|.
  const avgR = Math.abs(avgLoser) > 0 ? avgWinner / Math.abs(avgLoser) : 0;

  const lastExecutionDate = chrono.length > 0 ? chrono[chrono.length - 1].trade.closeDate : null;

  return {
    totalTrades: strategyTrades.length,
    totalNetPnL,
    profitFactor: isFinite(profitFactor) ? profitFactor : 0,
    winRate,
    avgWinner,
    avgLoser,
    expectancy,
    sharedStrategies: '-', // Placeholder - for future multi-strategy feature
    monthlyReturnPct,
    avgR,
    maxDrawdownPct: maxDdPct,
    cumulativeSeries,
    lastExecutionDate,
  };
}
