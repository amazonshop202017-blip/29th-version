import { MetricCards } from "@/components/propfirm/MetricCards";
import { ROIChart } from "@/components/propfirm/ROIChart";
import { FinanceBreakdown } from "@/components/propfirm/FinanceBreakdown";
import { PassingInsights } from "@/components/propfirm/PassingInsights";
import { BreachInsights } from "@/components/propfirm/BreachInsights";

const PropFirmDashboard = () => {
  return (
    <>
      <MetricCards />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        <ROIChart />
        <FinanceBreakdown />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PassingInsights />
        <BreachInsights />
      </div>
    </>
  );
};

export default PropFirmDashboard;
