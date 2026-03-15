import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { PrivateRoute } from "@/components/auth/PrivateRoute";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Portfolio from "./pages/Portfolio";
import Trades from "./pages/Trades";
import Analytics from "./pages/Analytics";
import Transactions from "./pages/Transactions";
import TaxReport from "./pages/TaxReport";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import RiskManagement from "./pages/RiskManagement";
import Backtesting from "./pages/Backtesting";
import MLAnalytics from "./pages/MLAnalytics";
import PaperTrading from "./pages/PaperTrading";
import StrategyConfig from "./pages/StrategyConfig";
import SymbolAnalysis from "./pages/SymbolAnalysis";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public route — only accessible without auth */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes — require valid admin session */}
            <Route path="/" element={<PrivateRoute><Index /></PrivateRoute>} />
            <Route path="/portfolio" element={<PrivateRoute><Portfolio /></PrivateRoute>} />
            <Route path="/trades" element={<PrivateRoute><Trades /></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
            <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
            <Route path="/tax-report" element={<PrivateRoute><TaxReport /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/risk-management" element={<PrivateRoute><RiskManagement /></PrivateRoute>} />
            <Route path="/backtesting" element={<PrivateRoute><Backtesting /></PrivateRoute>} />
            <Route path="/ml-analytics" element={<PrivateRoute><MLAnalytics /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/paper-trading" element={<PrivateRoute><PaperTrading /></PrivateRoute>} />
            <Route path="/strategy-config" element={<PrivateRoute><StrategyConfig /></PrivateRoute>} />
            <Route path="/symbol-analysis" element={<PrivateRoute><SymbolAnalysis /></PrivateRoute>} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
