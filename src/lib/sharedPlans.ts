import { supabase } from "@/integrations/supabase/client";

export const respondToSharedPlan = async (shareId: string, accept: boolean) => {
  const { data, error } = await supabase.functions.invoke("accept-shared-plan", {
    body: {
      shareId,
      accept,
    },
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
};