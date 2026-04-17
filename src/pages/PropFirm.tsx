import { useState } from "react";
import { MetricCards } from "@/components/propfirm/MetricCards";
import { ROIChart } from "@/components/propfirm/ROIChart";
import { FinanceBreakdown } from "@/components/propfirm/FinanceBreakdown";
import { PassingInsights } from "@/components/propfirm/PassingInsights";
import { BreachInsights } from "@/components/propfirm/BreachInsights";
import { FilterPanel } from "@/components/propfirm/FilterPanel";
import { PayoutModal } from "@/components/propfirm/PayoutModal";
import { TrackAccountModal } from "@/components/propfirm/TrackAccountModal";
import PropFirmAccounts from "@/components/propfirm/PropFirmAccounts";
import PropFirmTransactions from "@/components/propfirm/PropFirmTransactions";
import PropFirmAccountDetails from "@/components/propfirm/PropFirmAccountDetails";
import RealPropFirmAccountDetails from "@/components/propfirm/RealPropFirmAccountDetails";
import { SlidersHorizontal, Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tab = "dashboard" | "accounts" | "transactions";

const PropFirm = () => {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [trackAccountOpen, setTrackAccountOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  if (selectedAccountId === "demo") {
    return <PropFirmAccountDetails onBack={() => setSelectedAccountId(null)} />;
  }
  if (selectedAccountId) {
    return (
      <RealPropFirmAccountDetails
        accountId={selectedAccountId}
        onBack={() => setSelectedAccountId(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase">
              BETA
            </span>
            <p className="text-sm text-muted-foreground">
              Here's an overview of your prop firm activity
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {activeTab !== "transactions" && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm relative"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  1
                </span>
              </Button>
              <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-sm"
            onClick={() => setPayoutOpen(true)}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log payout</span>
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-sm bg-primary hover:bg-primary/90"
            onClick={() => setTrackAccountOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Challenge</span>
            <span className="sm:hidden">Add Challenge</span>
          </Button>
        </div>
      </div>

      {/* Primary Tabs */}
      <div className="flex items-center gap-1">
        {(["dashboard", "accounts", "transactions"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium capitalize rounded-lg transition-colors ${
              activeTab === tab
                ? "border border-border bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "dashboard" && (
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
      )}

      {activeTab === "accounts" && (
        <PropFirmAccounts
          onSelectAccount={(id) => setSelectedAccountId(id ?? "demo")}
        />
      )}

      {activeTab === "transactions" && <PropFirmTransactions />}

      {/* Overlays */}
      <PayoutModal open={payoutOpen} onClose={() => setPayoutOpen(false)} />
      <TrackAccountModal open={trackAccountOpen} onClose={() => setTrackAccountOpen(false)} />
    </div>
  );
};

export default PropFirm;
