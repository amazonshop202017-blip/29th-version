import { useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { prepareExitTrades, computeHeatmap, computeSLSweep, computeTPSweep, HeatmapCell, SweepPoint } from '@/lib/exitAnalyzerCalc';
import { Info, X, Zap, PenLine, Lightbulb } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, Cell as RechartsCell,
  LineChart, Line
} from 'recharts';

const subTabs = [
  { id: 'auto', label: 'Auto', icon: Zap },
  { id: 'manual', label: 'Manual', icon: PenLine },
];

// ─── Inputs Section ───
const InputField = ({ label, value, onChange, min }: {
  label: string; value: number; onChange: (v: number) => void; min?: number;
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
    <input
      type="number"
      value={value}
      min={min ?? 1}
      onChange={e => onChange(Number(e.target.value))}
      className="h-9 w-24 rounded-md border border-border bg-secondary px-2 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
    />
  </div>
);

// ─── Color helper ───
function cellColor(expectancy: number): string {
  if (expectancy > 0.5) return 'hsl(142 76% 35%)';
  if (expectancy > 0.2) return 'hsl(142 76% 25%)';
  if (expectancy > 0) return 'hsl(142 76% 18%)';
  if (expectancy === 0) return 'hsl(222 47% 14%)';
  if (expectancy > -0.2) return 'hsl(0 84% 18%)';
  if (expectancy > -0.5) return 'hsl(0 84% 25%)';
  return 'hsl(0 84% 35%)';
}

function cellTextColor(expectancy: number): string {
  if (Math.abs(expectancy) > 0.2) return 'hsl(210 40% 98%)';
  return 'hsl(215 20% 55%)';
}

// ─── Manual Exit Tab ───
const ManualExitTab = () => {
  const { filteredTrades } = useFilteredTrades();

  // Inputs
  const [fixedTP, setFixedTP] = useState(20);
  const [fixedSL, setFixedSL] = useState(10);
  const [slRangeMin, setSlRangeMin] = useState(5);
  const [slRangeMax, setSlRangeMax] = useState(50);
  const [slStep, setSlStep] = useState(1);
  const [tpRangeMin, setTpRangeMin] = useState(5);
  const [tpRangeMax, setTpRangeMax] = useState(80);
  const [tpStep, setTpStep] = useState(1);
  const [optimiseMetric, setOptimiseMetric] = useState<'winrate' | 'expectancy'>('expectancy');
  const [treatMissingAsZero, setTreatMissingAsZero] = useState(true);
  const [minTradeCount, setMinTradeCount] = useState(1);

  // Quick calculator
  const [quickSL, setQuickSL] = useState(10);
  const [quickTP, setQuickTP] = useState(20);

  // Draggable selection
  const [selectedSL, setSelectedSL] = useState<number | null>(null);
  const [selectedTP, setSelectedTP] = useState<number | null>(null);

  const exitTrades = useMemo(
    () => prepareExitTrades(filteredTrades, treatMissingAsZero),
    [filteredTrades, treatMissingAsZero]
  );

  const slSweep = useMemo(
    () => computeSLSweep(exitTrades, fixedTP, slRangeMin, slRangeMax, slStep).filter(p => p.tradesCount >= minTradeCount),
    [exitTrades, fixedTP, slRangeMin, slRangeMax, slStep, minTradeCount]
  );

  const tpSweep = useMemo(
    () => computeTPSweep(exitTrades, fixedSL, tpRangeMin, tpRangeMax, tpStep).filter(p => p.tradesCount >= minTradeCount),
    [exitTrades, fixedSL, tpRangeMin, tpRangeMax, tpStep, minTradeCount]
  );

  // Quick calculator computation
  const quickResult = useMemo(() => {
    if (exitTrades.length === 0 || quickSL <= 0 || quickTP <= 0) {
      return { winRate: 0, expectancy: 0, trades: 0 };
    }
    let totalR = 0;
    let wins = 0;
    for (const trade of exitTrades) {
      let r: number;
      if (trade.mae >= quickSL) {
        r = -1; // SL hit
      } else if (trade.mfe >= quickTP) {
        r = quickTP / quickSL; // TP hit
      } else {
        r = trade.realizedR; // Neither hit
      }
      totalR += r;
      if (r > 0) wins++;
    }
    return {
      winRate: (wins / exitTrades.length) * 100,
      expectancy: totalR / exitTrades.length,
      trades: exitTrades.length,
    };
  }, [exitTrades, quickSL, quickTP]);

  // Find best point for display
  const bestSL = useMemo(() => {
    if (slSweep.length === 0) return null;
    const sel = selectedSL != null ? slSweep.find(p => p.value === selectedSL) : null;
    if (sel) return sel;
    return slSweep.reduce((best, p) => {
      const metric = optimiseMetric === 'expectancy' ? p.expectancy : p.winRate;
      const bestMetric = optimiseMetric === 'expectancy' ? best.expectancy : best.winRate;
      return metric > bestMetric ? p : best;
    });
  }, [slSweep, selectedSL, optimiseMetric]);

  const bestTP = useMemo(() => {
    if (tpSweep.length === 0) return null;
    const sel = selectedTP != null ? tpSweep.find(p => p.value === selectedTP) : null;
    if (sel) return sel;
    return tpSweep.reduce((best, p) => {
      const metric = optimiseMetric === 'expectancy' ? p.expectancy : p.winRate;
      const bestMetric = optimiseMetric === 'expectancy' ? best.expectancy : best.winRate;
      return metric > bestMetric ? p : best;
    });
  }, [tpSweep, selectedTP, optimiseMetric]);

  const dataKey = optimiseMetric === 'expectancy' ? 'expectancy' : 'winRate';
  const yLabel = optimiseMetric === 'expectancy' ? 'Expectancy (R)' : 'Win Rate (%)';
  const formatVal = (v: number) => optimiseMetric === 'expectancy' ? `${v >= 0 ? '+' : ''}${v.toFixed(3)}R` : `${v.toFixed(1)}%`;

  const handleChartClick = (chartType: 'sl' | 'tp', data: any) => {
    if (data?.activePayload?.[0]) {
      const val = data.activePayload[0].payload.value;
      if (chartType === 'sl') setSelectedSL(val);
      else setSelectedTP(val);
    }
  };

  if (exitTrades.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center min-h-[300px]"
      >
        <p className="text-muted-foreground text-lg">No trades with MFE/MAE data available.</p>
        <p className="text-muted-foreground text-sm mt-1">Add Farthest Price in Profit/Loss values to your trades to use the Exit Analyzer.</p>
      </motion.div>
    );
  }

  return (
    <>
      {/* QUICK */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
        className="glass-card rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">QUICK</h2>
          <div className="text-xs text-muted-foreground font-mono">{quickResult.trades} trades</div>
        </div>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <InputField label="SL" value={quickSL} onChange={setQuickSL} />
          <InputField label="TP" value={quickTP} onChange={setQuickTP} />
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <span className="text-muted-foreground">Win Rate: <span className="font-mono font-semibold text-foreground">{quickResult.winRate.toFixed(1)}%</span></span>
          <span className="text-muted-foreground">Expectancy: <span className={`font-mono font-semibold ${quickResult.expectancy >= 0 ? 'profit-text' : 'loss-text'}`}>{quickResult.expectancy >= 0 ? '+' : ''}{quickResult.expectancy.toFixed(3)}R</span></span>
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="glass-card rounded-2xl p-5"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Optimise</span>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setOptimiseMetric('expectancy')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${optimiseMetric === 'expectancy' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
              >
                Expectancy
              </button>
              <button
                onClick={() => setOptimiseMetric('winrate')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${optimiseMetric === 'winrate' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
              >
                Win Rate
              </button>
            </div>
          </div>
          <div className="w-px h-9 bg-border" />
          <InputField label="Min Trades" value={minTradeCount} onChange={setMinTradeCount} min={1} />
          <div className="w-px h-9 bg-border" />
          <label className="flex items-center gap-2 cursor-pointer select-none pb-0.5">
            <input
              type="checkbox"
              checked={treatMissingAsZero}
              onChange={e => setTreatMissingAsZero(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-muted-foreground">Fill missing as 0</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[240px] text-xs">If a trade has one value (e.g. MFE) but the other is empty (e.g. MAE), the missing one is treated as 0 — meaning the trade never moved in that direction. When disabled, such trades are excluded entirely.</p>
              </TooltipContent>
            </Tooltip>
          </label>
        </div>
        <div className="mt-3 text-xs text-muted-foreground font-mono">{exitTrades.length} trades</div>
      </motion.div>

      {/* SL Optimiser */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">SL Optimiser</h2>
          {bestSL && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Selected SL: <span className="font-mono font-semibold text-foreground">{selectedSL ?? bestSL.value}</span></span>
              <span className="text-muted-foreground">WR: <span className="font-mono font-semibold text-foreground">{bestSL.winRate.toFixed(1)}%</span></span>
              <span className="text-muted-foreground">Exp: <span className={`font-mono font-semibold ${bestSL.expectancy >= 0 ? 'profit-text' : 'loss-text'}`}>{bestSL.expectancy >= 0 ? '+' : ''}{bestSL.expectancy.toFixed(3)}R</span></span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <InputField label="Fixed TP" value={fixedTP} onChange={setFixedTP} />
          <InputField label="SL From" value={slRangeMin} onChange={setSlRangeMin} />
          <InputField label="SL To" value={slRangeMax} onChange={setSlRangeMax} />
          <InputField label="Step" value={slStep} onChange={setSlStep} />
        </div>
        <p className="text-xs text-muted-foreground mb-3">Click on the chart to select an SL value. TP is held fixed at {fixedTP}.</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={slSweep} onClick={(data) => handleChartClick('sl', data)} style={{ cursor: 'crosshair' }}
            margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="value" type="number" domain={['dataMin', 'dataMax']}
              label={{ value: 'SL (ticks)', position: 'bottom', offset: 0, style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 } }}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 } }}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              stroke="hsl(var(--border))"
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
                fontSize: 12,
              }}
              formatter={(value: number) => [formatVal(value), yLabel]}
              labelFormatter={(label) => `SL: ${label} ticks`}
            />
            <Line type="monotone" dataKey={dataKey} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: 'hsl(var(--chart-1))' }} />
            {selectedSL != null && (
              <ReferenceLine
                x={selectedSL}
                stroke="hsl(0 84% 60%)"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{ value: `SL ${selectedSL}`, fill: 'hsl(0 84% 60%)', fontSize: 11, position: 'top' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* TP Optimiser */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="glass-card rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">TP Optimiser</h2>
          {bestTP && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Selected TP: <span className="font-mono font-semibold text-foreground">{selectedTP ?? bestTP.value}</span></span>
              <span className="text-muted-foreground">WR: <span className="font-mono font-semibold text-foreground">{bestTP.winRate.toFixed(1)}%</span></span>
              <span className="text-muted-foreground">Exp: <span className={`font-mono font-semibold ${bestTP.expectancy >= 0 ? 'profit-text' : 'loss-text'}`}>{bestTP.expectancy >= 0 ? '+' : ''}{bestTP.expectancy.toFixed(3)}R</span></span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <InputField label="Fixed SL" value={fixedSL} onChange={setFixedSL} />
          <InputField label="TP From" value={tpRangeMin} onChange={setTpRangeMin} />
          <InputField label="TP To" value={tpRangeMax} onChange={setTpRangeMax} />
          <InputField label="Step" value={tpStep} onChange={setTpStep} />
        </div>
        <p className="text-xs text-muted-foreground mb-3">Click on the chart to select a TP value. SL is held fixed at {fixedSL}.</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={tpSweep} onClick={(data) => handleChartClick('tp', data)} style={{ cursor: 'crosshair' }}
            margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="value" type="number" domain={['dataMin', 'dataMax']}
              label={{ value: 'TP (ticks)', position: 'bottom', offset: 0, style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 } }}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 } }}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              stroke="hsl(var(--border))"
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
                fontSize: 12,
              }}
              formatter={(value: number) => [formatVal(value), yLabel]}
              labelFormatter={(label) => `TP: ${label} ticks`}
            />
            <Line type="monotone" dataKey={dataKey} stroke="hsl(142 76% 45%)" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: 'hsl(142 76% 45%)' }} />
            {selectedTP != null && (
              <ReferenceLine
                x={selectedTP}
                stroke="hsl(142 76% 45%)"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{ value: `TP ${selectedTP}`, fill: 'hsl(142 76% 45%)', fontSize: 11, position: 'top' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </>
  );
};

const OpportunityAnalysis = () => {
  const { filteredTrades } = useFilteredTrades();

  // Inputs
  const [minSL, setMinSL] = useState(5);
  const [maxSL, setMaxSL] = useState(30);
  const [minTP, setMinTP] = useState(5);
  const [maxTP, setMaxTP] = useState(30);
  const [slStep, setSlStep] = useState(5);
  const [tpStep, setTpStep] = useState(5);
  const [activeTab, setActiveTab] = useState('auto');
  const [treatMissingAsZero, setTreatMissingAsZero] = useState(true);
  const [minTradeCount, setMinTradeCount] = useState(1);
  const [coloringMode, setColoringMode] = useState<'expectancy' | 'winrate'>('expectancy');

  // Selection
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [activeModel, setActiveModel] = useState<{ sl: number; tp: number } | null>(null);
  const [highlightRange, setHighlightRange] = useState<[number, number] | null>(null); // [min, max] value range from color bar hover

  // Scatter overlay inputs
  const [scatterTP, setScatterTP] = useState<number>(0);
  const [scatterSL, setScatterSL] = useState<number>(0);

  // Prepare trades
  const exitTrades = useMemo(
    () => prepareExitTrades(filteredTrades, treatMissingAsZero),
    [filteredTrades, treatMissingAsZero]
  );

  // Compute heatmap
  const heatmapRange = { minSL, maxSL, minTP, maxTP, slStep, tpStep };
  const isValidRange = heatmapRange.minSL > 0 && heatmapRange.maxSL >= heatmapRange.minSL &&
    heatmapRange.minTP > 0 && heatmapRange.maxTP >= heatmapRange.minTP &&
    heatmapRange.slStep > 0 && heatmapRange.tpStep > 0;

  const heatmapCells = useMemo(() => {
    if (!isValidRange || exitTrades.length === 0) return [];
    return computeHeatmap(
      exitTrades,
      heatmapRange.minSL, heatmapRange.maxSL, heatmapRange.slStep,
      heatmapRange.minTP, heatmapRange.maxTP, heatmapRange.tpStep
    ).filter(c => c.tradesCount >= minTradeCount);
  }, [exitTrades, heatmapRange, isValidRange, minTradeCount]);

  // Build grid structure
  const { tpValues, slValues, cellMap } = useMemo(() => {
    const tpSet = new Set<number>();
    const slSet = new Set<number>();
    const map = new Map<string, HeatmapCell>();
    for (const c of heatmapCells) {
      tpSet.add(c.tp);
      slSet.add(c.sl);
      map.set(`${c.sl}:${c.tp}`, c);
    }
    return {
      tpValues: Array.from(tpSet).sort((a, b) => a - b),
      slValues: Array.from(slSet).sort((a, b) => a - b),
      cellMap: map,
    };
  }, [heatmapCells]);

  const toggleCell = useCallback((key: string) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCells(new Set());
    setActiveModel(null);
  }, []);

  // Selected cells for comparison table
  const comparisonRows = useMemo(() => {
    return Array.from(selectedCells).map(key => cellMap.get(key)!).filter(Boolean);
  }, [selectedCells, cellMap]);

  // Scatter data
  const scatterData = useMemo(() => {
    return exitTrades.map((t, i) => ({ x: t.mae, y: t.mfe, id: i }));
  }, [exitTrades]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
      </motion.div>

      {/* Sub-Navigation Menu */}
      <div className="flex items-center gap-1 border-b border-border pb-2">
        {subTabs.map((tab) => (
          <div key={tab.id} className="relative">
            <button
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
            {activeTab === tab.id && (
              <motion.div
                layoutId="exitAnalyzerTab"
                className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </div>
        ))}
      </div>

      {/* Methodology note */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
        className="glass-card rounded-2xl px-5 py-4 flex items-start justify-between gap-4"
      >
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary">
            Results are based on the price ranges you recorded (MFE/MAE).
            This analysis assumes price could reach both profit and loss levels, without considering the order of movement.
          </p>
          <p className="text-xs text-muted-foreground">
            For best accuracy, use a consistent method — either record MFE/MAE only until exit, or record the full price range after entry.
          </p>
        </div>
        <HoverCard openDelay={100} closeDelay={100}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary hover:bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
            >
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              Example
            </button>
          </HoverCardTrigger>
          <HoverCardContent side="left" align="start" sideOffset={8} className="w-[560px] z-[100] shadow-xl">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Example</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Same trade — what really happened vs. how the system reads it.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Left column — what actually happened */}
                <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-2.5 text-xs">
                  <div className="font-semibold text-foreground">What actually happened</div>
                  <div className="space-y-0.5 font-mono text-muted-foreground">
                    <div className="text-foreground">Trade</div>
                    <div>Entry: <span className="text-foreground">60</span></div>
                    <div>Exit: <span className="text-foreground">61</span></div>
                  </div>
                  <div className="space-y-0.5 font-mono text-muted-foreground">
                    <div className="text-foreground">Price movement</div>
                    <div>Before exit:</div>
                    <div className="text-foreground">60 → 65 → 59 → exit at 61</div>
                    <div className="pt-1">After exit:</div>
                    <div className="text-foreground">61 → 58 → 68 → 57</div>
                  </div>
                  <div className="space-y-0.5 font-mono">
                    <div className="text-foreground">Key detail</div>
                    <div className="text-muted-foreground">68 was reached <span className="text-foreground">BEFORE</span> 57</div>
                  </div>
                </div>

                {/* Right column — how the system reads it */}
                <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-2.5 text-xs">
                  <div className="font-semibold text-foreground">How the system reads it</div>
                  <div className="space-y-0.5 font-mono text-muted-foreground">
                    <div className="text-foreground">Recorded values (from your input)</div>
                    <div>MFE = <span className="text-foreground">68</span> <span className="opacity-70">(+8 from entry)</span></div>
                    <div>MAE = <span className="text-foreground">57</span> <span className="opacity-70">(−3 from entry)</span></div>
                  </div>
                  <div className="space-y-0.5 font-mono">
                    <div className="text-foreground">Assumption</div>
                    <div className="text-muted-foreground">• +8 and −3 were possible at any time</div>
                  </div>
                  <div className="space-y-0.5 font-mono">
                    <div className="text-foreground">Result</div>
                    <div className="text-muted-foreground">
                      Some trades may be slightly over- or under-estimated depending on how values are recorded.
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Tip: stay consistent — either record MFE/MAE only <em>up to exit</em>, or record the <em>full post-entry range</em>. Mixing both styles makes the SL/TP grid less reliable.
              </p>
            </div>
          </HoverCardContent>
        </HoverCard>
      </motion.div>

      {activeTab === 'auto' ? (
      <>
      {/* Inputs Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="glass-card rounded-2xl p-5"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <InputField label="Min SL" value={minSL} onChange={setMinSL} />
            <InputField label="Max SL" value={maxSL} onChange={setMaxSL} />
            <InputField label="SL Step" value={slStep} onChange={setSlStep} />
          </div>
          <div className="w-px h-9 bg-border" />
          <div className="flex flex-wrap items-end gap-3">
            <InputField label="Min TP" value={minTP} onChange={setMinTP} />
            <InputField label="Max TP" value={maxTP} onChange={setMaxTP} />
            <InputField label="TP Step" value={tpStep} onChange={setTpStep} />
          </div>
          <div className="w-px h-9 bg-border" />
          <InputField label="Min Trades" value={minTradeCount} onChange={setMinTradeCount} min={1} />
          <div className="w-px h-9 bg-border" />
          <label className="flex items-center gap-2 cursor-pointer select-none pb-0.5">
            <input
              type="checkbox"
              checked={treatMissingAsZero}
              onChange={e => setTreatMissingAsZero(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-muted-foreground">Fill missing as 0</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[240px] text-xs">If a trade has one value (e.g. MFE) but the other is empty (e.g. MAE), the missing one is treated as 0 — meaning the trade never moved in that direction. When disabled, such trades are excluded entirely.</p>
              </TooltipContent>
            </Tooltip>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-mono">{exitTrades.length} trades</span>
          {selectedCells.size > 0 && (
            <button onClick={clearSelection} className="text-primary hover:underline">
              Clear selection ({selectedCells.size})
            </button>
          )}
        </div>
      </motion.div>

      {/* Empty state */}
      {exitTrades.length === 0 && (
        <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center min-h-[300px]">
          <p className="text-muted-foreground text-lg">No trades with MFE/MAE data available.</p>
          <p className="text-muted-foreground text-sm mt-1">Add MFE/MAE tick values to your trades to use the Exit Analyzer.</p>
        </div>
      )}

      {/* Invalid range */}
      {exitTrades.length > 0 && !isValidRange && (
        <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center min-h-[200px]">
          <p className="text-muted-foreground">Invalid SL/TP ranges. Please adjust the inputs.</p>
        </div>
      )}

      {/* Heatmap */}
      {heatmapCells.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-lg font-semibold">SL / TP Performance Heatmap</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Coloring:</span>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setColoringMode('expectancy')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${coloringMode === 'expectancy' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                >
                  Expectancy
                </button>
                <button
                  onClick={() => setColoringMode('winrate')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${coloringMode === 'winrate' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                >
                  Win Rate
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-auto" style={{ maxHeight: 600 }}>
            <table className="border-separate" style={{ borderSpacing: 6 }}>
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 bg-card px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    SL \ TP
                  </th>
                  {tpValues.map(tp => (
                    <th key={tp} className="sticky top-0 z-20 bg-card px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap text-center">
                      {tp}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slValues.map(sl => (
                  <tr key={sl}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap text-right">
                      {sl}
                    </td>
                    {tpValues.map(tp => {
                      const cell = cellMap.get(`${sl}:${tp}`);
                      if (!cell) return <td key={tp} className="rounded-lg" style={{ minWidth: 80, minHeight: 50 }} />;
                      
                      const colorVal = coloringMode === 'expectancy' ? cell.expectancy : cell.winRate;
                      const allVals = heatmapCells.map(c => coloringMode === 'expectancy' ? c.expectancy : c.winRate);
                      const minVal = Math.min(...allVals);
                      const maxVal = Math.max(...allVals);
                      const range = maxVal - minVal || 1;
                      const ratio = (colorVal - minVal) / range; // 0..1
                      
                      // Gradient: orange (#C96A2B) to green (#2FAF7A)
                      const colors = [
                        [139, 58, 26],   // #8B3A1A
                        [201, 106, 43],  // #C96A2B
                        [212, 148, 74],  // #D4944A
                        [107, 175, 110], // #6BAF6E
                        [47, 175, 122],  // #2FAF7A
                        [26, 122, 78],   // #1A7A4E
                      ];
                      const segment = ratio * (colors.length - 1);
                      const idx = Math.min(Math.floor(segment), colors.length - 2);
                      const t = segment - idx;
                      const r = Math.round(colors[idx][0] + t * (colors[idx + 1][0] - colors[idx][0]));
                      const g = Math.round(colors[idx][1] + t * (colors[idx + 1][1] - colors[idx][1]));
                      const b = Math.round(colors[idx][2] + t * (colors[idx + 1][2] - colors[idx][2]));
                      const bgColor = `rgb(${r},${g},${b})`;

                      const isSelected = selectedCells.has(`${sl}:${tp}`);
                      const expStr = `${cell.expectancy >= 0 ? '+' : ''}${cell.expectancy.toFixed(2)}R`;
                      const wrStr = `${cell.winRate.toFixed(1)}%`;

                        const inHighlight = highlightRange
                          ? colorVal >= highlightRange[0] && colorVal <= highlightRange[1]
                          : true;

                        return (
                        <td
                          key={tp}
                          onClick={() => toggleCell(`${sl}:${tp}`)}
                          className={`rounded-lg text-center cursor-pointer transition-all hover:brightness-125 ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                          style={{ backgroundColor: bgColor, minWidth: 80, padding: '8px 6px', opacity: inHighlight ? 1 : 0.15 }}
                        >
                          <div className="text-[11px] font-bold font-mono text-white leading-4">
                            {coloringMode === 'expectancy' ? expStr : wrStr}
                          </div>
                          <div className="text-[9px] font-mono text-white/65 leading-3">
                            {coloringMode === 'expectancy' ? `WR: ${wrStr}` : `Exp: ${expStr}`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Color bar legend */}
          <div className="flex items-center justify-center gap-3 px-5 pb-4 pt-2">
            <span className="text-xs text-muted-foreground font-mono">
              {(() => {
                const allVals = heatmapCells.map(c => coloringMode === 'expectancy' ? c.expectancy : c.winRate);
                const minV = Math.min(...allVals);
                return coloringMode === 'expectancy' ? `${minV >= 0 ? '+' : ''}${minV.toFixed(2)}R` : `${minV.toFixed(1)}%`;
              })()}
            </span>
            <div
              className="h-3 rounded-full flex-1 max-w-xs cursor-pointer relative"
              style={{
                background: 'linear-gradient(to right, #8B3A1A, #C96A2B, #D4944A, #6BAF6E, #2FAF7A, #1A7A4E)',
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const ratio = x / rect.width;
                const allVals = heatmapCells.map(c => coloringMode === 'expectancy' ? c.expectancy : c.winRate);
                const minV = Math.min(...allVals);
                const maxV = Math.max(...allVals);
                const range = maxV - minV || 1;
                const hoverVal = minV + ratio * range;
                const bandwidth = range * 0.08; // highlight ~8% band around cursor
                setHighlightRange([hoverVal - bandwidth, hoverVal + bandwidth]);
              }}
              onMouseLeave={() => setHighlightRange(null)}
            />
            <span className="text-xs text-muted-foreground font-mono">
              {(() => {
                const allVals = heatmapCells.map(c => coloringMode === 'expectancy' ? c.expectancy : c.winRate);
                const maxV = Math.max(...allVals);
                return coloringMode === 'expectancy' ? `${maxV >= 0 ? '+' : ''}${maxV.toFixed(2)}R` : `${maxV.toFixed(1)}%`;
              })()}
            </span>
          </div>
        </motion.div>
      )}

      {/* Comparison Table */}
      {comparisonRows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-5"
        >
          <h2 className="text-lg font-semibold mb-4">Model Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">SL</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">TP</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Expectancy</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Win Rate</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Avg R</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Trades</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(row => {
                  const isActive = activeModel?.sl === row.sl && activeModel?.tp === row.tp;
                  return (
                    <tr
                      key={`${row.sl}:${row.tp}`}
                      onClick={() => { setActiveModel({ sl: row.sl, tp: row.tp }); setScatterSL(row.sl); setScatterTP(row.tp); }}
                      className={`cursor-pointer transition-colors border-b border-border/50 hover:bg-secondary/50 ${isActive ? 'bg-primary/10' : ''}`}
                    >
                      <td className="py-2.5 px-3 font-mono">{row.sl}</td>
                      <td className="py-2.5 px-3 font-mono">{row.tp}</td>
                      <td className={`py-2.5 px-3 text-right font-mono font-semibold ${row.expectancy > 0 ? 'profit-text' : row.expectancy < 0 ? 'loss-text' : ''}`}>
                        {row.expectancy >= 0 ? '+' : ''}{row.expectancy.toFixed(3)}R
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{row.winRate.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right font-mono">{row.avgR.toFixed(3)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{row.tradesCount}</td>
                      <td className="py-2.5 px-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCell(`${row.sl}:${row.tp}`); }}
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* MFE/MAE Scatter Chart */}
      {exitTrades.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass-card rounded-2xl p-5"
        >
          <h2 className="text-lg font-semibold mb-3">MFE / MAE Scatter</h2>
          <div className="flex items-end gap-4 mb-4">
            <InputField label="Profit (TP) Ticks" value={scatterTP} onChange={setScatterTP} min={0} />
            <InputField label="Loss (SL) Ticks" value={scatterSL} onChange={setScatterSL} min={0} />
            {(scatterTP > 0 || scatterSL > 0) && (
              <div className="text-xs text-muted-foreground pb-1.5 space-y-0.5">
                {scatterTP > 0 && <p className="text-profit">TP hit: {scatterData.filter(d => d.y >= scatterTP).length} trades</p>}
                {scatterSL > 0 && <p className="text-loss">SL hit: {scatterData.filter(d => d.x >= scatterSL).length} trades</p>}
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 18%)" />
              <XAxis
                type="number" dataKey="x" name="MAE (ticks)"
                label={{ value: 'MAE (ticks)', position: 'bottom', offset: 0, style: { fill: 'hsl(215 20% 55%)', fontSize: 12 } }}
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                stroke="hsl(222 47% 18%)"
              />
              <YAxis
                type="number" dataKey="y" name="MFE (ticks)"
                label={{ value: 'MFE (ticks)', angle: -90, position: 'insideLeft', style: { fill: 'hsl(215 20% 55%)', fontSize: 12 } }}
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                stroke="hsl(222 47% 18%)"
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'hsl(222 47% 10%)',
                  border: '1px solid hsl(222 47% 18%)',
                  borderRadius: '8px',
                  color: 'hsl(210 40% 98%)',
                  fontSize: 12,
                }}
                itemStyle={{ color: 'hsl(210 40% 98%)' }}
                labelStyle={{ color: 'hsl(210 40% 98%)' }}
                formatter={(value: number, name: string) => [value, name]}
              />
              {scatterSL > 0 && (
                <ReferenceLine
                  x={scatterSL}
                  stroke="hsl(0 84% 60%)"
                  strokeDasharray="6 3"
                  strokeWidth={2}
                  label={{ value: `SL ${scatterSL}`, fill: 'hsl(0 84% 60%)', fontSize: 11, position: 'top' }}
                />
              )}
              {scatterTP > 0 && (
                <ReferenceLine
                  y={scatterTP}
                  stroke="hsl(142 76% 45%)"
                  strokeDasharray="6 3"
                  strokeWidth={2}
                  label={{ value: `TP ${scatterTP}`, fill: 'hsl(142 76% 45%)', fontSize: 11, position: 'right' }}
                />
              )}
              <Scatter data={scatterData} fill="hsl(199 89% 48%)" fillOpacity={0.6} r={4}>
                {scatterData.map((_, i) => (
                  <RechartsCell key={i} fill="hsl(199 89% 48%)" />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </motion.div>
      )}
      </>
      ) : (
      <ManualExitTab />

      )}
    </div>
  );
};

export default OpportunityAnalysis;
