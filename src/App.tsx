import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LedgerProvider } from "@/contexts/LedgerContext";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Advances from "./pages/Advances";
import Shops from "./pages/Shops";
import Categories from "./pages/Categories";
import Currencies from "./pages/Currencies";
import Backup from "./pages/Backup";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LedgerProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/advances" element={<Advances />} />
            <Route path="/shops" element={<Shops />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/currencies" element={<Currencies />} />
            <Route path="/backup" element={<Backup />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </LedgerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
