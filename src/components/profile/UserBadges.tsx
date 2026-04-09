import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Zap } from "lucide-react";

import bronzeBadge from "@/assets/badges/bronze.png";
import prataBadge from "@/assets/badges/prata.png";
import ouroBadge from "@/assets/badges/ouro.png";
import eliteBadge from "@/assets/badges/elite.png";
import legendBadge from "@/assets/badges/legend.png";

interface UserBadgesProps {
  userId: string;
}

const AFFILIATE_TIERS: Record<string, { label: string; image: string }> = {
  bronze: { label: "Bronze", image: bronzeBadge },
  prata: { label: "Prata", image: prataBadge },
  ouro: { label: "Ouro", image: ouroBadge },
  elite: { label: "Elite", image: eliteBadge },
  legend: { label: "Legend", image: legendBadge },
};

const PLAN_BADGES: Record<string, { label: string; icon: typeof Star; colorClass: string }> = {
  pro: { label: "Pro", icon: Zap, colorClass: "text-primary bg-primary/15 border-primary/30" },
  vip: { label: "VIP", icon: Star, colorClass: "text-yellow-400 bg-yellow-400/15 border-yellow-400/30" },
};

const UserBadges = ({ userId }: UserBadgesProps) => {
  const [affiliateCategory, setAffiliateCategory] = useState<string | null>(null);
  const [subscriberPlan, setSubscriberPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    supabase
      .from("affiliates")
      .select("tier, status")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.tier) setAffiliateCategory((data as any).tier.toLowerCase());
      });

    supabase
      .from("service_purchases")
      .select("id, status")
      .eq("buyer_id", userId)
      .in("status", ["paid", "delivered", "completed"])
      .not("next_renewal_date", "is", null)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSubscriberPlan("pro");
        }
      });
  }, [userId]);

  const tier = affiliateCategory ? AFFILIATE_TIERS[affiliateCategory] : null;
  const plan = subscriberPlan ? PLAN_BADGES[subscriberPlan] : null;

  if (!tier && !plan) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      {tier && (
        <div className="flex flex-col items-center gap-0.5">
          <img
            src={tier.image}
            alt={`Selo ${tier.label}`}
            className="h-10 w-10 object-contain drop-shadow-md"
          />
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {tier.label}
          </span>
        </div>
      )}
      {plan && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${plan.colorClass}`}
        >
          <plan.icon className="h-3 w-3" />
          {plan.label}
        </span>
      )}
    </div>
  );
};

export default UserBadges;
