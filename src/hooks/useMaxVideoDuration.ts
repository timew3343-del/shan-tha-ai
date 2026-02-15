import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_MAX_DURATION = 180;

export const useMaxVideoDuration = () => {
  const [maxDuration, setMaxDuration] = useState(DEFAULT_MAX_DURATION);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "max_video_duration")
          .maybeSingle();
        if (data?.value) {
          const val = parseInt(data.value, 10);
          if (val > 0) setMaxDuration(val);
        }
      } catch (e) {
        console.error("Failed to fetch max_video_duration:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();

    const channel = supabase
      .channel("max-video-duration")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings", filter: "key=eq.max_video_duration" }, (payload: any) => {
        const val = parseInt(payload.new?.value, 10);
        if (val > 0) setMaxDuration(val);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const maxMinutes = Math.floor(maxDuration / 60);
  const maxSeconds = maxDuration % 60;
  const maxLabel = maxSeconds > 0 ? `${maxMinutes} မိနစ် ${maxSeconds} စက္ကန့်` : `${maxMinutes} မိနစ်`;

  return { maxDuration, maxMinutes, maxLabel, isLoading };
};
