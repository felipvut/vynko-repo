import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Flag, Users, Dumbbell, ArrowLeft, Users2, BarChart3, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/reports", label: "Denúncias", icon: Flag },
  { path: "/admin/users", label: "Usuários", icon: Users },
  { path: "/admin/gyms", label: "Academias", icon: Dumbbell },
  { path: "/admin/affiliates", label: "Afiliados", icon: Users2 },
  { path: "/admin/affiliates-executive", label: "Afiliados Executivo", icon: BarChart3 },
];

export const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, isLoading } = useAdmin();
  const { loading, signOut } = useAuth();
  const location = useLocation();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold text-foreground font-['Space_Grotesk']">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">Gerenciamento</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                location.pathname === item.path
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-border space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao app
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
};
