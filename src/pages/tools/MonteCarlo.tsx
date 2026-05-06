import { useState, useCallback, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useStatsFromTrades } from "@/hooks/useStatsFromTrades";
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
import { runMonteCarlo, buildChartData, SimulationParams, SimulationResult, PathStats, RiskMode } from "@/lib/simulation";

const DEFAULT_PARAMS: SimulationParams = {
  winRate: 55,
  riskReward: 2,
  riskPerTrade: 1,
  numberOfTrades: 100,
  initialCapital: 10000,
  iterations: 100,
  riskMode: "percent",
  avgWinDollar: 200,
  avgLossDollar: 100,
};

function formatCurrency(val: number, compact = false) {
  if (compact) {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  }
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  description?: string;
  disabled?: boolean;
}

function InputField({ label, value, onChange, min, max, step = 1, prefix, suffix, description, disabled }: InputFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${disabled ? "opacity-70" : ""}`}>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{label}</label>
        {description && <span className="text-[10px] text-muted-foreground/80">{description}</span>}
      </div>
      <div className={`flex items-center rounded-lg border border-border bg-muted/40 overflow-hidden transition-all ${disabled ? "cursor-not-allowed" : "focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20"}`}>
        {prefix && (
          <span className="px-3 py-2 text-sm text-muted-foreground border-r border-border bg-muted/30 select-none shrink-0">{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
          onBlur={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && min !== undefined && v < min) onChange(min);
          }}
          className={`flex-1 px-3 py-2 text-sm font-medium text-foreground bg-transparent outline-none min-w-0 ${disabled ? "cursor-not-allowed" : ""}`}
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

const colorMap = {
  green: {
    border: "border-emerald-500/25",
    headerBg: "bg-emerald-500/8",
    dot: "bg-emerald-400",
    label: "text-emerald-400",
    accent: "text-emerald-300",
    line: "bg-emerald-400",
  },
  blue: {
    border: "border-blue-500/25",
    headerBg: "bg-blue-500/8",
    dot: "bg-blue-400",
    label: "text-blue-400",
    accent: "text-blue-300",
    line: "bg-blue-400",
  },
  red: {
    border: "border-rose-500/25",
    headerBg: "bg-rose-500/8",
    dot: "bg-rose-400",
    label: "text-rose-400",
    accent: "text-rose-300",
    line: "bg-rose-400",
  },
};

function MetricRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${valueClass ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

function CaseMetricsCard({ label, color, stats, initialCapital }: { label: string; color: "green" | "blue" | "red"; stats: PathStats; initialCapital: number }) {
  const c = colorMap[color];
  const returnPositive = stats.returnPct >= 0;
  return (
    <div className={`rounded-2xl border ${c.border} overflow-hidden`}>
      <div className={`${c.headerBg} px-5 py-3.5 flex items-center gap-2.5 border-b ${c.border}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} />
        <span className={`text-xs font-bold uppercase tracking-widest ${c.label}`}>{label}</span>
        <span className={`ml-auto text-lg font-bold ${c.accent}`}>{formatCurrency(stats.finalBalance)}</span>
      </div>
      <div className="px-5 bg-muted/20">
        <MetricRow label="Initial Balance" value={formatCurrency(initialCapital)} valueClass="text-foreground/70" />
        <MetricRow label="Result Balance" value={formatCurrency(stats.finalBalance)} valueClass={c.accent} />
        <MetricRow
          label="Return % (whole period)"
          value={`${returnPositive ? "+" : ""}${stats.returnPct.toFixed(1)}%`}
          valueClass={returnPositive ? "text-emerald-400" : "text-rose-400"}
        />
        <MetricRow label="Maximum Drawdown" value={`-${stats.maxDrawdown.toFixed(1)}%`} valueClass="text-rose-400" />
        <MetricRow label="Max Consecutive Losses" value={stats.maxConsecLosses.toString()} valueClass="text-rose-300" />
        <MetricRow label="Max Consecutive Wins" value={stats.maxConsecWins.toString()} valueClass="text-emerald-300" />
        <MetricRow
          label="Win Trades %"
          value={`${stats.winPct.toFixed(1)}%`}
          valueClass={stats.winPct >= 50 ? "text-emerald-300" : "text-rose-300"}
        />
      </div>
    </div>
  );
}

