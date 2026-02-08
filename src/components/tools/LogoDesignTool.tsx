import { useState } from "react";
import { Loader2, Download, RefreshCw, Sparkles, Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion, AnimatePresence } from "framer-motion";

interface LogoDesignToolProps { userId?: string; onBack: () => void; }

const PLATFORMS = [
  { value: "logo", label: "Logo", aspect: "1:1", icon: "🎯" },
  { value: "fb_cover", label: "Facebook Cover", aspect: "16:9", icon: "📘" },
  { value: "tiktok_bg", label: "TikTok / Phone Wallpaper", aspect: "9:16", icon: "🎵" },
  { value: "youtube_banner", label: "YouTube Banner", aspect: "16:9", icon: "▶️" },
  { value: "business_card", label: "Business Card", aspect: "3:2", icon: "💼" },
  { value: "instagram_post", label: "Instagram Post", aspect: "1:1", icon: "📸" },
];

const DESIGN_STYLES = [
  { value: "modern", label: "ခေတ်မီ Minimalist" },
  { value: "3d_minimalist", label: "3D Minimalist" },
  { value: "luxury_gold", label: "Luxury Gold" },
  { value: "retro", label: "Retro / Vintage" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "corporate", label: "Professional Corporate" },
  { value: "playful", label: "Playful / Fun" },
  { value: "elegant", label: "Elegant / Serif" },
  { value: "bold", label: "Bold & Strong" },
  { value: "nature", label: "Nature / Organic" },
  { value: "tech", label: "Tech / Digital" },
  { value: "hand_drawn", label: "Hand-Drawn" },
  { value: "geometric", label: "Geometric" },
  { value: "gradient", label: "Gradient Modern" },
  { value: "flat", label: "Flat Design" },
  { value: "art_deco", label: "Art Deco" },
  { value: "neon", label: "Neon Glow" },
  { value: "watercolor", label: "Watercolor" },
  { value: "myanmar_traditional", label: "Myanmar Traditional" },
  { value: "abstract", label: "Abstract" },
  { value: "monochrome", label: "Monochrome" },
  { value: "pastel", label: "Pastel Soft" },
];

const ASPECT_RATIOS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 },
  "16:9": { w: 1344, h: 768 },
  "3:2": { w: 1152, h: 768 },
  "9:16": { w: 768, h: 1344 },
};

