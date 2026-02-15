import { useState, useEffect } from "react";
import { useFirstOutputGuide } from "./useFirstOutputGuide";
import { useOutputStore, StoredOutput } from "./useOutputStore";
import { supabase } from "@/integrations/supabase/client";

export const useToolOutput = (toolId: string, toolName: string) => {
  const { showGuide, markAsLearned } = useFirstOutputGuide(toolId);
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id);
    });
  }, []);

  const { addOutput } = useOutputStore(userId);

  const saveOutput = (type: StoredOutput["type"], content: string, thumbnail?: string, fileUrl?: string) => {
    markAsLearned();
    addOutput({ toolId, toolName, type, content, thumbnail, fileUrl });
  };

  return { showGuide, markAsLearned, saveOutput };
};
