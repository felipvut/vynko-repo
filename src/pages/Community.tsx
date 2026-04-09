import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Dumbbell, Users } from "lucide-react";
import vynkoLogo from "@/assets/airfit-logo.png";
import NotificationBell from "@/components/NotificationBell";
import ChatIcon from "@/components/ChatIcon";
import { Button } from "@/components/ui/button";
import PostCard from "@/components/community/PostCard";
import CreateMoveSheet from "@/components/community/CreateMoveSheet";
import CreatePostSheet from "@/components/community/CreatePostSheet";
import FriendsSheet from "@/components/community/FriendsSheet";
import StoriesBar from "@/components/community/StoriesBar";
import { useFeed, useFriendships } from "@/hooks/useCommunity";
import BottomNav from "@/components/BottomNav";
import OnboardingTour from "@/components/OnboardingTour";

const Community = () => {
  const navigate = useNavigate();
  const { posts, loading, refresh } = useFeed();
  const { pending } = useFriendships();
  const [showCreateMove, setShowCreateMove] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0);

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const PULL_THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return;
    if (window.scrollY > 0) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) {
      setPullDistance(Math.min(dy * 0.5, 120));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      await refresh();
      setStoriesRefreshKey(k => k + 1);
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, refreshing, refresh]);

  return (
    <>
    <OnboardingTour />
    <div
      ref={scrollContainerRef}
      className="min-h-screen pb-24"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex justify-center items-center overflow-hidden transition-all"
          style={{ height: refreshing ? 48 : pullDistance }}
        >
          <div
            className={`h-6 w-6 border-2 border-primary border-t-transparent rounded-full ${
              refreshing || pullDistance >= PULL_THRESHOLD ? "animate-spin" : ""
            }`}
            style={{
              opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
              transform: `rotate(${pullDistance * 3}deg)`,
            }}
          />
        </div>
      )}

      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <img src={vynkoLogo} alt="Vynko" className="h-9" />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowFriends(true)} className="p-2 rounded-full hover:bg-accent/50 transition-colors relative">
              <Users className="h-5 w-5 text-foreground" />
              {pending.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                  {pending.length}
                </span>
              )}
            </button>
            <ChatIcon />
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Stories bar */}
      <div className="border-b border-border/30">
        <StoriesBar onAddStory={() => setShowCreateMove(true)} refreshKey={storiesRefreshKey} />
      </div>

      {/* Feed */}
      <div className="container mt-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-8 text-center space-y-4">
            <Dumbbell className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-display font-bold">Nenhum post ainda</h2>
            <p className="text-muted-foreground text-sm">Seja o primeiro a compartilhar!</p>
          </motion.div>
        ) : (
          posts.map((post, i) => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <PostCard post={post} onRefresh={refresh} />
            </motion.div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowCreatePost(true)}
        className="fixed bottom-24 right-6 h-14 w-14 rounded-full gradient-primary flex items-center justify-center shadow-lg glow-primary z-50"
      >
        <Plus className="h-6 w-6 text-primary-foreground" />
      </button>

      <CreateMoveSheet open={showCreateMove} onOpenChange={setShowCreateMove} onCreated={() => setStoriesRefreshKey(k => k + 1)} />
      <CreatePostSheet open={showCreatePost} onOpenChange={setShowCreatePost} onCreated={refresh} />
      <FriendsSheet open={showFriends} onOpenChange={setShowFriends} />
      <BottomNav />
    </div>
    </>
  );
};

export default Community;
