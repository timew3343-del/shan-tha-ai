import { useState, useRef } from "react";
import { Loader2, Copy, Check, Scale, Plus, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

export const LegalAdvisorTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("legal_advisor", "Legal Advisor");
  const [question, setQuestion] = useState("");
  const [docImage, setDocImage] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cost = costs.legal_advisor || 10;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = (ev) => setDocImage(ev.target?.result as string); reader.readAsDataURL(file); }
  };

  const handleGenerate = async () => {
    if (!question.trim() || !userId) return;
    setIsLoading(true); setResult("");
    try {
      const body: any = { toolType: "legal_advisor", inputs: { question } };
      if (docImage) {
        const [prefix, base64] = docImage.split(",");
        const mimeMatch = prefix.match(/data:(.*?);/);
        body.imageBase64 = base64;
        body.imageType = mimeMatch?.[1] || "image/jpeg";
      }
      const { data, error } = await supabase.functions.invoke("ai-tool", { body });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.result || ""); refetch();
      if (data?.result) saveOutput("text", data.result);
      toast({ title: "ဥပဒေ အကြံပြုချက် ရရှိပါပြီ!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI တရားရုံးနှင့် ဥပဒေအကြံပေး" subtitle="ဥပဒေဆိုင်ရာ မေးခွန်းများ ခွဲခြမ်းစိတ်ဖြာပေးခြင်း" onBack={onBack} />

      <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <p className="text-xs text-destructive/80 font-myanmar">ဤအကြံပြုချက်သည် AI မှပေးသော ယေဘုယျ အကြံပြုချက်သာဖြစ်ပါသည်။ တရားဝင် ဥပဒေအကြံအတွက် ရှေ့နေတစ်ဦးနှင့် တိုင်ပင်ပါ။</p>
      </div>

      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-primary font-myanmar">ဥပဒေ မေးခွန်း</label>
          <Textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="ဥပဒေဆိုင်ရာ အခြေအနေ သို့မဟုတ် မေးခွန်းကို ရေးပါ..." className="min-h-[100px] text-sm font-myanmar" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2 font-myanmar">စာရွက်စာတမ်း ပုံ (Optional)</label>
          {docImage ? (
            <div className="relative inline-block">
              <img src={docImage} alt="Document" className="w-20 h-20 object-cover rounded-lg border border-primary/30" />
              <button onClick={() => setDocImage(null)} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-primary/30 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-primary/5">
              <Plus className="w-4 h-4 text-primary" /><span className="text-[9px] text-muted-foreground">ပုံတင်ရန်</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </div>
      </div>

      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || !question.trim() || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ခွဲခြမ်းစိတ်ဖြာနေသည်...</> : <><Scale className="w-4 h-4 mr-2" />ဥပဒေ အကြံဉာဏ် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">ဥပဒေ အကြံပြုချက်</h3>
            <Button onClick={handleCopy} size="sm" variant="outline" className="text-xs">{copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}{copied ? "Copied!" : "Copy"}</Button>
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground font-myanmar leading-relaxed bg-secondary/30 rounded-xl p-3 max-h-[500px] overflow-y-auto">{result}</div>
        </motion.div>
      )}
    </motion.div>
  );
};
