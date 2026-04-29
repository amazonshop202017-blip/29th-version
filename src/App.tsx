import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TradeModalProvider } from "@/contexts/TradeModalContext";
import { TradesProvider } from "@/contexts/TradesContext";
import { TagsProvider } from "@/contexts/TagsContext";
import { CategoriesProvider } from "@/contexts/CategoriesContext";
import { ScreenshotTagsProvider } from "@/contexts/ScreenshotTagsContext";
import { StrategiesProvider } from "@/contexts/StrategiesContext";
import { AccountsProvider } from "@/contexts/AccountsContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { CurrencyAccountBridge } from "@/components/CurrencyAccountBridge";
import { CustomStatsProvider } from "@/contexts/CustomStatsContext";
import { DiaryProvider } from "@/contexts/DiaryContext";
import { SymbolTickSizeProvider } from "@/contexts/SymbolTickSizeContext";
import { InterfaceThemeProvider } from "@/contexts/InterfaceThemeContext";
import { DashboardEditProvider } from "@/contexts/DashboardEditContext";
import { ChallengesProvider } from "@/contexts/ChallengesContext";
import { TransactionsProvider } from "@/contexts/TransactionsContext";
import { TransactionsAutoSync } from "@/components/propfirm/TransactionsAutoSync";
import { AppLayout } from "@/components/layout/AppLayout";
import { TradeModal } from "@/components/trades/TradeModal";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import DayView from "./pages/DayView";
import Diary from "./pages/Diary";
import Strategies from "./pages/Strategies";
import StrategyDetail from "./pages/StrategyDetail";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import Entering from "./pages/Entering";
import Landing from "./pages/Landing";
import Landing2 from "./pages/Landing2";
import Landing3 from "./pages/Landing3";
import Landing4 from "./pages/Landing4";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";

import SupportedPlatforms from "./pages/SupportedPlatforms";
import Drawdown from "./pages/chartroom/Drawdown";
import ConsecutiveWinnersLosers from "./pages/chartroom/ConsecutiveWinnersLosers";
import ExitAnalysis from "./pages/edgelab/ExitAnalysis";
import HoldingTime from "./pages/chartroom/HoldingTime";
import PerformanceBySymbol from "./pages/chartroom/PerformanceBySymbol";
import PerformanceBySetup from "./pages/chartroom/PerformanceBySetup";
import PerformanceByTime from "./pages/chartroom/PerformanceByTime";
import TagsAnalytics from "./pages/chartroom/TagsAnalytics";
import RiskDistribution from "./pages/chartroom/RiskDistribution";
import TradeManagement from "./pages/chartroom/TradeManagement";
import OpportunityAnalysis from "./pages/edgelab/OpportunityAnalysis";
import MonteCarlo from "./pages/tools/MonteCarlo";
import StreakAnalysis from "./pages/tools/StreakAnalysis";
import PropFirmLayout from "./pages/propfirm/PropFirmLayout";
import PropFirmDashboard from "./pages/propfirm/PropFirmDashboard";
import PropFirmAccountsPage from "./pages/propfirm/PropFirmAccountsPage";
import PropFirmTransactionsPage from "./pages/propfirm/PropFirmTransactionsPage";
import PropFirmAccountDetailsPage from "./pages/propfirm/PropFirmAccountDetailsPage";

const queryClient = new QueryClient();

