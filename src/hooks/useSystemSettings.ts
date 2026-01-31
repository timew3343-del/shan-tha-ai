import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FullSystemSettings {
  // API Keys
  replicate_api_token: string;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  gemini_api_key: string;
  stability_api_key: string;
  
  // System Status
  is_maintenance_mode: boolean;
}

const DEFAULT_SETTINGS: FullSystemSettings = {
  replicate_api_token: "",
  stripe_publishable_key: "",
  stripe_secret_key: "",
  gemini_api_key: "",
  stability_api_key: "",
  is_maintenance_mode: false,
};

export const useSystemSettings = () => {
  const [settings, setSettings] = useState<FullSystemSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "replicate_api_token",
          "stripe_publishable_key",
          "stripe_secret_key",
          "gemini_api_key",
          "stability_api_key",
          "is_maintenance_mode",
        ]);

      if (error) {
        console.error("Error fetching system settings:", error);
        return;
      }

      if (data && data.length > 0) {
        const loadedSettings: Partial<FullSystemSettings> = {};
        data.forEach((setting) => {
          if (setting.key === "is_maintenance_mode") {
            loadedSettings.is_maintenance_mode = setting.value === "true";
          } else {
            (loadedSettings as any)[setting.key] = setting.value || "";
          }
        });
        setSettings((prev) => ({ ...prev, ...loadedSettings }));
      }
    } catch (error) {
      console.error("Error fetching system settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("system-settings-admin")
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

  const updateSetting = async (key: keyof FullSystemSettings, value: string | boolean) => {
    const stringValue = typeof value === "boolean" ? value.toString() : value;
    
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value: stringValue }, { onConflict: "key" });

      if (error) throw error;

      setSettings((prev) => ({ ...prev, [key]: value }));
      return true;
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
      return false;
    }
  };

  const saveAllSettings = async (newSettings: Partial<FullSystemSettings>) => {
    setIsSaving(true);
    try {
      const updates = Object.entries(newSettings).map(([key, value]) => ({
        key,
        value: typeof value === "boolean" ? value.toString() : value,
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
        description: "System Settings များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ",
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

  const toggleMaintenanceMode = async () => {
    const newValue = !settings.is_maintenance_mode;
    const success = await updateSetting("is_maintenance_mode", newValue);
    
    if (success) {
      toast({
        title: newValue ? "Maintenance Mode ဖွင့်လိုက်ပါပြီ" : "Maintenance Mode ပိတ်လိုက်ပါပြီ",
        description: newValue 
          ? "Users များအား API အသုံးပြုခွင့် ခေတ္တပိတ်ထားပါသည်" 
          : "Users များအား API အသုံးပြုခွင့် ပြန်ဖွင့်ပေးပါပြီ",
      });
    }
    
    return success;
  };

  return {
    settings,
    isLoading,
    isSaving,
    updateSetting,
    saveAllSettings,
    toggleMaintenanceMode,
    refetch: fetchSettings,
  };
};
