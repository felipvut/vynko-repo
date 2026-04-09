import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, UserPlus, UserCheck, AtSign, Dumbbell, UtensilsCrossed, Users, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { useBackButton } from "@/hooks/useBackButton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCallback } from "react";

const ICON_MAP: Record<string, any> = {
  new_follow: Users,
  friendship_request: UserPlus,
  friendship_accepted: UserCheck,
  mention: AtSign,
  workout_expiring: Dumbbell,
  diet_expiring: UtensilsCrossed,
  shared_plan: Users,
};

function NotificationItem({ notification, onTap }: { notification: Notification; onTap: () => void }) {
  const Icon = ICON_MAP[notification.type] || Bell;
  const isUnread = !notification.read_at;

  return (
    <button
      onClick={onTap}
      className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
        isUnread ? "bg-primary/5" : "hover:bg-muted/50"
      }`}
    >
      {notification.actor_profile ? (
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={notification.actor_profile.avatar_url || ""} />
          <AvatarFallback className="text-xs">
            {(notification.actor_profile.full_name || notification.actor_profile.username || "?")[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          {notification.actor_profile && (
            <span className="font-semibold">{notification.actor_profile.full_name || notification.actor_profile.username}</span>
          )}{" "}
          <span className={isUnread ? "text-foreground" : "text-muted-foreground"}>{notification.title}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
      {isUnread && <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 mt-1.5" />}
    </button>
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleClose = useCallback(() => setOpen(false), []);
  useBackButton(open, handleClose);

  const handleTap = (notification: Notification) => {
    if (!notification.read_at) markAsRead(notification.id);

    // Navigate based on type
    if (notification.type === "new_follow" || notification.type === "friendship_request" || notification.type === "friendship_accepted") {
      if (notification.actor_id) {
        navigate(`/u/${notification.actor_id}`);
        setOpen(false);
      }
    } else if (notification.type === "mention" && notification.reference_id) {
      setOpen(false);
      // Post is on the community feed
    } else if (notification.type === "workout_expiring") {
      navigate("/training");
      setOpen(false);
    } else if (notification.type === "diet_expiring") {
      navigate("/diet");
      setOpen(false);
    } else if (notification.type === "anamnesis_expired") {
      navigate("/onboarding");
      setOpen(false);
    } else if (notification.type.startsWith("inactivity_")) {
      navigate("/training");
      setOpen(false);
    } else if (notification.type === "shared_plan") {
      const text = ((notification.title || "") + " " + (notification.body || "")).toLowerCase();
      if (text.includes("dieta") || text.includes("diet")) {
        navigate("/diet", { state: { openPendingShares: true } });
      } else {
        navigate("/training", { state: { openPendingShares: true } });
      }
      setOpen(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="relative" onClick={() => setOpen(true)}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <SheetTitle>Notificações</SheetTitle>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs text-primary">
                  <Check className="h-3.5 w-3.5 mr-1" /> Marcar todas como lidas
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="overflow-y-auto max-h-[calc(100vh-80px)] p-2">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bell className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem key={n.id} notification={n} onTap={() => handleTap(n)} />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
