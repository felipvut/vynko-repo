import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
import vynkoLogo from "@/assets/airfit-logo.png";
import heroImage from "@/assets/hero-gym.jpg";
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Capacitor } from "@capacitor/core";

type AuthView = "login" | "signup" | "forgot";

const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem("vynko_ref", ref);
    }
  }, [searchParams]);

  useEffect(() => {
    const initGoogle = async () => {
      await SocialLogin.initialize({
        google: {
          webClientId: VITE_GOOGLE_CLIENT_ID,        // Required for Android and Web// Required for iOS offline mode and server authorization (same as webClientId)
          mode: 'online',  // 'online' or 'offline'
        }
      });
    }
    initGoogle();
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (view === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
          setView("login");
        }
      } else if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(error.message);
        } else {
          navigate("/");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          toast.error(error.message);
        } else {
          const refCode = localStorage.getItem("vynko_ref");
          if (refCode) {
            try {
              const { data: aff } = await supabase
                .from("affiliates")
                .select("id")
                .eq("referral_code", refCode)
                .eq("status", "approved")
                .maybeSingle();
              if (aff) {
                const { data: session } = await supabase.auth.getSession();
                if (session?.session?.user?.id) {
                  await supabase.from("affiliate_referrals").insert({
                    affiliate_id: (aff as any).id,
                    referred_user_id: session.session.user.id,
                  } as any);
                }
              }
              localStorage.removeItem("vynko_ref");
            } catch { }
          }
          toast.success("Conta criada com sucesso!");
          navigate("/profile");
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        toast.error("A requisição demorou demais. Tente novamente.");
      } else {
        toast.error("Erro de conexão. Tente novamente em alguns instantes.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const res: any = await SocialLogin.login({
          provider: 'google',
          options: {
            scopes: ['email', 'profile'],
          },
        });

        console.log("Google response:", res);

        const idToken = res?.result?.idToken;

        if (!idToken) {
          throw new Error("ID Token não encontrado");
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
        });


        if (error) {
          console.error(error);
          toast.error("Erro ao autenticar com Supabase1" + JSON.stringify(error));
          return;
        }

        toast.success("Login realizado com sucesso!");
        navigate("/");

      } else {
        const { error } = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });

        if (error) {
          toast.error(error.message);
        }
      }
    } catch (err) {
      console.error("Google login error:", err);
      toast.error("Erro ao entrar com Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  const getTitle = () => {
    if (view === "forgot") return "Recuperar senha";
    if (view === "signup") return "Crie sua conta";
    return "Bem-vindo de volta";
  };

  const getSubtitle = () => {
    if (view === "forgot") return "Informe seu e-mail para receber o link de redefinição";
    if (view === "signup") return "Comece sua jornada fitness hoje";
    return "Acesse a comunidade fitness que mais cresce no mundo";
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={heroImage} alt="Gym" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-3 mb-4">
              <img src={vynkoLogo} alt="Vynko" className="h-14" />
            </div>
            <p className="text-xl font-semibold text-foreground max-w-md leading-relaxed">
              Sugestão de Treinos e Dietas inteligentes gerados por IA, personalizados para seu corpo, seus objetivos e sua rotina.
            </p>
            <p className="text-base text-muted-foreground max-w-md mt-3">
              Evolua com desafios reais e faça parte da comunidade fitness que mais cresce no mundo.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src={vynkoLogo} alt="Vynko" className="h-10" />
          </div>

          <div>
            {view === "forgot" && (
              <button
                onClick={() => setView("login")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </button>
            )}
            <h2 className="text-2xl font-display font-bold">{getTitle()}</h2>
            <p className="text-muted-foreground mt-1">{getSubtitle()}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {view === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 bg-secondary border-border"
                    required
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-secondary border-border"
                  required
                />
              </div>
            </div>
            {view !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-secondary border-border"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full gradient-primary font-semibold text-primary-foreground" disabled={loading}>
              {loading
                ? "Carregando..."
                : view === "forgot"
                  ? "Enviar link de recuperação"
                  : view === "login"
                    ? "Entrar"
                    : "Criar conta"}
            </Button>
          </form>

          {view !== "forgot" && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou continue com</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {googleLoading ? "Conectando..." : "Google"}
              </Button>
            </>
          )}

          {view === "login" && (
            <div className="text-center space-y-2">
              <button
                onClick={() => setView("forgot")}
                className="text-sm text-primary hover:underline font-medium block mx-auto"
              >
                Esqueci minha senha
              </button>
              <p className="text-sm text-muted-foreground">
                Não tem conta?{" "}
                <button onClick={() => setView("signup")} className="text-primary hover:underline font-medium">
                  Cadastre-se
                </button>
              </p>
            </div>
          )}

          {view === "signup" && (
            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <button onClick={() => setView("login")} className="text-primary hover:underline font-medium">
                Faça login
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
