import { useState, useRef } from "react";
import { ZoomIn, Upload, Sparkles, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";
import { useToolOutput } from "@/hooks/useToolOutput";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";

interface UpscaleToolProps {
  userId?: string;
  onBack: () => void;
}

const PLATFORM_PRESETS = [
  { id: "original", label: "Original 4K", icon: "🖼️", desc: "Original size" },
  { id: "tiktok", label: "TikTok", icon: "🎵", desc: "1080×1920" },
  { id: "youtube", label: "YouTube", icon: "▶️", desc: "1920×1080" },
  { id: "instagram", label: "Instagram", icon: "📸", desc: "1080×1080" },
  { id: "fb_cover", label: "FB Cover", icon: "📘", desc: "820×312" },
  { id: "twitter", label: "Twitter/X", icon: "🐦", desc: "1500×500" },
];

export const UpscaleTool = ({ userId, onBack }: UpscaleToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState("original");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { showGuide, markAsLearned, saveOutput } = useToolOutput("upscale", "ပုံကြည်လင်အောင်ပြုလုပ်ရန်");

  const creditCost = costs.upscale || 1;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "ဖိုင်ကြီးလွန်းပါသည်",
          description: "10MB အောက် ပုံရွေးပါ",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceImage(event.target?.result as string);
        setResultImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSourceImage(null);
    setResultImage(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const resizeToPreset = (imageUrl: string, preset: string): Promise<string> => {
    return new Promise((resolve) => {
      if (preset === "original") {
        resolve(imageUrl);
        return;
      }
      const dims: Record<string, { w: number; h: number }> = {
        tiktok: { w: 1080, h: 1920 },
        youtube: { w: 1920, h: 1080 },
        instagram: { w: 1080, h: 1080 },
        fb_cover: { w: 820, h: 312 },
        twitter: { w: 1500, h: 500 },
      };
      const target = dims[preset];
      if (!target) { resolve(imageUrl); return; }

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = target.w;
        canvas.height = target.h;
        const ctx = canvas.getContext("2d")!;
        // Cover crop: scale to fill then center crop
        const scale = Math.max(target.w / img.width, target.h / img.height);
        const sw = target.w / scale;
        const sh = target.h / scale;
        const sx = (img.width - sw) / 2;
        const sy = (img.height - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, target.w, target.h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(imageUrl);
      img.src = imageUrl;
    });
  };

  const handleUpscale = async () => {
    if (!sourceImage) {
      toast({
        title: "ပုံထည့်ပါ",
        description: "ကြည်လင်အောင်ပြုလုပ်ရန် ပုံတစ်ပုံ ထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    if ((credits || 0) < creditCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `ပုံကြည်လင်အောင်ပြုလုပ်ရန် ${creditCost} Credit လိုအပ်ပါသည်`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResultImage(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95;
        return prev + Math.random() * 5;
      });
    }, 500);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "အကောင့်ဝင်ရန်လိုအပ်သည်",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upscale-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            imageBase64: sourceImage.split(",")[1],
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upscale failed");
      }

      // Apply selected platform resize
      const finalImage = await resizeToPreset(result.image, selectedPreset);
      setResultImage(finalImage);
      setProgress(100);
      refetchCredits();
      saveOutput("image", finalImage);

      toast({
        title: "အောင်မြင်ပါသည်",
        description: `ပုံကြည်လင်အောင်ပြုလုပ်ပြီးပါပြီ (${result.creditsUsed} Credit)`,
      });
    } catch (error: any) {
      console.error("Upscale error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "ပုံကြည်လင်အောင်ပြုလုပ်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-4 pb-24"
    >
      <ToolHeader 
        title="ပုံကြည်လင်အောင်ပြုလုပ်ရန်" 
        subtitle="ပုံများကို 4K အထိ ကြည်လင်အောင် ပြုလုပ်ပေးပါ"
        onBack={onBack} 
      />

      <FirstOutputGuide toolName="ပုံကြည်လင်အောင်ပြုလုပ်ရန်" steps={["ပုံထည့်ပါ", "ကြည်လင်အောင်ပြုလုပ်မည် ခလုတ်ကို နှိပ်ပါ", "ရလဒ်ပုံကို ဒေါင်းလုဒ်လုပ်ပါ"]} show={showGuide} onDismiss={markAsLearned} />

      {/* Source Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          <ZoomIn className="w-4 h-4 inline mr-1" />
          ပုံထည့်ပါ
        </label>
        {sourceImage ? (
          <div className="relative">
            <img src={sourceImage} alt="Source" className="w-full max-h-48 object-contain rounded-xl border border-primary/30" />
            <button onClick={removeImage} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => imageInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ပုံထည့်ပါ</span>
          </button>
        )}
        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </div>

      {/* Platform Size Presets */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">📐 Platform Size ရွေးချယ်ပါ</label>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORM_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedPreset(preset.id)}
              className={`flex flex-col items-center gap-0.5 p-2.5 rounded-xl border transition-all ${
                selectedPreset === preset.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border/50 hover:border-primary/30"
              }`}
            >
              <span className="text-lg">{preset.icon}</span>
              <span className="text-[10px] font-medium">{preset.label}</span>
              <span className="text-[8px] text-muted-foreground">{preset.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {isLoading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">ပုံကြည်လင်အောင်ပြုလုပ်နေသည်...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Upscale Button */}
      <Button
        onClick={handleUpscale}
        disabled={isLoading || !sourceImage}
        className="w-full btn-gradient-blue py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ကြည်လင်အောင်ပြုလုပ်နေသည်...
          </>
        ) : (
          <>
            <ZoomIn className="w-5 h-5 mr-2" />
            ကြည်လင်အောင်ပြုလုပ်မည် ({creditCost} Credit)
          </>
        )}
      </Button>

      {/* Result */}
      {resultImage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="gradient-card rounded-2xl p-4 border border-primary/30"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary font-myanmar">4K ရလဒ်</h3>
            </div>
            <Button
              onClick={() => {
                const link = document.createElement("a");
                link.href = resultImage;
                link.download = `upscaled-4k-${Date.now()}.png`;
                link.click();
              }}
              size="sm"
              variant="outline"
              className="text-xs font-myanmar"
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
          <img
            src={resultImage}
            alt="Upscaled"
            className="w-full rounded-xl border border-border"
          />
        </motion.div>
      )}
    </motion.div>
  );
};
