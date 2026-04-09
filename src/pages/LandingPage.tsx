import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Flame, Trophy, Users, Dumbbell, TrendingUp, Zap, Star, ChevronRight, Shield, MessageCircle, MapPin, Globe, Play, Utensils, Eye, Lock, UserCheck, Check, X, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/landing-hero.jpg";
import communityImg from "@/assets/landing-community.jpg";
import experienceImg from "@/assets/landing-experience.jpg";
import vynkoLogo from "@/assets/airfit-logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const stats = [
  { value: "120.000+", label: "Treinos realizados" },
  { value: "35.000", label: "Desafios concluídos" },
  { value: "10.000+", label: "Membros da comunidade" },
];

const motivationCards = [
  { icon: Flame, title: "Desafios semanais", desc: "Supere limites com desafios criados para te motivar." },
  { icon: Trophy, title: "Ranking de evolução", desc: "Veja sua evolução e compare com outros membros." },
  { icon: Star, title: "Conquistas e XP", desc: "Ganhe reconhecimento por cada treino completado." },
];

const experienceCards = [
  { icon: Dumbbell, title: "Treinos inteligentes por IA", desc: "Treinos personalizados por IA, adaptados ao seu nível, objetivo e rotina." },
  { icon: Utensils, title: "Dietas inteligentes por IA", desc: "Planos nutricionais gerados por IA com cálculo preciso de calorias, macros e até 10 opções de substituição por alimento." },
  { icon: Users, title: "Comunidade ativa", desc: "Pessoas reais treinando junto com você, todos os dias." },
  { icon: TrendingUp, title: "Evolução visível", desc: "Acompanhe sua jornada fitness com gráficos de progresso e histórico completo." },
];

const challenges = [
  { title: "Desafio 30 dias de treino", emoji: "🔥" },
  { title: "Desafio perder 5kg", emoji: "⚡" },
  { title: "Desafio 100 treinos", emoji: "💪" },
  { title: "Desafio corrida 5km", emoji: "🏃" },
];

const communityFeatures = [
  { icon: MessageCircle, title: "Chat com amigos", desc: "Converse em tempo real com seus parceiros de treino. Motive e seja motivado." },
  { icon: Dumbbell, title: "Publique treinos e evoluções", desc: "Compartilhe seus resultados, PRs e conquistas com toda a comunidade." },
  { icon: MapPin, title: "Marque sua academia", desc: "Mostre onde você treina e encontre pessoas do mesmo local para treinar juntos." },
  { icon: Globe, title: "Conexões pelo mundo", desc: "Conheça pessoas compatíveis em todo o mundo através de conteúdos que te agradam." },
];

const safetyFeatures = [
  { icon: Shield, title: "Moderação ativa", desc: "Todo conteúdo publicado é monitorado e moderado para garantir um ambiente seguro." },
  { icon: Eye, title: "Denúncia simplificada", desc: "Viu algo impróprio? Denuncie em segundos. Sua identidade é 100% sigilosa." },
  { icon: Lock, title: "Privacidade garantida", desc: "Seus dados pessoais são protegidos. Você decide o que é público e o que é privado." },
  { icon: UserCheck, title: "Pontuação de risco", desc: "Usuários reincidentes são identificados automaticamente para manter a comunidade limpa." },
];

