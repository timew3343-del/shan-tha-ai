import { useState, useRef } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, Loader2, X, ImageIcon, Video, Sparkles } from "lucide-react";
import { downloadVideo } from "@/lib/downloadHelper";
import { motion } from "framer-motion";

interface CharacterAnimateToolProps {
  userId?: string;
  onBack: () => void;
}

export const CharacterAnimateTool = ({ userId, onBack }: CharacterAnimateToolProps) => {
  const { toast } = useToast();
  const { credits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, markAsLearned, saveOutput } = useToolOutput("character_animate", "Character Animation");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "ဖိုင်အရွယ်အစား ကြီးလွန်းပါသည်", description: "10MB အောက် ဖိုင်ကိုသာ ရွေးပါ", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "ဖိုင်အရွယ်အစား ကြီးလွန်းပါသည်", description: "50MB အောက် ဖိုင်ကိုသာ ရွေးပါ", variant: "destructive" });
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]); // Remove data:...;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleGenerate = async () => {
    if (!imageFile) {
      toast({ title: "ဓာတ်ပုံ ထည့်ပါ", description: "ရုပ်ပုံ တစ်ခု ရွေးချယ်ပါ", variant: "destructive" });
      return;
    }
    if (!videoFile) {
      toast({ title: "ဗီဒီယို ထည့်ပါ", description: "လိုက်လုပ်စေချင်သော ဗီဒီယို ရွေးချယ်ပါ", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setResultUrl(null);

    try {
      const [imageBase64, videoBase64] = await Promise.all([
        fileToBase64(imageFile),
        fileToBase64(videoFile),
      ]);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/character-animate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            source_face_base64: `data:${imageFile.type};base64,${imageBase64}`,
            video_base64: `data:${videoFile.type};base64,${videoBase64}`,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Animation failed");
      }

      setResultUrl(result.video_url);
      saveOutput("video", result.video_url);
      toast({
        title: "အောင်မြင်ပါသည်!",
        description: `ဗီဒီယို ဖန်တီးပြီးပါပြီ။ ${result.credits_deducted} Credits သုံးစွဲပါသည်။`,
      });
    } catch (error: any) {
      console.error("Character animation error:", error);
      toast({
        title: "အမှား ဖြစ်ပွားခဲ့ပါသည်",
        description: error.message || "ပြန်လည် ကြိုးစားပါ",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    downloadVideo(resultUrl, "character-animation");
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-4 space-y-4 pb-24">
      <ToolHeader
        title="ရုပ်ပုံကို လှုပ်ရှားသက်ဝင်စေခြင်း"
        subtitle="ရုပ်ပုံထည့်၊ လိုက်လုပ်စေချင်တဲ့ Video ထည့်"
        onBack={onBack}
      />

      <FirstOutputGuide
        toolName="Character Animation"
        steps={["ရုပ်ပုံ တစ်ခု ရွေးချယ်ပါ", "ကကွက် ဗီဒီယို ထည့်ပါ", "Generate နှိပ်ပြီး စောင့်ပါ"]}
        show={showGuide}
        onDismiss={markAsLearned}
      />

      {/* Image Input */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground font-myanmar">ရုပ်ပုံ (Image)</h3>
        </div>

        {imagePreview ? (
          <div className="relative">
            <img src={imagePreview} alt="Selected" className="w-full max-h-48 object-contain rounded-xl" />
            <button
              onClick={() => { setImageFile(null); setImagePreview(null); }}
              className="absolute top-2 right-2 p-1 bg-destructive/80 rounded-full"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => imageInputRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-primary/30 rounded-xl hover:border-primary/60 transition-colors flex flex-col items-center gap-2"
          >
            <Upload className="w-6 h-6 text-primary" />
            <span className="text-xs text-muted-foreground font-myanmar">ဓာတ်ပုံ ရွေးချယ်ပါ</span>
          </button>
        )}
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
      </div>

      {/* Video Input */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground font-myanmar">ကကွက် ဗီဒီယို (လိုက်လုပ်စေချင်တဲ့ video)</h3>
        </div>

        {videoPreview ? (
          <div className="relative">
            <video src={videoPreview} controls className="w-full max-h-48 rounded-xl" />
            <button
              onClick={() => { setVideoFile(null); setVideoPreview(null); }}
              className="absolute top-2 right-2 p-1 bg-destructive/80 rounded-full"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => videoInputRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-primary/30 rounded-xl hover:border-primary/60 transition-colors flex flex-col items-center gap-2"
          >
            <Upload className="w-6 h-6 text-primary" />
            <span className="text-xs text-muted-foreground font-myanmar">ဗီဒီယို ရွေးချယ်ပါ</span>
          </button>
        )}
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isProcessing || !imageFile || !videoFile}
        className="w-full h-12 rounded-2xl gradient-gold text-primary-foreground font-semibold text-sm font-myanmar"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            AI ဖန်တီးနေပါသည်... (၁-၃ မိနစ်)
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            ဗီဒီယို ဖန်တီးမည် ({costs.character_animation || 15} Cr)
          </>
        )}
      </Button>

      {/* Output */}
      {resultUrl && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">✨ ရလဒ် ဗီဒီယို</h3>
          <video src={resultUrl} controls autoPlay className="w-full rounded-xl" />
          <Button onClick={handleDownload} className="w-full rounded-xl gradient-gold text-primary-foreground">
            <Download className="w-4 h-4 mr-2" />
            ဗီဒီယိုကို သိမ်းဆည်းရန်
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
