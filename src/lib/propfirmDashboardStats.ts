import type { PropFirmTransaction } from "@/contexts/TransactionsContext";
import type { ChallengeSteps } from "@/contexts/ChallengesContext";

export function getNonIgnoredTxs(txs: PropFirmTransaction[]): PropFirmTransaction[] {
  return txs.filter(t => t.status !== "ignored");
}

export function formatSizeBucket(balance: number): string {
  if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(balance % 1_000_000 === 0 ? 0 : 1)}M`;
  if (balance >= 1_000) return `${Math.round(balance / 1_000)}K`;
  return `$${balance}`;
}

export function accountTypeLabel(steps: ChallengeSteps | undefined): string {
  if (steps === 0) return "Instant";
  if (steps === 2) return "2-step";
  if (steps === 1) return "1-step";
  return "Unknown";
}

export interface GroupAgg {
  spent: number;
  earned: number;
}

export function groupTransactions<K>(
  txs: PropFirmTransaction[],
  getKey: (t: PropFirmTransaction) => K | null | undefined,
): Map<K, GroupAgg> {
  const map = new Map<K, GroupAgg>();
  for (const t of txs) {
    const key = getKey(t);
    if (key == null) continue;
    const cur = map.get(key) ?? { spent: 0, earned: 0 };
    if (t.type === "income") cur.earned += t.amount;
    else cur.spent += t.amount;
    map.set(key, cur);
  }
  return map;
}

export const PROPFIRM_PALETTE = [
  "#22c55e",
  "#6366f1",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#f43f5e",
  "#10b981",
];
