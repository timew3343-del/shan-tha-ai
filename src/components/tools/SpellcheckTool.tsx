import { useState } from "react";
import { Loader2, Copy, Check, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

export const SpellcheckTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cost = costs.myanmar_spellcheck || 5;

  const handleGenerate = async () => {
    if (!text.trim() || !userId) return;
    setIsLoading(true); setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { toolType: "spellcheck", inputs: { text } },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.result || ""); refetch();
      toast({ title: "စစ်ဆေးပြီးပါပြီ!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI မြန်မာစာ သတ်ပုံစစ်ဆေးစနစ်" subtitle="သတ်ပုံနှင့် သဒ္ဒါ စစ်ဆေးပေးခြင်း" onBack={onBack} />
      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">စစ်ဆေးလိုသော စာသား</label>
        <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="မြန်မာစာ ထည့်ပါ..." className="min-h-[120px] bg-background/50 border-primary/30 rounded-xl text-sm font-myanmar" />
      </div>
      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || !text.trim() || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />စစ်ဆေးနေသည်...</> : <><Type className="w-4 h-4 mr-2" />သတ်ပုံ စစ်ဆေးမည် ({cost} Cr)</>}
      </Button>
      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">စစ်ဆေးချက် ရလဒ်</h3>
            <Button onClick={handleCopy} size="sm" variant="outline" className="text-xs">
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}{copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground font-myanmar leading-relaxed bg-secondary/30 rounded-xl p-3">{result}</div>
        </motion.div>
      )}
    </motion.div>
  );
};