const AuthenticatedApp = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Landing4 />} />
        {/* Home 1 is served at "/" via Landing4 */}
        <Route path="/home-2" element={<Landing2 />} />
        <Route path="/home-3" element={<Landing3 />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        
        <Route path="/supported-platforms" element={<SupportedPlatforms />} />
        <Route path="/entering" element={<Entering />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <CategoriesProvider>
      <ScreenshotTagsProvider>
        <TagsProvider>
          <StrategiesProvider>
            <TradesProvider>
              <AccountsProvider>
                <ChallengesProvider>
                <TransactionsProvider>
                <TransactionsAutoSync />
                <GlobalFiltersProvider>
                  <CurrencyAccountBridge />
                  <CustomStatsProvider>
                    <SymbolTickSizeProvider>
                      <DiaryProvider>
                        <TradeModalProvider>
                          <DashboardEditProvider>
                          <Routes>
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/account/*" element={<Account />} />
                            <Route path="*" element={
                              <AppLayout>
                                <Routes>
                                  <Route path="/" element={<Dashboard />} />
                                  <Route path="/trades" element={<Trades />} />
                                  <Route path="/day-view" element={<DayView />} />
                                  <Route path="/diary" element={<Diary />} />
                                  <Route path="/strategies" element={<Strategies />} />
                                  <Route path="/strategies/:id" element={<StrategyDetail />} />
                                  <Route path="/reports/*" element={<Reports />} />
                                  <Route path="/chart-room/drawdown" element={<Drawdown />} />
                                  <Route path="/chart-room/consecutive" element={<ConsecutiveWinnersLosers />} />
                                  <Route path="/edge-lab/exit-analysis" element={<ExitAnalysis />} />
                                  <Route path="/chart-room/exit-analysis" element={<Navigate to="/edge-lab/exit-analysis" replace />} />
                                  <Route path="/chart-room/holding-time" element={<HoldingTime />} />
                                  <Route path="/chart-room/performance-by-symbol" element={<PerformanceBySymbol />} />
                                  <Route path="/chart-room/performance-by-setup" element={<PerformanceBySetup />} />
                                  <Route path="/chart-room/performance-by-time" element={<PerformanceByTime />} />
                                  <Route path="/chart-room/tags-analytics" element={<TagsAnalytics />} />
                                  <Route path="/chart-room/risk-distribution" element={<RiskDistribution />} />
                                  <Route path="/chart-room/trade-management" element={<TradeManagement />} />
                                  <Route path="/edge-lab/opportunity-analysis" element={<OpportunityAnalysis />} />
                                  <Route path="/edge-lab/exit-analyzer" element={<Navigate to="/edge-lab/opportunity-analysis" replace />} />
                                  <Route path="/exit-analyzer" element={<Navigate to="/edge-lab/opportunity-analysis" replace />} />
                                  <Route path="/tools/monte-carlo" element={<MonteCarlo />} />
                                  <Route path="/tools/streak-analysis" element={<StreakAnalysis />} />
                                  <Route path="/prop-firm" element={<PropFirmLayout />}>
                                    <Route index element={<PropFirmDashboard />} />
                                    <Route path="accounts" element={<PropFirmAccountsPage />} />
                                    <Route path="accounts/:accountId" element={<PropFirmAccountDetailsPage />} />
                                    <Route path="transactions" element={<PropFirmTransactionsPage />} />
                                  </Route>
                                  <Route path="/entering" element={<Navigate to="/" replace />} />
                                  <Route path="*" element={<NotFound />} />
                                </Routes>
                              </AppLayout>
                            } />
                          </Routes>
                          <TradeModal />
                          </DashboardEditProvider>
                        </TradeModalProvider>
                      </DiaryProvider>
                    </SymbolTickSizeProvider>
                  </CustomStatsProvider>
                </GlobalFiltersProvider>
                </TransactionsProvider>
                </ChallengesProvider>
              </AccountsProvider>
            </TradesProvider>
          </StrategiesProvider>
        </TagsProvider>
      </ScreenshotTagsProvider>
    </CategoriesProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <TooltipProvider>
        <AuthProvider>
          <InterfaceThemeProvider>
            <BrowserRouter>
              <Toaster />
              <Sonner />
              <AuthenticatedApp />
            </BrowserRouter>
          </InterfaceThemeProvider>
        </AuthProvider>
      </TooltipProvider>
    </LocalizationProvider>
  </QueryClientProvider>
);

export default App;
