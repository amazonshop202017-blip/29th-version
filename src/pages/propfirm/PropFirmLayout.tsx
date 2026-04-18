import { useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { SlidersHorizontal, Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "@/components/propfirm/FilterPanel";
import { PayoutModal } from "@/components/propfirm/PayoutModal";
import { TrackAccountModal } from "@/components/propfirm/TrackAccountModal";

type Tab = "dashboard" | "accounts" | "transactions";

const PropFirmLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const isAccountDetails = Boolean(params.accountId);

  const activeTab: Tab = location.pathname.startsWith("/prop-firm/accounts")
    ? "accounts"
    : location.pathname.startsWith("/prop-firm/transactions")
    ? "transactions"
    : "dashboard";

  const setActiveTab = (tab: Tab) => {
    if (tab === "dashboard") navigate("/prop-firm");
    else navigate(`/prop-firm/${tab}`);
  };

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [trackAccountOpen, setTrackAccountOpen] = useState(false);

  // Account details takes over the page (no header/tabs)
  if (isAccountDetails) {
    return <Outlet />;
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

      <Outlet />

      <PayoutModal open={payoutOpen} onClose={() => setPayoutOpen(false)} />
      <TrackAccountModal open={trackAccountOpen} onClose={() => setTrackAccountOpen(false)} />
    </div>
  );
};

export default PropFirmLayout;
