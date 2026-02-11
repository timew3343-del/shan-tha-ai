import { useState, useRef } from "react";
import { Loader2, Copy, Check, Heart, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

export const NutritionPlannerTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("nutrition_planner", "Nutrition Planner");
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [foodText, setFoodText] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cost = costs.nutrition_planner || 10;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = (ev) => setFoodImage(ev.target?.result as string); reader.readAsDataURL(file); }
  };

  const handleGenerate = async () => {
    if ((!foodImage && !foodText.trim()) || !userId) return;
    setIsLoading(true); setResult("");
    try {
      const body: any = {
        toolType: "nutrition_planner",
        inputs: { foodDescription: foodText || "ပုံမှာ ပါသော အစားအစာများ ခွဲခြမ်းပါ", weight, height, goal },
      };
      if (foodImage) {
        const [prefix, base64] = foodImage.split(",");
        const mimeMatch = prefix.match(/data:(.*?);/);
        body.imageBase64 = base64;
        body.imageType = mimeMatch?.[1] || "image/jpeg";
      }
      const { data, error } = await supabase.functions.invoke("ai-tool", { body });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.result || ""); refetch();
      if (data?.result) saveOutput("text", data.result);
      toast({ title: "ခွဲခြမ်းစိတ်ဖြာပြီးပါပြီ!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI အစားအသောက်နှင့် ကယ်လိုရီတွက်သူ" subtitle="အစားအစာ ခွဲခြမ်းစိတ်ဖြာပြီး အာဟာရ အကြံပေးခြင်း" onBack={onBack} />
      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div>
          <label className="block text-sm font-medium text-primary mb-2 font-myanmar">အစားအစာ ဓာတ်ပုံ</label>
          {foodImage ? (
            <div className="relative inline-block">
              <img src={foodImage} alt="Food" className="w-full max-h-40 object-cover rounded-xl border border-primary/30" />
              <button onClick={() => setFoodImage(null)} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="w-full h-28 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-primary/5">
              <Plus className="w-6 h-6 text-primary" /><span className="text-xs text-muted-foreground font-myanmar">အစားအစာ ပုံ တင်ပါ</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-myanmar">သို့မဟုတ် အစားအစာ ရေးပါ</Label>
          <Textarea value={foodText} onChange={e => setFoodText(e.target.value)} placeholder="ဥပမာ - ထမင်း၊ ကြက်သားဟင်း၊ သုပ်..." className="min-h-[50px] text-sm font-myanmar" />
        </div>
        <div id="settings-panel" className="grid grid-cols-3 gap-2">
          <div className="space-y-1"><Label className="text-[10px] font-myanmar">ကိုယ်အလေးချိန်(kg)</Label><Input value={weight} onChange={e => setWeight(e.target.value)} placeholder="60" className="text-sm h-8" /></div>
          <div className="space-y-1"><Label className="text-[10px] font-myanmar">အရပ်(cm)</Label><Input value={height} onChange={e => setHeight(e.target.value)} placeholder="165" className="text-sm h-8" /></div>
          <div className="space-y-1"><Label className="text-[10px] font-myanmar">ရည်မှန်းချက်</Label><Input value={goal} onChange={e => setGoal(e.target.value)} placeholder="ကျန်းမာ" className="text-sm h-8" /></div>
        </div>
      </div>
      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || (!foodImage && !foodText.trim()) || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ခွဲခြမ်းနေသည်...</> : <><Heart className="w-4 h-4 mr-2" />အာဟာရ ခွဲခြမ်းမည် ({cost} Cr)</>}
      </Button>
      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">အာဟာရ ခွဲခြမ်းချက်</h3>
            <Button onClick={handleCopy} size="sm" variant="outline" className="text-xs">{copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}{copied ? "Copied!" : "Copy"}</Button>
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground font-myanmar leading-relaxed bg-secondary/30 rounded-xl p-3 max-h-[500px] overflow-y-auto">{result}</div>
        </motion.div>
      )}
    </motion.div>
  );
};
