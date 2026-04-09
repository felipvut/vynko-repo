import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithBadge from "@/components/profile/AvatarWithBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, UserPlus, Search, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFriendships } from "@/hooks/useCommunity";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FriendsSheet = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pending, friends, loading, refresh } = useFriendships();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const searchUsers = async (query: string) => {
    if (!user || !query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const trimmed = query.trim();
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, username")
      .or(`full_name.ilike.%${trimmed}%,username.ilike.%${trimmed}%`)
      .neq("user_id", user.id)
      .limit(10);
    setSearchResults(data || []);
    setSearching(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    searchUsers(value);
  };

  const sendRequest = async (targetId: string) => {
    if (!user) return;
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: targetId,
    });
    if (error?.code === "23505") {
      toast.info("Solicitação já enviada");
    } else if (error) {
      toast.error("Erro ao enviar solicitação");
    } else {
      toast.success("Solicitação enviada!");
    }
    refresh();
  };

  const acceptRequest = async (id: string) => {
    const { error } = await supabase.rpc("accept_friendship", { _friendship_id: id } as any);
    if (error) {
      toast.error("Erro ao aceitar solicitação");
      return;
    }
    toast.success("Amizade aceita! Agora vocês se seguem mutuamente.");
    refresh();
  };

  const rejectRequest = async (id: string) => {
    await supabase.from("friendships").update({ status: "rejected" }).eq("id", id);
    refresh();
  };

  const removeFriend = async (id: string) => {
    await supabase.from("friendships").delete().eq("id", id);
    toast.success("Amizade removida");
    refresh();
  };

  const initials = (name: string | null) => (name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Amigos</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="friends" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full">
            <TabsTrigger value="friends" className="flex-1">Amigos ({friends.length})</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">
              Pendentes {pending.length > 0 && `(${pending.length})`}
            </TabsTrigger>
            <TabsTrigger value="search" className="flex-1">Buscar</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="flex-1 overflow-y-auto space-y-2">
            {friends.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum amigo ainda.</p>}
            {friends.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 glass-card">
                <div className="flex items-center gap-3">
                  <AvatarWithBadge userId={f.requester_id === user?.id ? f.addressee_id : f.requester_id} avatarUrl={f.profiles?.avatar_url} fallback={initials(f.profiles?.full_name)} className="h-9 w-9" />
                  <span className="text-sm font-medium">{f.profiles?.full_name || "Usuário"}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); navigate(`/dm/${f.requester_id === user?.id ? f.addressee_id : f.requester_id}`); }}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeFriend(f.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="pending" className="flex-1 overflow-y-auto space-y-2">
            {pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sem solicitações pendentes.</p>}
            {pending.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 glass-card">
                <div className="flex items-center gap-3">
                  <AvatarWithBadge userId={f.requester_id === user?.id ? f.addressee_id : f.requester_id} avatarUrl={f.profiles?.avatar_url} fallback={initials(f.profiles?.full_name)} className="h-9 w-9" />
                  <span className="text-sm font-medium">{f.profiles?.full_name || "Usuário"}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => acceptRequest(f.id)}>
                    <Check className="h-4 w-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => rejectRequest(f.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="search" className="flex-1 overflow-y-auto space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou @usuário..."
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-9"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {searchResults.map(u => (
              <div
                key={u.user_id}
                className="flex items-center justify-between p-3 glass-card cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => { onOpenChange(false); navigate(`/u/${u.username}`); }}
              >
                <div className="flex items-center gap-3">
                  <AvatarWithBadge userId={u.user_id} avatarUrl={u.avatar_url} fallback={initials(u.full_name)} className="h-9 w-9" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{u.full_name || "Usuário"}</span>
                    <span className="text-xs text-muted-foreground">@{u.username}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); sendRequest(u.user_id); }}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default FriendsSheet;
