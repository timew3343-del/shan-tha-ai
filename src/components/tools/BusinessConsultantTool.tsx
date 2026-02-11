import { useState } from "react";
import { Loader2, Copy, Check, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";
import { useToolOutput } from "@/hooks/useToolOutput";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";

interface Props { userId?: string; onBack: () => void; }

export const BusinessConsultantTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [businessIdea, setBusinessIdea] = useState("");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cost = costs.business_consultant || 5;
  const { showGuide, markAsLearned, saveOutput } = useToolOutput("business-consultant", "စီးပွားရေး အကြံပေး");

  const handleGenerate = async () => {
    if (!businessIdea.trim() || !userId) return;
    setIsLoading(true); setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { toolType: "business_consultant", inputs: { businessIdea, budget, location } },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.result || ""); refetch();
      saveOutput("text", data?.result || "");
      toast({ title: "စီးပွားရေး အကြံပြုချက် ရရှိပါပြီ!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI စီးပွားရေးနှင့် ရင်းနှီးမြှုပ်နှံမှု အကြံပေး" subtitle="စီးပွားရေး ခွဲခြမ်းစိတ်ဖြာပြီး အကြံပေးခြင်း" onBack={onBack} />
      <FirstOutputGuide toolName="စီးပွားရေး အကြံပေး" steps={["စီးပွားရေး အိုင်ဒီယာ ထည့်ပါ", "ရင်းနှီးငွေနှင့် တည်နေရာ ဖြည့်ပါ", "အကြံဉာဏ် ခလုတ် နှိပ်ပါ"]} show={showGuide} onDismiss={markAsLearned} />
      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="space-y-1"><Label className="text-sm font-myanmar">စီးပွားရေး အိုင်ဒီယာ</Label><Textarea value={businessIdea} onChange={e => setBusinessIdea(e.target.value)} placeholder="စီးပွားရေး အိုင်ဒီယာကို ဖော်ပြပါ..." className="min-h-[80px] text-sm font-myanmar" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-sm font-myanmar">ရင်းနှီးငွေ</Label><Input value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. 50 သိန်း" className="text-sm" /></div>
          <div className="space-y-1"><Label className="text-sm font-myanmar">တည်နေရာ</Label><Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. ရန်ကုန်" className="text-sm" /></div>
        </div>
      </div>
      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || !businessIdea.trim() || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ခွဲခြမ်းစိတ်ဖြာနေသည်...</> : <><LineChart className="w-4 h-4 mr-2" />စီးပွားရေး အကြံဉာဏ် ({cost} Cr)</>}
      </Button>
      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">စီးပွားရေး အကြံပြုချက်</h3>
            <Button onClick={handleCopy} size="sm" variant="outline" className="text-xs">{copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}{copied ? "Copied!" : "Copy"}</Button>
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground font-myanmar leading-relaxed bg-secondary/30 rounded-xl p-3 max-h-[500px] overflow-y-auto">{result}</div>
        </motion.div>
      )}
    </motion.div>
  );
};
