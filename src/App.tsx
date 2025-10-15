import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell";
import { Guard } from "./components/Guard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Portal from "./pages/Portal";
import Admin from "./pages/Admin";
import AdminCovenants from "./pages/AdminCovenants";
import AdminLoans from "./pages/AdminLoans";
import AdminLoanDetail from "./pages/AdminLoanDetail";
import Analytics from "./pages/Analytics";
import Borrower from "./pages/Borrower";
import BorrowerLoanDetail from "./pages/portal/LoanDetail";
import PortfolioDashboard from "./pages/admin/PortfolioDashboard";
import Reports from "./pages/admin/Reports";
import Setup from "./pages/Setup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
