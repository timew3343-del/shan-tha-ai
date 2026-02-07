import { useState, useRef } from "react";
import { ToolHeader } from "../ToolHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Loader2, Copy, X, ListChecks } from "lucide-react";
import { motion } from "framer-motion";

interface SceneSummarizerToolProps {
  userId?: string;
  onBack: () => void;
}

export const SceneSummarizerTool = ({ userId, onBack }: SceneSummarizerToolProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const creditCost = costs.scene_summarizer || costs.ai_chat * 3;

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
        const duration = video.duration;
        const frameCount = Math.min(6, Math.max(3, Math.floor(duration / 10)));
        const interval = duration / (frameCount + 1);
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

  const handleSummarize = async () => {
    if (!videoFile || !userId) return;

    if (credits < creditCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${creditCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      toast({ title: "ဗီဒီယို ခွဲခြမ်းစိတ်ဖြာနေပါသည်...", description: "Frame များ ထုတ်ယူနေပါသည်" });

      const frames = await extractFrames(videoFile);

      if (frames.length === 0) {
        throw new Error("Frame များ ထုတ်ယူ၍ မရပါ");
      }

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          message: customPrompt.trim() || 
            "ဤဗီဒီယို၏ အဓိက အကြောင်းအရာများကို မြန်မာဘာသာဖြင့် အကျဉ်းချုပ် ရေးပေးပါ။ Scene တစ်ခုချင်းစီ၏ အရေးကြီးသော အချက်များ၊ Key Highlights နှင့် Recap Script ကို ပရော်ဖက်ရှင်နယ် ပုံစံဖြင့် ရေးပေးပါ။",
          images: frames,
        },
      });

      if (error) throw error;

      if (data?.reply) {
        setResult(data.reply);

        // Deduct credits after successful generation
        const { data: deductResult, error: deductError } = await supabase.rpc("deduct_user_credits", {
          _user_id: userId,
          _amount: creditCost,
          _action: "scene_summarizer",
        });

        if (deductError) {
          console.error("Credit deduction error:", deductError);
        }

        // Log to credit audit
        await supabase.from("credit_audit_log").insert({
          user_id: userId,
          amount: -creditCost,
          credit_type: "scene_summarizer",
          description: `Scene Summarizer - Video Analysis`,
        });

        refetchCredits();
        toast({ title: "✅ ခွဲခြမ်းစိတ်ဖြာပြီးပါပြီ!", description: `${creditCost} Credits နုတ်ယူပြီးပါပြီ` });
      } else {
        throw new Error(data?.error || "Analysis failed");
      }
    } catch (error: any) {
      console.error("Summarize error:", error);
      toast({ 
        title: "ခွဲခြမ်းစိတ်ဖြာရာတွင် ပြဿနာရှိပါသည်", 
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
        title="ဗီဒီယို အကျဥ်းချုပ်ပြန်ထုတ်ခြင်း" 
        subtitle="Video Summary & Recap" 
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

          {/* Custom Prompt */}
          <Textarea
            placeholder="(Optional) ဗီဒီယိုအကြောင်း သီးသန့်မေးခွန်း ထည့်နိုင်ပါသည်..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={2}
            className="text-sm"
          />

          {/* Credit Cost */}
          <div className="gradient-card rounded-2xl p-3 border border-primary/20 flex items-center justify-between">
            <span className="text-sm font-myanmar">ခွဲခြမ်းစိတ်ဖြာခ</span>
            <span className="text-sm font-bold text-primary">{creditCost} Credits</span>
          </div>

          {/* Analyze Button */}
          {!result && (
            <Button 
              onClick={handleSummarize} 
              disabled={isProcessing} 
              className="w-full gradient-gold text-primary-foreground"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ခွဲခြမ်းစိတ်ဖြာနေပါသည်...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Summarize ({creditCost} Credits)
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="gradient-card rounded-xl p-3 border border-green-500/30 bg-green-500/5">
            <p className="text-xs text-green-400 font-myanmar">✅ Credits နုတ်ယူပြီးပါပြီ။ ရလဒ်ကို ကြည့်ရှုနိုင်ပါပြီ။</p>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">📝 Recap Script</h3>
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
          <Button onClick={clearAll} variant="outline" className="w-full">
            ဗီဒီယိုအသစ် ခွဲခြမ်းမည်
          </Button>
        </motion.div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />

      {/* Info */}
      <div className="gradient-card rounded-xl p-4 border border-primary/20">
        <p className="text-xs text-muted-foreground font-myanmar leading-relaxed">
          💡 ဗီဒီယိုမှ Key Frames များကို AI ဖြင့် ခွဲခြမ်းစိတ်ဖြာပြီး 
          မြန်မာဘာသာဖြင့် Recap Script ရေးပေးပါသည်။ 
          Scene Highlights, Key Points နှင့် အကျဉ်းချုပ် ပါဝင်ပါသည်။
          Credits ကို ရလဒ်ထွက်ပြီးမှသာ နုတ်ယူပါသည်။
        </p>
      </div>
    </motion.div>
  );
};
