import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Base API costs (raw cost without profit margin)
const BASE_API_COSTS = {
  image_generation: 2,
  video_generation: 7,
  video_with_speech: 10,
  text_to_speech: 2,
  speech_to_text: 5,
  ai_chat: 1,
  face_swap: 15,
  upscale: 1,
  bg_remove: 1,
  live_camera: 15,
  video_export: 4,
  youtube_to_text: 10,
  character_animation: 15,
  doc_slide_gen: 24,
  caption_per_minute: 6,
  ad_generator: 6,
  live_camera_chat: 1,
  social_media_agent: 18,
  photoshoot: 6,
};

export type CreditCostKey = keyof typeof BASE_API_COSTS;

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
  social_media_agent: number;
  photoshoot: number;
}

function calculateCosts(margin: number): CreditCosts {
  const result: any = {};
  for (const [key, baseCost] of Object.entries(BASE_API_COSTS)) {
    result[key] = Math.ceil(baseCost * (1 + margin / 100));
  }
  return result as CreditCosts;
}

export { BASE_API_COSTS };

export const useCreditCosts = () => {
  const [profitMargin, setProfitMargin] = useState(40);
  const [costs, setCosts] = useState<CreditCosts>(calculateCosts(40));
  const [isLoading, setIsLoading] = useState(true);

  const fetchMargin = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "profit_margin")
        .maybeSingle();

      if (error) {
        console.error("Error fetching profit margin:", error);
        return;
      }

      const margin = data?.value ? parseInt(data.value, 10) : 40;
      setProfitMargin(margin);
      setCosts(calculateCosts(margin));
    } catch (error) {
      console.error("Error fetching profit margin:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMargin();

    // Subscribe to realtime changes on profit_margin
    const channel = supabase
      .channel("profit-margin-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: "key=eq.profit_margin",
        },
        () => {
          fetchMargin();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMargin]);

  return { costs, profitMargin, isLoading, refetch: fetchMargin };
};
