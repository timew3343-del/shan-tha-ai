import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const LEARNED_TOOLS_KEY = "myanmar-ai-learned-tools";

export const useFirstOutputGuide = (toolId: string) => {
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const checkGuideStatus = async () => {
      // First check localStorage (fast)
      const learned = getLearnedTools();
      if (learned.includes(toolId)) {
        setShowGuide(false);
        return;
      }

      // Then check DB for existing outputs for this tool
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user?.id) {
          const { data: outputs } = await supabase
            .from("user_outputs")
            .select("id")
            .eq("user_id", session.session.user.id)
            .eq("tool_id", toolId)
            .limit(1);

          if (outputs && outputs.length > 0) {
            // User has generated output before - mark as learned
            markToolAsLearned(toolId);
            setShowGuide(false);
            return;
          }
        }
      } catch {
        // If DB check fails, fall back to localStorage only
      }

      // No outputs found - show the guide
      setShowGuide(true);
    };

    checkGuideStatus();
  }, [toolId]);

  const markAsLearned = useCallback(() => {
    markToolAsLearned(toolId);
    setShowGuide(false);
  }, [toolId]);

  return { showGuide, markAsLearned };
};

const markToolAsLearned = (toolId: string) => {
  const learned = getLearnedTools();
  if (!learned.includes(toolId)) {
    learned.push(toolId);
    localStorage.setItem(LEARNED_TOOLS_KEY, JSON.stringify(learned));
  }
};

const getLearnedTools = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(LEARNED_TOOLS_KEY) || "[]");
  } catch {
    return [];
  }
};

export const isToolLearned = (toolId: string): boolean => {
  return getLearnedTools().includes(toolId);
};

export const resetToolLearning = (toolId?: string) => {
  if (toolId) {
    const learned = getLearnedTools().filter(id => id !== toolId);
    localStorage.setItem(LEARNED_TOOLS_KEY, JSON.stringify(learned));
  } else {
    localStorage.removeItem(LEARNED_TOOLS_KEY);
  }
};
