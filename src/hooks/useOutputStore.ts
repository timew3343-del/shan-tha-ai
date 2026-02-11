import { useState, useEffect, useCallback } from "react";

export interface StoredOutput {
  id: string;
  toolId: string;
  toolName: string;
  type: "text" | "image" | "video" | "audio" | "document";
  content: string; // text content or URL
  thumbnail?: string;
  createdAt: string;
}

const STORE_KEY = "myanmar-ai-output-store";
const MAX_ITEMS = 100;

const getStore = (): StoredOutput[] => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
};

export const useOutputStore = () => {
  const [outputs, setOutputs] = useState<StoredOutput[]>([]);

  useEffect(() => {
    setOutputs(getStore());
  }, []);

  const addOutput = useCallback((output: Omit<StoredOutput, "id" | "createdAt">) => {
    const newOutput: StoredOutput = {
      ...output,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };

    const current = getStore();
    const updated = [newOutput, ...current].slice(0, MAX_ITEMS);
    localStorage.setItem(STORE_KEY, JSON.stringify(updated));
    setOutputs(updated);
    return newOutput;
  }, []);

  const removeOutput = useCallback((id: string) => {
    const updated = getStore().filter(o => o.id !== id);
    localStorage.setItem(STORE_KEY, JSON.stringify(updated));
    setOutputs(updated);
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORE_KEY);
    setOutputs([]);
  }, []);

  return { outputs, addOutput, removeOutput, clearAll };
};
