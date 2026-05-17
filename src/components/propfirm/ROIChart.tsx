import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { getNonIgnoredTxs } from "@/lib/propfirmDashboardStats";
import { usePropFirmFiltered } from "@/hooks/usePropFirmFiltered";

type Period = "1W" | "1M" | "1Y";

interface Point {
  date: string;
  income: number;
  expenses: number;
  roi: number;
  ts: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-md p-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="capitalize">{entry.name === "roi" ? "ROI" : entry.name}:</span>
            <span className="font-medium text-foreground">
              ${Number(entry.value).toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function formatTickShort(d: Date, period: Period): string {
  if (period === "1Y") {
    return d.toLocaleDateString("en-US", { month: "short" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ROIChart() {
  const [period, setPeriod] = useState<Period>("1M");
  const { transactions } = usePropFirmFiltered();

  const data = useMemo<Point[]>(() => {
    const txs = getNonIgnoredTxs(transactions);
    if (!txs.length) return [];

    // Immutable sort
    const sorted = [...txs].sort((a, b) => +new Date(a.date) - +new Date(b.date));

    // Build cumulative timeline of all events
    let cumIn = 0, cumEx = 0;
    const events = sorted.map(t => {
      if (t.type === "income") cumIn += t.amount;
      else cumEx += t.amount;
      return { ts: new Date(t.date).getTime(), income: cumIn, expenses: cumEx };
    });

    const now = Date.now();
    let buckets: { ts: number; label: string }[] = [];
    if (period === "1W") {
      const start = now - 6 * 86400000;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start + i * 86400000);
        buckets.push({ ts: d.getTime(), label: formatTickShort(d, period) });
      }
    } else if (period === "1M") {
      const start = now - 29 * 86400000;
      for (let i = 0; i <= 6; i++) {
        const d = new Date(start + Math.round(i * (29 / 6)) * 86400000);
        buckets.push({ ts: d.getTime(), label: formatTickShort(d, period) });
      }
    } else {
      // 1Y - 12 months
      const start = new Date();
      start.setMonth(start.getMonth() - 11);
      start.setDate(1);
      for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        buckets.push({ ts: d.getTime(), label: formatTickShort(d, period) });
      }
    }

    // For each bucket, find latest cumulative value at or before bucket.ts
    return buckets.map(b => {
      let income = 0, expenses = 0;
      for (const e of events) {
        if (e.ts <= b.ts) { income = e.income; expenses = e.expenses; }
        else break;
      }
      return {
        date: b.label,
        income,
        expenses: -expenses,
        roi: income - expenses,
        ts: b.ts,
      };
    });
  }, [transactions, period]);

  const isEmpty = data.length === 0 || data.every(d => d.income === 0 && d.expenses === 0);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-sm font-semibold text-foreground">ROI Progression</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track how your cumulative net return on investment evolves over time</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(["1W", "1M", "1Y"] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4" style={{ height: 220 }}>
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Add transactions to see ROI progression</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="pfColorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="pfColorRoi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="pfColorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7}
                formatter={(value) => (<span style={{ color: "hsl(var(--muted-foreground))", textTransform: "capitalize" }}>{value === "roi" ? "Return on investment" : value}</span>)} />
              <Area type="monotone" dataKey="income" stroke="#6366f1" strokeWidth={2} fill="url(#pfColorIncome)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="Income" />
              <Area type="monotone" dataKey="roi" stroke="#10b981" strokeWidth={2} fill="url(#pfColorRoi)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="roi" />
              <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#pfColorExpenses)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
