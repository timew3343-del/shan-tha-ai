import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Base API costs (raw cost without profit margin) - used as fallback only
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
  story_video: 20,
  copyright_check: 3,
  scene_summarizer: 3,
  bg_studio: 2,
  song_mtv: 15,
  auto_ad: 18,
  video_redesign: 21,
  logo_design: 3,
  photo_restoration: 2,
  myanmar_spellcheck: 1,
  virtual_tryon: 3,
  myanmar_astrology: 1,
  interior_design: 3,
  cv_builder: 2,
  business_consultant: 2,
  creative_writer: 1,
  legal_advisor: 2,
  message_polisher: 1,
  nutrition_planner: 2,
  // New tools
  car_dealer: 1,
  exterior_design: 3,
  voice_translator: 2,
  health_checker: 1,
  baby_namer: 1,
  legal_doc: 1,
  style_transfer: 3,
  smart_chef: 1,
  travel_planner: 1,
  fashion_designer: 5,
  video_multi: 8,
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
  story_video: number;
  copyright_check: number;
  scene_summarizer: number;
  bg_studio: number;
  song_mtv: number;
  auto_ad: number;
  video_redesign: number;
  logo_design: number;
  photo_restoration: number;
  myanmar_spellcheck: number;
  virtual_tryon: number;
  myanmar_astrology: number;
  interior_design: number;
  cv_builder: number;
  business_consultant: number;
  creative_writer: number;
  legal_advisor: number;
  message_polisher: number;
  nutrition_planner: number;
  car_dealer: number;
  exterior_design: number;
  voice_translator: number;
  health_checker: number;
  baby_namer: number;
  legal_doc: number;
  style_transfer: number;
  smart_chef: number;
  travel_planner: number;
  fashion_designer: number;
  video_multi: number;
}

function calculateDefaultCosts(margin: number = 40): CreditCosts {
  const result: any = {};
  for (const [key, baseCost] of Object.entries(BASE_API_COSTS)) {
    result[key] = Math.ceil(baseCost * (1 + margin / 100));
  }
  return result as CreditCosts;
}

export { BASE_API_COSTS };

export const useCreditCosts = () => {
  const [costs, setCosts] = useState<CreditCosts>(calculateDefaultCosts(40));
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

      const fetchedCosts: Partial<CreditCosts> = {};
      data?.forEach((setting) => {
        const toolKey = setting.key.replace("credit_cost_", "");
        if (toolKey in BASE_API_COSTS) {
          const val = parseInt(setting.value || "0", 10);
          if (val > 0) {
            fetchedCosts[toolKey as CreditCostKey] = val;
          }
        }
      });

      const defaults = calculateDefaultCosts(40);
      setCosts({ ...defaults, ...fetchedCosts });
    } catch (error) {
      console.error("Error fetching credit costs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCosts();

    const channel = supabase
      .channel("credit-costs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        (payload: any) => {
          const key = payload?.new?.key || payload?.old?.key;
          if (key && typeof key === "string" && key.startsWith("credit_cost_")) {
            fetchCosts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCosts]);

  return { costs, isLoading, refetch: fetchCosts };
};
