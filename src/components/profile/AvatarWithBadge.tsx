import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

import bronzeBadge from "@/assets/badges/bronze.png";
import prataBadge from "@/assets/badges/prata.png";
import ouroBadge from "@/assets/badges/ouro.png";
import eliteBadge from "@/assets/badges/elite.png";
import legendBadge from "@/assets/badges/legend.png";

const TIER_IMAGES: Record<string, string> = {
  bronze: bronzeBadge,
  prata: prataBadge,
  ouro: ouroBadge,
  elite: eliteBadge,
  legend: legendBadge,
};

interface AvatarWithBadgeProps {
  userId: string;
  avatarUrl?: string | null;
  fallback: string;
  className?: string;
  fallbackClassName?: string;
  /** Pre-fetched tier to avoid extra query */
  tier?: string | null;
}

const AvatarWithBadge = ({
  userId,
  avatarUrl,
  fallback,
  className = "h-9 w-9",
  fallbackClassName = "text-xs bg-primary/20 text-primary",
  tier: preloadedTier,
}: AvatarWithBadgeProps) => {
  const [tier, setTier] = useState<string | null>(preloadedTier ?? null);

  useEffect(() => {
    if (preloadedTier !== undefined) {
      setTier(preloadedTier);
      return;
    }
    if (!userId) return;

    supabase
      .from("affiliates")
      .select("tier, status")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle()
      .then(({ data }) => {
        if (data && (data as any).tier) {
          setTier((data as any).tier.toLowerCase());
        }
      });
  }, [userId, preloadedTier]);

  const badgeImage = tier ? TIER_IMAGES[tier] : null;

  // Calculate badge size as ~40% of avatar size
  const badgeSizeClass = className.includes("h-24")
    ? "h-8 w-8"
    : className.includes("h-20")
    ? "h-7 w-7"
    : className.includes("h-16")
    ? "h-6 w-6"
    : className.includes("h-12")
    ? "h-5 w-5"
    : className.includes("h-9") || className.includes("h-10") || className.includes("h-8")
    ? "h-4 w-4"
    : "h-4 w-4";

  return (
    <div className="relative inline-block flex-shrink-0">
      <Avatar className={className}>
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className={fallbackClassName}>{fallback}</AvatarFallback>
      </Avatar>
      {badgeImage && (
        <img
          src={badgeImage}
          alt="Selo"
          className={`absolute -bottom-1 -right-1 ${badgeSizeClass} object-contain drop-shadow-md pointer-events-none`}
        />
      )}
    </div>
  );
};

export default AvatarWithBadge;
