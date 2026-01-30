import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreditCosts {
  image_generation: number;
  video_generation: number;
  video_with_speech: number;
  text_to_speech: number;
  speech_to_text: number;
  ai_chat: number;
}

const DEFAULT_COSTS: CreditCosts = {
  image_generation: 2,
  video_generation: 7,
  video_with_speech: 10,
  text_to_speech: 2,
  speech_to_text: 5,
  ai_chat: 1,
};

export const useCreditCosts = () => {
  const [costs, setCosts] = useState<CreditCosts>(DEFAULT_COSTS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .like("key", "credit_cost_%");

      if (error) {
        console.error("Error fetching credit costs:", error);
        return;
      }

      if (data && data.length > 0) {
        const loadedCosts: Partial<CreditCosts> = {};
        data.forEach((setting) => {
          const costKey = setting.key.replace("credit_cost_", "") as keyof CreditCosts;
          loadedCosts[costKey] = parseInt(setting.value || "0", 10);
        });
        setCosts((prev) => ({ ...prev, ...loadedCosts }));
      }
    } catch (error) {
      console.error("Error fetching credit costs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  return { costs, isLoading, refetch: fetchCosts };
};
