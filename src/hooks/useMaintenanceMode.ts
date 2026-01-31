import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SystemSettings {
  is_maintenance_mode: boolean;
  replicate_api_token: string;
  stripe_publishable_key: string;
  stripe_secret_key: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  is_maintenance_mode: false,
  replicate_api_token: "",
  stripe_publishable_key: "",
  stripe_secret_key: "",
};

export const useMaintenanceMode = () => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "is_maintenance_mode",
          "replicate_api_token",
          "stripe_publishable_key",
          "stripe_secret_key",
        ]);

      if (error) {
        console.error("Error fetching maintenance settings:", error);
        return;
      }

      if (data && data.length > 0) {
        const loadedSettings: Partial<SystemSettings> = {};
        data.forEach((setting) => {
          switch (setting.key) {
            case "is_maintenance_mode":
              loadedSettings.is_maintenance_mode = setting.value === "true";
              break;
            case "replicate_api_token":
              loadedSettings.replicate_api_token = setting.value || "";
              break;
            case "stripe_publishable_key":
              loadedSettings.stripe_publishable_key = setting.value || "";
              break;
            case "stripe_secret_key":
              loadedSettings.stripe_secret_key = setting.value || "";
              break;
          }
        });
        setSettings((prev) => ({ ...prev, ...loadedSettings }));
      }
    } catch (error) {
      console.error("Error fetching maintenance settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // Subscribe to realtime changes on app_settings
    const channel = supabase
      .channel("maintenance-settings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `key=in.(is_maintenance_mode,replicate_api_token,stripe_publishable_key,stripe_secret_key)`,
        },
        (payload) => {
          console.log("Settings changed:", payload);
          // Refetch settings when any relevant setting changes
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  const updateSetting = async (key: keyof SystemSettings, value: string | boolean) => {
    try {
      const stringValue = typeof value === "boolean" ? value.toString() : value;
      
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

  return {
    isMaintenanceMode: settings.is_maintenance_mode,
    settings,
    isLoading,
    updateSetting,
    refetch: fetchSettings,
  };
};
