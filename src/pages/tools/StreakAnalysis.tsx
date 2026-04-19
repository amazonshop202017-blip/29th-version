import { useState, useCallback, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { runMonteCarlo, buildChartData, SimulationParams, SimulationResult, RiskMode } from "@/lib/simulation";

// ── Default params (1000 sims default for this page) ─────────────────────────
const DEFAULT_PARAMS: SimulationParams = {
  winRate: 55,
  riskReward: 2,
  riskPerTrade: 1,
  numberOfTrades: 100,
  initialCapital: 10000,
  iterations: 1000,
  riskMode: "percent",
  avgWinDollar: 200,
  avgLossDollar: 100,
};

// ── Streak table constants ────────────────────────────────────────────────────
const TRADE_COLS = [50, 100, 500, 1000];
const MAX_STREAK = 15;
type StreakCalcMode = "mathematical" | "simulation";

// ── Mathematical streak probability ──────────────────────────────────────────
function streakProbability(p: number, k: number, n: number): number {
  if (p <= 0 || k <= 0 || n < k) return 0;
  if (p >= 1) return 1;
  const f: number[] = new Array(n + 1).fill(0);
  for (let i = 0; i < k; i++) f[i] = 1;
  for (let i = k; i <= n; i++) {
    let sum = 0;
    for (let j = 1; j <= k; j++) sum += Math.pow(p, j - 1) * (1 - p) * f[i - j];
    f[i] = sum;
  }
  return Math.min(1, Math.max(0, 1 - f[n]));
}

// ── Simulation-based streak probability ──────────────────────────────────────
interface SimStreakData {
  losses: number[][];
  wins: number[][];
}

function computeStreakSim(winRate: number, iterations: number): SimStreakData {
  const p = winRate / 100;
  const cols = TRADE_COLS.length;
  const losses: number[][] = Array.from({ length: cols }, () => new Array(MAX_STREAK + 1).fill(0));
  const wins:   number[][] = Array.from({ length: cols }, () => new Array(MAX_STREAK + 1).fill(0));
  for (let ci = 0; ci < cols; ci++) {
    const n = TRADE_COLS[ci];
    const hitLoss = new Array(MAX_STREAK + 1).fill(0);
    const hitWin  = new Array(MAX_STREAK + 1).fill(0);
    for (let sim = 0; sim < iterations; sim++) {
      let maxL = 0, maxW = 0, curL = 0, curW = 0;
      for (let t = 0; t < n; t++) {
        if (Math.random() < p) { curW++; curL = 0; if (curW > maxW) maxW = curW; }
        else                   { curL++; curW = 0; if (curL > maxL) maxL = curL; }
      }
      for (let k = 1; k <= MAX_STREAK; k++) {
        if (maxL >= k) hitLoss[k]++;
        if (maxW >= k) hitWin[k]++;
      }
    }
    for (let k = 1; k <= MAX_STREAK; k++) {
      losses[ci][k] = hitLoss[k] / iterations;
      wins[ci][k]   = hitWin[k]  / iterations;
    }
  }
  return { losses, wins };
}

// ── Streak table color helpers ────────────────────────────────────────────────
function cellStyle(pct: number, invert: boolean) {
  const v = invert ? 1 - pct : pct;
  if (v >= 0.75) return { bg: "bg-rose-600/80",   text: "text-foreground" };
  if (v >= 0.50) return { bg: "bg-orange-500/75", text: "text-foreground" };
  if (v >= 0.25) return { bg: "bg-amber-400/70",  text: "text-foreground" };
  return              { bg: "bg-emerald-600/65", text: "text-foreground" };
}
function formatPct(v: number) { return (v * 100).toFixed(2) + "%"; }

// ── Streak table component ────────────────────────────────────────────────────
interface StreakTableProps {
  title: string; subtitle: string; p: number; invert: boolean;
  calcMode: StreakCalcMode; simData: SimStreakData | null; colIndex: "losses" | "wins";
}
function StreakTable({ title, subtitle, p, invert, calcMode, simData, colIndex }: StreakTableProps) {
  const rows: { streak: number; probs: number[] }[] = [];
  for (let k = 1; k <= MAX_STREAK; k++) {
    let probs: number[];
    if (calcMode === "mathematical") {
      probs = TRADE_COLS.map(n => streakProbability(p, k, n));
    } else {
      probs = simData
        ? TRADE_COLS.map((_, ci) => simData[colIndex][ci][k] ?? 0)
        : TRADE_COLS.map(() => 0);
    }
    if (k > 1 && probs.every(v => v < 0.001)) break;
    rows.push({ streak: k, probs });
  }
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-48">
                {invert ? "Wins in a row" : "Losses in a row"}
              </th>
              <th colSpan={TRADE_COLS.length} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-l border-border">
                Number of trades
              </th>
            </tr>
            <tr className="border-b border-border">
              <th className="px-6 py-2 text-left text-xs text-muted-foreground/80" />
              {TRADE_COLS.map(n => (
                <th key={n} className="px-4 py-2 text-center text-xs font-bold text-foreground/60 border-l border-border w-32">{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ streak, probs }) => (
              <tr key={streak} className="border-b border-border/50 last:border-0">
                <td className="px-6 py-2.5 text-center text-sm font-semibold text-foreground/70">{streak}</td>
                {probs.map((prob, ci) => {
                  const s = cellStyle(prob, invert);
                  return (
                    <td key={ci} className={`px-4 py-2.5 text-center text-xs font-bold border-l border-border ${s.bg} ${s.text}`}>
                      {formatPct(prob)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shared helpers (exact copy from MonteCarloPage) ───────────────────────────
function formatCurrency(val: number, compact = false) {
  if (compact) {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000)     return `$${(val / 1_000).toFixed(1)}K`;
  }
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface InputFieldProps {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  prefix?: string; suffix?: string; description?: string;
}
function InputField({ label, value, onChange, min, max, step = 1, prefix, suffix, description }: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{label}</label>
        {description && <span className="text-[10px] text-muted-foreground/80">{description}</span>}
      </div>
      <div className="flex items-center rounded-lg border border-border bg-muted/40 overflow-hidden focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
        {prefix && (
          <span className="px-3 py-2 text-sm text-muted-foreground border-r border-border bg-muted/30 select-none shrink-0">{prefix}</span>
        )}
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && min !== undefined && v < min) onChange(min); }}
          className="flex-1 px-3 py-2 text-sm font-medium text-foreground bg-transparent outline-none min-w-0"
        />
        {suffix && (
          <span className="px-3 py-2 text-xs text-muted-foreground border-l border-border bg-muted/30 select-none shrink-0">{suffix}</span>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) => {
  if (!active || !payload || !payload.length) return null;
  const filtered = payload.filter(p => ["best", "worst", "median"].includes(p.name));
  if (!filtered.length) return null;
  const labelMap: Record<string, string> = { best: "Best Case", worst: "Worst Case", median: "Most Possible" };
  return (
    <div className="rounded-xl border border-border bg-popover text-popover-foreground backdrop-blur-md p-3 shadow-2xl">
      <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Trade #{label}</p>
      {filtered.map(p => (
        <div key={p.name} className="flex items-center gap-2 text-sm mb-1 last:mb-0">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-foreground/65">{labelMap[p.name] ?? p.name}:</span>
          <span className="font-bold text-foreground ml-auto pl-4">{formatCurrency(p.value, true)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StreakAnalysis() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [chartData, setChartData] = useState<ReturnType<typeof buildChartData> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [pathKeys, setPathKeys] = useState<string[]>([]);
  const [iterInput, setIterInput] = useState("1000");

  // Streak table state
  const [calcMode, setCalcMode] = useState<StreakCalcMode>("mathematical");
  const [simData, setSimData]   = useState<SimStreakData | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const simCacheRef = useRef<{ winRate: number; iterations: number; data: SimStreakData } | null>(null);

  const setParam = useCallback(<K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const setRiskMode = useCallback((mode: RiskMode) => {
    setParams(prev => ({ ...prev, riskMode: mode }));
  }, []);

  // Streak simulation cache / recompute
  useEffect(() => {
    if (calcMode !== "simulation") { setSimData(null); setSimLoading(false); return; }
    const cache = simCacheRef.current;
    if (cache && cache.winRate === params.winRate && cache.iterations === params.iterations) {
      setSimData(cache.data); return;
    }
    setSimLoading(true);
    const id = setTimeout(() => {
      const data = computeStreakSim(params.winRate, params.iterations);
      simCacheRef.current = { winRate: params.winRate, iterations: params.iterations, data };
      setSimData(data);
      setSimLoading(false);
    }, 30);
    return () => clearTimeout(id);
  }, [calcMode, params.winRate, params.iterations]);

  const yDomain: [number, number] | undefined = result
    ? [
        result.worstCase.reduce((a, b) => Math.min(a, b), Infinity),
        result.bestCase.reduce((a, b) => Math.max(a, b), -Infinity),
      ]
    : undefined;

  const runSimulation = useCallback(() => {
    setIsRunning(true);
    setTimeout(() => {
      const res = runMonteCarlo(params);
      const data = buildChartData(res, params.numberOfTrades);
      const keys = res.paths.map((_, i) => `path_${i}`);
      setResult(res);
      setChartData(data);
      setPathKeys(keys);
      setIsRunning(false);
      if (calcMode === "simulation") {
        simCacheRef.current = null;
        setSimLoading(true);
        setTimeout(() => {
          const sd = computeStreakSim(params.winRate, params.iterations);
          simCacheRef.current = { winRate: params.winRate, iterations: params.iterations, data: sd };
          setSimData(sd);
          setSimLoading(false);
        }, 30);
      }
    }, 50);
  }, [params, calcMode]);

  const lossP = (100 - params.winRate) / 100;
  const winP  = params.winRate / 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1500px] mx-auto px-5 py-7">

        {/* Header */}
        <div className="flex items-center gap-3 mb-7 ml-[55px]">
          <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-rose-400">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
              <polyline points="17 18 23 18 23 12" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mb-0.5">Trading Journal</div>
            <h1 className="text-2xl font-bold text-foreground leading-none">Win/Loss Streak Simulator</h1>
          </div>
          <p className="ml-auto text-xs text-muted-foreground/80 max-w-xs text-right hidden lg:block">
            Visualize how winning and losing streaks affect your equity curve
          </p>
        </div>

        {/* ── TOP ROW: Inputs | Chart  (exact copy from MonteCarloPage) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 mb-4">

          {/* Inputs Card */}
          <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Strategy Inputs</div>

            <InputField
              label="Win Rate"
              value={params.winRate}
              onChange={v => setParam("winRate", Math.min(100, Math.max(0, v)))}
              min={0} max={100} step={0.5}
              suffix="%" description="% of profitable trades"
            />

            {/* Risk Per Trade toggle */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Risk Per Trade</span>
                <div className="flex rounded-md overflow-hidden border border-border text-[11px] font-semibold">
                  <button
                    onClick={() => setRiskMode("percent")}
                    className={`px-2.5 py-1 transition-colors ${params.riskMode === "percent" ? "bg-blue-600 text-white" : "bg-transparent text-muted-foreground hover:text-foreground/70"}`}
                  >
                    % Risk
                  </button>
                  <button
                    onClick={() => setRiskMode("dollar")}
                    className={`px-2.5 py-1 transition-colors border-l border-border ${params.riskMode === "dollar" ? "bg-blue-600 text-white" : "bg-transparent text-muted-foreground hover:text-foreground/70"}`}
                  >
                    $ Win/Loss
                  </button>
                </div>
              </div>

              {params.riskMode === "percent" ? (
                <>
                  <div className="flex items-center rounded-lg border border-border bg-muted/40 overflow-hidden focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
                    <input
                      type="number"
                      value={params.riskPerTrade}
                      min={1} max={100} step={1}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParam("riskPerTrade", v); }}
                      onBlur={e => { const v = parseFloat(e.target.value); setParam("riskPerTrade", isNaN(v) || v < 1 ? 1 : Math.min(100, v)); }}
                      className="flex-1 px-3 py-2 text-sm font-medium text-foreground bg-transparent outline-none min-w-0"
                    />
                    <span className="px-3 py-2 text-xs text-muted-foreground border-l border-border bg-muted/30 select-none shrink-0">% of capital</span>
                  </div>
                  <InputField
                    label="Risk Reward Ratio (1:X)"
                    value={params.riskReward}
                    onChange={v => setParam("riskReward", Math.max(0.1, v))}
                    min={0.1} step={0.1}
                    prefix="1:" description="reward per unit of risk"
                  />
                </>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center rounded-lg border border-border bg-muted/40 overflow-hidden focus-within:border-blue-500/50 transition-all">
                    <span className="px-3 py-2 text-xs text-muted-foreground border-r border-border bg-muted/30 select-none shrink-0">Avg Win</span>
                    <input
                      type="number" value={params.avgWinDollar} min={0.01} step={10}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setParam("avgWinDollar", v); }}
                      className="flex-1 px-3 py-2 text-sm font-medium text-foreground bg-transparent outline-none min-w-0"
                    />
                    <span className="px-3 py-2 text-xs text-muted-foreground border-l border-border bg-muted/30 select-none shrink-0">$</span>
                  </div>
                  <div className="flex items-center rounded-lg border border-border bg-muted/40 overflow-hidden focus-within:border-blue-500/50 transition-all">
                    <span className="px-3 py-2 text-xs text-muted-foreground border-r border-border bg-muted/30 select-none shrink-0">Avg Loss</span>
                    <input
                      type="number" value={params.avgLossDollar} min={0.01} step={10}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setParam("avgLossDollar", v); }}
                      className="flex-1 px-3 py-2 text-sm font-medium text-foreground bg-transparent outline-none min-w-0"
                    />
                    <span className="px-3 py-2 text-xs text-muted-foreground border-l border-border bg-muted/30 select-none shrink-0">$</span>
                  </div>
                </div>
              )}
            </div>

            <InputField
              label="Number of Trades"
              value={params.numberOfTrades}
              onChange={v => setParam("numberOfTrades", Math.max(1, Math.round(v)))}
              min={1} max={10000} description="trades per simulation path"
            />

            <InputField
              label="Initial Capital"
              value={params.initialCapital}
              onChange={v => setParam("initialCapital", Math.max(1, v))}
              min={1} step={100}
              prefix="$" description="starting balance"
            />

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Simulations</label>
                <span className="text-[10px] text-muted-foreground/80">number of paths</span>
              </div>
              <div className="flex items-center rounded-lg border border-border bg-muted/40 overflow-hidden focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
                <input
                  type="number"
                  value={iterInput}
                  min={1} max={20000} step={100}
                  onChange={e => {
                    setIterInput(e.target.value);
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v >= 1) setParam("iterations", v);
                  }}
                  onBlur={() => {
                    const v = parseInt(iterInput);
                    const clamped = isNaN(v) || v < 1 ? 1000 : Math.min(20000, v);
                    setIterInput(clamped.toString());
                    setParam("iterations", clamped);
                  }}
                  className="flex-1 px-3 py-2 text-sm font-medium text-foreground bg-transparent outline-none min-w-0"
                />
                <span className="px-3 py-2 text-xs text-muted-foreground border-l border-border bg-muted/30 select-none shrink-0">paths</span>
              </div>
            </div>

            <button
              onClick={runSimulation}
              disabled={isRunning}
              className="mt-1 w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-all duration-150 shadow-lg shadow-blue-500/15 flex items-center justify-center gap-2"
            >
              {isRunning ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                  </svg>
                  Simulating...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  Run Simulation
                </>
              )}
            </button>

            {/* EV pill */}
            {result && (
              <div className={`rounded-xl px-4 py-3 border text-center ${result.globalStats.expectedValue >= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"}`}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Expected Value / Trade</div>
                <div className={`text-base font-bold ${result.globalStats.expectedValue >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {params.riskMode === "dollar"
                    ? `${result.globalStats.expectedValue >= 0 ? "+" : ""}${formatCurrency(result.globalStats.expectedValue)}`
                    : `${result.globalStats.expectedValue >= 0 ? "+" : ""}${result.globalStats.expectedValue.toFixed(2)}%`}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {result.globalStats.profitablePct.toFixed(1)}% of paths profitable · {params.iterations.toLocaleString()} simulations
                </div>
              </div>
            )}
          </div>

          {/* Chart Card */}
          <div className="rounded-2xl border border-border bg-card p-5 flex flex-col min-h-[440px]">
            {!result && !isRunning && (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/60">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <p className="text-sm font-medium text-muted-foreground/80">Configure inputs and run the simulation</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Chart will appear here</p>
              </div>
            )}
            {isRunning && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <svg className="animate-spin w-9 h-9 mb-3 text-blue-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20" />
                </svg>
                <p className="text-sm text-muted-foreground">Running {params.iterations.toLocaleString()} simulations...</p>
              </div>
            )}
            {result && chartData && !isRunning && (
              <>
                <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Equity Curve Distribution</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{params.iterations.toLocaleString()} paths · {params.numberOfTrades} trades each</p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-emerald-400 inline-block rounded-full" />Best</span>
                    <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-blue-400 inline-block rounded-full" />Most Possible</span>
                    <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-rose-400 inline-block rounded-full" />Worst</span>
                    <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-muted-foreground/30 inline-block rounded-full" />Other paths</span>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 24, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="trade"
                        stroke="hsl(var(--border))"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        label={{ value: "Trade Number", position: "insideBottom", offset: -12, fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      />
                      <YAxis
                        stroke="hsl(var(--border))"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        tickFormatter={v => formatCurrency(v, true)}
                        width={70}
                        domain={yDomain}
                        allowDataOverflow={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine
                        y={params.initialCapital}
                        stroke="hsl(var(--border))"
                        strokeDasharray="4 4"
                        label={{ value: "Start", fill: "hsl(var(--muted-foreground))", fontSize: 9, position: "insideTopLeft" }}
                      />
                      {pathKeys.map(key => (
                        <Line key={key} dataKey={key} stroke="hsl(var(--muted-foreground) / 0.18)" dot={false} strokeWidth={1} isAnimationActive={false} legendType="none" activeDot={false} />
                      ))}
                      <Line dataKey="worst" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" activeDot={{ r: 3, fill: "#f43f5e" }} />
                      <Line dataKey="median" stroke="#60a5fa" strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" activeDot={{ r: 3, fill: "#60a5fa" }} />
                      <Line dataKey="best" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" activeDot={{ r: 3, fill: "#34d399" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── BOTTOM ROW: Streak Probability Tables ── */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-foreground/60">Streak Calculation Mode</span>
              {calcMode === "simulation" && (
                <span className="ml-3 text-[11px] text-muted-foreground/80">Simulations: {params.iterations.toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {calcMode === "simulation" && (
                <span className="text-[10px] text-muted-foreground/70 italic">Results may vary slightly due to randomness</span>
              )}
              <div className="flex rounded-md overflow-hidden border border-border text-[11px] font-semibold">
                <button
                  onClick={() => setCalcMode("mathematical")}
                  className={`px-3 py-1.5 transition-colors ${calcMode === "mathematical" ? "bg-blue-600 text-white" : "bg-transparent text-muted-foreground hover:text-foreground/70"}`}>
                  Mathematical
                </button>
                <button
                  onClick={() => setCalcMode("simulation")}
                  className={`px-3 py-1.5 transition-colors border-l border-border ${calcMode === "simulation" ? "bg-blue-600 text-white" : "bg-transparent text-muted-foreground hover:text-foreground/70"}`}>
                  Simulation
                </button>
              </div>
            </div>
          </div>

          {simLoading ? (
            <div className="rounded-2xl border border-border bg-card flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20" />
                </svg>
                <p className="text-sm text-muted-foreground">Running {params.iterations.toLocaleString()} streak simulations…</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <StreakTable
                title="Losing Streak Probability"
                subtitle={`Probability of at least X consecutive losses — loss rate ${(lossP * 100).toFixed(2)}%`}
                p={lossP} invert={false}
                calcMode={calcMode} simData={simData} colIndex="losses"
              />
              <StreakTable
                title="Winning Streak Probability"
                subtitle={`Probability of at least X consecutive wins — win rate ${params.winRate.toFixed(2)}%`}
                p={winP} invert={true}
                calcMode={calcMode} simData={simData} colIndex="wins"
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
