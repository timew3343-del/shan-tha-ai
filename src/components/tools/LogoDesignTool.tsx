import { useState } from "react";
import { Loader2, Download, RefreshCw, Sparkles, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion, AnimatePresence } from "framer-motion";

interface LogoDesignToolProps {
  userId?: string;
  onBack: () => void;
}

const DESIGN_TYPES = [
  { value: "logo", label: "Logo", aspect: "1:1" },
  { value: "fb_cover", label: "Facebook Cover", aspect: "16:9" },
  { value: "business_card", label: "Business Card", aspect: "3:2" },
  { value: "youtube_banner", label: "YouTube Banner", aspect: "16:9" },
  { value: "instagram_post", label: "Instagram Post", aspect: "1:1" },
  { value: "tiktok_bg", label: "TikTok Background", aspect: "9:16" },
];

const DESIGN_STYLES = [
  { value: "simple", label: "ရိုးရှင်းသော" },
  { value: "luxury", label: "Luxury" },
  { value: "modern", label: "ခေတ်မီသော" },
  { value: "3d", label: "3D ဖောင်းကြွ" },
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
  const [designType, setDesignType] = useState("logo");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [designStyle, setDesignStyle] = useState("modern");
  const [numImages, setNumImages] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [lastSettings, setLastSettings] = useState<any>(null);

  const baseCostPerImage = costs.logo_design || 5;
  const totalCost = baseCostPerImage * numImages;

  const selectedDesign = DESIGN_TYPES.find(d => d.value === designType);
  const aspectRatio = selectedDesign?.aspect || "1:1";
  const dimensions = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS["1:1"];

  const handleGenerate = async () => {
    if (!businessName.trim()) {
      toast({ title: "လုပ်ငန်းအမည် ထည့်ပါ", variant: "destructive" });
      return;
    }
    if (!userId) {
      toast({ title: "အကောင့်ဝင်ရန် လိုအပ်သည်", variant: "destructive" });
      return;
    }
    if (credits < totalCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${totalCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);

    const styleLabel = DESIGN_STYLES.find(s => s.value === designStyle)?.label || designStyle;
    const typeLabel = selectedDesign?.label || designType;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const results: string[] = [];

      for (let i = 0; i < numImages; i++) {
        const prompt = `Professional ${typeLabel} design for "${businessName}" (${businessType || "business"}). Style: ${styleLabel}. Clean, high-quality, commercial-ready design. ${
          designType === "logo" ? "Minimal, scalable vector-style logo on a clean background." :
          designType === "fb_cover" ? "Wide banner format, eye-catching, brand-focused." :
          designType === "business_card" ? "Elegant business card layout with contact info area." :
          designType === "youtube_banner" ? "Dynamic YouTube channel banner with branding." :
          designType === "instagram_post" ? "Square format, Instagram-optimized, visually striking." :
          "Vertical TikTok background with bold branding."
        } Variation ${i + 1}.`;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ prompt, width: dimensions.w, height: dimensions.h }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Image generation failed");
        }

        const data = await response.json();
        if (data.imageUrl) {
          results.push(data.imageUrl);
          setGeneratedImages([...results]);
        }
      }

      // Deduct credits after all images generated
      await supabase.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: totalCost,
        _action: `Logo Design (${numImages} images)`,
      });

      refetchCredits();
      setLastSettings({ designType, businessName, businessType, designStyle, numImages });
      toast({ title: "ဖန်တီးပြီးပါပြီ!", description: `${results.length} ပုံ ဖန်တီးပြီးပါပြီ` });
    } catch (error: any) {
      console.error("Logo design error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    if (lastSettings) {
      handleGenerate();
    }
  };

  const handleDownload = (imageUrl: string, index: number) => {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `${businessName}-${designType}-${index + 1}.png`;
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
      <ToolHeader
        title="Logo နှင့် Graphic Design ဆွဲပေးခြင်း"
        subtitle="လုပ်ငန်းသုံး Logo၊ FB Cover နှင့် Social Media ဒီဇိုင်းများကို AI ဖြင့် ဖန်တီးပါ"
        onBack={onBack}
      />

      {/* Form */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4">
        {/* Design Type */}
        <div className="space-y-2">
          <Label className="text-sm font-myanmar">ဒီဇိုင်း အမျိုးအစား</Label>
          <Select value={designType} onValueChange={setDesignType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DESIGN_TYPES.map(dt => (
                <SelectItem key={dt.value} value={dt.value}>{dt.label} ({dt.aspect})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Business Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-myanmar">လုပ်ငန်းအမည်</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Myanmar Coffee" className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-myanmar">လုပ်ငန်းအမျိုးအစား</Label>
            <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="e.g. Coffee Shop" className="text-sm" />
          </div>
        </div>

        {/* Design Style */}
        <div className="space-y-2">
          <Label className="text-sm font-myanmar">ဒီဇိုင်း Style</Label>
          <Select value={designStyle} onValueChange={setDesignStyle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DESIGN_STYLES.map(ds => (
                <SelectItem key={ds.value} value={ds.value}>{ds.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Number of images */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-myanmar">ပုံအရေအတွက်</Label>
            <span className="text-sm font-bold text-primary">{numImages} ပုံ</span>
          </div>
          <Slider value={[numImages]} onValueChange={(val) => setNumImages(val[0])} min={1} max={10} step={1} />
        </div>

        {/* Cost Display */}
        <div className="bg-secondary/30 rounded-xl p-3 border border-primary/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-myanmar">စုစုပေါင်း Credit</span>
            <span className="font-bold text-primary">{totalCost} Credits</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>{baseCostPerImage} Cr/ပုံ × {numImages} ပုံ</span>
            <span>Aspect: {aspectRatio}</span>
          </div>
        </div>

        {/* Generate Button */}
        <Button onClick={handleGenerate} disabled={isGenerating || !businessName.trim() || credits < totalCost} className="w-full bg-primary text-primary-foreground rounded-2xl py-3">
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> ဖန်တီးနေသည်...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> ဒီဇိုင်း ဖန်တီးမည် ({totalCost} Cr)</>
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
              {lastSettings && (
                <Button onClick={handleRegenerate} disabled={isGenerating} variant="outline" size="sm" className="text-xs">
                  <RefreshCw className="w-3 h-3 mr-1" /> ထပ်ဖန်တီးမည်
                </Button>
              )}
            </div>

            <div className={`grid ${aspectRatio === "9:16" ? "grid-cols-2" : aspectRatio === "16:9" ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
              {generatedImages.map((img, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }} className="relative group rounded-2xl overflow-hidden border border-primary/20 bg-black/20">
                  <img src={img} alt={`Design ${idx + 1}`} className="w-full h-auto object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button onClick={() => handleDownload(img, idx)} size="sm" className="bg-primary text-primary-foreground">
                      <Download className="w-4 h-4 mr-1" /> Download
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isGenerating && generatedImages.length < numImages && (
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground font-myanmar">
            {generatedImages.length}/{numImages} ပုံ ဖန်တီးပြီး...
          </p>
        </div>
      )}
    </motion.div>
  );
};
