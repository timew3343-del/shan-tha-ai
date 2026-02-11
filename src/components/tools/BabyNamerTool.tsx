import { useState } from "react";
import { Loader2, Baby, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const DAYS = ["တနင်္လာ", "အင်္ဂါ", "ဗုဒ္ဓဟူး", "ကြာသပတေး", "သောကြာ", "စနေ", "တနင်္ဂနွေ"];

export const BabyNamerTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("baby_namer", "Baby Namer");
  const [birthdate, setBirthdate] = useState("");
  const [birthDay, setBirthDay] = useState("တနင်္လာ");
  const [category, setCategory] = useState("person");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cost = (costs as any).baby_namer || 2;

  const handleGenerate = async () => {
    if (!userId) return;
    setIsLoading(true);
    setResult(null);
    try {
      const prompt = `You are a Myanmar naming expert (ကင္ကုဗေဒ ပညာရှင်). Generate names based on Myanmar astrology and naming conventions in Burmese.

Details:
- Birthdate: ${birthdate || "Not specified"}
- Day of birth: ${birthDay}
- Category: ${category === "person" ? "လူနာမည်" : "လုပ်ငန်းနာမည်"}

Based on ${birthDay} (${category === "person" ? "ကလေး" : "စီးပွားရေး"}) naming conventions:
1. Generate 10 meaningful names
2. For each name, explain:
   - **နာမည်** (Name)
   - **အဓိပ္ပါယ်** (Meaning)
   - **ကံကောင်းစေသော အကြောင်းရင်း** (Why it's auspicious)
3. Include traditional Myanmar letter associations for the day of birth
4. All output in Burmese`;

      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { userId, toolType: "baby_namer", prompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.result);
      refetch();
      if (data?.result) saveOutput("text", data.result);
      toast({ title: "အောင်မြင်ပါသည်!", description: `နာမည်များ ဖန်တီးပြီးပါပြီ (${data.creditsUsed} Cr)` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const handleCopy = () => {
    if (result) { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI နာမည်ပေးကင်္ကုဗေဒ" subtitle="မွေးနေ့အလိုက် ကံကောင်းသော နာမည်များ ဖန်တီးခြင်း" onBack={onBack} />

      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">မွေးနေ့</label>
          <Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">မွေးသောနေ့</label>
          <Select value={birthDay} onValueChange={setBirthDay}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">အမျိုးအစား</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="person">👶 လူ နာမည်</SelectItem>
              <SelectItem value="business">🏢 လုပ်ငန်း နာမည်</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဖန်တီးနေသည်...</> : <><Baby className="w-4 h-4 mr-2" />နာမည်များ ဖန်တီးမည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">✨ နာမည်များ</h3>
            <Button size="sm" variant="ghost" onClick={handleCopy}>{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none font-myanmar text-sm">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
