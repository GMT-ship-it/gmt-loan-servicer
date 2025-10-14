import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell";
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
          <Route path="/portal" element={<Portal />} />
          <Route element={<AppShell />}>
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/covenants" element={<AdminCovenants />} />
            <Route path="/admin/loans" element={<AdminLoans />} />
            <Route path="/admin/loans/:id" element={<AdminLoanDetail />} />
            <Route path="/admin/dashboard" element={<PortfolioDashboard />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/borrower" element={<Borrower />} />
            <Route path="/portal/loans/:id" element={<BorrowerLoanDetail />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
