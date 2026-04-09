import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

export const useGymManager = () => {
  const { user } = useAuth();

  const { data: managedGym, isLoading } = useQuery({
    queryKey: ["gym-manager-assignment", user?.id],
    queryFn: async () => {
      if (!user) return null;
      // Check if user has gym_manager role
      const { data: roleData } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "gym_manager" as any,
      });
      if (!roleData) return null;

      // Get the gym they manage
      const { data: assignment } = await supabase
        .from("gym_managers" as any)
        .select("gym_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!assignment) return null;

      const gymId = (assignment as any).gym_id;
      const { data: gym } = await supabase
        .from("gyms")
        .select("*")
        .eq("id", gymId)
        .single();

      return gym;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return { managedGym, isGymManager: !!managedGym, isLoading };
};
