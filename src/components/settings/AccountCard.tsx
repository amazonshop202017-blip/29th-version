import { motion } from 'framer-motion';
import { Wallet, MoreVertical, Edit2, Archive, Download, DollarSign, ArrowRightLeft, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import type { StrategyStats } from '@/lib/strategyStats';
import type { AccountWithStats } from '@/contexts/AccountsContext';

interface AccountCardProps {
  account: AccountWithStats;
  stats: StrategyStats;
  currencySymbol: string;
  onEdit: () => void;
  onArchive: () => void;
  onDepositWithdraw: () => void;
  onImport: () => void;
}

const fmtPct = (v: number) => `${Math.round(v)}%`;

const formatExecutionDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

export const AccountCard = ({
  account,
  stats,
  currencySymbol,
  onEdit,
  onArchive,
  onDepositWithdraw,
  onImport,
}: AccountCardProps) => {
  const isPositive = stats.totalNetPnL >= 0;
  const chartColor = isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))';
  const gradId = `acct-grad-${account.id}`;
  const series = stats.cumulativeSeries.length > 0
    ? stats.cumulativeSeries
    : [{ x: 0, y: 0 }, { x: 1, y: 0 }];

  const pnlPositive = account.pnl >= 0;
  const ddZero = stats.maxDrawdownPct === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-5 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-muted/40 border border-border flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">{account.name.toUpperCase()}</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-profit/10 text-[10px] font-medium text-profit border border-profit/20">
                <span className="w-1 h-1 rounded-full bg-profit" /> ACTIVE
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 truncate">
              {account.accountMode === 'propfirm' ? 'Prop Firm' : 'Live'} · LAST EXECUTION: {formatExecutionDate(stats.lastExecutionDate)}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border z-50 w-48">
            <DropdownMenuItem onClick={onImport} className="cursor-pointer">
              <Download className="w-4 h-4 mr-2" /> Import
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDepositWithdraw} className="cursor-pointer">
              <DollarSign className="w-4 h-4 mr-2" /> Deposit / Withdraw
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
              <Edit2 className="w-4 h-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive} className="cursor-pointer">
              <Archive className="w-4 h-4 mr-2" /> Archive
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="cursor-not-allowed opacity-50">
              <ArrowRightLeft className="w-4 h-4 mr-2" /> Transfer All Data
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="cursor-not-allowed opacity-50">
              <Eraser className="w-4 h-4 mr-2" /> Clear Trades
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-y-3 gap-x-4 mb-4">
        <Metric label="BALANCE" value={`${currencySymbol}${Math.round(account.currentBalance).toLocaleString()}`} />
        <Metric
          label="P/L"
          value={`${pnlPositive ? '+' : ''}${currencySymbol}${Math.round(account.pnl).toLocaleString()}`}
          className={pnlPositive ? 'text-profit' : 'text-loss'}
        />
        <Metric
          label="ROI"
          value={`${account.roi >= 0 ? '+' : ''}${account.roi.toFixed(1)}%`}
          className={account.roi >= 0 ? 'text-profit' : 'text-loss'}
        />
        <Metric label="WIN RATE" value={fmtPct(stats.winRate)} />
        <Metric label="PF" value={stats.profitFactor.toFixed(2)} />
        <Metric
          label="DD"
          value={`${stats.maxDrawdownPct.toFixed(0)}%`}
          className={ddZero ? undefined : 'text-loss'}
        />
      </div>

      {/* Mini chart */}
      <div className="h-16 -mx-1 mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="y"
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

const Metric = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
    <p className={cn('text-sm font-medium text-foreground truncate', className)}>{value}</p>
  </div>
);
