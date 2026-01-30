import { useState, useRef } from "react";
import { Users, Upload, Sparkles, Download, Loader2, X, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface FaceSwapToolProps {
  userId?: string;
  onBack: () => void;
}

export const FaceSwapTool = ({ userId, onBack }: FaceSwapToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [targetVideo, setTargetVideo] = useState<string | null>(null);
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const creditCost = costs.face_swap || 15;

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "ဖိုင်ကြီးလွန်းပါသည်",
          description: "50MB အောက် ဗီဒီယိုရွေးပါ",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setTargetVideo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
        setFaceImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeVideo = () => {
    setTargetVideo(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const removeImage = () => {
    setFaceImage(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!targetVideo || !faceImage) {
      toast({
        title: "ဗီဒီယိုနှင့် ပုံထည့်ပါ",
        description: "Target Video နှင့် Face Image နှစ်ခုစလုံး လိုအပ်ပါသည်",
        variant: "destructive",
      });
      return;
    }

    if ((credits || 0) < creditCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `Face Swap အတွက် ${creditCost} Credits လိုအပ်ပါသည်`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResultVideo(null);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95;
        return prev + Math.random() * 3;
      });
    }, 2000);

    const statuses = [
      "ဗီဒီယိုကို ပြင်ဆင်နေသည်...",
      "မျက်နှာကို ခွဲခြမ်းစိတ်ဖြာနေသည်...",
      "Face Swap လုပ်ဆောင်နေသည်...",
      "ရလဒ်ကို ပြင်ဆင်နေသည်...",
    ];
    let statusIndex = 0;
    setStatusText(statuses[0]);
    
    const statusInterval = setInterval(() => {
      statusIndex = Math.min(statusIndex + 1, statuses.length - 1);
      setStatusText(statuses[statusIndex]);
    }, 15000);

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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/face-swap`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            targetVideo,
            faceImage,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Face swap failed");
      }

      setResultVideo(result.video);
      setProgress(100);
      refetchCredits();

      toast({
        title: "အောင်မြင်ပါသည်",
        description: `Face Swap ပြီးပါပြီ (${result.creditsUsed} Credits)`,
      });
    } catch (error: any) {
      console.error("Face swap error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "Face Swap လုပ်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      setIsLoading(false);
      setStatusText("");
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
        title="မျက်နှာပြောင်းဗီဒီယို" 
        subtitle="Face Swap Technology"
        onBack={onBack} 
      />

      {/* Target Video Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          <Video className="w-4 h-4 inline mr-1" />
          Target Video (လိုအပ်သည်)
        </label>
        
        {targetVideo ? (
          <div className="relative">
            <video
              src={targetVideo}
              controls
              className="w-full max-h-48 object-contain rounded-xl border border-primary/30"
            />
            <button
              onClick={removeVideo}
              className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => videoInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
          >
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ဗီဒီယိုထည့်ရန် နှိပ်ပါ</span>
          </button>
        )}
        
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoUpload}
          className="hidden"
        />
      </div>

      {/* Face Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          <Users className="w-4 h-4 inline mr-1" />
          Face Image (လိုအပ်သည်)
        </label>
        <p className="text-xs text-muted-foreground mb-3 font-myanmar">
          အစားထိုးလိုသော မျက်နှာပုံ
        </p>
        
        {faceImage ? (
          <div className="relative inline-block">
            <img
              src={faceImage}
              alt="Face"
              className="w-full max-w-[150px] h-auto object-cover rounded-xl border border-primary/30"
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
            className="w-full h-28 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
          >
            <Upload className="w-6 h-6 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">မျက်နှာပုံထည့်ပါ</span>
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
            <span className="font-myanmar">{statusText || "Face Swap လုပ်နေသည်..."}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isLoading || !targetVideo || !faceImage}
        className="w-full btn-gradient-red py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Face Swap လုပ်နေသည်...
          </>
        ) : (
          <>
            <Users className="w-5 h-5 mr-2" />
            Face Swap လုပ်မည် ({creditCost} Credits)
          </>
        )}
      </Button>

      {/* Result */}
      {resultVideo && (
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
              onClick={() => {
                const link = document.createElement("a");
                link.href = resultVideo;
                link.download = `face-swap-${Date.now()}.mp4`;
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
          <video
            src={resultVideo}
            controls
            autoPlay
            muted
            className="w-full rounded-xl border border-border"
          />
        </motion.div>
      )}
    </motion.div>
  );
};
