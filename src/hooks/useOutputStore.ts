import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StoredOutput {
  id: string;
  toolId: string;
  toolName: string;
  type: "text" | "image" | "video" | "audio" | "document";
  content: string;
  thumbnail?: string;
  createdAt: string;
  expiresAt?: string;
  fileUrl?: string;
}

// Also keep localStorage for backwards compat
const STORE_KEY = "myanmar-ai-output-store";
const MAX_ITEMS = 100;

const getLocalStore = (): StoredOutput[] => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
};

export const useOutputStore = (userId?: string) => {
  const [outputs, setOutputs] = useState<StoredOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOutputs = useCallback(async () => {
    if (!userId) {
      // Fallback to localStorage for non-auth
      setOutputs(getLocalStore());
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_outputs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS);

      if (error) {
        console.error("Error fetching outputs:", error);
        setOutputs(getLocalStore());
      } else {
        const mapped: StoredOutput[] = (data || []).map((o: any) => ({
          id: o.id,
          toolId: o.tool_id,
          toolName: o.tool_name,
          type: o.output_type,
          content: o.content || o.file_url || "",
          thumbnail: o.thumbnail_url,
          createdAt: o.created_at,
          expiresAt: o.expires_at,
          fileUrl: o.file_url,
        }));
        setOutputs(mapped);
      }
    } catch {
      setOutputs(getLocalStore());
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchOutputs();
  }, [fetchOutputs]);

  const addOutput = useCallback(async (output: Omit<StoredOutput, "id" | "createdAt">) => {
    // Always save to localStorage as backup
    const localOutput: StoredOutput = {
      ...output,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    const current = getLocalStore();
    const updated = [localOutput, ...current].slice(0, MAX_ITEMS);
    localStorage.setItem(STORE_KEY, JSON.stringify(updated));

    // Save to DB if we have userId
    if (userId) {
      try {
        const { data, error } = await supabase
          .from("user_outputs")
          .insert({
            user_id: userId,
            tool_id: output.toolId,
            tool_name: output.toolName,
            output_type: output.type,
            content: output.type === "text" ? output.content : null,
            file_url: output.type !== "text" ? output.content : null,
            thumbnail_url: output.thumbnail || null,
          })
          .select()
          .single();

        if (!error && data) {
          localOutput.id = data.id;
          localOutput.expiresAt = data.expires_at;
        }
      } catch (e) {
        console.error("Error saving output to DB:", e);
      }
    }

    setOutputs(prev => [localOutput, ...prev].slice(0, MAX_ITEMS));
    return localOutput;
  }, [userId]);

  const removeOutput = useCallback(async (id: string) => {
    // Remove from localStorage
    const localUpdated = getLocalStore().filter(o => o.id !== id);
    localStorage.setItem(STORE_KEY, JSON.stringify(localUpdated));

    // Remove from DB
    if (userId) {
      await supabase.from("user_outputs").delete().eq("id", id);
    }

    setOutputs(prev => prev.filter(o => o.id !== id));
  }, [userId]);

  const clearAll = useCallback(async () => {
    localStorage.removeItem(STORE_KEY);
    if (userId) {
      await supabase.from("user_outputs").delete().eq("user_id", userId);
    }
    setOutputs([]);
  }, [userId]);

  return { outputs, addOutput, removeOutput, clearAll, isLoading, refetch: fetchOutputs };
};
