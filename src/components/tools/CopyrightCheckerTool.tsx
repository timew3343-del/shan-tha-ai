import { useState, useRef } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, Shield, ShieldCheck, ShieldAlert, ShieldX,
  Loader2, X, FileText, Video, AlertTriangle, CheckCircle,
  Lightbulb, ChevronDown, ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CopyrightCheckerToolProps {
  userId?: string;
  onBack: () => void;
}

interface CopyrightIssue {
  type: string;
  severity: string;
  description: string;
  detail: string;
}

interface Recommendation {
  issue: string;
  fix: string;
  effort: string;
}

interface AnalysisResult {
  safetyScore: number;
  overallRisk: string;
  issues: CopyrightIssue[];
  recommendations: Recommendation[];
  summary: string;
}

const PROCESSING_STEPS = [
  { label: "Content ခွဲခြမ်းစိတ်ဖြာနေပါသည်...", icon: "🔍" },
  { label: "Copyright database စစ်ဆေးနေပါသည်...", icon: "📚" },
  { label: "Risk assessment ပြုလုပ်နေပါသည်...", icon: "⚖️" },
  { label: "Report ပြင်ဆင်နေပါသည်...", icon: "📋" },
];

export const CopyrightCheckerTool = ({ userId, onBack }: CopyrightCheckerToolProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { showGuide, saveOutput } = useToolOutput("copyright_checker", "Copyright Checker");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contentType, setContentType] = useState<"text" | "video">("text");
  const [textContent, setTextContent] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());

  const creditCost = costs.copyright_check;

  const getScoreColor = (score: number) => {
    if (score >= 71) return "text-green-500";
    if (score >= 41) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 71) return "bg-green-500";
    if (score >= 41) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 71) return "Safe ✅";
    if (score >= 41) return "Warning ⚠️";
    return "Danger ❌";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 71) return <ShieldCheck className="w-8 h-8 text-green-500" />;
    if (score >= 41) return <ShieldAlert className="w-8 h-8 text-yellow-500" />;
    return <ShieldX className="w-8 h-8 text-red-500" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "text-red-500 bg-red-500/10 border-red-500/30";
      case "medium": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
      default: return "text-green-500 bg-green-500/10 border-green-500/30";
    }
  };

  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case "easy": return "bg-green-500/20 text-green-400";
      case "medium": return "bg-yellow-500/20 text-yellow-400";
      default: return "bg-red-500/20 text-red-400";
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "ဗီဒီယို ဖိုင်သာ ထည့်နိုင်ပါသည်", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "50MB ထက်မကျော်ရပါ", variant: "destructive" });
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
        const frameCount = Math.min(4, Math.max(2, Math.floor(dur / 15)));
        const interval = dur / (frameCount + 1);
        const frames: string[] = [];
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        canvas.width = 512;
        canvas.height = 288;
        for (let i = 1; i <= frameCount; i++) {
          await new Promise<void>((res) => {
            video.currentTime = interval * i;
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

  const handleAnalyze = async () => {
    if (!userId) return;
    if (contentType === "text" && !textContent.trim()) {
      toast({ title: "စစ်ဆေးရန် content ထည့်ပါ", variant: "destructive" });
      return;
    }
    if (contentType === "video" && !videoFile) {
      toast({ title: "ဗီဒီယို ဖိုင် ထည့်ပါ", variant: "destructive" });
      return;
    }
    if (credits < creditCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${creditCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setResult(null);
    setProgress(0);
    setCurrentStep(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.random() * 5;
        if (next >= 95) return 95;
        setCurrentStep(Math.min(Math.floor(next / 25), PROCESSING_STEPS.length - 1));
        return next;
      });
    }, 500);

    try {
      let frames: string[] = [];
      if (contentType === "video" && videoFile) {
        frames = await extractFrames(videoFile);
      }

      const { data, error } = await supabase.functions.invoke("copyright-check", {
        body: {
          content: contentType === "text" ? textContent : "",
          contentType,
          frames,
        },
      });

      if (error) throw error;
      if (data?.analysis) {
        setResult(data.analysis);
        setProgress(100);
        refetchCredits();
        saveOutput("text", data.analysis.summary);
        toast({ title: "✅ Copyright စစ်ဆေးမှု ပြီးပါပြီ!" });
      } else {
        throw new Error(data?.error || "Analysis failed");
      }
    } catch (error: any) {
      console.error("Copyright check error:", error);
      toast({ title: "ပြဿနာရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      clearInterval(progressInterval);
      setIsProcessing(false);
    }
  };

  const toggleIssue = (index: number) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const clearAll = () => {
    setTextContent("");
    setVideoFile(null);
    setVideoPreview(null);
    setResult(null);
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
        title="Copyright စစ်ဆေးခြင်း"
        subtitle="AI ဖြင့် Copyright အန္တရာယ် စစ်ဆေးမည်"
        onBack={onBack}
      />
      <FirstOutputGuide toolName="Copyright Checker" show={showGuide} steps={["Content ထည့်ပါ", "စစ်ဆေးမည် နှိပ်ပါ"]} />

      {/* Content Type Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setContentType("text"); setResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
            contentType === "text"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/50 bg-secondary/30 text-muted-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm font-myanmar">စာသား/Script</span>
        </button>
        <button
          onClick={() => { setContentType("video"); setResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
            contentType === "video"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/50 bg-secondary/30 text-muted-foreground"
          }`}
        >
          <Video className="w-4 h-4" />
          <span className="text-sm font-myanmar">ဗီဒီယို</span>
        </button>
      </div>

      {/* Input Area */}
      {contentType === "text" ? (
        <Textarea
          placeholder="စစ်ဆေးလိုသော script, lyrics, သို့မဟုတ် content ကို ဒီမှာ ထည့်ပါ..."
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          rows={6}
          className="text-sm font-myanmar"
        />
      ) : (
        <>
          {!videoFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-primary/30 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
            >
              <Upload className="w-10 h-10 text-primary mx-auto mb-3" />
              <p className="text-sm font-medium font-myanmar">ဗီဒီယို ဖိုင် ထည့်ပါ</p>
              <p className="text-xs text-muted-foreground mt-1">MP4, WEBM, MOV (50MB max)</p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-border/50">
              <video src={videoPreview!} className="w-full max-h-48 object-contain bg-black/50" controls />
              <button onClick={clearAll} className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
        </>
      )}

      {/* Credit Cost */}
      <div className="gradient-card rounded-2xl p-3 border border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-sm font-myanmar">စစ်ဆေးခ</span>
        </div>
        <span className="text-sm font-bold text-primary">{creditCost} Credits</span>
      </div>

      {/* Processing */}
      {isProcessing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{PROCESSING_STEPS[currentStep]?.icon}</span>
            <span className="font-myanmar">{PROCESSING_STEPS[currentStep]?.label}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Analyze Button */}
      {!result && (
        <Button onClick={handleAnalyze} disabled={isProcessing} className="w-full py-5 rounded-2xl font-semibold">
          {isProcessing ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> စစ်ဆေးနေပါသည်...</>
          ) : (
            <><Shield className="w-5 h-5 mr-2" /> Copyright စစ်ဆေးမည် ({creditCost} Cr)</>
          )}
        </Button>
      )}

      {/* Results - Audit Report */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Score Card */}
          <div className="gradient-card rounded-2xl p-5 border border-primary/20 text-center space-y-3">
            <div className="flex justify-center">{getScoreIcon(result.safetyScore)}</div>
            <div>
              <div className={`text-4xl font-extrabold ${getScoreColor(result.safetyScore)}`}>
                {result.safetyScore}%
              </div>
              <div className={`text-sm font-bold mt-1 ${getScoreColor(result.safetyScore)}`}>
                {getScoreLabel(result.safetyScore)}
              </div>
            </div>
            {/* Score Bar */}
            <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${result.safetyScore}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${getScoreBg(result.safetyScore)}`}
              />
            </div>
            <p className="text-xs text-muted-foreground font-myanmar">{result.summary}</p>
          </div>

          {/* Issues Breakdown */}
          {result.issues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 font-myanmar">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                တွေ့ရှိချက်များ ({result.issues.length})
              </h3>
              {result.issues.map((issue, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`rounded-xl border p-3 ${getSeverityColor(issue.severity)}`}
                >
                  <button onClick={() => toggleIssue(i)} className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-2 text-left">
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-md bg-current/10">
                        {issue.type}
                      </span>
                      <span className="text-sm font-myanmar">{issue.description}</span>
                    </div>
                    {expandedIssues.has(i) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <AnimatePresence>
                    {expandedIssues.has(i) && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="text-xs mt-2 leading-relaxed font-myanmar"
                      >
                        {issue.detail}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 font-myanmar">
                <Lightbulb className="w-4 h-4 text-primary" />
                ပြင်ဆင်ရန် အကြံပြုချက်များ
              </h3>
              {result.recommendations.map((rec, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="gradient-card rounded-xl border border-primary/20 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">{rec.issue}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getEffortBadge(rec.effort)}`}>
                      {rec.effort}
                    </span>
                  </div>
                  <p className="text-sm font-myanmar leading-relaxed">{rec.fix}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* No issues */}
          {result.issues.length === 0 && (
            <div className="gradient-card rounded-xl p-4 border border-green-500/30 text-center">
              <ShieldCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-myanmar text-green-400 font-semibold">Copyright ပြဿနာ မတွေ့ရပါ!</p>
              <p className="text-xs text-muted-foreground mt-1 font-myanmar">သင့် content သည် လုံခြုံပါသည်။</p>
            </div>
          )}

          <Button onClick={clearAll} variant="outline" className="w-full font-myanmar">
            နောက်တစ်ခု စစ်ဆေးမည်
          </Button>
        </motion.div>
      )}

      {/* Info */}
      <div className="gradient-card rounded-xl p-4 border border-primary/20">
        <p className="text-xs text-muted-foreground font-myanmar leading-relaxed">
          🛡️ AI ဖြင့် သင့် content ကို copyright ပြဿနာများ စစ်ဆေးပေးပါသည်။
          Safety Score 71% အထက်ဆိုလျှင် လုံခြုံပါသည်။ Credits ကို report ထွက်ပြီးမှသာ နုတ်ယူပါသည်။
        </p>
      </div>
    </motion.div>
  );
};
