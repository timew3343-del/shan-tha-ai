import { useState, useEffect, useCallback } from "react";

const LEARNED_TOOLS_KEY = "myanmar-ai-learned-tools";

export const useFirstOutputGuide = (toolId: string) => {
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const learned = getLearnedTools();
    setShowGuide(!learned.includes(toolId));
  }, [toolId]);

  const markAsLearned = useCallback(() => {
    const learned = getLearnedTools();
    if (!learned.includes(toolId)) {
      learned.push(toolId);
      localStorage.setItem(LEARNED_TOOLS_KEY, JSON.stringify(learned));
    }
    setShowGuide(false);
  }, [toolId]);

  return { showGuide, markAsLearned };
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
