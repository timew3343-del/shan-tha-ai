import { useState, useRef } from "react";
import { Loader2, Download, Plus, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

export const PhotoRestoreTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cost = costs.photo_restoration || 10;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!image || !userId) return;
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("photo-restore", {
        body: { imageBase64: image },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.imageUrl);
      refetch();
      toast({ title: "အောင်မြင်ပါသည်!", description: `ဓာတ်ပုံ ပြုပြင်ပြီးပါပြီ (${data.creditsUsed} Cr)` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI ဓာတ်ပုံဟောင်း ပြုပြင်သူ" subtitle="ပုံဟောင်းများကို ရှင်းလင်းပြတ်သားအောင် ပြုပြင်ပေးခြင်း" onBack={onBack} />

      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">ပုံဟောင်း တင်ပါ</label>
        {image ? (
          <div className="relative inline-block">
            <img src={image} alt="Upload" className="w-full max-h-64 object-contain rounded-xl border border-primary/30" />
            <button onClick={() => { setImage(null); setResult(null); }} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="w-full h-40 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
            <Plus className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ဓာတ်ပုံ ရွေးပါ</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </div>

      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || !image || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ပြုပြင်နေသည်...</> : <><ImagePlus className="w-4 h-4 mr-2" />ပုံ ပြုပြင်မည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">ပြုပြင်ပြီး ရလဒ်</h3>
          <img src={result} alt="Restored" className="w-full rounded-xl" />
          <Button onClick={() => { const a = document.createElement("a"); a.href = result; a.download = `restored-${Date.now()}.png`; a.click(); }} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />Download
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
