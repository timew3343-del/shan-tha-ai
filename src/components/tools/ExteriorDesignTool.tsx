import { useState, useRef } from "react";
import { Loader2, Download, Plus, X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

export const ExteriorDesignTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState("modern");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cost = (costs as any).exterior_design || 5;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const stylePrompts: Record<string, string> = {
    modern: "modern minimalist architecture with clean lines, large glass windows, flat roof",
    classic: "classic European architecture with ornate details, columns, stone facade",
    zen: "Japanese Zen style with natural materials, rock garden, wooden elements, minimalist",
    tropical: "tropical resort style with open spaces, palm trees, wooden deck, thatched roof",
  };

  const handleGenerate = async () => {
    if (!image || !userId) return;
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("interior-design", {
        body: {
          imageBase64: image.split(",")[1],
          userId,
          style: "exterior",
          prompt: `Transform this building/land into a beautiful ${stylePrompts[style]} exterior house design. High quality 3D architectural rendering, professional visualization, photorealistic.`,
          toolType: "exterior_design",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.imageUrl);
      refetch();
      toast({ title: "အောင်မြင်ပါသည်!", description: `အိမ်ပြင်ပ ဒီဇိုင်း ဖန်တီးပြီးပါပြီ (${data.creditsUsed} Cr)` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI အိမ်မက်အိမ် ဒီဇိုင်နာ - အပြင်ပိုင်း" subtitle="ခေတ်မီအိမ် ပြင်ပ ဒီဇိုင်း ဖန်တီးခြင်း" onBack={onBack} />

      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <label className="block text-sm font-medium text-primary font-myanmar">မြေကွက် / အိမ်ဟောင်း ဓာတ်ပုံ</label>
        {image ? (
          <div className="relative inline-block">
            <img src={image} alt="Upload" className="w-full max-h-48 object-contain rounded-xl border border-primary/30" />
            <button onClick={() => { setImage(null); setResult(null); }} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
            <Plus className="w-6 h-6 text-primary" />
            <span className="text-xs text-muted-foreground font-myanmar">ဓာတ်ပုံ ရွေးပါ</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />

        <div>
          <label className="text-xs text-muted-foreground font-myanmar">ဒီဇိုင်း စတိုင်</label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="modern">🏢 Modern</SelectItem>
              <SelectItem value="classic">🏛️ Classic</SelectItem>
              <SelectItem value="zen">🎋 Zen</SelectItem>
              <SelectItem value="tropical">🌴 Tropical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading || !image || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဒီဇိုင်းဆွဲနေသည်...</> : <><Building2 className="w-4 h-4 mr-2" />ဒီဇိုင်း ဖန်တီးမည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">🏠 ဒီဇိုင်း ရလဒ်</h3>
          <img src={result} alt="Exterior Design" className="w-full rounded-xl" />
          <Button onClick={() => { const a = document.createElement("a"); a.href = result; a.download = `exterior-${Date.now()}.png`; a.click(); }} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />Download
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
