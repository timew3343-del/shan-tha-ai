import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "./i18n/LanguageContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import TopUp from "./pages/TopUp";
import Support from "./pages/Support";
import TransactionHistory from "./pages/TransactionHistory";
import Admin from "./pages/Admin";
import AILiveCam from "./pages/AILiveCam";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/top-up" element={<TopUp />} />
              <Route path="/support" element={<Support />} />
              <Route path="/transactions" element={<TransactionHistory />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/ai-live-cam" element={<AILiveCam />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
