import { useState, useRef } from "react";
import { Eraser, Upload, Sparkles, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { Watermark, addWatermarkToImage } from "@/components/Watermark";
import { motion } from "framer-motion";

interface BgRemoveToolProps {
  userId?: string;
  onBack: () => void;
}

export const BgRemoveTool = ({ userId, onBack }: BgRemoveToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const creditCost = costs.bg_remove || 1;

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

  const handleRemoveBg = async () => {
    if (!sourceImage) {
      toast({
        title: "ပုံထည့်ပါ",
        description: "Background ဖယ်ရန် ပုံတစ်ပုံ ထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    if ((credits || 0) < creditCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `Background Remove အတွက် ${creditCost} Credit လိုအပ်ပါသည်`,
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
        return prev + Math.random() * 8;
      });
    }, 300);

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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-bg`,
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
        throw new Error(result.error || "Background removal failed");
      }

      setResultImage(result.image);
      setProgress(100);
      refetchCredits();

      toast({
        title: "အောင်မြင်ပါသည်",
        description: `Background ဖယ်ပြီးပါပြီ (${result.creditsUsed} Credit)`,
      });
    } catch (error: any) {
      console.error("BG Remove error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "Background ဖယ်ရာတွင် ပြဿနာရှိပါသည်",
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
        title="Background Remover" 
        subtitle="ပုံမှ Background ကို ချက်ခြင်းဖယ်ရှားရန်"
        onBack={onBack} 
      />

      {/* Source Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          <Eraser className="w-4 h-4 inline mr-1" />
          ပုံထည့်ပါ
        </label>
        
        {sourceImage ? (
          <div className="relative">
            <img
              src={sourceImage}
              alt="Source"
              className="w-full max-h-48 object-contain rounded-xl border border-primary/30"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => imageInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
          >
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ပုံထည့်ရန် နှိပ်ပါ</span>
          </button>
        )}
        
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Progress */}
      {isLoading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">Background ဖယ်ရှားနေသည်...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Remove BG Button */}
      <Button
        onClick={handleRemoveBg}
        disabled={isLoading || !sourceImage}
        className="w-full btn-gradient-green py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Background ဖယ်နေသည်...
          </>
        ) : (
          <>
            <Eraser className="w-5 h-5 mr-2" />
            Background ဖယ်မည် ({creditCost} Credit)
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
              <h3 className="text-sm font-semibold text-primary font-myanmar">ရလဒ်</h3>
            </div>
            <Button
              onClick={async () => {
                try {
                  const watermarked = await addWatermarkToImage(resultImage, userId || 'unknown');
                  const link = document.createElement("a");
                  link.href = watermarked;
                  link.download = `no-bg-${Date.now()}.png`;
                  link.click();
                } catch {
                  const link = document.createElement("a");
                  link.href = resultImage;
                  link.download = `no-bg-${Date.now()}.png`;
                  link.click();
                }
              }}
              size="sm"
              variant="outline"
              className="text-xs font-myanmar"
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
          <Watermark userId={userId}>
            <div className="bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNjY2MiLz48L3N2Zz4=')] rounded-xl">
              <img
                src={resultImage}
                alt="No Background"
                className="w-full rounded-xl"
              />
            </div>
          </Watermark>
        </motion.div>
      )}
    </motion.div>
  );
};
