import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApiConfig } from "./useApiConfig";

export const useDailyFreeUses = (userId: string | undefined) => {
  const { config } = useApiConfig();
  const [usedToday, setUsedToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const getTodayKey = () => {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return `free_use_${userId}_${today}`;
  };

  const fetchUsage = useCallback(async () => {
    if (!userId) return;
    
    try {
      // Use localStorage for tracking daily free uses (resets naturally per day via key)
      const key = getTodayKey();
      const stored = localStorage.getItem(key);
      setUsedToday(stored ? parseInt(stored, 10) : 0);
    } catch (e) {
      console.error("Error fetching daily usage:", e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const hasFreeTrial = usedToday < config.daily_free_uses;
  const remainingFree = Math.max(0, config.daily_free_uses - usedToday);

  const consumeFreeUse = () => {
    if (!userId || !hasFreeTrial) return false;
    const newCount = usedToday + 1;
    setUsedToday(newCount);
    localStorage.setItem(getTodayKey(), newCount.toString());
    return true;
  };

  return {
    usedToday,
    remainingFree,
    hasFreeTrial,
    dailyLimit: config.daily_free_uses,
    consumeFreeUse,
    isLoading,
  };
};
