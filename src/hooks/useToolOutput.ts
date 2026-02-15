import { useState, useEffect, useCallback, useRef } from "react";
import { useFirstOutputGuide } from "./useFirstOutputGuide";
import { useOutputStore, StoredOutput } from "./useOutputStore";
import { supabase } from "@/integrations/supabase/client";

export const useToolOutput = (toolId: string, toolName: string) => {
  const { showGuide, markAsLearned } = useFirstOutputGuide(toolId);
  const [userId, setUserId] = useState<string | undefined>();
  const userIdRef = useRef<string | undefined>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id;
      setUserId(id);
      userIdRef.current = id;
    });
  }, []);

  const { addOutput } = useOutputStore(userId);
  // Keep a ref to addOutput so saveOutput always uses the latest
  const addOutputRef = useRef(addOutput);
  useEffect(() => {
    addOutputRef.current = addOutput;
  }, [addOutput]);

  const saveOutput = useCallback((type: StoredOutput["type"], content: string, thumbnail?: string, fileUrl?: string) => {
    markAsLearned();
    addOutputRef.current({ toolId, toolName, type, content, thumbnail, fileUrl });
  }, [toolId, toolName, markAsLearned]);

  return { showGuide, markAsLearned, saveOutput };
};
