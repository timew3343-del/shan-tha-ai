import { useState, useRef } from "react";
import { Loader2, Download, Plus, X, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

export const VirtualTryOnTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const personRef = useRef<HTMLInputElement>(null);
  const garmentRef = useRef<HTMLInputElement>(null);
  const cost = costs.virtual_tryon || 15;

  const handleUpload = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = (ev) => setter(ev.target?.result as string); reader.readAsDataURL(file); }
  };

  const handleGenerate = async () => {
    if (!personImage || !garmentImage || !userId) return;
    setIsLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("virtual-tryon", {
        body: { personImage, garmentImage },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.imageUrl); refetch();
      toast({ title: "အောင်မြင်ပါသည်!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const ImageUploader = ({ image, onClear, onSelect, label }: { image: string | null; onClear: () => void; onSelect: () => void; label: string }) => (
    <div className="flex-1">
      <label className="block text-xs font-medium text-primary mb-2 font-myanmar">{label}</label>
      {image ? (
        <div className="relative">
          <img src={image} alt={label} className="w-full h-32 object-cover rounded-xl border border-primary/30" />
          <button onClick={onClear} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <button onClick={onSelect} className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-primary/5">
          <Plus className="w-6 h-6 text-primary" /><span className="text-[10px] text-muted-foreground font-myanmar">{label}</span>
        </button>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI အင်္ကျီလဲဝတ်ကြည့်မယ်" subtitle="AI ဖြင့် အဝတ်အစား စမ်းဝတ်ကြည့်ခြင်း" onBack={onBack} />
      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20">
        <div className="flex gap-3">
          <ImageUploader image={personImage} onClear={() => setPersonImage(null)} onSelect={() => personRef.current?.click()} label="လူပုံ" />
          <ImageUploader image={garmentImage} onClear={() => setGarmentImage(null)} onSelect={() => garmentRef.current?.click()} label="အဝတ်ပုံ" />
        </div>
        <input ref={personRef} type="file" accept="image/*" onChange={handleUpload(setPersonImage)} className="hidden" />
        <input ref={garmentRef} type="file" accept="image/*" onChange={handleUpload(setGarmentImage)} className="hidden" />
      </div>
      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || !personImage || !garmentImage || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဖန်တီးနေသည်...</> : <><Shirt className="w-4 h-4 mr-2" />ဝတ်ကြည့်မည် ({cost} Cr)</>}
      </Button>
      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">ရလဒ်</h3>
          <img src={result} alt="Try-on result" className="w-full rounded-xl" />
          <Button onClick={() => { const a = document.createElement("a"); a.href = result!; a.download = `tryon-${Date.now()}.png`; a.click(); }} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />Download
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
