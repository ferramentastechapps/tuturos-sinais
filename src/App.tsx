import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { PrivateRoute } from "@/components/auth/PrivateRoute";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Core routes loaded immediately
import Login from "./pages/Login";
import Index from "./pages/Index";
import Portfolio from "./pages/Portfolio";
import Trades from "./pages/Trades";
// Lazy load heavier / less frequently accessed routes
const Analytics = lazy(() => import("./pages/Analytics"));
const Transactions = lazy(() => import("./pages/Transactions"));
const TaxReport = lazy(() => import("./pages/TaxReport"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const RiskManagement = lazy(() => import("./pages/RiskManagement"));
const Backtesting = lazy(() => import("./pages/Backtesting")); // Very heavy (53KB)
const MLAnalytics = lazy(() => import("./pages/MLAnalytics"));
const PaperTrading = lazy(() => import("./pages/PaperTrading"));
const StrategyConfig = lazy(() => import("./pages/StrategyConfig")); // Heavy (31KB)
const SymbolAnalysis = lazy(() => import("./pages/SymbolAnalysis"));
const SignalHistory = lazy(() => import("./pages/SignalHistory"));
const SignalsGallery = lazy(() => import("./pages/SignalsGallery"));

import { BottomNav } from "@/components/layout/BottomNav";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Mobile pages — lazy loaded
const MobileSignals = lazy(() => import("./pages/mobile/MobileSignals"));
const MobileChart = lazy(() => import("./pages/mobile/MobileChart"));
const MobileBacktest = lazy(() => import("./pages/mobile/MobileBacktest"));
const MobilePositions = lazy(() => import("./pages/mobile/MobilePositions"));
const MobileResults = lazy(() => import("./pages/mobile/MobileResults"));

// Redirect from / to /m/sinais on mobile, keep desktop intact
const SmartRedirect = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) navigate('/m/sinais', { replace: true });
  }, [navigate]);
  return null;
};

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public route — only accessible without auth */}
              <Route path="/login" element={<Login />} />

              {/* Protected routes — require valid admin session */}
              <Route path="/" element={
                <PrivateRoute>
                  <>
                    <SmartRedirect />
                    <Index />
                  </>
                </PrivateRoute>
              } />
              <Route path="/portfolio" element={<PrivateRoute><Portfolio /></PrivateRoute>} />
              <Route path="/trades" element={<PrivateRoute><Trades /></PrivateRoute>} />
              <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
              <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
              <Route path="/tax-report" element={<PrivateRoute><TaxReport /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
              <Route path="/sinais" element={<PrivateRoute><SignalHistory /></PrivateRoute>} />
              <Route path="/signals-gallery" element={<PrivateRoute><SignalsGallery /></PrivateRoute>} />
              <Route path="/risk-management" element={<PrivateRoute><RiskManagement /></PrivateRoute>} />
              <Route path="/backtesting" element={<PrivateRoute><Backtesting /></PrivateRoute>} />
              <Route path="/ml-analytics" element={<PrivateRoute><MLAnalytics /></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/paper-trading" element={<PrivateRoute><PaperTrading /></PrivateRoute>} />
              <Route path="/strategy-config" element={<PrivateRoute><StrategyConfig /></PrivateRoute>} />
              <Route path="/symbol-analysis" element={<PrivateRoute><SymbolAnalysis /></PrivateRoute>} />
              <Route path="/signals-history" element={<PrivateRoute><SignalHistory /></PrivateRoute>} />

              {/* ── Mobile-first routes ── */}
              <Route path="/m/sinais" element={<PrivateRoute><MobileSignals /></PrivateRoute>} />
              <Route path="/m/grafico" element={<PrivateRoute><MobileChart /></PrivateRoute>} />
              <Route path="/m/backtest" element={<PrivateRoute><MobileBacktest /></PrivateRoute>} />
              <Route path="/m/posicoes" element={<PrivateRoute><MobilePositions /></PrivateRoute>} />
              <Route path="/m/resultados" element={<PrivateRoute><MobileResults /></PrivateRoute>} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <BottomNav />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
