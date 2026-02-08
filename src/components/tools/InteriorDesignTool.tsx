import { useState, useRef } from "react";
import { Loader2, Download, Plus, X, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

const STYLES = [
  { value: "modern minimalist", label: "Modern Minimalist" },
  { value: "traditional myanmar", label: "မြန်မာ့ရိုးရာ" },
  { value: "scandinavian", label: "Scandinavian" },
  { value: "industrial", label: "Industrial" },
  { value: "bohemian", label: "Bohemian" },
  { value: "japanese zen", label: "Japanese Zen" },
  { value: "luxury classic", label: "Luxury Classic" },
];

const ROOMS = [
  { value: "living room", label: "ဧည့်ခန်း" },
  { value: "bedroom", label: "အိပ်ခန်း" },
  { value: "kitchen", label: "မီးဖိုချောင်" },
  { value: "bathroom", label: "ရေချိုးခန်း" },
  { value: "office", label: "ရုံးခန်း" },
  { value: "dining room", label: "ထမင်းစားခန်း" },
];

export const InteriorDesignTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState("modern minimalist");
  const [roomType, setRoomType] = useState("living room");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cost = costs.interior_design || 15;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = (ev) => setImage(ev.target?.result as string); reader.readAsDataURL(file); }
  };

  const handleGenerate = async () => {
    if (!image || !userId) return;
    setIsLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("interior-design", {
        body: { imageBase64: image, style, roomType },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.imageUrl); refetch();
      toast({ title: "ဒီဇိုင်း ဖန်တီးပြီးပါပြီ!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI အိမ်တွင်းအလှဆင် ဒီဇိုင်နာ" subtitle="အခန်းပုံတင်ပြီး AI ဖြင့် ပြန်လည်ဒီဇိုင်းဆွဲခြင်း" onBack={onBack} />
      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-2 font-myanmar">အခန်းပုံ တင်ပါ</label>
          {image ? (
            <div className="relative">
              <img src={image} alt="Room" className="w-full max-h-48 object-cover rounded-xl border border-primary/30" />
              <button onClick={() => { setImage(null); setResult(null); }} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5">
              <Plus className="w-8 h-8 text-primary" /><span className="text-sm text-muted-foreground font-myanmar">အခန်းပုံ ရွေးပါ</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </div>
        <div id="settings-panel" className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-myanmar">ဒီဇိုင်း Style</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-myanmar">အခန်းအမျိုးအစား</Label>
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROOMS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || !image || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဒီဇိုင်းဆွဲနေသည်...</> : <><Home className="w-4 h-4 mr-2" />ဒီဇိုင်း ဖန်တီးမည် ({cost} Cr)</>}
      </Button>
      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">ဖန်တီးထားသော ဒီဇိုင်း</h3>
          <img src={result} alt="Redesigned" className="w-full rounded-xl" />
          <Button onClick={() => { const a = document.createElement("a"); a.href = result!; a.download = `interior-${Date.now()}.png`; a.click(); }} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />Download
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
