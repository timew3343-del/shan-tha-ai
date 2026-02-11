import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useMaintenanceMode = () => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("key", "is_maintenance_mode")
        .maybeSingle();

      if (error) {
        console.error("Error fetching maintenance settings:", error);
        return;
      }

      setIsMaintenanceMode(data?.value === "true");
    } catch (error) {
      console.error("Error fetching maintenance settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    const channel = supabase
      .channel("maintenance-settings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `key=eq.is_maintenance_mode`,
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

  const updateSetting = async (key: string, value: string | boolean) => {
    try {
      const stringValue = typeof value === "boolean" ? value.toString() : value;
      
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value: stringValue }, { onConflict: "key" });

      if (error) throw error;

      if (key === "is_maintenance_mode") {
        setIsMaintenanceMode(value === true || value === "true");
      }
      return true;
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
      return false;
    }
  };

  return {
    isMaintenanceMode,
    settings: { is_maintenance_mode: isMaintenanceMode },
    isLoading,
    updateSetting,
    refetch: fetchSettings,
  };
};