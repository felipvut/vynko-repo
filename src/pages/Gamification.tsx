import { useNavigate } from "react-router-dom";
import { useGamification, xpProgress, type Badge } from "@/hooks/useGamification";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Flame, Star, Trophy, Crown, Zap, Target, Medal,
  Dumbbell, Loader2
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  dumbbell: Dumbbell, flame: Flame, trophy: Trophy, crown: Crown,
  zap: Zap, target: Target, medal: Medal, star: Star,
};

const Gamification = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userXp, badges, earnedBadges, leaderboard, loading } = useGamification();

  const earnedIds = new Set(earnedBadges.map((b) => b.badge_id));
  const progressPct = userXp ? xpProgress(userXp.total_xp, userXp.level) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center h-14 gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Star className="h-5 w-5 text-primary" />
          <span className="font-display font-bold text-lg">Gamificação</span>
        </div>
      </header>

      <div className="container max-w-lg mx-auto mt-6 space-y-6 px-4">
        {/* XP Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Nível</p>
              <p className="text-4xl font-display font-bold text-primary">{userXp?.level || 1}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">XP Total</p>
              <p className="text-2xl font-bold">{userXp?.total_xp || 0}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Próximo nível</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-3" />
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-lg font-bold">{userXp?.current_streak || 0}</p>
                <p className="text-[10px] text-muted-foreground">Dias seguidos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{userXp?.longest_streak || 0}</p>
                <p className="text-[10px] text-muted-foreground">Recorde</p>
              </div>
            </div>
          </div>
        </motion.div>

        <Tabs defaultValue="badges">
          <TabsList className="w-full">
            <TabsTrigger value="badges" className="flex-1">Conquistas</TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1">Ranking</TabsTrigger>
          </TabsList>

          <TabsContent value="badges" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              {badges.map((badge, i) => {
                const earned = earnedIds.has(badge.id);
                const Icon = ICON_MAP[badge.icon] || Trophy;
                return (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className={`glass-card p-4 text-center space-y-2 ${earned ? "border-primary/50" : "opacity-40"}`}
                  >
                    <Icon className={`h-8 w-8 mx-auto ${earned ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-sm font-semibold">{badge.name}</p>
                    <p className="text-[10px] text-muted-foreground">{badge.description}</p>
                    {badge.xp_reward > 0 && (
                      <p className="text-[10px] text-primary font-semibold">+{badge.xp_reward} XP</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4 space-y-2">
            {leaderboard.map((entry, i) => {
              const isMe = entry.user_id === user?.id;
              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-3 p-3 rounded-lg ${isMe ? "bg-primary/10 border border-primary/30" : "bg-secondary/30"}`}
                >
                  <span className="w-7 text-center font-bold text-sm">
                    {i === 0 ? <Crown className="h-5 w-5 text-warning mx-auto" /> :
                     i === 1 ? <Medal className="h-5 w-5 text-muted-foreground mx-auto" /> :
                     i === 2 ? <Medal className="h-5 w-5 text-accent mx-auto" /> :
                     `${i + 1}º`}
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={entry.avatar_url || ""} />
                    <AvatarFallback className="text-xs">{(entry.full_name || "?")[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{entry.full_name}{isMe ? " (você)" : ""}</p>
                    <p className="text-[10px] text-muted-foreground">Nível {entry.level} • 🔥 {entry.current_streak}</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-primary">{entry.total_xp} XP</span>
                </motion.div>
              );
            })}
            {leaderboard.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum jogador ainda.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Gamification;
