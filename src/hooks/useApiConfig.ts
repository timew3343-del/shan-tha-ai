import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ApiConfig {
  gemini_enabled: boolean;
  replicate_enabled: boolean;
  stability_enabled: boolean;
  shotstack_enabled: boolean;
  acrcloud_enabled: boolean;
  sunoapi_enabled: boolean;
  daily_free_uses: number;
}

const DEFAULT_CONFIG: ApiConfig = {
  gemini_enabled: true,
  replicate_enabled: true,
  stability_enabled: true,
  shotstack_enabled: true,
  acrcloud_enabled: true,
  sunoapi_enabled: true,
  daily_free_uses: 3,
};

export const useApiConfig = () => {
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "api_enabled_gemini",
          "api_enabled_replicate",
          "api_enabled_stability",
          "api_enabled_shotstack",
          "api_enabled_acrcloud",
          "api_enabled_sunoapi",
          "daily_free_uses",
        ]);

      if (data) {
        const loaded: Partial<ApiConfig> = {};
        data.forEach(s => {
          switch (s.key) {
            case "api_enabled_gemini": loaded.gemini_enabled = s.value !== "false"; break;
            case "api_enabled_replicate": loaded.replicate_enabled = s.value !== "false"; break;
            case "api_enabled_stability": loaded.stability_enabled = s.value !== "false"; break;
            case "api_enabled_shotstack": loaded.shotstack_enabled = s.value !== "false"; break;
            case "api_enabled_acrcloud": loaded.acrcloud_enabled = s.value !== "false"; break;
            case "api_enabled_sunoapi": loaded.sunoapi_enabled = s.value !== "false"; break;
            case "daily_free_uses": loaded.daily_free_uses = parseInt(s.value || "3", 10); break;
          }
        });
        setConfig(prev => ({ ...prev, ...loaded }));
      }
    } catch (e) {
      console.error("Error fetching API config:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();

    const channel = supabase
      .channel("api-config-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, (payload: any) => {
        const key = payload?.new?.key;
        if (key && (key.startsWith("api_enabled_") || key === "daily_free_uses")) {
          fetchConfig();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchConfig]);

  return { config, isLoading, refetch: fetchConfig };
};
