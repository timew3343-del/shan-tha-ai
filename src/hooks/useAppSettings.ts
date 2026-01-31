import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AppSettings {
  ad_reward_amount: number;
  daily_ad_limit: number;
  campaign_approval_reward: number;
  ad_timer_duration: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  ad_reward_amount: 5,
  daily_ad_limit: 10,
  campaign_approval_reward: 100,
  ad_timer_duration: 60,
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "ad_reward_amount",
          "daily_ad_limit",
          "campaign_approval_reward",
          "ad_timer_duration",
        ]);

      if (error) {
        console.error("Error fetching app settings:", error);
        return;
      }

      if (data && data.length > 0) {
        const loadedSettings: Partial<AppSettings> = {};
        data.forEach((setting) => {
          const value = parseInt(setting.value || "0", 10);
          if (setting.key === "ad_reward_amount") {
            loadedSettings.ad_reward_amount = value || DEFAULT_SETTINGS.ad_reward_amount;
          } else if (setting.key === "daily_ad_limit") {
            loadedSettings.daily_ad_limit = value || DEFAULT_SETTINGS.daily_ad_limit;
          } else if (setting.key === "campaign_approval_reward") {
            loadedSettings.campaign_approval_reward = value || DEFAULT_SETTINGS.campaign_approval_reward;
          } else if (setting.key === "ad_timer_duration") {
            loadedSettings.ad_timer_duration = value || DEFAULT_SETTINGS.ad_timer_duration;
          }
        });
        setSettings((prev) => ({ ...prev, ...loadedSettings }));
      }
    } catch (error) {
      console.error("Error fetching app settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("app-settings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
        },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  const saveSettings = async (newSettings: Partial<AppSettings>) => {
    setIsSaving(true);
    try {
      const updates = Object.entries(newSettings).map(([key, value]) => ({
        key,
        value: value.toString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: update.key, value: update.value }, { onConflict: "key" });
        
        if (error) throw error;
      }

      setSettings((prev) => ({ ...prev, ...newSettings }));
      
      toast({
        title: "သိမ်းဆည်းပြီးပါပြီ",
        description: "App Settings များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ",
      });
      
      return true;
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "အမှား",
        description: "Settings သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    settings,
    isLoading,
    isSaving,
    saveSettings,
    refetch: fetchSettings,
  };
};
