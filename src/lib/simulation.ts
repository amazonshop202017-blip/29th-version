export type RiskMode = "percent" | "dollar";

export interface SimulationParams {
  winRate: number;
  riskReward: number;
  riskPerTrade: number;
  numberOfTrades: number;
  initialCapital: number;
  iterations: number;
  riskMode: RiskMode;
  avgWinDollar: number;
  avgLossDollar: number;
}

export interface PathStats {
  finalBalance: number;
  returnPct: number;
  maxDrawdown: number;
  maxConsecWins: number;
  maxConsecLosses: number;
  winPct: number;
}

export interface SimulationResult {
  paths: number[][];
  bestCase: number[];
  worstCase: number[];
  median: number[];
  bestStats: PathStats;
  worstStats: PathStats;
  medianStats: PathStats;
  globalStats: {
    profitablePct: number;
    expectedValue: number;
  };
}

function computePathStats(path: number[], trades: boolean[], initialCapital: number): PathStats {
  const finalBalance = path[path.length - 1];
  const returnPct = ((finalBalance - initialCapital) / initialCapital) * 100;

  let peak = path[0];
  let maxDrawdown = 0;
  for (const val of path) {
    if (val > peak) peak = val;
    if (peak > 0) {
      const dd = ((peak - val) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }

  let maxConsecWins = 0;
  let maxConsecLosses = 0;
  let curWins = 0;
  let curLosses = 0;
  let totalWins = 0;

  for (const isWin of trades) {
    if (isWin) {
      totalWins++;
      curWins++;
      curLosses = 0;
      if (curWins > maxConsecWins) maxConsecWins = curWins;
    } else {
      curLosses++;
      curWins = 0;
      if (curLosses > maxConsecLosses) maxConsecLosses = curLosses;
    }
  }

  const winPct = trades.length > 0 ? (totalWins / trades.length) * 100 : 0;

  return {
    finalBalance,
    returnPct,
    maxDrawdown,
    maxConsecWins,
    maxConsecLosses,
    winPct,
  };
}

export function runMonteCarlo(params: SimulationParams): SimulationResult {
  const {
    winRate, riskReward, riskPerTrade, numberOfTrades,
    initialCapital, iterations, riskMode, avgWinDollar, avgLossDollar,
  } = params;

  const winRateDecimal = winRate / 100;
  const riskDecimal = riskPerTrade / 100;

  const allPaths: number[][] = [];
  const allTrades: boolean[][] = [];

  for (let i = 0; i < iterations; i++) {
    const path: number[] = [initialCapital];
    const trades: boolean[] = [];
    let capital = initialCapital;

    for (let t = 0; t < numberOfTrades; t++) {
      const isWin = Math.random() < winRateDecimal;
      trades.push(isWin);

      if (riskMode === "dollar") {
        if (isWin) {
          capital += avgWinDollar;
        } else {
          capital -= avgLossDollar;
        }
      } else {
        if (isWin) {
          capital = capital * (1 + riskDecimal * riskReward);
        } else {
          capital = capital * (1 - riskDecimal);
        }
      }

      if (capital <= 0) {
        capital = 0;
        path.push(capital);
        break;
      }
      path.push(capital);
    }

    while (path.length < numberOfTrades + 1) {
      path.push(0);
    }

    allPaths.push(path);
    allTrades.push(trades);
  }

  const finalValues = allPaths.map(p => p[p.length - 1]);

  const bestIdx = allPaths.reduce((best, path, idx) =>
    path[path.length - 1] > allPaths[best][allPaths[best].length - 1] ? idx : best, 0);
  const worstIdx = allPaths.reduce((worst, path, idx) =>
    path[path.length - 1] < allPaths[worst][allPaths[worst].length - 1] ? idx : worst, 0);

  const sortedIndices = [...allPaths.keys()].sort((a, b) =>
    allPaths[a][allPaths[a].length - 1] - allPaths[b][allPaths[b].length - 1]
  );
  const medianRawIdx = sortedIndices[Math.floor(sortedIndices.length / 2)];

  const profitablePct = (finalValues.filter(v => v > initialCapital).length / iterations) * 100;

  let expectedValue: number;
  if (riskMode === "dollar") {
    expectedValue = winRateDecimal * avgWinDollar - (1 - winRateDecimal) * avgLossDollar;
  } else {
    expectedValue = winRateDecimal * riskDecimal * riskReward - (1 - winRateDecimal) * riskDecimal;
    expectedValue *= 100;
  }

  const displayPaths: number[][] = [];
  const step = Math.max(1, Math.floor(allPaths.length / 200));
  for (let i = 0; i < allPaths.length; i += step) {
    displayPaths.push(allPaths[i]);
  }

  return {
    paths: displayPaths,
    bestCase: allPaths[bestIdx],
    worstCase: allPaths[worstIdx],
    median: allPaths[medianRawIdx],
    bestStats: computePathStats(allPaths[bestIdx], allTrades[bestIdx], initialCapital),
    worstStats: computePathStats(allPaths[worstIdx], allTrades[worstIdx], initialCapital),
    medianStats: computePathStats(allPaths[medianRawIdx], allTrades[medianRawIdx], initialCapital),
    globalStats: {
      profitablePct,
      expectedValue,
    },
  };
}

export function buildChartData(result: SimulationResult, numberOfTrades: number) {
  const data = [];
  for (let i = 0; i <= numberOfTrades; i++) {
    const point: Record<string, number> = { trade: i };
    result.paths.forEach((path, idx) => {
      point[`path_${idx}`] = path[i] ?? path[path.length - 1];
    });
    point['best'] = result.bestCase[i] ?? result.bestCase[result.bestCase.length - 1];
    point['worst'] = result.worstCase[i] ?? result.worstCase[result.worstCase.length - 1];
    point['median'] = result.median[i] ?? result.median[result.median.length - 1];
    data.push(point);
  }
  return data;
}
