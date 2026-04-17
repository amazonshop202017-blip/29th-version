import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { TradesTableCard } from '@/components/trades/TradesTableCard';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';

const Trades = () => {
  const { filteredTrades } = useFilteredTrades();

  return (
    <div className="flex flex-col h-[calc(100vh-10vh)] md:h-[calc(100vh-120px)] space-y-4">
      {/* Metrics Cards - synced with Dashboard, hidden on mobile to maximize table space */}
      <div className="flex-shrink-0 hidden md:block">
        <DashboardMetrics isEditMode={false} />
      </div>

      {/* Trades Card */}
      <TradesTableCard trades={filteredTrades} />
    </div>
  );
};

export default Trades;
