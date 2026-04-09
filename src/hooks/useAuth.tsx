import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  needsPasswordReset: boolean;
  clearPasswordReset: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  needsPasswordReset: false,
  clearPasswordReset: () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        setNeedsPasswordReset(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for deep link / URL open on native platforms (OAuth callback)
    if (Capacitor.isNativePlatform()) {
      (async () => {
        const { App: CapApp } = await import("@capacitor/app");
        const { Browser } = await import("@capacitor/browser");

        // Helper to extract tokens from a URL (hash or query)
        const extractTokens = (url: string) => {
          try {
            const parsed = new URL(url);
            const hashParams = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);
            const queryParams = parsed.searchParams;
            const accessToken = hashParams.get('access_token') ?? queryParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token') ?? queryParams.get('refresh_token');
            return { accessToken, refreshToken };
          } catch {
            return { accessToken: null, refreshToken: null };
          }
        };

        const handleTokens = async (url: string) => {
          const { accessToken, refreshToken } = extractTokens(url);
          if (accessToken && refreshToken) {
            // Close browser FIRST to avoid showing URL bar
            try { await Browser.close(); } catch {}
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            return true;
          }
          return false;
        };

        CapApp.addListener('appUrlOpen', async ({ url }) => {
          try { await Browser.close(); } catch {}
          try {
            await handleTokens(url);
          } catch (e) {
            console.error('OAuth callback parse error:', e);
          }
        });

        // Also listen for URL changes inside the in-app browser
        // in case the redirect doesn't trigger a deep link
        Browser.addListener('browserPageLoaded', async () => {
          // Small delay to let the page settle
          await new Promise(r => setTimeout(r, 500));
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            try { await Browser.close(); } catch {}
            setSession(data.session);
            setUser(data.session.user);
          }
        });

        Browser.addListener('browserFinished', async () => {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
          }
        });
      })();
    }

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setNeedsPasswordReset(false);
    await supabase.auth.signOut();
  };

  const clearPasswordReset = () => setNeedsPasswordReset(false);

  return (
    <AuthContext.Provider value={{ user, session, loading, needsPasswordReset, clearPasswordReset, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
