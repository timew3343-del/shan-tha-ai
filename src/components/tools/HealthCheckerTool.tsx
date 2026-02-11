import { useState } from "react";
import { Loader2, Stethoscope, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface Props { userId?: string; onBack: () => void; }

export const HealthCheckerTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("health_checker", "Health Checker");
  const [symptoms, setSymptoms] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cost = (costs as any).health_checker || 2;

  const handleGenerate = async () => {
    if (!userId || !symptoms.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const prompt = `You are an AI Health Advisor. Analyze the following symptoms and provide advice in Burmese.

Patient Info:
- Symptoms: ${symptoms}
- Age: ${age || "Not specified"}
- Gender: ${gender === "male" ? "ကျား" : gender === "female" ? "မ" : "မသိ"}

Provide in Burmese:
1. **ဖြစ်နိုင်ချေရှိသော ရောဂါများ** (Possible conditions - list 2-3)
2. **ရောဂါလက္ခဏာ ခွဲခြမ်းစိတ်ဖြာချက်** (Symptom analysis)
3. **သွားရောက်ပြသသင့်သော ဆရာဝန်အမျိုးအစား** (Specialist recommendation)
4. **ကိုယ်တိုင် လုပ်ဆောင်နိုင်သည့်အချက်များ** (Self-care steps)
5. **⚠️ အရေးပေါ် သတိပေးချက်** (When to seek emergency care)

⚕️ DISCLAIMER: ဤအကြံပြုချက်သည် AI မှ ပေးသော ယေဘုယျ သတင်းအချက်အလက်သာ ဖြစ်ပါသည်။ ဆရာဝန်နှင့် တိုက်ရိုက်ပြသရန် အကြံပြုပါသည်။`;

      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { userId, toolType: "health_checker", prompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.result);
      refetch();
      if (data?.result) saveOutput("text", data.result);
      toast({ title: "စစ်ဆေးပြီးပါပြီ!", description: `${data.creditsUsed} Cr` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI ကျန်းမာရေးနှင့် ရောဂါလက္ခဏာစစ်" subtitle="ရောဂါလက္ခဏာများ ခွဲခြမ်းစိတ်ဖြာခြင်း" onBack={onBack} />
      <FirstOutputGuide toolName="Health Checker" show={showGuide} steps={["ရောဂါလက္ခဏာများ ရေးပါ", "အသက်/ကျား-မ ဖြည့်ပါ", "စစ်ဆေးမည် နှိပ်ပါ"]} />

      {/* Medical Disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-400 font-myanmar">
          ⚕️ ဤ AI သည် ယေဘုယျ ကျန်းမာရေး သတင်းအချက်အလက် ပေးသည့် tool ဖြစ်ပြီး ဆရာဝန်၏ အကြံပြုချက် အစားထိုး မဟုတ်ပါ။
        </p>
      </div>

      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">ရောဂါလက္ခဏာများ (မြန်မာလို ရေးပါ)</label>
          <Textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="ဥပမာ - ခေါင်းကိုက်သည်၊ ဖျားသည်၊ ချောင်းဆိုးသည်..." className="mt-1 min-h-[100px] font-myanmar" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground font-myanmar">အသက်</label>
            <Input value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" type="number" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-myanmar">ကျား/မ</label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">ကျား</SelectItem>
                <SelectItem value="female">မ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading || !symptoms.trim() || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />စစ်ဆေးနေသည်...</> : <><Stethoscope className="w-4 h-4 mr-2" />ရောဂါလက္ခဏာ စစ်ဆေးမည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30">
          <h3 className="text-sm font-semibold text-primary font-myanmar mb-3">🩺 ကျန်းမာရေး အစီရင်ခံစာ</h3>
          <div className="prose prose-sm dark:prose-invert max-w-none font-myanmar text-sm">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
