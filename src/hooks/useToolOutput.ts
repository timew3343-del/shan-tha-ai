import { useFirstOutputGuide } from "./useFirstOutputGuide";
import { useOutputStore, StoredOutput } from "./useOutputStore";

export const useToolOutput = (toolId: string, toolName: string) => {
  const { showGuide, markAsLearned } = useFirstOutputGuide(toolId);
  const { addOutput } = useOutputStore();

  const saveOutput = (type: StoredOutput["type"], content: string, thumbnail?: string) => {
    markAsLearned();
    addOutput({ toolId, toolName, type, content, thumbnail });
  };

  return { showGuide, markAsLearned, saveOutput };
};
