import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useDailyFreeUses = (userId: string | undefined) => {
  const [usedToday, setUsedToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(5);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!userId) return;
    try {
      // Fetch limit from app_settings
      const { data: limitSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "daily_free_image_limit")
        .maybeSingle();
      if (limitSetting?.value) {
        const val = parseInt(limitSetting.value, 10);
        if (val > 0) setDailyLimit(val);
      }

      // Fetch today's usage from daily_free_usage table
      const today = new Date().toISOString().split("T")[0];
      const { data: usageData } = await supabase
        .from("daily_free_usage")
        .select("usage_count")
        .eq("user_id", userId)
        .eq("tool_type", "image")
        .eq("usage_date", today)
        .maybeSingle();

      setUsedToday(usageData?.usage_count ?? 0);
    } catch (e) {
      console.error("Error fetching daily usage:", e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const hasFreeTrial = usedToday < dailyLimit;
  const remainingFree = Math.max(0, dailyLimit - usedToday);

  const consumeFreeUse = async (): Promise<boolean> => {
    if (!userId || !hasFreeTrial) return false;
    try {
      const { data, error } = await supabase.rpc("check_and_use_free_quota", {
        _user_id: userId,
        _tool_type: "image",
        _daily_limit: dailyLimit,
      });
      if (error) { console.error("Free quota error:", error); return false; }
      const result = data as any;
      if (result?.success && result?.is_free) {
        setUsedToday(result.used);
        return true;
      }
      return false;
    } catch (e) {
      console.error("consumeFreeUse error:", e);
      return false;
    }
  };

  return {
    usedToday,
    remainingFree,
    hasFreeTrial,
    dailyLimit,
    consumeFreeUse,
    isLoading,
    refetch: fetchUsage,
  };
};