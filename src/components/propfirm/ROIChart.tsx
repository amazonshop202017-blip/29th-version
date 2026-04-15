import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

const data1W = [
  { date: "Apr 3", income: 100, roi: -50, expenses: -80 },
  { date: "Apr 4", income: 120, roi: -20, expenses: -90 },
  { date: "Apr 5", income: 200, roi: 10, expenses: -100 },
  { date: "Apr 6", income: 280, roi: 60, expenses: -110 },
  { date: "Apr 7", income: 350, roi: 100, expenses: -120 },
  { date: "Apr 8", income: 420, roi: 180, expenses: -130 },
  { date: "Apr 9", income: 500, roi: 250, expenses: -167 },
];
const data1M = [
  { date: "Mar 10", income: 0, roi: -80, expenses: -40 },
  { date: "Mar 15", income: 80, roi: -60, expenses: -60 },
  { date: "Mar 20", income: 150, roi: -20, expenses: -90 },
  { date: "Mar 25", income: 250, roi: 40, expenses: -110 },
  { date: "Mar 30", income: 350, roi: 100, expenses: -130 },
  { date: "Apr 5", income: 420, roi: 180, expenses: -150 },
  { date: "Apr 9", income: 500, roi: 250, expenses: -167 },
];
const data1Y = [
  { date: "May", income: 0, roi: -100, expenses: -30 },
  { date: "Jul", income: 100, roi: -80, expenses: -60 },
  { date: "Sep", income: 200, roi: -40, expenses: -90 },
  { date: "Nov", income: 300, roi: 30, expenses: -110 },
  { date: "Jan", income: 380, roi: 100, expenses: -135 },
  { date: "Mar", income: 450, roi: 190, expenses: -155 },
  { date: "Apr", income: 500, roi: 250, expenses: -167 },
];

type Period = "1W" | "1M" | "1Y";
const dataMap: Record<Period, typeof data1W> = { "1W": data1W, "1M": data1M, "1Y": data1Y };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border rounded-lg shadow-md p-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="capitalize">{entry.name}:</span>
            <span className="font-medium text-foreground">${entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function ROIChart() {
  const [period, setPeriod] = useState<Period>("1M");
  const data = dataMap[period];

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-sm font-semibold text-foreground">ROI Progression</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track how your cumulative net return on investment evolves over time</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(["1W", "1M", "1Y"] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${period === p ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4" style={{ height: 220 }}>
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
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(220,15%,55%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(220,15%,55%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} />
            <ReferenceLine y={0} stroke="hsl(220,15%,80%)" strokeDasharray="3 3" />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={7}
              formatter={(value) => (<span style={{ color: "hsl(220,15%,45%)", textTransform: "capitalize" }}>{value === "roi" ? "Return on investment" : value}</span>)} />
            <Area type="monotone" dataKey="income" stroke="#6366f1" strokeWidth={2} fill="url(#pfColorIncome)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="Income" />
            <Area type="monotone" dataKey="roi" stroke="#10b981" strokeWidth={2} fill="url(#pfColorRoi)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="roi" />
            <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#pfColorExpenses)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="Expenses" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
