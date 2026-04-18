const BREACH_REASON_LABELS: Record<string, string> = {
  max_drawdown: "Broke max drawdown",
  overtrading: "Overtrading / Forcing trades",
  time_pressure: "Time pressure",
  risk_management: "Lack of risk management",
};

export function formatBreachReason(raw?: string | null): string {
  if (!raw) return "—";
  return BREACH_REASON_LABELS[raw] ?? raw;
}

export function formatBreachDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
