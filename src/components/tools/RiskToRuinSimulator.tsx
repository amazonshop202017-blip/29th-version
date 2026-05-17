import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, ReferenceLine } from 'recharts';

const formatPercent = (value: number) => {
  return value.toFixed(2) + '%';
};

interface SimulationResult {
  riskOfRuin: number;
  survivalRate: number;
  maxDrawdown: number;
  avgDrawdown: number;
  avgTradesBeforeRuin: number | string;
  worstCaseSequence: any[];
  distribution: any[];
}

export default function RiskToRuinSimulator() {
  const [startingBalance, setStartingBalance] = useState<number | string>(10000);
  const [winRate, setWinRate] = useState<number | string>(50);
  const [riskPerTrade, setRiskPerTrade] = useState<number | string>(2);
  const [rewardRisk, setRewardRisk] = useState<number | string>(1.5);
  const [targetDrawdown, setTargetDrawdown] = useState<number | string>(30);
  const [sizingStrategy, setSizingStrategy] = useState<string>('percentage');
  const [consecLossLimit, setConsecLossLimit] = useState<number | string>(0);
  const [numSimulations, setNumSimulations] = useState<number | string>(1000);

  const [results, setResults] = useState<SimulationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateRisk = () => {
    setIsCalculating(true);
    
    // Use a timeout to allow UI to update to "calculating" state before heavy CPU work
    setTimeout(() => {
      const MAX_TRADES = 10000;
      let ruinCount = 0;
      let totalMaxDrawdown = 0;
      let tradesBeforeRuinSum = 0;
      
      let worstMaxDrawdown = -1;
      let worstWins: boolean[] = [];
      
      const maxDrawdowns: number[] = [];
      
      const sb = Number(startingBalance) || 10000;
      const wr = Number(winRate) || 50;
      const rpt = Number(riskPerTrade) || 2;
      const rr = Number(rewardRisk) || 1.5;
      const td = Number(targetDrawdown) || 30;
      const cll = Number(consecLossLimit) || 0;
      const ns = Number(numSimulations) || 1000;

      for (let s = 0; s < ns; s++) {
        let balance = sb;
        let peak = sb;
        let consecLosses = 0;
        let currentMaxDrawdown = 0;
        
        const wins: boolean[] = [];
        
        for (let t = 1; t <= MAX_TRADES; t++) {
          let riskAmount = 0;
          if (sizingStrategy === 'percentage') {
            riskAmount = balance * (rpt / 100);
          } else {
            riskAmount = sb * (rpt / 100);
          }
          
          if (cll > 0 && consecLosses >= cll) {
            riskAmount = riskAmount / 2; // Half risk after consecutive losses
          }
          
          const isWin = Math.random() < (wr / 100);
          wins.push(isWin);
          
          if (isWin) {
            balance += riskAmount * rr;
            consecLosses = 0;
            if (balance > peak) peak = balance;
          } else {
            balance -= riskAmount;
            consecLosses++;
          }
          
          const currentDD = ((peak - balance) / peak) * 100;
          if (currentDD > currentMaxDrawdown) {
            currentMaxDrawdown = currentDD;
          }
          
          if (currentDD >= td) {
            tradesBeforeRuinSum += t;
            ruinCount++;
            break;
          }
        }
        
        maxDrawdowns.push(currentMaxDrawdown);
        totalMaxDrawdown += currentMaxDrawdown;
        
        if (currentMaxDrawdown > worstMaxDrawdown) {
          worstMaxDrawdown = currentMaxDrawdown;
          worstWins = wins;
        }
      }
      
      // Reconstruct the worst sequence using the wins of that specific simulation
      const worstSequence = [];
      let recBalance = sb;
      let recPeak = sb;
      let recConsecLosses = 0;
      for (let t = 1; t <= worstWins.length; t++) {
        let riskAmount = sizingStrategy === 'percentage' 
          ? recBalance * (rpt / 100) 
          : sb * (rpt / 100);
          
        if (cll > 0 && recConsecLosses >= cll) {
          riskAmount = riskAmount / 2;
        }
        
        const isWin = worstWins[t - 1];
        if (isWin) {
          recBalance += riskAmount * rr;
          recConsecLosses = 0;
          if (recBalance > recPeak) recPeak = recBalance;
        } else {
          recBalance -= riskAmount;
          recConsecLosses++;
        }
        
        const currentDD = ((recPeak - recBalance) / recPeak) * 100;
        worstSequence.push({ trade: t, drawdown: currentDD });
      }
      
      const ror = (ruinCount / ns) * 100;
      const survival = 100 - ror;
      const maxDD = Math.max(...maxDrawdowns);
      const avgDD = totalMaxDrawdown / ns;
      const avgTrades = ruinCount > 0 ? Math.round(tradesBeforeRuinSum / ruinCount) : 'N/A';
      
      // Calculate probability distribution (cumulative)
      const distribution = [];
      for (let i = 10; i <= 100; i += 10) {
        const count = maxDrawdowns.filter(dd => dd >= i).length;
        distribution.push({
          level: `${i}%`,
          probability: (count / ns) * 100
        });
        if (i > td && count === 0) {
           // If we've passed target drawdown and probability is 0, we can stop adding buckets or just show them as 0
        }
      }

      setResults({
        riskOfRuin: ror,
        survivalRate: survival,
        maxDrawdown: maxDD,
        avgDrawdown: avgDD,
        avgTradesBeforeRuin: avgTrades,
        worstCaseSequence: worstSequence,
        distribution: distribution
      });
      
      setIsCalculating(false);
    }, 50);
  };

  useEffect(() => {
    calculateRisk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getRiskLevel = (ror: number) => {
    if (ror < 5) return { label: 'Well / Low Risk', color: 'hsl(var(--profit))' };
    if (ror <= 20) return { label: 'Acceptable Risk', color: 'hsl(38 92% 50%)' };
    return { label: 'High Risk', color: 'hsl(var(--loss))' };
  };

  const getInterpretationText = (ror: number) => {
    if (ror < 5) return 'This risk level is well within professional standards. Your capital is well protected against normal variance.';
    if (ror <= 20) return 'This risk level is acceptable, but you may experience noticeable drawdowns. Ensure your psychology can handle it.';
    return 'This risk level is high. Consider reducing your risk per trade or improving your edge (win rate or reward/risk ratio).';
  };

  // Downsample worst case sequence if it's too large for Recharts to render smoothly
  const chartSequence = useMemo(() => {
    if (!results || !results.worstCaseSequence) return [];
    const seq = results.worstCaseSequence;
    if (seq.length <= 200) return seq;
    
    const step = Math.ceil(seq.length / 200);
    const downsampled = [];
    for (let i = 0; i < seq.length; i += step) {
      downsampled.push(seq[i]);
    }
    // ensure last point is included
    if (downsampled[downsampled.length - 1].trade !== seq[seq.length - 1].trade) {
      downsampled.push(seq[seq.length - 1]);
    }
    return downsampled;
  }, [results]);

  return (
    <div className="layout-grid" style={{ paddingBottom: '3rem' }}>
      <div className="panel">
        <h2 className="panel-title">Trading Parameters</h2>
        
        <div className="form-group">
          <label className="form-label">Starting Balance</label>
          <input 
            type="number" 
            className="form-input" 
            value={startingBalance} 
            onChange={e => setStartingBalance(e.target.value === '' ? '' : e.target.value)} 
            step="any" min="100"
          />
        </div>

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
          <label className="form-label">Risk Per Trade %</label>
          <input 
            type="number" 
            className="form-input" 
            value={riskPerTrade} 
            onChange={e => setRiskPerTrade(e.target.value === '' ? '' : e.target.value)}
            step="any" min="0.1"
          />
          <span className="form-help">Percentage of account risked per trade</span>
        </div>

        <div className="form-group">
          <label className="form-label">Reward/Risk Ratio</label>
          <input 
            type="number" 
            className="form-input" 
            value={rewardRisk} 
            onChange={e => setRewardRisk(e.target.value === '' ? '' : e.target.value)}
            step="any" min="0.1"
          />
          <span className="form-help">Ratio of potential reward to risk (e.g. 2 means you target 2x what you risk)</span>
        </div>

        <div className="form-group">
          <label className="form-label">Target Drawdown % (Ruin Definition)</label>
          <input 
            type="number" 
            className="form-input" 
            value={targetDrawdown} 
            onChange={e => setTargetDrawdown(e.target.value === '' ? '' : e.target.value)}
            step="any" min="1" max="100"
          />
          <span className="form-help">The percentage drop from peak that constitutes 'ruin'</span>
        </div>

        <div className="form-group">
          <label className="form-label">Position Sizing Strategy</label>
          <select 
            className="form-input" 
            value={sizingStrategy}
            onChange={e => setSizingStrategy(e.target.value)}
            style={{ appearance: 'auto' }}
          >
            <option value="percentage">Percentage of Balance</option>
            <option value="fixed">Fixed Amount</option>
          </select>
          <span className="form-help">Strategy for determining trade size</span>
        </div>

        <div className="form-group">
          <label className="form-label">Consecutive Loss Limit</label>
          <input 
            type="number" 
            className="form-input" 
            value={consecLossLimit} 
            onChange={e => setConsecLossLimit(e.target.value === '' ? '' : e.target.value)}
            step="any" min="0"
          />
          <span className="form-help">Reduce position size after this many consecutive losses (0 = no limit)</span>
        </div>

        <div className="form-group">
          <label className="form-label">Number of Simulations</label>
          <input 
            type="number" 
            className="form-input" 
            value={numSimulations} 
            onChange={e => setNumSimulations(e.target.value === '' ? '' : e.target.value)}
            step="any" min="100" max="10000"
          />
          <span className="form-help">More simulations = more accurate results but slower calculation</span>
        </div>

        <button 
          className="btn-primary" 
          onClick={calculateRisk}
          disabled={isCalculating}
          style={{ opacity: isCalculating ? 0.7 : 1, cursor: isCalculating ? 'wait' : 'pointer' }}
        >
          {isCalculating ? 'CALCULATING...' : 'CALCULATE RISK'}
        </button>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem' }}>
          Need a better trading strategy? <a href="#" style={{ color: '#fff', textDecoration: 'underline' }}>Take our quiz</a> to compare 75K+ trading strategies & learn with AI
        </div>
      </div>

      {results && (
        <div>
          <h2 className="panel-title">Risk Analysis Results</h2>
          
          <div className="results-grid-2">
            <div className="panel" style={{ padding: '1.25rem', border: '1px solid var(--border)' }}>
              <div className="result-title">Risk of Ruin ({targetDrawdown}% Drawdown)</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: getRiskLevel(results.riskOfRuin).color, marginBottom: '0.5rem' }}>
                {formatPercent(results.riskOfRuin)}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#fff' }}>
                {getRiskLevel(results.riskOfRuin).label}
              </div>
            </div>
            
            <div className="panel" style={{ padding: '1.25rem', border: '1px solid var(--border)' }}>
              <div className="result-title">Survival Rate</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)', marginBottom: '0.5rem' }}>
                {formatPercent(results.survivalRate)}
              </div>
            </div>
          </div>

          <div className="results-grid">
            <div className="panel" style={{ padding: '1rem', border: '1px solid var(--border)' }}>
              <div className="result-title">Maximum Drawdown</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--danger)' }}>
                {formatPercent(results.maxDrawdown)}
              </div>
            </div>
            <div className="panel" style={{ padding: '1rem', border: '1px solid var(--border)' }}>
              <div className="result-title">Average Drawdown</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
                {formatPercent(results.avgDrawdown)}
              </div>
            </div>
            <div className="panel" style={{ padding: '1rem', border: '1px solid var(--border)' }}>
              <div className="result-title">Avg. Trades Before Ruin</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
                {results.avgTradesBeforeRuin}
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: '2rem', border: '1px solid var(--border)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#fff', marginBottom: '1rem' }}>Interpretation</h3>
            <p style={{ color: '#d1d5db', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              With a {winRate}% win rate, risking {riskPerTrade}% per trade, and a {rewardRisk}:1 reward-to-risk ratio, your probability of experiencing a {targetDrawdown}% drawdown is <strong>{formatPercent(results.riskOfRuin)}</strong>.
            </p>
            <p style={{ color: getRiskLevel(results.riskOfRuin).color, fontSize: '0.9rem', fontWeight: 500 }}>
              {getInterpretationText(results.riskOfRuin)}
            </p>
          </div>
          
          <div className="results-grid" style={{ gridTemplateColumns: '1fr', gap: '2rem' }}>
            {/* CSS hack for responsive grid inline */}
            <style>{`
              .charts-wrapper { display: grid; grid-template-columns: 1fr; gap: 2rem; margin-bottom: 2rem; }
              @media (min-width: 768px) { .charts-wrapper { grid-template-columns: 1fr 1fr; } }
              .recharts-cartesian-axis-tick-value { fill: #a0a0a0; font-size: 10px; }
            `}</style>
            
            <div className="charts-wrapper">
              <div>
                <h3 style={{ fontSize: '1rem', color: '#fff', textAlign: 'center', marginBottom: '1rem' }}>Worst Case Drawdown Sequence</h3>
                <div style={{ height: '250px', width: '100%', backgroundColor: 'var(--bg-dark)', padding: '1rem', borderRadius: '0.25rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartSequence} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis 
                        dataKey="trade" 
                        tick={{ fill: '#a0a0a0', fontSize: 10 }}
                        tickFormatter={(val) => val}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={30}
                      />
                      <YAxis 
                        tick={{ fill: '#a0a0a0', fontSize: 10 }}
                        tickFormatter={(val) => `${val}%`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)', color: '#fff' }}
                        itemStyle={{ color: '#ef4444' }}
                        formatter={(val: any) => {
                          if (val === undefined || val === null) return ['', 'Drawdown %'];
                          return [`${Number(val).toFixed(2)}%`, 'Drawdown %'];
                        }}
                        labelFormatter={(label) => `Trade ${label}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="drawdown" 
                        stroke="#ef4444" 
                        fill="#ef4444" 
                        fillOpacity={0.8}
                        name="Drawdown %"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1rem', color: '#fff', textAlign: 'center', marginBottom: '1rem' }}>Drawdown Probability Distribution</h3>
                <div style={{ height: '250px', width: '100%', backgroundColor: 'var(--bg-dark)', padding: '1rem', borderRadius: '0.25rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={results.distribution} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis 
                        dataKey="level" 
                        tick={{ fill: '#a0a0a0', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: '#a0a0a0', fontSize: 10 }}
                        tickFormatter={(val) => `${val}%`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)', color: '#fff' }}
                        itemStyle={{ color: '#f59e0b' }}
                        formatter={(val: any) => {
                          if (val === undefined || val === null) return ['', 'Probability %'];
                          return [`${Number(val).toFixed(2)}%`, 'Probability %'];
                        }}
                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                      />
                      <ReferenceLine y={5} stroke="var(--success)" strokeDasharray="3 3" label={{ value: 'Low Risk (5%)', fill: 'var(--success)', position: 'insideBottomLeft', fontSize: 10 }} />
                      <ReferenceLine y={20} stroke="var(--danger)" strokeDasharray="3 3" label={{ value: 'High Risk (20%)', fill: 'var(--danger)', position: 'insideBottomLeft', fontSize: 10 }} />
                      <Bar 
                        dataKey="probability" 
                        fill="#f59e0b" 
                        name="Probability %"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <div className="article-text" style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.125rem', color: '#fff', marginBottom: '1rem' }}>How to Reduce Your Risk of Ruin</h3>
            <ul style={{ paddingLeft: '1.5rem', color: '#d1d5db', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li><strong>Reduce position size:</strong> Decreasing your risk per trade from {riskPerTrade}% to {(Number(riskPerTrade) / 2).toFixed(1)}% could significantly lower your risk of ruin.</li>
              <li><strong>Improve win rate:</strong> Working to increase your win rate through better trade selection.</li>
              <li><strong>Increase reward/risk ratio:</strong> Targeting larger profits relative to your risk can compensate for a lower win rate.</li>
              <li><strong>Use a stop-loss strategy:</strong> Implement a consecutive loss limit to reduce position size after a string of losses.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
