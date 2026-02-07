import { useState, useRef, useEffect } from "react";
import { ToolHeader } from "../ToolHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { 
  Upload, FileText, Loader2, Copy, X, Clock, Volume2, 
  Type, Sparkles, Crown, Subtitles, ImagePlus, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VideoCopywritingToolProps {
  userId?: string;
  onBack: () => void;
}

const DURATION_OPTIONS = [
  { value: "15", label: "၁၅ စက္ကန့်", multiplier: 1 },
  { value: "30", label: "၃၀ စက္ကန့်", multiplier: 1.5 },
  { value: "60", label: "၁ မိနစ်", multiplier: 2 },
  { value: "120", label: "၂ မိနစ်", multiplier: 3 },
  { value: "300", label: "၅ မိနစ်", multiplier: 5 },
  { value: "600", label: "၁၀ မိနစ်", multiplier: 8 },
  { value: "900", label: "၁၅ မိနစ်", multiplier: 10 },
];

const VOICE_STYLES = [
  { id: "professional", name: "Professional", description: "ကျွမ်းကျင်သော အသံ" },
  { id: "casual", name: "Casual", description: "သဘာဝကျသော အသံ" },
  { id: "energetic", name: "Energetic", description: "တက်ကြွသော အသံ" },
  { id: "storytelling", name: "Storytelling", description: "ပုံပြင်ပြော အသံ" },
];

// Add-on credit costs (base)
const ADDON_COSTS = {
  subtitles: 2,
  logo: 1,
  highQuality: 3,
  voiceover: 3,
};

const PROCESSING_STEPS = [
  { key: "analyzing", label: "ဗီဒီယို ခွဲခြမ်းစိတ်ဖြာနေပါသည်...", icon: "🔍" },
  { key: "generating", label: "AI Copy ရေးသားနေပါသည်...", icon: "✍️" },
  { key: "voiceover", label: "Voiceover ဖန်တီးနေပါသည်...", icon: "🎙️" },
  { key: "finishing", label: "အပြီးသတ်နေပါသည်...", icon: "✨" },
];

