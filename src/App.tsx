import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import SplashScreen from "@/components/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import Chat from "./pages/Chat";
import Community from "./pages/Community";
import Profile from "./pages/Profile";
import Challenges from "./pages/Challenges";
import SearchPeople from "./pages/SearchPeople";
import PublicProfile from "./pages/PublicProfile";
import DirectMessages from "./pages/DirectMessages";
import DirectChat from "./pages/DirectChat";
import Diet from "./pages/Diet";
import NotFound from "./pages/NotFound";
import Moves from "./pages/Moves";
import LandingPage from "./pages/LandingPage";
import Marketplace from "./pages/Marketplace";
import ServiceDetail from "./pages/ServiceDetail";
import SellerDashboard from "./pages/SellerDashboard";
import CreateService from "./pages/CreateService";
import SellerPublicProfile from "./pages/SellerPublicProfile";
import MyPurchases from "./pages/MyPurchases";
import DeliverService from "./pages/DeliverService";
import MarketplaceChat from "./pages/MarketplaceChat";
import MarketplaceConversations from "./pages/MarketplaceConversations";
import SellerTemplates from "./pages/SellerTemplates";
import SellerMaterials from "./pages/SellerMaterials";
import MarketplaceGeneratePlan from "./pages/MarketplaceGeneratePlan";
import PurchaseDetail from "./pages/PurchaseDetail";
import SellerOrderDetail from "./pages/SellerOrderDetail";
import GymPublicProfile from "./pages/GymPublicProfile";
import GymDashboard from "./pages/GymDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminReports from "./pages/admin/AdminReports";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminGyms from "./pages/admin/AdminGyms";
import AdminAffiliates from "./pages/admin/AdminAffiliates";
import AdminAffiliatesExecutive from "./pages/admin/AdminAffiliatesExecutive";
import AffiliateRegistration from "./pages/AffiliateRegistration";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import AffiliateLanding from "./pages/AffiliateLanding";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading, needsPasswordReset } = useAuth();
  const [hasAnamnesis, setHasAnamnesis] = useState<boolean | null>(null);
  const [isGymManager, setIsGymManager] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (user) {
      // Check if user is a gym manager
      supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "gym_manager").maybeSingle().then(({ data }) => {
        setIsGymManager(!!data);
      });

      // If navigating from onboarding with state, skip re-check
      if (location.state?.anamnesisCompleted) {
        setHasAnamnesis(true);
        return;
      }
      setHasAnamnesis(null);
      const timeout = setTimeout(() => {
        setHasAnamnesis(false);
      }, 10000);
      supabase.from("anamnesis").select("id").eq("user_id", user.id).eq("completed", true).maybeSingle().then(({ data, error }) => {
        clearTimeout(timeout);
        if (error) {
          console.error("Anamnesis check error:", error);
          setHasAnamnesis(false);
        } else {
          setHasAnamnesis(!!data);
        }
      });
      return () => clearTimeout(timeout);
    }
  }, [user, location.pathname]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  // Gym managers go directly to gym-dashboard, skip anamnesis
  const isGymManagerUser = isGymManager === true;

  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/auth" element={user && !needsPasswordReset ? (isGymManagerUser ? <Navigate to="/gym-dashboard" /> : <Navigate to="/" />) : needsPasswordReset ? <Navigate to="/reset-password" /> : <Auth />} />
      <Route path="/reset-password" element={needsPasswordReset ? <ResetPassword /> : <Navigate to="/auth" />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
      <Route path="/search-people" element={<ProtectedRoute><SearchPeople /></ProtectedRoute>} />
      <Route path="/profile/:userId" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
      <Route path="/u/:userId" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><DirectMessages /></ProtectedRoute>} />
      <Route path="/dm/:friendId" element={<ProtectedRoute><DirectChat /></ProtectedRoute>} />
      <Route path="/diet" element={<ProtectedRoute><Diet /></ProtectedRoute>} />
      <Route path="/moves" element={<ProtectedRoute><Moves /></ProtectedRoute>} />
      <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
      <Route path="/marketplace/:serviceId" element={<ProtectedRoute><ServiceDetail /></ProtectedRoute>} />
      <Route path="/seller-dashboard" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
      <Route path="/create-service" element={<ProtectedRoute><CreateService /></ProtectedRoute>} />
      <Route path="/edit-service/:serviceId" element={<ProtectedRoute><CreateService /></ProtectedRoute>} />
      <Route path="/seller/:userId" element={<ProtectedRoute><SellerPublicProfile /></ProtectedRoute>} />
       <Route path="/my-purchases" element={<ProtectedRoute><MyPurchases /></ProtectedRoute>} />
       <Route path="/purchase/:purchaseId" element={<ProtectedRoute><PurchaseDetail /></ProtectedRoute>} />
       <Route path="/deliver/:purchaseId" element={<ProtectedRoute><DeliverService /></ProtectedRoute>} />
       <Route path="/seller-order/:purchaseId" element={<ProtectedRoute><SellerOrderDetail /></ProtectedRoute>} />
      <Route path="/marketplace-conversations" element={<ProtectedRoute><MarketplaceConversations /></ProtectedRoute>} />
      <Route path="/marketplace-chat/:conversationId" element={<ProtectedRoute><MarketplaceChat /></ProtectedRoute>} />
      <Route path="/seller-templates" element={<ProtectedRoute><SellerTemplates /></ProtectedRoute>} />
      <Route path="/seller-materials" element={<ProtectedRoute><SellerMaterials /></ProtectedRoute>} />
      <Route path="/marketplace-generate/:purchaseId" element={<ProtectedRoute><MarketplaceGeneratePlan /></ProtectedRoute>} />
      <Route path="/gym/:gymId" element={<ProtectedRoute><GymPublicProfile /></ProtectedRoute>} />
      <Route path="/gym-dashboard" element={<ProtectedRoute><GymDashboard /></ProtectedRoute>} />
      <Route path="/affiliate-landing" element={<ProtectedRoute><AffiliateLanding /></ProtectedRoute>} />
      <Route path="/affiliate-register" element={<ProtectedRoute><AffiliateRegistration /></ProtectedRoute>} />
      <Route path="/affiliate-dashboard" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute><AdminReports /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/gyms" element={<ProtectedRoute><AdminGyms /></ProtectedRoute>} />
      <Route path="/admin/affiliates" element={<ProtectedRoute><AdminAffiliates /></ProtectedRoute>} />
      <Route path="/admin/affiliates-executive" element={<ProtectedRoute><AdminAffiliatesExecutive /></ProtectedRoute>} />

      <Route path="/" element={
        <ProtectedRoute>
          {isGymManagerUser ? (
            <Navigate to="/gym-dashboard" />
          ) : hasAnamnesis || location.state?.anamnesisCompleted ? (
            <Community />
          ) : hasAnamnesis === null ? (
            <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <Navigate to="/onboarding" />
          )}
        </ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(Capacitor.isNativePlatform());

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <SplashScreen visible={showSplash} />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
