import { useState, useRef } from "react";
import { ZoomIn, Upload, Sparkles, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { Watermark, addWatermarkToImage } from "@/components/Watermark";
import { motion } from "framer-motion";

interface UpscaleToolProps {
  userId?: string;
  onBack: () => void;
}

export const UpscaleTool = ({ userId, onBack }: UpscaleToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpscale = async () => {
    if (!sourceImage) {
      toast({
        title: "ပုံထည့်ပါ",
        description: "Upscale လုပ်ရန် ပုံတစ်ပုံ ထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    if ((credits || 0) < creditCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `4K Upscale အတွက် ${creditCost} Credit လိုအပ်ပါသည်`,
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

      setResultImage(result.image);
      setProgress(100);
      refetchCredits();

      toast({
        title: "အောင်မြင်ပါသည်",
        description: `4K Upscale ပြီးပါပြီ (${result.creditsUsed} Credit)`,
      });
    } catch (error: any) {
      console.error("Upscale error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "Upscale လုပ်ရာတွင် ပြဿနာရှိပါသည်",
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
        title="4K Upscaler" 
        subtitle="ပုံကို 4K Resolution သို့ မြှင့်တင်ရန်"
        onBack={onBack} 
      />

      {/* Source Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          <ZoomIn className="w-4 h-4 inline mr-1" />
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
            <span className="font-myanmar">4K သို့ မြှင့်တင်နေသည်...</span>
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
            Upscale လုပ်နေသည်...
          </>
        ) : (
          <>
            <ZoomIn className="w-5 h-5 mr-2" />
            4K Upscale ({creditCost} Credit)
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
              onClick={async () => {
                try {
                  const watermarked = await addWatermarkToImage(resultImage, userId || 'unknown');
                  const link = document.createElement("a");
                  link.href = watermarked;
                  link.download = `upscaled-4k-${Date.now()}.png`;
                  link.click();
                } catch {
                  const link = document.createElement("a");
                  link.href = resultImage;
                  link.download = `upscaled-4k-${Date.now()}.png`;
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
            <img
              src={resultImage}
              alt="Upscaled"
              className="w-full rounded-xl border border-border"
            />
          </Watermark>
        </motion.div>
      )}
    </motion.div>
  );
};