export const VideoCopywritingTool = ({ userId, onBack }: VideoCopywritingToolProps) => {
  const { toast } = useToast();
  const { costs, profitMargin } = useCreditCosts();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  // Options
  const [duration, setDuration] = useState("60");
  const [voiceStyle, setVoiceStyle] = useState("professional");
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const [logoUpload, setLogoUpload] = useState(false);
  const [highQuality, setHighQuality] = useState(false);
  const [voiceoverOn, setVoiceoverOn] = useState(true);

  // Calculate dynamic credit cost
  const selectedDuration = DURATION_OPTIONS.find(d => d.value === duration) || DURATION_OPTIONS[0];
  
  const calculateCreditCost = () => {
    const baseCost = costs.ai_chat; // Gemini API base cost
    let apiCost = baseCost * selectedDuration.multiplier;
    
    if (subtitlesOn) apiCost += ADDON_COSTS.subtitles;
    if (logoUpload) apiCost += ADDON_COSTS.logo;
    if (highQuality) apiCost += ADDON_COSTS.highQuality;
    if (voiceoverOn) apiCost += ADDON_COSTS.voiceover;
    
    // Apply profit margin: Final = apiCost * (1 + margin/100)
    return Math.ceil(apiCost * (1 + profitMargin / 100));
  };

  const creditCost = calculateCreditCost();

  // Progress animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setProgress(0);
      setCurrentStep(0);
      interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + Math.random() * 4;
          if (newProgress >= 95) return 95;
          
          const newStep = Math.min(Math.floor(newProgress / 25), PROCESSING_STEPS.length - 1);
          if (newStep !== currentStep) {
            setCurrentStep(newStep);
          }
          return newProgress;
        });
      }, 600);
    } else if (result) {
      setProgress(100);
      const timeout = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timeout);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast({ title: "ဗီဒီယို ဖိုင်သာ ထည့်နိုင်ပါသည်", variant: "destructive" });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "ဖိုင်အရွယ်အစား 50MB ထက်မကျော်ရပါ", variant: "destructive" });
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setResult(null);
  };

  const extractFrames = async (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.src = URL.createObjectURL(file);

      video.onloadedmetadata = async () => {
        const dur = video.duration;
        const frameCount = Math.min(6, Math.max(3, Math.floor(dur / 10)));
        const interval = dur / (frameCount + 1);
        const frames: string[] = [];
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        canvas.width = 512;
        canvas.height = 288;

        for (let i = 1; i <= frameCount; i++) {
          const time = interval * i;
          await new Promise<void>((res) => {
            video.currentTime = time;
            video.onseeked = () => {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              frames.push(canvas.toDataURL("image/jpeg", 0.7));
              res();
            };
          });
        }
        URL.revokeObjectURL(video.src);
        resolve(frames);
      };
    });
  };

  const handleGenerate = async () => {
    if (!videoFile || !userId) return;

    if (credits < creditCost) {
      toast({ 
        title: "ခရက်ဒစ် မလုံလောက်ပါ", 
        description: `${creditCost} Credits လိုအပ်ပါသည်`,
        variant: "destructive" 
      });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      toast({ title: "ဗီဒီယို ခွဲခြမ်းစိတ်ဖြာနေပါသည်..." });
      const frames = await extractFrames(videoFile);

      if (frames.length === 0) {
        throw new Error("Frame များ ထုတ်ယူ၍ မရပါ");
      }

      const systemPrompt = `You are a professional video copywriter. Analyze the video frames and create high-converting marketing copy in Myanmar language.
Duration: ${selectedDuration.label}
Voice Style: ${voiceStyle}
${subtitlesOn ? "Include subtitle text with timestamps." : ""}
${voiceoverOn ? "Include a voiceover script with timing cues." : ""}

Create:
1. A compelling headline
2. Scene-by-scene breakdown with marketing angles
3. ${voiceoverOn ? "A professional voiceover script" : "Key talking points"}
4. ${subtitlesOn ? "Subtitle text with timestamps" : ""}
5. Call-to-action recommendations
6. Best scenes for marketing highlights

Format the output professionally with clear sections.`;

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          message: customPrompt.trim() || systemPrompt,
          images: frames,
        },
      });

      if (error) throw error;

      if (data?.reply) {
        setResult(data.reply);
        refetchCredits();
        toast({ title: "✨ Video Copywriting ပြီးပါပြီ!" });
      } else {
        throw new Error(data?.error || "Generation failed");
      }
    } catch (error: any) {
      console.error("Video copywriting error:", error);
      toast({ 
        title: "ပြဿနာရှိပါသည်", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      toast({ title: "ကူးယူပြီးပါပြီ" });
    }
  };

  const clearAll = () => {
    setVideoFile(null);
    setVideoPreview(null);
    setResult(null);
    setCustomPrompt("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-4 pb-24 space-y-4"
    >
      <ToolHeader 
        title="Video Copywriting" 
        subtitle="AI ဖြင့် ဗီဒီယို ကြော်ငြာ ဖန်တီးမည်" 
        onBack={onBack} 
      />

      {/* Upload Area */}
      {!videoFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-primary/30 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
        >
          <Upload className="w-10 h-10 text-primary mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground font-myanmar">ဗီဒီယို ဖိုင် ထည့်ပါ</p>
          <p className="text-xs text-muted-foreground mt-1">MP4, WEBM, MOV (50MB max)</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-border/50">
            <video src={videoPreview!} className="w-full max-h-48 object-contain bg-black/50" controls />
            <button
              onClick={clearAll}
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Duration Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          <Clock className="w-4 h-4 inline mr-1" />
          ကြော်ငြာ အရှည်
        </label>
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger className="bg-background/50 border-primary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label} (x{opt.multiplier})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Voice Style */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          <Volume2 className="w-4 h-4 inline mr-1" />
          Voice Style
        </label>
        <Select value={voiceStyle} onValueChange={setVoiceStyle}>
          <SelectTrigger className="bg-background/50 border-primary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VOICE_STYLES.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name} - {v.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Add-ons */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <h3 className="text-sm font-medium text-primary font-myanmar">⚡ Add-ons</h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-myanmar">AI Voiceover</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">+{ADDON_COSTS.voiceover} base</span>
          </div>
          <Switch checked={voiceoverOn} onCheckedChange={setVoiceoverOn} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Subtitles className="w-4 h-4 text-primary" />
            <span className="text-sm font-myanmar">Subtitles</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">+{ADDON_COSTS.subtitles} base</span>
          </div>
          <Switch checked={subtitlesOn} onCheckedChange={setSubtitlesOn} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-primary" />
            <span className="text-sm font-myanmar">Logo Upload</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">+{ADDON_COSTS.logo} base</span>
          </div>
          <Switch checked={logoUpload} onCheckedChange={setLogoUpload} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-myanmar">High Quality 4K</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">+{ADDON_COSTS.highQuality} base</span>
          </div>
          <Switch checked={highQuality} onCheckedChange={setHighQuality} />
        </div>
      </div>

      {/* Real-time Credit Cost Display */}
      <motion.div 
        layout
        className="gradient-card rounded-2xl p-4 border border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground font-myanmar">Estimated Credit Cost</span>
          </div>
          <motion.span 
            key={creditCost}
            initial={{ scale: 1.2, color: "hsl(var(--primary))" }}
            animate={{ scale: 1, color: "hsl(var(--foreground))" }}
            className="text-xl font-bold"
          >
            {creditCost} Credits
          </motion.span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Profit Margin: {profitMargin}% • Duration: x{selectedDuration.multiplier}
        </p>
      </motion.div>

      {/* Custom Prompt */}
      {videoFile && (
        <Textarea
          placeholder="(Optional) သီးသန့် ညွှန်ကြားချက် ထည့်နိုင်ပါသည်..."
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          rows={2}
          className="text-sm"
        />
      )}

      {/* Progress */}
      {isProcessing && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{PROCESSING_STEPS[currentStep]?.icon}</span>
            <span className="font-myanmar">{PROCESSING_STEPS[currentStep]?.label}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            {PROCESSING_STEPS.map((step, i) => (
              <span key={step.key} className={i <= currentStep ? "text-primary" : ""}>
                {step.icon}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Generate Button */}
      {videoFile && !result && (
        <Button 
          onClick={handleGenerate} 
          disabled={isProcessing} 
          className="w-full gradient-gold text-primary-foreground py-5 rounded-2xl font-semibold"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              AI Processing...
            </>
          ) : (
            <>
              <Crown className="w-5 h-5 mr-2" />
              Generate Video Copy ({creditCost} Credits)
            </>
          )}
        </Button>
      )}

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-1">
              <Crown className="w-4 h-4" />
              Video Copywriting Result
            </h3>
            <button onClick={copyResult} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
          <div className="gradient-card rounded-xl p-4 border border-primary/20 max-h-96 overflow-y-auto">
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-myanmar">
              {result}
            </div>
          </div>
          <Button onClick={clearAll} variant="outline" className="w-full font-myanmar">
            ဗီဒီယိုအသစ် ဖန်တီးမည်
          </Button>
        </motion.div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />

      {/* Info */}
      <div className="gradient-card rounded-xl p-4 border border-primary/20">
        <p className="text-xs text-muted-foreground font-myanmar leading-relaxed">
          💡 Transform your raw videos into high-converting ads with AI-generated copy, voiceovers, and subtitles.
          Duration, Add-ons ပေါ်မူတည်ပြီး credit ပြောင်းလဲပါသည်။ 
          Credits များကို output အောင်မြင်ပြီးမှသာ နုတ်ယူပါသည်။
        </p>
      </div>
    </motion.div>
  );
};
