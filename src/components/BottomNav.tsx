import { useNavigate, useLocation } from "react-router-dom";
import { Home, Trophy, Dumbbell, ShoppingBag, UserCircle, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [user]);

  const tabs = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/challenges", icon: Trophy, label: "Desafio" },
    { path: "/marketplace", icon: ShoppingBag, label: "Market" },
    { path: "/training", icon: Dumbbell, label: "Treino" },
    { path: "/diet", icon: UtensilsCrossed, label: "Dieta" },
    { path: "/profile", icon: UserCircle, label: "Perfil" },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-xl" style={{ paddingBottom: isNative ? 'env(safe-area-inset-bottom, 0px)' : '0px' }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {tab.path === "/profile" ? (
                avatarUrl ? (
                  <Avatar className={`h-6 w-6 ${active ? "ring-2 ring-primary" : ""}`}>
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-[10px]">
                      <UserCircle className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <tab.icon className="h-5 w-5" />
                )
              ) : (
                <tab.icon className="h-5 w-5" />
              )}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