const LandingPage = () => {
  useEffect(() => {
    document.title = "Vynko | Ecossistema Fitness com Treinos e Dietas por IA";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "Transforme sua rotina na Vynko! Treine com propósito em uma comunidade ativa, participe de desafios exclusivos e receba dietas e treinos personalizados por IA. Evolua hoje!");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40" aria-label="Navegação principal">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <img src={vynkoLogo} alt="Vynko - Ecossistema Fitness com IA" className="h-10" loading="eager" />
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#social-proof" className="hover:text-foreground transition-colors">Comunidade</a>
            <a href="#challenges" className="hover:text-foreground transition-colors">Desafios</a>
            <a href="#experience" className="hover:text-foreground transition-colors">Experiência</a>
            <a href="#safety" className="hover:text-foreground transition-colors">Segurança</a>
            <a href="#plans" className="hover:text-foreground transition-colors">Planos</a>
          </div>
          <Button size="sm" className="font-display font-semibold" onClick={() => window.location.href = "/auth"}>
            Começar agora
          </Button>
        </div>
      </nav>

      {/* HERO — Heurística #8: foco em proposta de valor + CTA */}
      <header className="relative min-h-screen flex items-center justify-center pt-20">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Pessoas treinando em comunidade na academia" className="w-full h-full object-cover" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial="hidden" animate="visible" className="space-y-8">
            <motion.h1 variants={fadeUp} custom={1} className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              Ecossistema Fitness com Treinos e Dietas{" "}
              <span className="text-gradient">Personalizados por IA.</span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed">
              Treine com propósito. Participe de desafios, evolua com outras pessoas e transforme sua rotina em uma jornada fitness.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-4">
              <Button size="lg" className="font-display font-semibold text-base px-8 h-14 glow-primary" onClick={() => window.location.href = "/auth"}>
                Começar agora <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
              <Button size="lg" variant="outline" className="font-display font-semibold text-base px-8 h-14" onClick={() => document.getElementById("challenges")?.scrollIntoView({ behavior: "smooth" })}>
                Explorar desafios
              </Button>
            </motion.div>
          </motion.div>
          <div className="hidden lg:block" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </header>

      {/* SOCIAL PROOF */}
      <section id="social-proof" className="py-24 md:py-32 relative" aria-label="Prova social">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="font-display text-3xl md:text-5xl font-bold mb-4">
              Milhares de pessoas <span className="text-gradient">evoluindo juntas.</span>
            </motion.h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} variants={fadeUp} custom={i} className="glass-card p-8 text-center group hover:border-primary/30 transition-all duration-500">
                <div className="font-display text-5xl md:text-6xl font-bold text-gradient mb-3">{stat.value}</div>
                <div className="text-muted-foreground text-lg">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* MOTIVATION — Benefícios (H2) */}
      <section className="py-24 md:py-32 relative" aria-label="Benefícios da comunidade">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />
        <div className="relative max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="text-center mb-16 space-y-4">
            <motion.h2 variants={fadeUp} custom={0} className="font-display text-3xl md:text-5xl font-bold leading-tight">
              Sozinho você treina.<br /><span className="text-gradient">Junto você evolui.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Treinar fica mais fácil quando você faz parte de uma comunidade que te incentiva todos os dias.
            </motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="grid md:grid-cols-3 gap-6">
            {motivationCards.map((card, i) => (
              <motion.div key={card.title} variants={fadeUp} custom={i} className="glass-card p-8 group hover:border-primary/40 hover:glow-primary transition-all duration-500">
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-6">
                  <card.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{card.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* EXPERIENCE — Funcionalidades (H3) */}
      <section id="experience" className="py-24 md:py-32 relative" aria-label="Funcionalidades da plataforma">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="space-y-8">
              <motion.h2 variants={fadeUp} custom={0} className="font-display text-3xl md:text-5xl font-bold leading-tight">
                Uma experiência fitness <span className="text-gradient">completamente diferente.</span>
              </motion.h2>
              <div className="space-y-5">
                {experienceCards.map((card, i) => (
                  <motion.div key={card.title} variants={fadeUp} custom={i + 1} className="flex items-start gap-5 p-5 rounded-xl hover:bg-card/60 transition-colors">
                    <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                      <card.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold mb-1">{card.title}</h3>
                      <p className="text-muted-foreground">{card.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="relative">
              <div className="rounded-2xl overflow-hidden border border-border/50 shadow-2xl">
                <img src={experienceImg} alt="Pessoa acompanhando evolução fitness no app Vynko" className="w-full h-auto" loading="lazy" />
              </div>
              <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-primary/15 blur-2xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* MOVES */}
      <section className="py-24 md:py-32 relative" aria-label="Recurso Moves - vídeos curtos">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/20 to-background" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="relative flex justify-center">
              <div className="w-64 md:w-72 aspect-[9/16] rounded-3xl overflow-hidden border-2 border-primary/30 shadow-2xl glow-primary relative">
                <img src={communityImg} alt="Pessoa gravando vídeo curto de treino no Moves" className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-4 right-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Play className="w-5 h-5 text-primary fill-primary" />
                    <span className="text-sm font-display font-semibold text-foreground">Move do dia</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Treino de peito completo 🔥</p>
                </div>
              </div>
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="space-y-6">
              <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-5xl font-bold leading-tight">
                Conheça o <span className="text-gradient">Move.</span>
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-muted-foreground text-lg leading-relaxed">
                Vídeos curtos de até 45 segundos no estilo Reels. Mostre seu treino, inspire pessoas e descubra novos exercícios em um feed vertical infinito.
              </motion.p>
              <motion.div variants={fadeUp} custom={3} className="space-y-3">
                {["Autoplay imersivo em tela cheia", "Stories que duram 24h no topo da comunidade", "Descubra conteúdos recomendados para você"].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span className="text-foreground/80">{item}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CHALLENGES */}
      <section id="challenges" className="py-24 md:py-32 relative" aria-label="Desafios fitness">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/20 to-background" />
        <div className="relative max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="text-center mb-16 space-y-4">
            <motion.h2 variants={fadeUp} custom={0} className="font-display text-3xl md:text-5xl font-bold">
              Todo dia um <span className="text-gradient">novo desafio.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Participe de desafios, complete missões e veja sua evolução crescer.
            </motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {challenges.map((c, i) => (
              <motion.div key={c.title} variants={fadeUp} custom={i} className="glass-card p-6 group hover:border-primary/40 hover:glow-primary transition-all duration-500 cursor-pointer">
                <div className="text-4xl mb-4">{c.emoji}</div>
                <h3 className="font-display text-lg font-semibold mb-2">{c.title}</h3>
                <div className="flex items-center gap-1 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Participar <ChevronRight className="w-4 h-4" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* COMMUNITY FEATURES */}
      <section className="py-24 md:py-32 relative" aria-label="Funcionalidades da comunidade">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="text-center mb-16 space-y-4">
            <motion.h2 variants={fadeUp} custom={0} className="font-display text-3xl md:text-5xl font-bold leading-tight">
              Mais que uma rede social.<br /><span className="text-gradient">Uma comunidade de verdade.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Compartilhe conquistas, inspire pessoas e evolua junto com milhares de membros ao redor do mundo.
            </motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {communityFeatures.map((card, i) => (
              <motion.div key={card.title} variants={fadeUp} custom={i} className="glass-card p-7 group hover:border-primary/40 hover:glow-primary transition-all duration-500">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-5">
                  <card.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{card.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-12 flex flex-wrap justify-center gap-3">
            {["Compartilhe treinos", "Inspire amigos", "Suba no ranking", "Ganhe conquistas", "Marque sua academia", "Encontre parceiros"].map((tag, i) => (
              <motion.span key={tag} variants={fadeUp} custom={i * 0.5} className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                {tag}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SAFETY */}
      <section id="safety" className="py-24 md:py-32 relative" aria-label="Segurança da plataforma">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />
        <div className="relative max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="text-center mb-16 space-y-4">
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-5xl font-bold leading-tight">
              Um ambiente <span className="text-gradient">seguro e respeitoso.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Todos os conteúdos são moderados. Aqui você treina com liberdade, sem preocupações.
            </motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {safetyFeatures.map((card, i) => (
              <motion.div key={card.title} variants={fadeUp} custom={i} className="glass-card p-7 group hover:border-primary/40 transition-all duration-500">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                  <card.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{card.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PRICING */}
      <section id="plans" className="py-24 md:py-32 relative" aria-label="Planos e preços">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="text-center mb-8 space-y-4">
            <motion.h2 variants={fadeUp} custom={0} className="font-display text-3xl md:text-5xl font-bold leading-tight">
              Comece <span className="text-gradient">sem pagar nada.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              Você pode entrar, participar da comunidade, fazer desafios e evoluir sem pagar nada. Os planos são apenas um upgrade de experiência para quem quer mais vantagens e uma jornada fitness ainda mais completa.
            </motion.p>
            <motion.p variants={fadeUp} custom={2} className="text-primary font-display font-semibold text-lg">
              Porque acreditamos que o mais importante é começar.<br />O resto vem com a evolução.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="grid md:grid-cols-3 gap-6 mt-16">
            {/* Gratuito */}
            <motion.div variants={fadeUp} custom={0} className="glass-card p-8 flex flex-col relative">
              <div className="mb-6">
                <h3 className="font-display text-2xl font-bold mb-1">Gratuito</h3>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">R$0</span>
                </div>
                <p className="text-muted-foreground text-sm mt-2">Para sempre. Sem cartão de crédito.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  { text: "Treinos com IA", value: "1 por mês" },
                  { text: "Participar de desafios", included: true },
                  { text: "Participar da comunidade", included: true },
                  { text: "Criar desafios", included: true, note: "Gratuito" },
                  { text: "Dieta com IA", value: "1 a 4 por mês" },
                  { text: "Sem anúncios", included: false },
                  { text: "Insights avançados", included: false },
                  { text: "Eventos exclusivos", included: false },
                ].map((item) => (
                  <li key={item.text} className="flex items-center gap-3 text-sm">
                    {item.included === false ? (
                      <X className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    ) : (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <span className={item.included === false ? "text-muted-foreground/50" : "text-foreground/80"}>
                      {item.text}
                      {item.value && <span className="text-muted-foreground ml-1">({item.value})</span>}
                      {item.note && <span className="text-muted-foreground ml-1">({item.note})</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="lg" className="w-full font-display font-semibold" onClick={() => window.location.href = "/auth"}>
                Começar grátis
              </Button>
            </motion.div>

            {/* Pro */}
            <motion.div variants={fadeUp} custom={1} className="glass-card p-8 flex flex-col relative border-primary/50 glow-primary">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full gradient-primary text-primary-foreground text-sm font-display font-bold">
                Mais popular
              </div>
              <div className="mb-6">
                <h3 className="font-display text-2xl font-bold mb-1">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold text-gradient">R$34,90</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <p className="text-muted-foreground text-sm mt-2">Para quem quer evoluir mais rápido.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  { text: "Treinos com IA", value: "12 por mês" },
                  { text: "Participar de desafios", included: true },
                  { text: "Participar da comunidade", included: true },
                  { text: "Criar desafios", included: true, note: "Gratuito" },
                  { text: "Dieta com IA", value: "12 por mês" },
                  { text: "Sem anúncios", included: true },
                  { text: "Insights avançados", included: false },
                  { text: "Eventos exclusivos", included: false },
                ].map((item) => (
                  <li key={item.text} className="flex items-center gap-3 text-sm">
                    {item.included === false ? (
                      <X className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    ) : (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <span className={item.included === false ? "text-muted-foreground/50" : "text-foreground/80"}>
                      {item.text}
                      {item.value && <span className="text-muted-foreground ml-1">({item.value})</span>}
                      {item.note && <span className="text-muted-foreground ml-1">({item.note})</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Button size="lg" className="w-full font-display font-bold glow-primary" onClick={() => window.location.href = "/auth"}>
                Assinar Pro <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>

            {/* Premium */}
            <motion.div variants={fadeUp} custom={2} className="glass-card p-8 flex flex-col relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-foreground text-background text-sm font-display font-bold flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> Premium
              </div>
              <div className="mb-6">
                <h3 className="font-display text-2xl font-bold mb-1">Premium</h3>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">R$54,90</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <p className="text-muted-foreground text-sm mt-2">Experiência completa sem limites.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  { text: "Treinos com IA", value: "Ilimitado" },
                  { text: "Participar de desafios", included: true },
                  { text: "Participar da comunidade", included: true },
                  { text: "Criar desafios", included: true, note: "Monetizado" },
                  { text: "Dieta com IA", value: "Ilimitado" },
                  { text: "Sem anúncios", included: true },
                  { text: "Insights avançados", included: true },
                  { text: "Eventos exclusivos", included: true },
                ].map((item) => (
                  <li key={item.text} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-foreground/80">
                      {item.text}
                      {item.value && <span className="text-muted-foreground ml-1">({item.value})</span>}
                      {item.note && <span className="text-muted-foreground ml-1">({item.note})</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Button size="lg" variant="secondary" className="w-full font-display font-bold" onClick={() => window.location.href = "/auth"}>
                Assinar Premium <Crown className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 md:py-32 relative" aria-label="Chamada para ação">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="space-y-8">
            <motion.h2 variants={fadeUp} custom={0} className="font-display text-4xl md:text-6xl font-bold leading-tight">
              Sua evolução <span className="text-gradient">começa hoje.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-xl max-w-xl mx-auto">
              Entre para a comunidade fitness que transforma rotina em resultado.
            </motion.p>
            <motion.div variants={fadeUp} custom={2}>
              <Button size="lg" className="font-display font-bold text-lg px-12 h-16 glow-primary animate-pulse-glow" onClick={() => window.location.href = "/auth"}>
                Entrar para a comunidade <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER — Heurística #10: navegação estruturada */}
      <footer className="border-t border-border/40 py-12" role="contentinfo">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="space-y-4">
              <img src={vynkoLogo} alt="Vynko - Ecossistema Fitness" className="h-10" loading="lazy" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                A comunidade fitness que transforma treino em evolução com treinos e dietas personalizados por IA.
              </p>
            </div>
            <nav aria-label="Links da plataforma">
              <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Plataforma</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="/landing" className="text-foreground/70 hover:text-primary transition-colors">Home</a></li>
                <li><a href="#social-proof" className="text-foreground/70 hover:text-primary transition-colors">Sobre</a></li>
                <li><a href="#experience" className="text-foreground/70 hover:text-primary transition-colors">Treinos</a></li>
              </ul>
            </nav>
            <nav aria-label="Links de recursos">
              <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Recursos</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#challenges" className="text-foreground/70 hover:text-primary transition-colors">Desafios</a></li>
                <li><a href="#safety" className="text-foreground/70 hover:text-primary transition-colors">Segurança</a></li>
                <li><a href="mailto:contato@vynko.com.br" className="text-foreground/70 hover:text-primary transition-colors">Contato</a></li>
              </ul>
            </nav>
            <nav aria-label="Links legais">
              <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="/termos" className="text-foreground/70 hover:text-primary transition-colors">Termos de Uso</a></li>
                <li><a href="/privacidade" className="text-foreground/70 hover:text-primary transition-colors">Política de Privacidade</a></li>
              </ul>
            </nav>
          </div>
          <div className="border-t border-border/40 pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Vynko. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
