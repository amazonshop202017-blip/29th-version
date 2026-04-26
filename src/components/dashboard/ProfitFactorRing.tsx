import { PieChart } from '@mui/x-charts/PieChart';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';

interface ProfitFactorRingProps {
  profitFactor: number;
  totalProfits: number;
  totalLosses: number;
}

export const ProfitFactorRing = ({ 
  profitFactor, 
  totalProfits, 
  totalLosses
}: ProfitFactorRingProps) => {
  const { isPrivacyMode, maskProfitFactor } = usePrivacyMode();
  
  const total = totalProfits + Math.abs(totalLosses);
  const profitPercent = total > 0 ? totalProfits : 1;
  const lossPercent = total > 0 ? Math.abs(totalLosses) : 1;

  const pieData = [
    { id: 0, value: profitPercent, label: 'Profits', color: 'hsl(var(--profit))' },
    { id: 1, value: lossPercent, label: 'Losses', color: 'hsl(var(--loss))' },
  ].filter(d => d.value > 0);

  if (pieData.length === 0) {
    pieData.push({ id: 0, value: 1, label: 'No Data', color: 'hsl(var(--muted))' });
  }

  return (
    <div className="flex items-center justify-between w-full h-full gap-2">
      <div className="flex flex-col items-start justify-start">
        <span className="text-xs text-muted-foreground">Profit Factor</span>
        <span className="text-2xl font-bold font-mono mt-0.5">
          {maskProfitFactor(profitFactor)}
        </span>
      </div>
      <div style={{ width: 90, height: 90 }}>
        <PieChart
          series={[
            {
              data: pieData.map(d => ({
                ...d,
                label: `${d.label}: ${total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%`,
              })),
              innerRadius: 26,
              outerRadius: 42,
              paddingAngle: 2,
              cornerRadius: 4,
              cx: 41,
              cy: 41,
              arcLabel: () => '',
              highlightScope: { fade: 'global', highlight: 'item' },
            },
          ]}
          width={90}
          height={90}
          hideLegend
          skipAnimation={false}
        />
      </div>
    </div>
  );
};
