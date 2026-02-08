import { useState, useRef } from "react";
import { Loader2, Download, Plus, X, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

const STYLES = [
  { value: "oil_paint", label: "🎨 Oil Painting" },
  { value: "sketch", label: "✏️ Pencil Sketch" },
  { value: "myanmar_art", label: "🇲🇲 Myanmar Traditional Art" },
  { value: "watercolor", label: "💧 Watercolor" },
  { value: "anime", label: "🎌 Anime Style" },
  { value: "pop_art", label: "🌈 Pop Art" },
];

export const StyleTransferTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState("oil_paint");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cost = (costs as any).style_transfer || 3;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const stylePrompts: Record<string, string> = {
    oil_paint: "oil painting style, thick brushstrokes, rich colors, artistic masterpiece",
    sketch: "detailed pencil sketch, graphite drawing, fine lines, shading",
    myanmar_art: "traditional Myanmar art style, gold leaf, intricate patterns, Burmese painting",
    watercolor: "watercolor painting, soft colors, flowing washes, artistic",
    anime: "anime art style, cel shading, vibrant colors, Japanese animation",
    pop_art: "pop art style, bold colors, halftone dots, Andy Warhol inspired",
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
          style: "artistic",
          prompt: `Transform this photo into ${stylePrompts[style]}. High quality artistic rendering, beautiful detailed artwork.`,
          toolType: "style_transfer",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.imageUrl);
      refetch();
      toast({ title: "အောင်မြင်ပါသည်!", description: `Art Style ပြောင်းလဲပြီးပါပြီ (${data.creditsUsed} Cr)` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI အနုပညာ စတိုင်ပြောင်းလဲသူ" subtitle="ဓာတ်ပုံကို အနုပညာ လက်ရာအဖြစ် ပြောင်းလဲခြင်း" onBack={onBack} />

      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <label className="block text-sm font-medium text-primary font-myanmar">ဓာတ်ပုံ ရွေးပါ</label>
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
          <label className="text-xs text-muted-foreground font-myanmar">အနုပညာ စတိုင်</label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading || !image || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ပြောင်းလဲနေသည်...</> : <><Paintbrush className="w-4 h-4 mr-2" />Art Style ပြောင်းမည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">🎨 Art ရလဒ်</h3>
          <img src={result} alt="Styled" className="w-full rounded-xl" />
          <Button onClick={() => { const a = document.createElement("a"); a.href = result; a.download = `art-${Date.now()}.png`; a.click(); }} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />Download
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