export const LogoDesignTool = ({ userId, onBack }: LogoDesignToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["logo"]);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [designStyle, setDesignStyle] = useState("modern");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{ platform: string; url: string; aspect: string }[]>([]);
  const [generationProgress, setGenerationProgress] = useState({ done: 0, total: 0 });

  const baseCostPerImage = costs.logo_design || 5;
  const totalCost = baseCostPerImage * selectedPlatforms.length;

  const togglePlatform = (value: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]
    );
  };

  const handleGenerate = async () => {
    if (!businessName.trim()) {
      toast({ title: "လုပ်ငန်းအမည် ထည့်ပါ", variant: "destructive" });
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast({ title: "Platform အနည်းဆုံး ၁ ခု ရွေးပါ", variant: "destructive" });
      return;
    }
    if (!userId || credits < totalCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${totalCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);
    setGenerationProgress({ done: 0, total: selectedPlatforms.length });

    const styleLabel = DESIGN_STYLES.find(s => s.value === designStyle)?.label || designStyle;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const results: { platform: string; url: string; aspect: string }[] = [];

      for (const platformKey of selectedPlatforms) {
        const platform = PLATFORMS.find(p => p.value === platformKey);
        if (!platform) continue;

        const dimensions = ASPECT_RATIOS[platform.aspect] || ASPECT_RATIOS["1:1"];
        const prompt = `Professional ${platform.label} design for "${businessName}" (${businessType || "business"}). Style: ${styleLabel}. Clean, high-quality, commercial-ready design. ${
          platformKey === "logo" ? "Minimal, scalable vector-style logo on a clean background." :
          platformKey === "fb_cover" ? "Wide banner format, eye-catching, brand-focused." :
          platformKey === "business_card" ? "Elegant business card layout with contact info area." :
          platformKey === "youtube_banner" ? "Dynamic YouTube channel banner with branding." :
          platformKey === "instagram_post" ? "Square format, Instagram-optimized, visually striking." :
          "Vertical TikTok background with bold branding."
        } Brand identity: consistent colors and design language.`;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ prompt, width: dimensions.w, height: dimensions.h }),
        });

        if (!response.ok) {
          const err = await response.json();
          console.error(`Failed for ${platform.label}:`, err);
          continue;
        }

        const data = await response.json();
        if (data.imageUrl) {
          results.push({ platform: platform.label, url: data.imageUrl, aspect: platform.aspect });
          setGeneratedImages([...results]);
        }
        setGenerationProgress({ done: results.length, total: selectedPlatforms.length });
      }

      // Deduct credits
      await supabase.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: baseCostPerImage * results.length,
        _action: `Logo Design (${results.length} platforms)`,
      });

      refetchCredits();
      toast({ title: "ဖန်တီးပြီးပါပြီ!", description: `${results.length} ဒီဇိုင်း ဖန်တီးပြီးပါပြီ` });
    } catch (error: any) {
      console.error("Logo design error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string, platform: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${businessName}-${platform}-${Date.now()}.png`;
    a.click();
  };

  const handleDownloadAll = () => {
    generatedImages.forEach(img => handleDownload(img.url, img.platform));
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
      <ToolHeader
        title="Logo နှင့် Graphic Design ဆွဲပေးခြင်း"
        subtitle="Multi-Platform ဒီဇိုင်းများကို တစ်ပြိုင်နက် ဖန်တီးပါ"
        onBack={onBack}
      />

      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4">
        {/* Multi-Platform Checkbox Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-myanmar font-semibold">Platform ရွေးချယ်ပါ (Multi-Select)</Label>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map(p => (
              <label key={p.value} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                selectedPlatforms.includes(p.value) 
                  ? "border-primary bg-primary/10" 
                  : "border-border/50 hover:border-primary/40"
              }`}>
                <Checkbox
                  checked={selectedPlatforms.includes(p.value)}
                  onCheckedChange={() => togglePlatform(p.value)}
                />
                <span className="text-base">{p.icon}</span>
                <div className="min-w-0">
                  <span className="text-xs font-medium block truncate">{p.label}</span>
                  <span className="text-[10px] text-muted-foreground">{p.aspect}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Business Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-myanmar">လုပ်ငန်းအမည်</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Myanmar Coffee" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-myanmar">လုပ်ငန်းအမျိုးအစား</Label>
            <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="e.g. Coffee Shop" className="text-sm" />
          </div>
        </div>

        {/* Design Style - 20+ options */}
        <div className="space-y-1.5">
          <Label className="text-xs font-myanmar">ဒီဇိုင်း Style (20+ ရွေးချယ်စရာ)</Label>
          <Select value={designStyle} onValueChange={setDesignStyle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {DESIGN_STYLES.map(ds => (
                <SelectItem key={ds.value} value={ds.value}>{ds.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cost Display */}
        <div className="bg-secondary/30 rounded-xl p-3 border border-primary/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-myanmar">စုစုပေါင်း Credit</span>
            <span className="font-bold text-primary">{totalCost} Credits</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {baseCostPerImage} Cr/platform × {selectedPlatforms.length} platforms
          </div>
        </div>

        {/* Generate Button */}
        <Button onClick={handleGenerate} disabled={isGenerating || !businessName.trim() || selectedPlatforms.length === 0 || credits < totalCost} className="w-full bg-primary text-primary-foreground rounded-2xl py-3">
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> ဖန်တီးနေသည်... ({generationProgress.done}/{generationProgress.total})</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> ဒီဇိုင်း {selectedPlatforms.length} ခု ဖန်တီးမည် ({totalCost} Cr)</>
          )}
        </Button>
      </div>

      {/* Output Gallery */}
      <AnimatePresence>
        {generatedImages.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold font-myanmar">ဖန်တီးထားသော ဒီဇိုင်းများ</h3>
              </div>
              {generatedImages.length > 1 && (
                <Button onClick={handleDownloadAll} variant="outline" size="sm" className="text-xs">
                  <Download className="w-3 h-3 mr-1" /> Download All
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {generatedImages.map((img, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }}
                  className="gradient-card rounded-2xl overflow-hidden border border-primary/20"
                >
                  <div className="p-2 bg-secondary/20 flex items-center justify-between">
                    <span className="text-xs font-medium text-primary">{img.platform} ({img.aspect})</span>
                    <Button onClick={() => handleDownload(img.url, img.platform)} size="sm" variant="ghost" className="h-7 text-xs">
                      <Download className="w-3 h-3 mr-1" /> Download
                    </Button>
                  </div>
                  <img src={img.url} alt={img.platform} className="w-full h-auto" loading="lazy" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isGenerating && generatedImages.length < selectedPlatforms.length && (
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground font-myanmar">
            {generatedImages.length}/{selectedPlatforms.length} platform ဖန်တီးပြီး...
          </p>
        </div>
      )}
    </motion.div>
  );
};
