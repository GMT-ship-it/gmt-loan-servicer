import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell";
import { Guard } from "./components/Guard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Index from "./pages/Index";
import Apply from "./pages/Apply";
import Login from "./pages/Login";
import Portal from "./pages/Portal";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Admin from "./pages/Admin";
import AdminCovenants from "./pages/AdminCovenants";
import AdminLoans from "./pages/AdminLoans";
import AdminLoanDetail from "./pages/AdminLoanDetail";
import Analytics from "./pages/Analytics";
import Borrower from "./pages/Borrower";
import BorrowerLoanDetail from "./pages/portal/LoanDetail";
import PortfolioDashboard from "./pages/admin/PortfolioDashboard";
import Reports from "./pages/admin/Reports";
import FinanceInstruments from "./pages/admin/FinanceInstruments";
import FinanceEntities from "./pages/admin/FinanceEntities";
import FinanceCounterparties from "./pages/admin/FinanceCounterparties";
import Setup from "./pages/Setup";
import NotFound from "./pages/NotFound";

// PMD (Portfolio Management Dashboard) pages
import { OwnerGuard } from "./components/pmd/OwnerGuard";
import { PmdLayout } from "./components/pmd/PmdLayout";
import PmdDashboard from "./pages/pmd/PmdDashboard";
import PmdCapital from "./pages/pmd/PmdCapital";
import PmdProjects from "./pages/pmd/PmdProjects";
import PmdLiquidation from "./pages/pmd/PmdLiquidation";
import PmdAdmin from "./pages/pmd/PmdAdmin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/portal" element={<Portal />} />
          <Route element={<AppShell />}>
            <Route path="/admin" element={
              <ErrorBoundary>
                <Guard need={["admin", "analyst"]}>
                  <Admin />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/admin/covenants" element={
              <ErrorBoundary>
                <Guard need={["admin", "analyst"]}>
                  <AdminCovenants />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/admin/loans" element={
              <ErrorBoundary>
                <Guard need={["admin", "analyst"]}>
                  <AdminLoans />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/admin/loans/:id" element={
              <ErrorBoundary>
                <Guard need={["admin", "analyst"]}>
                  <AdminLoanDetail />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/admin/dashboard" element={
              <ErrorBoundary>
                <Guard need={["admin", "analyst"]}>
                  <PortfolioDashboard />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/admin/reports" element={
              <ErrorBoundary>
                <Guard need={["admin", "analyst"]}>
                  <Reports />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/analytics" element={
              <ErrorBoundary>
                <Guard need={["admin", "analyst"]}>
                  <Analytics />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/admin/finance/instruments" element={
              <ErrorBoundary>
                <Guard need={["admin"]}>
                  <FinanceInstruments />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/admin/finance/entities" element={
              <ErrorBoundary>
                <Guard need={["admin"]}>
                  <FinanceEntities />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/admin/finance/counterparties" element={
              <ErrorBoundary>
                <Guard need={["admin"]}>
                  <FinanceCounterparties />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/borrower" element={
              <ErrorBoundary>
                <Guard need={["borrower"]}>
                  <Borrower />
                </Guard>
              </ErrorBoundary>
            } />
            <Route path="/portal/loans/:id" element={
              <ErrorBoundary>
                <Guard need={["borrower"]}>
                  <BorrowerLoanDetail />
                </Guard>
              </ErrorBoundary>
            } />
          </Route>
          
          {/* PMD Routes - Owner Only */}
          <Route path="/pmd/dashboard" element={
            <OwnerGuard>
              <PmdLayout><PmdDashboard /></PmdLayout>
            </OwnerGuard>
          } />
          <Route path="/pmd/capital" element={
            <OwnerGuard>
              <PmdLayout><PmdCapital /></PmdLayout>
            </OwnerGuard>
          } />
          <Route path="/pmd/projects" element={
            <OwnerGuard>
              <PmdLayout><PmdProjects /></PmdLayout>
            </OwnerGuard>
          } />
          <Route path="/pmd/liquidation" element={
            <OwnerGuard>
              <PmdLayout><PmdLiquidation /></PmdLayout>
            </OwnerGuard>
          } />
          <Route path="/pmd/admin" element={
            <OwnerGuard>
              <PmdLayout><PmdAdmin /></PmdLayout>
            </OwnerGuard>
          } />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
import { BorrowerDashboard } from "./components/BorrowerDashboard";
// Rendering BorrowerDashboard
<BorrowerDashboard />
