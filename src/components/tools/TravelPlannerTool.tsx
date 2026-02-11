import { useState } from "react";
import { Loader2, Plane, Copy, Check, MapPin } from "lucide-react";
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

const INTERESTS = [
  { value: "nature", label: "🌿 သဘာဝ" },
  { value: "history", label: "🏛️ သမိုင်း" },
  { value: "food", label: "🍜 အစားအစာ" },
  { value: "adventure", label: "🏔️ စွန့်စားခရီး" },
  { value: "shopping", label: "🛍️ Shopping" },
  { value: "culture", label: "🎭 ယဉ်ကျေးမှု" },
];

export const TravelPlannerTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("travel_planner", "Travel Planner");
  const [destination, setDestination] = useState("");
  const [duration, setDuration] = useState("5");
  const [budget, setBudget] = useState("");
  const [interest, setInterest] = useState("nature");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cost = (costs as any).travel_planner || 3;

  const handleGenerate = async () => {
    if (!userId || !destination.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const interestLabel = INTERESTS.find(i => i.value === interest)?.label || interest;
      const prompt = `You are a global travel expert. Create a complete travel itinerary in Burmese.

Destination: ${destination}
Duration: ${duration} days
Budget: ${budget || "Not specified"}
Interest: ${interestLabel}

Provide a detailed day-by-day itinerary in Burmese:
1. **ခရီးစဉ် အကျဉ်းချုပ်** (Trip Summary)
2. **နေ့စဉ် အစီအစဉ်** (Day-by-day plan with times, activities, restaurants)
3. **လေယာဉ်/သယ်ယူပို့ဆောင်ရေး** (Transport suggestions from Myanmar)
4. **ဟိုတယ် အကြံပြုချက်** (Hotel recommendations by budget)
5. **ခန့်မှန်း ကုန်ကျစရိတ်** (Estimated costs in USD and MMK)
6. **မသွားမဖြစ် သွားရမည့်နေရာများ** (Must-visit places)
7. **အကြံပြုချက်များ** (Travel tips, visa info, weather)
8. **အစားအစာ အကြံပြုချက်** (Local food recommendations)

Make it practical and detailed for Myanmar travelers.`;

      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { userId, toolType: "travel_planner", prompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.result);
      refetch();
      if (data?.result) saveOutput("text", data.result);
      toast({ title: "အောင်မြင်ပါသည်!", description: `ခရီးစဉ် ပလန် ဖန်တီးပြီး (${data.creditsUsed} Cr)` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const handleCopy = () => {
    if (result) { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI ကမ္ဘာပတ် ခရီးသွားလမ်းညွှန်" subtitle="ကမ္ဘာတစ်ဝှမ်း ခရီးစဉ် ပလန်ဆွဲခြင်း" onBack={onBack} />

      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">ခရီးသွားမည့်နေရာ</label>
          <div className="relative mt-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Tokyo, Bangkok, Seoul..." className="pl-9" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground font-myanmar">ရက်ပေါင်း</label>
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} type="number" min="1" max="30" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-myanmar">Budget (USD)</label>
            <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="1000" className="mt-1" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">စိတ်ဝင်စားမှု</label>
          <Select value={interest} onValueChange={setInterest}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INTERESTS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading || !destination.trim() || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ပလန်ဆွဲနေသည်...</> : <><Plane className="w-4 h-4 mr-2" />ခရီးစဉ် ပလန်ဆွဲမည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">✈️ ခရီးစဉ် ပလန်</h3>
            <Button size="sm" variant="ghost" onClick={handleCopy}>{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none font-myanmar text-sm max-h-[500px] overflow-y-auto">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
