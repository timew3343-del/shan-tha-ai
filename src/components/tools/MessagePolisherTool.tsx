import { useState } from "react";
import { Loader2, Copy, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";
import { useToolOutput } from "@/hooks/useToolOutput";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";

interface Props { userId?: string; onBack: () => void; }

const RECIPIENTS = [
  { value: "boss", label: "အထက်လူကြီး" },
  { value: "client", label: "ဖောက်သည်" },
  { value: "elder", label: "အသက်ကြီးသူ" },
  { value: "colleague", label: "လုပ်ဖော်ကိုင်ဖက်" },
  { value: "teacher", label: "ဆရာ/ဆရာမ" },
  { value: "official", label: "အရာရှိ" },
];

export const MessagePolisherTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [rawText, setRawText] = useState("");
  const [recipientType, setRecipientType] = useState("boss");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cost = costs.message_polisher || 5;
  const { showGuide, markAsLearned, saveOutput } = useToolOutput("message-polisher", "စာတို ပြေပြစ်အောင်ပြင်သူ");

  const handleGenerate = async () => {
    if (!rawText.trim() || !userId) return;
    setIsLoading(true); setResult("");
    try {
      const recipientLabel = RECIPIENTS.find(r => r.value === recipientType)?.label || recipientType;
      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { toolType: "message_polisher", inputs: { rawMessage: rawText, recipientType: recipientLabel } },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.result || ""); refetch();
      saveOutput("text", data?.result || "");
      toast({ title: "ပြင်ဆင်ပြီးပါပြီ!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI စာတို ပြေပြစ်အောင်ပြင်သူ" subtitle="သာမန်စာကို ယဉ်ကျေးပြတ်သားသော စာအဖြစ် ပြောင်းပေးခြင်း" onBack={onBack} />
      <FirstOutputGuide toolName="စာတို ပြင်ဆင်သူ" steps={["ပြင်ဆင်လိုသော စာ ထည့်ပါ", "လက်ခံသူ အမျိုးအစား ရွေးပါ", "စာ ပြင်ဆင်မည် နှိပ်ပါ"]} show={showGuide} onDismiss={markAsLearned} />
      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="space-y-1">
          <Label className="text-sm font-myanmar">ပြင်ဆင်လိုသော စာ</Label>
          <Textarea value={rawText} onChange={e => setRawText(e.target.value)} placeholder="ရိုင်းသော/သာမန်စာကို ဒီမှာထည့်ပါ..." className="min-h-[100px] text-sm font-myanmar" />
        </div>
        <div id="settings-panel" className="space-y-1">
          <Label className="text-sm font-myanmar">လက်ခံသူ အမျိုးအစား</Label>
          <Select value={recipientType} onValueChange={setRecipientType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{RECIPIENTS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || !rawText.trim() || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ပြင်ဆင်နေသည်...</> : <><MessageCircle className="w-4 h-4 mr-2" />စာ ပြင်ဆင်မည် ({cost} Cr)</>}
      </Button>
      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">ပြင်ဆင်ပြီး စာ</h3>
            <Button onClick={handleCopy} size="sm" variant="outline" className="text-xs">{copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}{copied ? "Copied!" : "Copy"}</Button>
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground font-myanmar leading-relaxed bg-secondary/30 rounded-xl p-3">{result}</div>
        </motion.div>
      )}
    </motion.div>
  );
};
