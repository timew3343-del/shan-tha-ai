import { useState, useRef } from "react";
import { Upload, Sparkles, Download, Loader2, X, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { Watermark, addWatermarkToImage } from "@/components/Watermark";
import { motion } from "framer-motion";

interface BgStudioToolProps {
  userId?: string;
  onBack: () => void;
}

const BG_TEMPLATES = [
  { id: "luxury_marble", label: "💎 Luxury Marble", prompt: "Elegant luxury white and grey marble surface with soft studio lighting, high-end product photography background, clean and premium" },
  { id: "wooden_table", label: "🪵 Wooden Table", prompt: "Beautiful warm wooden table surface with soft natural lighting, rustic elegant product photography background" },
  { id: "clean_white", label: "⬜ Clean White", prompt: "Pure clean white studio background with professional soft lighting, minimalist product photography, no shadows" },
  { id: "nature_green", label: "🌿 Nature", prompt: "Fresh green nature background with soft bokeh, leaves and natural light, organic product photography" },
  { id: "gradient_purple", label: "💜 Gradient Purple", prompt: "Smooth gradient background from deep purple to soft pink, modern tech aesthetic, professional studio lighting" },
  { id: "dark_elegance", label: "🖤 Dark Elegance", prompt: "Dark matte black background with subtle golden rim lighting, luxury product showcase, dramatic shadows" },
  { id: "pastel_pink", label: "🌸 Pastel Pink", prompt: "Soft pastel pink background with gentle shadows, feminine elegant product photography, beauty aesthetic" },
  { id: "tech_blue", label: "💙 Tech Blue", prompt: "Modern tech blue gradient background with subtle geometric patterns, futuristic product display" },
];

export const BgStudioTool = ({ userId, onBack }: BgStudioToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [selectedBg, setSelectedBg] = useState<string>("clean_white");
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const creditCost = costs.bg_studio || 3;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "ဖိုင်ကြီးလွန်းပါသည်", description: "10MB အောက် ပုံရွေးပါ", variant: "destructive" });
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

  const handleGenerate = async () => {
    if (!sourceImage || !userId) return;

    if ((credits || 0) < creditCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${creditCost} Credit လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setResultImage(null);
    setProgress(0);

    const statuses = ["Background ဖယ်ရှားနေသည်...", "နောက်ခံအသစ် ထည့်နေသည်...", "အပြီးသတ်နေသည်..."];
    let statusIdx = 0;
    setStatusText(statuses[0]);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95;
        const next = prev + Math.random() * 5;
        const newIdx = Math.min(Math.floor(next / 33), statuses.length - 1);
        if (newIdx !== statusIdx) {
          statusIdx = newIdx;
          setStatusText(statuses[statusIdx]);
        }
        return next;
      });
    }, 500);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" });
        return;
      }

      const selectedTemplate = BG_TEMPLATES.find(t => t.id === selectedBg);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bg-studio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            imageBase64: sourceImage.split(",")[1],
            backgroundPrompt: selectedTemplate?.prompt || "Clean white studio background",
            backgroundId: selectedBg,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Background studio failed");

      setResultImage(result.image);
      setProgress(100);
      refetchCredits();

      toast({ title: "အောင်မြင်ပါသည် ✨", description: `နောက်ခံပြောင်းပြီးပါပြီ (${result.creditsUsed} Credit)` });
    } catch (error: any) {
      console.error("BG Studio error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI Background Studio" subtitle="ပစ္စည်းပုံထည့် အော်တိုနောက်ခံပြောင်း" onBack={onBack} />

      {/* Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          📸 ပစ္စည်းပုံထည့်ပါ
        </label>
        {sourceImage ? (
          <div className="relative">
            <img src={sourceImage} alt="Source" className="w-full max-h-48 object-contain rounded-xl border border-primary/30" />
            <button onClick={removeImage} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-destructive-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={() => imageInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ပစ္စည်းပုံထည့်ရန် နှိပ်ပါ</span>
          </button>
        )}
        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </div>

      {/* Background Templates */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="flex items-center gap-2 text-sm font-medium text-primary mb-3 font-myanmar">
          <Palette className="w-4 h-4" />
          Premium နောက်ခံ ရွေးချယ်ပါ
        </label>
        <div className="grid grid-cols-2 gap-2">
          {BG_TEMPLATES.map((bg) => (
            <button
              key={bg.id}
              onClick={() => setSelectedBg(bg.id)}
              className={`p-3 rounded-xl text-left transition-all border ${
                selectedBg === bg.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-background/30 hover:bg-primary/5"
              }`}
            >
              <span className="text-sm font-medium block">{bg.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">{statusText}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isLoading || !sourceImage} className="w-full btn-gradient-green py-4 rounded-2xl font-semibold font-myanmar">
        {isLoading ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />နောက်ခံပြောင်းနေသည်...</>
        ) : (
          <><Sparkles className="w-5 h-5 mr-2" />နောက်ခံပြောင်းမည် ({creditCost} Credit)</>
        )}
      </Button>

      {/* Result */}
      {resultImage && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="gradient-card rounded-2xl p-4 border border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary font-myanmar">ရလဒ်</h3>
            </div>
            <Button
              onClick={async () => {
                try {
                  const watermarked = await addWatermarkToImage(resultImage, userId || 'unknown');
                  const link = document.createElement("a");
                  link.href = watermarked;
                  link.download = `bg-studio-${Date.now()}.png`;
                  link.click();
                } catch {
                  const link = document.createElement("a");
                  link.href = resultImage;
                  link.download = `bg-studio-${Date.now()}.png`;
                  link.click();
                }
              }}
              size="sm" variant="outline" className="text-xs font-myanmar"
            >
              <Download className="w-3 h-3 mr-1" />Download
            </Button>
          </div>
          <Watermark userId={userId}>
            <img src={resultImage} alt="Result" className="w-full rounded-xl" />
          </Watermark>
        </motion.div>
      )}
    </motion.div>
  );
};
