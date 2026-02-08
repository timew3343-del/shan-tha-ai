import { useState, useRef } from "react";
import { Loader2, Download, Plus, X, Car, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface Props { userId?: string; onBack: () => void; }

export const CarDealerTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [image, setImage] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [condition, setCondition] = useState("good");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cost = (costs as any).car_dealer || 3;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!userId || !brand || !model) return;
    setIsLoading(true);
    setResult(null);
    try {
      const prompt = `You are a Myanmar car market expert. Analyze and provide a detailed valuation report in Burmese.

Car Details:
- Brand: ${brand}
- Model: ${model}
- Year: ${year || "N/A"}
- Mileage: ${mileage || "N/A"} km
- Engine Condition: ${condition}
${image ? "- Photo provided (analyze condition from photo)" : ""}

Provide:
1. **ခန့်မှန်းဈေးနှုန်း** (Estimated Price in MMK)
2. **ဈေးကွက်လမ်းကြောင်း** (Market Trend - rising/stable/declining)
3. **ပြန်ရောင်းတန်ဖိုး** (Resale Value Advice)
4. **ဝယ်/ရောင်း အကြံပြုချက်** (Buy/Sell Recommendation)
5. **အားသာချက်/အားနည်းချက်** (Pros/Cons of this model)

Format with clear sections and Myanmar currency.`;

      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { userId, toolType: "car_dealer", prompt, imageBase64: image?.split(",")[1] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.result);
      refetch();
      toast({ title: "အောင်မြင်ပါသည်!", description: `ကားဈေးနှုန်း ခန့်မှန်းပြီးပါပြီ (${data.creditsUsed} Cr)` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI ကားအရောင်းအဝယ်နှင့် ဈေးနှုန်းခန့်မှန်းသူ" subtitle="မြန်မာကား ဈေးကွက် ခွဲခြမ်းစိတ်ဖြာခြင်း" onBack={onBack} />

      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <label className="block text-sm font-medium text-primary font-myanmar">ကား ဓာတ်ပုံ (Optional)</label>
        {image ? (
          <div className="relative inline-block">
            <img src={image} alt="Car" className="w-full max-h-48 object-contain rounded-xl border border-primary/30" />
            <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="w-full h-28 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
            <Plus className="w-6 h-6 text-primary" />
            <span className="text-xs text-muted-foreground font-myanmar">ကား ဓာတ်ပုံ ရွေးပါ</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground font-myanmar">Brand</label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Toyota, Honda..." className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-myanmar">Model</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Vitz, Fit..." className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-myanmar">Year</label>
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2018" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-myanmar">Mileage (km)</label>
            <Input value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="50000" className="mt-1" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">Engine Condition</label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">Excellent</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="fair">Fair</SelectItem>
              <SelectItem value="poor">Poor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading || !brand || !model || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ခွဲခြမ်းစိတ်ဖြာနေသည်...</> : <><TrendingUp className="w-4 h-4 mr-2" />ဈေးနှုန်းခန့်မှန်းမည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30">
          <h3 className="text-sm font-semibold text-primary font-myanmar mb-3">📊 Valuation Report</h3>
          <div className="prose prose-sm dark:prose-invert max-w-none font-myanmar text-sm">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
