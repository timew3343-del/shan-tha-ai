import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreditCosts {
  image_generation: number;
  video_generation: number;
  video_with_speech: number;
  text_to_speech: number;
  speech_to_text: number;
  ai_chat: number;
  face_swap: number;
  upscale: number;
  bg_remove: number;
  live_camera: number;
  video_export: number;
  youtube_to_text: number;
  character_animation: number;
  doc_slide_gen: number;
  caption_per_minute: number;
  ad_generator: number;
  live_camera_chat: number;
}

// Default costs with 40% profit margin (cost / 0.6 rounded up)
const DEFAULT_COSTS: CreditCosts = {
  image_generation: 3,
  video_generation: 10,
  video_with_speech: 14,
  text_to_speech: 3,
  speech_to_text: 7,
  ai_chat: 2,
  face_swap: 21,
  upscale: 2,
  bg_remove: 2,
  live_camera: 21,
  video_export: 5,
  youtube_to_text: 14,
  character_animation: 21,
  doc_slide_gen: 34,
  caption_per_minute: 9,
  ad_generator: 9,
  live_camera_chat: 1,
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