export default function MonteCarlo() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [chartData, setChartData] = useState<ReturnType<typeof buildChartData> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [pathKeys, setPathKeys] = useState<string[]>([]);
  const [iterInput, setIterInput] = useState("100");
  const [useMyStats, setUseMyStats] = useState(false);
  const liveStats = useStatsFromTrades();

  const setParam = useCallback(<K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const setRiskMode = useCallback((mode: RiskMode) => {
    setParams(prev => ({ ...prev, riskMode: mode }));
  }, []);

  // Sync params from filtered trade stats while toggle is on
  useEffect(() => {
    if (!useMyStats || !liveStats.hasData) return;
    setParams(prev => ({
      ...prev,
      riskMode: "dollar",
      winRate: Number(liveStats.winRate.toFixed(2)),
      avgWinDollar: Number(liveStats.avgWin.toFixed(2)),
      avgLossDollar: Number(liveStats.avgLoss.toFixed(2)),
      riskReward: Number(liveStats.riskReward.toFixed(2)),
    }));
  }, [useMyStats, liveStats.hasData, liveStats.winRate, liveStats.avgWin, liveStats.avgLoss, liveStats.riskReward]);

  const locked = useMyStats;

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
    }, 50);
  }, [params]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1500px] mx-auto px-5 py-7">

        {/* Header */}
        <div className="flex items-center gap-3 mb-7 ml-[55px]">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-0.5">Trading Journal</div>
            <h1 className="text-2xl font-bold text-foreground leading-none">Monte Carlo Simulation</h1>
          </div>
          <p className="ml-auto text-xs text-muted-foreground/80 max-w-xs text-right hidden lg:block">
            Probabilistic analysis across thousands of randomized trading paths
          </p>
        </div>

        {/* ── TOP ROW: Inputs | Chart ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 mb-4">

          {/* Inputs Card */}
          <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Strategy Inputs</div>

            {/* Use My Stats toggle */}
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">Use My Stats</span>
                <Switch checked={useMyStats} onCheckedChange={setUseMyStats} />
              </div>
              <span className="text-[10px] text-muted-foreground/80">
                {useMyStats
                  ? (liveStats.hasData
                      ? "Synced from your filtered trades"
                      : "Not enough trade data — enable filters or add trades")
                  : "Auto-fill inputs from your filtered trades"}
              </span>
            </div>

            <InputField
              label="Win Rate"
              value={params.winRate}
              onChange={v => setParam("winRate", Math.min(100, Math.max(0, v)))}
              min={0} max={100} step={0.5}
              suffix="%" description="% of profitable trades"
              disabled={locked}
            />

            {/* Risk Per Trade toggle */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Risk Per Trade</span>
                <div className={`flex rounded-md overflow-hidden border border-border text-[11px] font-semibold ${locked ? "opacity-60 pointer-events-none" : ""}`}>
                  <button
                    onClick={() => setRiskMode("percent")}
                    disabled={locked}
                    className={`px-2.5 py-1 transition-colors ${params.riskMode === "percent" ? "bg-blue-600 text-white" : "bg-transparent text-muted-foreground hover:text-foreground/70"}`}
                  >
                    % Risk
                  </button>
                  <button
                    onClick={() => setRiskMode("dollar")}
                    disabled={locked}
                    className={`px-2.5 py-1 transition-colors border-l border-border ${params.riskMode === "dollar" ? "bg-blue-600 text-white" : "bg-transparent text-muted-foreground hover:text-foreground/70"}`}
                  >
                    $ Win/Loss
                  </button>
                </div>
              </div>

              {params.riskMode === "percent" ? (
                <>
                  <div className={`flex items-center rounded-lg border border-border bg-muted/40 overflow-hidden transition-all ${locked ? "opacity-70 cursor-not-allowed" : "focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20"}`}>
                    <input
                      type="number"
                      value={params.riskPerTrade}
                      min={1} max={100} step={1}
                      disabled={locked}
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
                    disabled={locked}
                  />
                </>
              ) : (
                <div className={`flex flex-col gap-1.5 ${locked ? "opacity-70" : ""}`}>
                  <div className={`flex items-center rounded-lg border border-border bg-muted/40 overflow-hidden transition-all ${locked ? "cursor-not-allowed" : "focus-within:border-blue-500/50"}`}>
                    <span className="px-3 py-2 text-xs text-muted-foreground border-r border-border bg-muted/30 select-none shrink-0">Avg Win</span>
                    <input
                      type="number" value={params.avgWinDollar} min={0.01} step={10}
                      disabled={locked}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setParam("avgWinDollar", v); }}
                      className="flex-1 px-3 py-2 text-sm font-medium text-foreground bg-transparent outline-none min-w-0"
                    />
                    <span className="px-3 py-2 text-xs text-muted-foreground border-l border-border bg-muted/30 select-none shrink-0">$</span>
                  </div>
                  <div className={`flex items-center rounded-lg border border-border bg-muted/40 overflow-hidden transition-all ${locked ? "cursor-not-allowed" : "focus-within:border-blue-500/50"}`}>
                    <span className="px-3 py-2 text-xs text-muted-foreground border-r border-border bg-muted/30 select-none shrink-0">Avg Loss</span>
                    <input
                      type="number" value={params.avgLossDollar} min={0.01} step={10}
                      disabled={locked}
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
                    const clamped = isNaN(v) || v < 1 ? 100 : Math.min(20000, v);
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

            {/* EV pill — shown after run */}
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

        {/* ── BOTTOM ROW: Best | Most Possible | Worst ── */}
        {result && !isRunning && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CaseMetricsCard label="Best Case" color="green" stats={result.bestStats} initialCapital={params.initialCapital} />
            <CaseMetricsCard label="Most Possible" color="blue" stats={result.medianStats} initialCapital={params.initialCapital} />
            <CaseMetricsCard label="Worst Case" color="red" stats={result.worstStats} initialCapital={params.initialCapital} />
          </div>
        )}

      </div>
    </div>
  );
}
