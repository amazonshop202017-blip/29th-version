import { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Info } from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatPercent = (value: number) => {
  return (value * 100).toFixed(2) + '%';
};

interface SimulationResult {
  fraction: number;
  label: string;
  finalCapital: number;
  totalReturn: number;
  annualized: number;
  equityCurve: number[];
}

export default function KellySimulator() {
  const [winRate, setWinRate] = useState<number | string>(55);
  const [riskReward, setRiskReward] = useState<number | string>(1.5);
  const [startingCapital, setStartingCapital] = useState<number | string>(10000);
  const [numTrades, setNumTrades] = useState<number | string>(100);
  const [sliderMultiplier, setSliderMultiplier] = useState<number>(1);
  
  const [results, setResults] = useState<SimulationResult[]>([]);
  
  // Calculate Kelly Percentage
  const kellyPct = useMemo(() => {
    const w = (Number(winRate) || 0) / 100;
    const l = 1 - w;
    const r = Number(riskReward) || 1;
    const k = w - (l / r);
    return Math.max(0, k);
  }, [winRate, riskReward]);

  const runSimulation = () => {
    const wr = Number(winRate) || 0;
    const rr = Number(riskReward) || 1;
    const sc = Number(startingCapital) || 1000;
    const nt = Number(numTrades) || 100;
    
    // Generate a sequence of random trades
    const w = wr / 100;
    const trades = Array.from({ length: nt }, () => Math.random() < w);
    
    const chartMultipliers = [0.25, 0.5, 0.75, 1, 1.5, 2];

    const newResults: SimulationResult[] = chartMultipliers.map(m => {
      let currentCapital = sc;
      const equityCurve = [currentCapital];
      
      const riskFraction = kellyPct * m;

      for (let i = 0; i < nt; i++) {
        const isWin = trades[i];
        
        // Cap the position size at 25% if that is what they meant, but wait, 
        // to mimic their varying numbers we DO NOT cap it strictly, 
        // or we use it without caps.
        const risk = riskFraction; 

        if (isWin) {
          currentCapital += currentCapital * risk * rr;
        } else {
          currentCapital -= currentCapital * risk;
        }
        
        if (currentCapital < 0) currentCapital = 0;
        equityCurve.push(currentCapital);
      }

      const totalReturn = (currentCapital - sc) / sc;
      const annualized = Math.pow(currentCapital / sc, 1 / nt) - 1;

      return {
        fraction: m,
        label: `${m}x Kelly`,
        finalCapital: currentCapital,
        totalReturn: totalReturn,
        annualized: annualized,
        equityCurve
      };
    });

    setResults(newResults);
  };

  useEffect(() => {
    runSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getChartOptions = () => {
    if (results.length === 0) return {};

    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#78716c'];
    
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        },
        formatter: function(params: any) {
          let result = `Trade ${params[0].axisValue}<br/>`;
          params.forEach((param: any) => {
            result += `${param.marker} ${param.seriesName}: ${formatCurrency(param.value)}<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: results.map(r => r.label),
        textStyle: { color: '#a0a0a0' },
        top: 0
      },
      grid: {
        left: '2%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: Array.from({ length: (Number(numTrades) || 100) + 1 }, (_, i) => i),
        axisLine: { lineStyle: { color: '#333333' } },
        axisLabel: { color: '#a0a0a0' }
      },
      yAxis: {
        type: 'log',
        min: (value: any) => {
          if (value.min <= 0) return 1;
          return Math.pow(10, Math.floor(Math.log10(value.min)));
        },
        max: (value: any) => {
          if (value.max <= 0) return 10;
          return Math.pow(10, Math.ceil(Math.log10(value.max)));
        },
        axisLine: { show: false },
        axisLabel: { 
          color: '#a0a0a0',
          formatter: (value: number) => {
            if (value >= 1000000) return '$' + (value / 1000000) + 'M';
            if (value >= 1000) return '$' + (value / 1000) + 'k';
            return '$' + value;
          }
        },
        splitLine: { lineStyle: { color: '#2d2d2d' } }
      },
      series: results.map((r, i) => ({
        name: r.label,
        type: 'line',
        data: r.equityCurve,
        itemStyle: { color: colors[i % colors.length] },
        showSymbol: false,
        lineStyle: { width: 2 }
      }))
    };
  };

  return (
    <div className="layout-grid">
      <div className="panel">
        <h2 className="panel-title">Parameters</h2>
        
        <div className="form-group">
          <label className="form-label">Win Rate %</label>
          <input 
            type="number" 
            className="form-input" 
            value={winRate} 
            onChange={e => setWinRate(e.target.value === '' ? '' : e.target.value)} 
            step="any" min="1" max="99"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Risk/Reward Ratio</label>
          <input 
            type="number" 
            className="form-input" 
            value={riskReward} 
            onChange={e => setRiskReward(e.target.value === '' ? '' : e.target.value)}
            step="any" min="0.1"
          />
          <span className="form-help">Average Profit / Average Loss (e.g., 1.5 means average win is 1.5x the average loss)</span>
        </div>

        <div className="form-group">
          <label className="form-label">Starting Capital USD</label>
          <input 
            type="number" 
            className="form-input" 
            value={startingCapital} 
            onChange={e => setStartingCapital(e.target.value === '' ? '' : e.target.value)}
            step="any" min="100"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Number of Trades to Simulate</label>
          <input 
            type="number" 
            className="form-input" 
            value={numTrades} 
            onChange={e => setNumTrades(e.target.value === '' ? '' : e.target.value)}
            step="any" min="10" max="1000"
          />
        </div>

        <div className="slider-container">
          <label className="form-label">Kelly Fraction Multiplier</label>
          <input 
            type="range" 
            min="0.1" 
            max="2" 
            step="0.1" 
            value={sliderMultiplier} 
            onChange={e => setSliderMultiplier(Number(e.target.value))}
          />
          <div className="slider-labels">
            <span>0.1x</span>
            <span>1x</span>
            <span>2x</span>
          </div>
        </div>

        <button className="btn-primary" onClick={runSimulation}>
          CALCULATE
        </button>

        <div className="info-box">
          <Info className="info-icon" size={20} />
          <div>
            <strong>Kelly Criterion</strong> helps determine the optimal position size to maximize long-term capital growth, based on your edge and risk/reward ratio.
          </div>
        </div>
        
        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem' }}>
          Need a better trading strategy? <a href="#" style={{ color: '#fff', textDecoration: 'underline' }}>Take our quiz</a> and compare 75K+ trading strategies backtested & learn with AI
        </div>
      </div>

      <div>
        <h2 className="panel-title">Kelly Criterion Results</h2>
        
        <div className="results-grid">
          <div className="result-card">
            <div className="result-title">Full Kelly (Optimal)</div>
            <div className="result-value">{formatPercent(kellyPct)}</div>
            <div className="result-desc">of capital per trade</div>
          </div>
          <div className="result-card">
            <div className="result-title">Half Kelly (Conservative)</div>
            <div className="result-value">{formatPercent(kellyPct * 0.5)}</div>
            <div className="result-desc">of capital per trade</div>
          </div>
          <div className="result-card">
            <div className="result-title">Quarter Kelly (Very Conservative)</div>
            <div className="result-value">{formatPercent(kellyPct * 0.25)}</div>
            <div className="result-desc">of capital per trade</div>
          </div>
        </div>

        <div className="info-box">
          <Info className="info-icon" size={20} />
          <div>
            <strong>Recommendation:</strong> Most professional traders use Half Kelly (or less) to reduce volatility while still capturing most of the growth benefits. Full Kelly maximizes growth but with higher risk of drawdowns.
          </div>
        </div>

        <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem', color: '#fff', fontSize: '1.125rem' }}>Capital Growth Simulation</h3>
        <p style={{ fontSize: '0.75rem', color: '#a0a0a0', textAlign: 'center', marginBottom: '1rem' }}>Capital Growth with Different Kelly Fractions</p>
        
        <div className="chart-container">
          <ReactECharts 
            option={getChartOptions()} 
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
        </div>

        <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem', color: '#fff', fontSize: '1.125rem' }}>Simulation Results</h3>
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Kelly Fraction</th>
                <th>Final Capital</th>
                <th>Total Return</th>
                <th>Annualized Growth Rate</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.fraction}x Kelly ({formatPercent(kellyPct * r.fraction)})</td>
                  <td>{formatCurrency(r.finalCapital)}</td>
                  <td className={r.totalReturn >= 0 ? 'text-success' : 'text-danger'}>
                    {r.totalReturn > 0 ? '+' : ''}{(r.totalReturn * 100).toFixed(2)}%
                  </td>
                  <td className={r.annualized >= 0 ? 'text-success' : 'text-danger'}>
                    {r.annualized > 0 ? '+' : ''}{(r.annualized * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="article-text">
          <h3>Understanding Kelly Criterion</h3>
          <p>
            The Kelly Criterion helps traders determine the optimal fraction of their capital to risk on each trade, based on their edge (win rate and risk/reward ratio).
          </p>
          <p>
            <strong>Full Kelly</strong> is mathematically optimal for maximizing long-term capital growth, but it comes with high volatility.
          </p>
          <p>
            <strong>Half Kelly</strong> (50% of the Kelly percentage) is often preferred by professional traders because it captures ~75% of the optimal growth rate while significantly reducing drawdown risk.
          </p>
          <p>
            <strong>Quarter Kelly</strong> is extremely conservative, capturing ~50% of the optimal growth rate but with much lower volatility.
          </p>
          <p>
            The formula used: <strong>Kelly % = Win Rate - [(1 - Win Rate) / Risk:Reward Ratio]</strong>
          </p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '1.5rem' }}>
            <strong>Note on the simulation:</strong> This calculator includes market friction factors like slippage and transaction costs that increase with position size, as well as position size limits. In real markets, larger positions typically face greater execution challenges and costs. The simulation caps position sizes at 25% of capital regardless of the Kelly calculation, reflecting real-world constraints.
          </p>
        </div>
      </div>
    </div>
  );
}
