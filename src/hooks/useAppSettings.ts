import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AppSettings {
  ad_reward_amount: number;
  daily_ad_limit: number;
  campaign_approval_reward: number;
  ad_timer_duration: number;
  profit_margin?: number;
  auto_ad_profit_margin?: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  ad_reward_amount: 5,
  daily_ad_limit: 10,
  campaign_approval_reward: 100,
  ad_timer_duration: 60,
  profit_margin: 40,
  auto_ad_profit_margin: 50,
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
          "profit_margin",
          "auto_ad_profit_margin",
        ]);

      if (error) {
        console.error("Error fetching app settings:", error);
        return;
      }

      if (data && data.length > 0) {
        const loadedSettings: Partial<AppSettings> = {};
        data.forEach((setting) => {
          const value = Number(setting.value) || 0;
          const keyMap: Record<string, keyof AppSettings> = {
            ad_reward_amount: "ad_reward_amount",
            daily_ad_limit: "daily_ad_limit",
            campaign_approval_reward: "campaign_approval_reward",
            ad_timer_duration: "ad_timer_duration",
            profit_margin: "profit_margin",
            auto_ad_profit_margin: "auto_ad_profit_margin",
          };
          const settingKey = keyMap[setting.key];
          if (settingKey) {
            loadedSettings[settingKey] = value || DEFAULT_SETTINGS[settingKey];
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
