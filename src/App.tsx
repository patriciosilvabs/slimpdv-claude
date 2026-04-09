import { Suspense, lazy, useEffect } from "react";
import { unlockAudioContext } from "@/utils/generateTone";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { OfflineSyncProvider } from "@/contexts/OfflineSyncContext";
import { PrinterProvider } from "@/contexts/PrinterContext";
import { PrintQueueListener } from "@/components/PrintQueueListener";
import { GlobalAlerts } from "@/components/GlobalAlerts";
import { AiAssistant } from "@/components/AiAssistant";
import { RequireTenant } from "@/components/auth/RequireTenant";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tables = lazy(() => import("./pages/Tables"));
const Orders = lazy(() => import("./pages/Orders"));
const Menu = lazy(() => import("./pages/Menu"));
const Profile = lazy(() => import("./pages/Profile"));
const Stock = lazy(() => import("./pages/Stock"));
const CashRegister = lazy(() => import("./pages/CashRegister"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Install = lazy(() => import("./pages/Install"));
const Counter = lazy(() => import("./pages/Counter"));
const Customers = lazy(() => import("./pages/Customers"));
const OrderManagement = lazy(() => import("./pages/OrderManagement"));
const KDS = lazy(() => import("./pages/KdsV2"));
const ClosingHistory = lazy(() => import("./pages/ClosingHistory"));
const CancellationHistory = lazy(() => import("./pages/CancellationHistory"));
const ItemCancellationHistory = lazy(() => import("./pages/ItemCancellationHistory"));
const Performance = lazy(() => import("./pages/Performance"));
const ReopenHistory = lazy(() => import("./pages/ReopenHistory"));
const AuditDashboard = lazy(() => import("./pages/AuditDashboard"));
const ShareReceiver = lazy(() => import("./pages/ShareReceiver"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Production = lazy(() => import("./pages/Production"));
const CreateStore = lazy(() => import("./pages/CreateStore"));
const NotFound = lazy(() => import("./pages/NotFound"));
const StorePage = lazy(() => import("./pages/store/StorePage"));

// Platform Admin Pages
const PlatformDashboard = lazy(() => import("./pages/platform/PlatformDashboard"));
const PlatformTenants = lazy(() => import("./pages/platform/PlatformTenants"));
const PlatformSubscriptions = lazy(() => import("./pages/platform/PlatformSubscriptions"));
const PlatformAdmins = lazy(() => import("./pages/platform/PlatformAdmins"));
const PlatformPlans = lazy(() => import("./pages/platform/PlatformPlans"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  useEffect(() => {
    const unlock = () => {
      unlockAudioContext();
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <OfflineSyncProvider>
          <PrinterProvider>
            <TooltipProvider>
              <Sonner />
              <BrowserRouter>
                <PrintQueueListener />
                <GlobalAlerts />
                <AiAssistant />
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/auth" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/invite/:token" element={<AcceptInvite />} />
                  <Route path="/create-store" element={<CreateStore />} />
                  <Route path="/loja/:slug" element={<StorePage />} />
                  
                  {/* Platform Admin routes */}
                  <Route path="/platform" element={<PlatformDashboard />} />
                  <Route path="/platform/tenants" element={<PlatformTenants />} />
                  <Route path="/platform/subscriptions" element={<PlatformSubscriptions />} />
                  <Route path="/platform/admins" element={<PlatformAdmins />} />
                  <Route path="/platform/plans" element={<PlatformPlans />} />
                  
                  {/* Protected routes - require tenant */}
                  <Route path="/dashboard" element={<RequireTenant><Dashboard /></RequireTenant>} />
                  <Route path="/tables" element={<RequireTenant><Tables /></RequireTenant>} />
                  <Route path="/orders" element={<RequireTenant><Orders /></RequireTenant>} />
                  <Route path="/menu" element={<RequireTenant><Menu /></RequireTenant>} />
                  <Route path="/stock" element={<RequireTenant><Stock /></RequireTenant>} />
                  <Route path="/cash-register" element={<RequireTenant><CashRegister /></RequireTenant>} />
                  <Route path="/reports" element={<RequireTenant><Reports /></RequireTenant>} />
                  <Route path="/settings" element={<RequireTenant><Settings /></RequireTenant>} />
                  <Route path="/settings/:section" element={<RequireTenant><Settings /></RequireTenant>} />
                  <Route path="/install" element={<RequireTenant><Install /></RequireTenant>} />
                  <Route path="/counter" element={<RequireTenant><Counter /></RequireTenant>} />
                  <Route path="/customers" element={<RequireTenant><Customers /></RequireTenant>} />
                  <Route path="/order-management" element={<RequireTenant><OrderManagement /></RequireTenant>} />
                  <Route path="/kds" element={<KDS />} />
                  <Route path="/closing-history" element={<RequireTenant><ClosingHistory /></RequireTenant>} />
                  <Route path="/cancellation-history" element={<RequireTenant><CancellationHistory /></RequireTenant>} />
                  <Route path="/item-cancellation-history" element={<RequireTenant><ItemCancellationHistory /></RequireTenant>} />
                  <Route path="/performance" element={<RequireTenant><Performance /></RequireTenant>} />
                  <Route path="/reopen-history" element={<RequireTenant><ReopenHistory /></RequireTenant>} />
                  <Route path="/audit-dashboard" element={<RequireTenant><AuditDashboard /></RequireTenant>} />
                  <Route path="/share-receiver" element={<RequireTenant><ShareReceiver /></RequireTenant>} />
                  <Route path="/profile" element={<RequireTenant><Profile /></RequireTenant>} />
                  <Route path="/production" element={<RequireTenant><Production /></RequireTenant>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </PrinterProvider>
        </OfflineSyncProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
