import { useState, useRef, useEffect } from "react";
import { Video, Upload, Sparkles, Download, Loader2, X, Clock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { Watermark } from "@/components/Watermark";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VideoToolProps {
  userId?: string;
  onBack: () => void;
}

export const VideoTool = ({ userId, onBack }: VideoToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [prompt, setPrompt] = useState("");
  const [speechText, setSpeechText] = useState("");
  const [duration, setDuration] = useState("5");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Optimized progress with faster polling simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      const statuses = [
        "ပုံကို ပြင်ဆင်နေသည်...",
        "AI မော်ဒယ်သို့ ပို့နေသည်...",
        "ဗီဒီယိုထုတ်နေသည်...",
        "အပြီးသတ်နေသည်...",
      ];
      let statusIndex = 0;
      setStatusText(statuses[0]);
      
      interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + Math.random() * 5;
          if (newProgress >= 95) return 95;
          
          const newStatusIndex = Math.min(Math.floor(newProgress / 25), statuses.length - 1);
          if (newStatusIndex !== statusIndex) {
            statusIndex = newStatusIndex;
            setStatusText(statuses[statusIndex]);
          }
          
          return newProgress;
        });
      }, 800);
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
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast({
        title: "ပုံထည့်ရန်လိုအပ်ပါသည်",
        description: "ဗီဒီယိုထုတ်ရန် ပုံတစ်ပုံထည့်ပေးပါ",
        variant: "destructive",
      });
      return;
    }

    const creditCost = speechText.trim() ? costs.video_with_speech : costs.video_generation;
    
    if (credits < creditCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `ဗီဒီယိုထုတ်ခြင်း အတွက် ${creditCost} Credits လိုအပ်ပါသည်`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedVideo(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "အကောင့်ဝင်ရန်လိုအပ်သည်",
          description: "ဗီဒီယိုထုတ်ရန် အကောင့်ဝင်ပါ",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            image: uploadedImage,
            speechText: speechText.trim() || undefined,
            duration: parseInt(duration),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.refunded) {
          toast({
            title: "ဗီဒီယိုထုတ်ခြင်း မအောင်မြင်ပါ",
            description: `${result.error} (${result.creditsRefunded} Credits ပြန်ပေးပြီးပါပြီ)`,
            variant: "destructive",
          });
          refetchCredits();
          return;
        }
        
        throw new Error(result.error || "Video generation failed");
      }

      setGeneratedVideo(result.video);
      refetchCredits();
      
      toast({
        title: "အောင်မြင်ပါသည်",
        description: `ဗီဒီယိုထုတ်ပြီးပါပြီ (${result.creditsUsed} Credits)`,
      });
    } catch (error: any) {
      console.error("Video generation error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "ဗီဒီယိုထုတ်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
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
        title="ဗီဒီယိုထုတ်ရန်" 
        subtitle="ပုံမှ ဗီဒီယိုသို့ ပြောင်းလဲခြင်း"
        onBack={onBack} 
      />

      {/* Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          ပုံထည့်ရန် (လိုအပ်သည်)
        </label>
        <p className="text-xs text-muted-foreground mb-3 font-myanmar">
          ပုံကို ဗီဒီယိုအဖြစ် ပြောင်းပေးပါမည်
        </p>
        
        {uploadedImage ? (
          <div className="relative inline-block">
            <img
              src={uploadedImage}
              alt="Uploaded"
              className="w-full max-w-[200px] h-auto object-cover rounded-xl border border-primary/30"
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
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
          >
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ပုံထည့်ရန် နှိပ်ပါ</span>
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

      {/* Duration Selector */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          <Clock className="w-4 h-4 inline mr-1" />
          ဗီဒီယိုအရှည်
        </label>
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger className="bg-background/50 border-primary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">၃ စက္ကန့်</SelectItem>
            <SelectItem value="5">၅ စက္ကန့်</SelectItem>
            <SelectItem value="10">၁၀ စက္ကန့်</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Prompt Input */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          ဗီဒီယိုဖော်ပြချက် (Optional)
        </label>
        <Textarea
          placeholder="ဥပမာ - လှေတစ်စင်း ပင်လယ်ပေါ်မှာ မျှောနေသည်..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[60px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
        />
      </div>

      {/* Speech Overlay Text */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          စကားပြောစေချင်သော စာသား (Optional)
        </label>
        <p className="text-xs text-muted-foreground mb-2 font-myanmar">
          ဗီဒီယိုတွင် အသံထည့်လိုပါက +{costs.video_with_speech - costs.video_generation} Credits ပိုကုန်ပါမည်
        </p>
        <Textarea
          placeholder="ဗီဒီယိုတွင် ထည့်သွင်းစေချင်သော အသံစာသား..."
          value={speechText}
          onChange={(e) => setSpeechText(e.target.value)}
          className="min-h-[60px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
        />
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">{statusText || "ဗီဒီယိုထုတ်နေသည်..."}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isLoading || !uploadedImage}
        className="w-full btn-gradient-red py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ဗီဒီယိုထုတ်နေသည်...
          </>
        ) : (
          <>
            <Video className="w-5 h-5 mr-2" />
            ဗီဒီယိုထုတ်မည် ({speechText.trim() ? costs.video_with_speech : costs.video_generation} Credits)
          </>
        )}
      </Button>

      {/* Result Preview */}
      {generatedVideo && (
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
                link.href = generatedVideo;
                link.download = `generated-video-${Date.now()}.mp4`;
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
          <Watermark userId={userId} type="video">
            <video
              src={generatedVideo}
              controls
              autoPlay
              muted
              className="w-full rounded-xl border border-border"
            />
          </Watermark>
        </motion.div>
      )}
    </motion.div>
  );
};
