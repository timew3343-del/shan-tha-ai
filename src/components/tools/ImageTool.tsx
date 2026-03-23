import { useState, useRef, useEffect } from "react";
import { Image, Plus, Sparkles, Download, Loader2, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { ToolHeader } from "@/components/ToolHeader";
// Watermark removed per user request
import { motion } from "framer-motion";
import { useToolOutput } from "@/hooks/useToolOutput";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";

interface ImageToolProps {
  userId?: string;
  onBack: () => void;
}

export const ImageTool = ({ userId, onBack }: ImageToolProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { refetch: refetchCredits } = useCredits(userId);
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [selectedAspect, setSelectedAspect] = useState<{ key: string; w: number; h: number; ratio: string }>({ key: "square", w: 1024, h: 1024, ratio: "1:1" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showGuide, markAsLearned, saveOutput } = useToolOutput("image-gen", "ပုံဖန်တီးရန်");

  // Progress simulation with status updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      const statuses = [
        "Prompt ကို ပြင်ဆင်နေသည်...",
        "AI မော်ဒယ်သို့ ပို့နေသည်...",
        "ပုံဖန်တီးနေသည်...",
        "အပြီးသတ်နေသည်...",
      ];
      let statusIndex = 0;
      setStatusText(statuses[0]);
      
      interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + Math.random() * 20;
          if (newProgress >= 90) return 90;
          
          const newStatusIndex = Math.min(Math.floor(newProgress / 25), statuses.length - 1);
          if (newStatusIndex !== statusIndex) {
            statusIndex = newStatusIndex;
            setStatusText(statuses[statusIndex]);
          }
          
          return newProgress;
        });
      }, 400);
    } else {
      setProgress(100);
      setStatusText("");
      const timeout = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timeout);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferenceImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "စာသားထည့်ပါ",
        description: "ပုံဖန်တီးရန် ဖော်ပြချက် ထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "လော့ဂ်အင်လုပ်ပါ",
        description: "ပုံဖန်တီးရန် အကောင့်ဝင်ပါ",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast({
          title: "လော့ဂ်အင်လုပ်ပါ",
          description: "ပုံဖန်တီးရန် အကောင့်ဝင်ပါ",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { 
          prompt, 
          referenceImage,
          aspectRatio: selectedAspect.ratio,
          width: selectedAspect.w,
          height: selectedAspect.h,
        },
      });

      if (error) throw new Error(error.message);

      if (data?.error) {
        if (data.error === "Insufficient credits") {
          toast({
            title: "ခရက်ဒစ် မလုံလောက်ပါ",
            description: `ပုံဖန်တီးရန် ${data.required} Credits လိုအပ်ပါသည်`,
            variant: "destructive",
          });
        } else {
          toast({ title: "အမှားရှိပါသည်", description: data.error, variant: "destructive" });
        }
        return;
      }

      if (data?.success && data?.image) {
        const finalImage = data.image;
        setGeneratedImage(finalImage);
        refetchCredits();
        saveOutput("image", finalImage);
        toast({
          title: "အောင်မြင်ပါသည်",
          description: `ပုံဖန်တီးပြီးပါပြီ (${data.creditsUsed} Credits)`,
        });
      }
    } catch (error: any) {
      console.error("Image generation error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "ပုံဖန်တီးရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `generated-image-${Date.now()}.png`;
    link.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-4 pb-24"
    >
      <ToolHeader 
        title="ပုံဖန်တီးရန်" 
        subtitle="AI ဖြင့် ပုံများ ဖန်တီးခြင်း"
        onBack={onBack} 
      />

      <FirstOutputGuide toolName="ပုံဖန်တီးရန်" steps={["ဖော်ပြချက် ထည့်ပါ", "ဖန်တီးမည် ခလုတ်ကို နှိပ်ပါ", "ရလဒ်ပုံကို ဒေါင်းလုဒ်လုပ်ပါ"]} show={showGuide} onDismiss={markAsLearned} />

      {/* Reference Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          ရည်ညွှန်းပုံ (Optional)
        </label>
        
        {referenceImage ? (
          <div className="relative inline-block">
            <img
              src={referenceImage}
              alt="Reference"
              className="w-24 h-24 object-cover rounded-xl border border-primary/30"
            />
            <button
              onClick={removeReferenceImage}
              className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-6 h-6 text-primary" />
            <span className="text-xs text-muted-foreground font-myanmar">ပုံထည့်ပါ</span>
          </button>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Aspect Ratio / Platform Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          Platform / Aspect Ratio
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { key: "square", label: "1:1", icon: "📸", desc: "IG/FB Post", w: 1024, h: 1024, ratio: "1:1" },
            { key: "portrait", label: "9:16", icon: "🎵", desc: "TikTok/Reels", w: 768, h: 1344, ratio: "9:16" },
            { key: "landscape", label: "16:9", icon: "▶️", desc: "YT/FB Cover", w: 1344, h: 768, ratio: "16:9" },
            { key: "free", label: "Free", icon: "🖼️", desc: "Custom", w: 1024, h: 1024, ratio: "1:1" },
          ].map(ar => (
            <button
              key={ar.key}
              onClick={() => setSelectedAspect({ key: ar.key, w: ar.w, h: ar.h, ratio: ar.ratio })}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border transition-all text-center ${
                selectedAspect.key === ar.key
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border/50 hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <span className="text-sm">{ar.icon}</span>
              <span className="text-[10px] font-medium">{ar.label}</span>
              <span className="text-[8px] text-muted-foreground">{ar.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Input */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          ပုံဖော်ပြချက်
        </label>
        <Textarea
          placeholder="ဥပမာ - နေဝင်ချိန် ပင်လယ်ကမ်းခြေ ပုံတစ်ပုံ ဖန်တီးပေးပါ..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[80px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
        />
      </div>

      {/* Progress Bar with Status */}
      {isLoading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">{statusText || "ပုံဖန်တီးနေသည်..."}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isLoading || !prompt.trim()}
        className="w-full btn-gradient-blue py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ပုံဖန်တီးနေသည်...
          </>
        ) : (
          <>
            <Image className="w-5 h-5 mr-2" />
            ပုံဖန်တီးမည် ({costs.image_generation} Credits)
          </>
        )}
      </Button>

      {/* Result Preview */}
      {generatedImage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="gradient-card rounded-2xl p-4 border border-primary/30"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary font-myanmar">ရလဒ်</h3>
            </div>
            <Button
              onClick={handleDownload}
              size="sm"
              variant="outline"
              className="text-xs font-myanmar"
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
          <img
            src={generatedImage}
            alt="Generated"
            className="w-full rounded-xl border border-border"
          />
        </motion.div>
      )}
    </motion.div>
  );
};
