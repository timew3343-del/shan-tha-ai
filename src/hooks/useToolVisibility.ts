import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to fetch tool visibility settings.
 * Returns a map of toolId -> boolean (true = visible).
 * If a tool is not in the map, it defaults to true (visible).
 */
export const useToolVisibility = () => {
  const [disabledTools, setDisabledTools] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchVisibility = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "tool_visibility")
        .maybeSingle();

      if (!error && data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setDisabledTools(parsed);
        } catch {
          setDisabledTools({});
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisibility();
  }, [fetchVisibility]);

  const isToolEnabled = useCallback(
    (toolId: string) => {
      // If not in the map or true, tool is enabled. Only disabled if explicitly false.
      return disabledTools[toolId] !== false;
    },
    [disabledTools]
  );

  return { disabledTools, isToolEnabled, isLoading, refetch: fetchVisibility };
};
