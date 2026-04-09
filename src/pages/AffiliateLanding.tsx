import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { DollarSign, Zap, TrendingUp, Users, ArrowRight, ArrowLeft, BarChart3, Repeat, Infinity } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const AffiliateLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center h-14">
          <button onClick={() => navigate("/profile")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>
      </header>

      <div className="container mt-8 space-y-10 max-w-lg mx-auto">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center mx-auto shadow-lg">
            <DollarSign className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold">Ganhe dinheiro indicando o app</h1>
          <p className="text-muted-foreground text-lg">
            Indique usuários e receba comissões por assinatura para cada cliente que entrar pelo seu link.
          </p>
        </motion.div>

        {/* Como funciona */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 space-y-5">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Como funciona
          </h2>
          <div className="space-y-4">
            {[
              { step: "1", title: "Cadastre-se", desc: "Preencha seus dados para participar do programa" },
              { step: "2", title: "Compartilhe seu link", desc: "Divulgue nas redes sociais e com seus amigos" },
              { step: "3", title: "Ganhe por cada conversão", desc: "Receba comissão automática por cada novo assinante" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Simples e automático.
          </p>
        </motion.div>

        {/* Seus ganhos */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 space-y-5">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" /> Seus ganhos
          </h2>
          <div className="space-y-3">
            {[
              { icon: TrendingUp, text: "Comissão por novos assinantes" },
              { icon: Repeat, text: "Ganhos recorrentes em planos ativos" },
              { icon: Infinity, text: "Sem limite de ganhos" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="bg-primary/10 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-primary">Acompanhe em tempo real:</p>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm">Conversões</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-sm">Comissões</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center space-y-4">
          <h2 className="text-2xl font-display font-bold">🚀 Comece agora</h2>
          <Button
            onClick={() => navigate("/affiliate-register")}
            className="gradient-primary text-primary-foreground w-full text-lg h-14 font-semibold"
          >
            👉 Entrar para o programa <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
};

export default AffiliateLanding;
