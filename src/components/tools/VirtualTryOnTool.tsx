import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Download, Plus, X, Shirt, Watch, Glasses, Briefcase, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

interface ItemSlot {
  key: string;
  label: string;
  icon: any;
  image: string | null;
  category: "upper_body" | "lower_body" | "accessory";
  baseCost: number;
}

const INITIAL_SLOTS: Omit<ItemSlot, "image">[] = [
  { key: "upper", label: "အထက်ပိုင်း အဝတ်", icon: Shirt, category: "upper_body", baseCost: 3 },
  { key: "lower", label: "အောက်ပိုင်း အဝတ်", icon: Shirt, category: "lower_body", baseCost: 3 },
  { key: "belt", label: "ခါးပတ်", icon: Briefcase, category: "accessory", baseCost: 1 },
  { key: "glasses", label: "မျက်မှန်", icon: Glasses, category: "accessory", baseCost: 1 },
  { key: "watch", label: "နာရီ", icon: Watch, category: "accessory", baseCost: 1 },
  { key: "handheld", label: "လက်ကိုင်ပစ္စည်း", icon: Briefcase, category: "accessory", baseCost: 1 },
];

export const VirtualTryOnTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [slots, setSlots] = useState<ItemSlot[]>(INITIAL_SLOTS.map(s => ({ ...s, image: null })));
  const [pose, setPose] = useState<"standing" | "sitting">("standing");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [adminMargin, setAdminMargin] = useState(200);
  const personRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Fetch admin margin for dynamic pricing
  useEffect(() => {
    const fetchMargin = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "profit_margin")
          .maybeSingle();
        if (data?.value) setAdminMargin(parseInt(data.value, 10) || 200);
      } catch {}
    };
    fetchMargin();
  }, []);

  const activeItems = slots.filter(s => s.image !== null);
  const totalBaseCost = activeItems.reduce((sum, s) => sum + s.baseCost, 0);
  const estimatedCredits = Math.max(1, Math.ceil(totalBaseCost * (1 + adminMargin / 100)));

  const handleUpload = (setter: (v: string | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setter(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSlotUpload = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setSlots(prev => prev.map(s => s.key === key ? { ...s, image: ev.target?.result as string } : s));
      };
      reader.readAsDataURL(file);
    }
  };

  const clearSlot = (key: string) => {
    setSlots(prev => prev.map(s => s.key === key ? { ...s, image: null } : s));
  };

  const handleGenerate = async () => {
    if (!personImage || activeItems.length === 0 || !userId) return;
    setIsLoading(true);
    setResult(null);
    try {
      const items = activeItems.map(s => ({
        image: s.image,
        category: s.category,
        key: s.key,
        baseCost: s.baseCost,
      }));

      const { data, error } = await supabase.functions.invoke("virtual-tryon", {
        body: { personImage, items, pose },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      setResult(data?.imageUrl);
      refetch();
      toast({ title: "အောင်မြင်ပါသည်!", description: `${data.creditsUsed} Credits သုံးပြီးပါပြီ` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const ImageUploader = ({ image, onClear, onSelect, label, IconComp }: {
    image: string | null; onClear: () => void; onSelect: () => void; label: string; IconComp: any;
  }) => (
    <div className="flex-1 min-w-0">
      <label className="block text-[10px] font-medium text-primary mb-1 font-myanmar truncate">{label}</label>
      {image ? (
        <div className="relative">
          <img src={image} alt={label} className="w-full h-20 object-cover rounded-xl border border-primary/30" />
          <button onClick={onClear} className="absolute -top-1.5 -right-1.5 p-0.5 bg-destructive rounded-full text-white">
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ) : (
        <button onClick={onSelect} className="w-full h-20 border-2 border-dashed border-primary/20 rounded-xl flex flex-col items-center justify-center gap-0.5 hover:bg-primary/5 transition-colors">
          <IconComp className="w-4 h-4 text-primary/60" />
          <span className="text-[8px] text-muted-foreground font-myanmar">{label}</span>
        </button>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3 p-4 pb-24">
      <ToolHeader title="AI အဝတ်အစား လဲလှယ်သူ" subtitle="AI ဖြင့် အဝတ်အစားနှင့် Accessories စမ်းဝတ်ကြည့်ခြင်း (7+1 System)" onBack={onBack} />

      {/* Person Photo */}
      <div className="gradient-card rounded-2xl p-3 border border-primary/20">
        <label className="block text-xs font-medium text-primary mb-2 font-myanmar">👤 သင့်ဓာတ်ပုံ (လိုအပ်သည်)</label>
        {personImage ? (
          <div className="relative inline-block">
            <img src={personImage} alt="Person" className="w-full max-h-40 object-contain rounded-xl border border-primary/30" />
            <button onClick={() => setPersonImage(null)} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => personRef.current?.click()} className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-primary/5">
            <User className="w-8 h-8 text-primary" />
            <span className="text-xs text-muted-foreground font-myanmar">ဓာတ်ပုံ ရွေးပါ</span>
          </button>
        )}
        <input ref={personRef} type="file" accept="image/*" onChange={handleUpload(setPersonImage)} className="hidden" />
      </div>

      {/* 6 Item Slots Grid */}
      <div className="gradient-card rounded-2xl p-3 border border-primary/20">
        <label className="block text-xs font-medium text-primary mb-2 font-myanmar">👗 ဝတ်စုံနှင့် Accessories (ရွေးချယ်ပါ)</label>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => (
            <div key={slot.key}>
              <ImageUploader
                image={slot.image}
                onClear={() => clearSlot(slot.key)}
                onSelect={() => itemRefs.current[slot.key]?.click()}
                label={slot.label}
                IconComp={slot.icon}
              />
              <input
                ref={(el) => { itemRefs.current[slot.key] = el; }}
                type="file"
                accept="image/*"
                onChange={handleSlotUpload(slot.key)}
                className="hidden"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pose Selection */}
      <div className="gradient-card rounded-2xl p-3 border border-primary/20">
        <Label className="text-xs font-medium text-primary font-myanmar">🧍 Pose ရွေးချယ်ပါ</Label>
        <Select value={pose} onValueChange={(v: "standing" | "sitting") => setPose(v)}>
          <SelectTrigger className="mt-1.5 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="standing">🧍 Standing (ရပ်နေပုံ)</SelectItem>
            <SelectItem value="sitting">🪑 Sitting (ထိုင်နေပုံ)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dynamic Cost Estimation */}
      <div className="bg-secondary/30 rounded-xl p-3 border border-primary/10">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-myanmar">ခန့်မှန်း Credit ကုန်ကျစရိတ်</span>
          <span className="font-bold text-primary">{activeItems.length > 0 ? `~${estimatedCredits} Credits` : "—"}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
          <span>ပစ္စည်း {activeItems.length} ခု × Admin Margin {adminMargin}%</span>
          <span>Base: {totalBaseCost} Cr</span>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isLoading || !personImage || activeItems.length === 0 || credits < estimatedCredits}
        className="w-full bg-primary text-primary-foreground rounded-2xl py-4"
      >
        {isLoading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဖန်တီးနေသည်...</>
        ) : (
          <><Shirt className="w-4 h-4 mr-2" />ဝတ်ကြည့်မည် (~{estimatedCredits} Cr)</>
        )}
      </Button>

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
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
