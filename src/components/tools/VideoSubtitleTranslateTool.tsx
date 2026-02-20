import { useState, useRef, useEffect, useCallback } from "react";
import { Captions, Download, Loader2, Upload, X, Sparkles, Languages } from "lucide-react";
import { downloadVideo } from "@/lib/downloadHelper";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion } from "framer-motion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props { userId?: string; onBack: () => void; }

const LANGUAGES = [
  { value: "my", label: "🇲🇲 မြန်မာ" },
  { value: "en", label: "🇺🇸 English" },
  { value: "th", label: "🇹🇭 Thai" },
  { value: "ko", label: "🇰🇷 Korean" },
  { value: "ja", label: "🇯🇵 Japanese" },
  { value: "zh", label: "🇨🇳 Chinese" },
  { value: "hi", label: "🇮🇳 Hindi" },
  { value: "original", label: "🌐 မူရင်းဘာသာ" },
];

const SUBTITLE_STYLES = [
  { value: "bottom_center", label: "📍 အောက်အလယ်" },
  { value: "top_center", label: "📍 အပေါ်အလယ်" },
];

const SUBTITLE_COLORS = [
  { value: "#FFFFFF", label: "အဖြူ" },
  { value: "#FFFF00", label: "အဝါ" },
  { value: "#00FFFF", label: "Cyan" },
  { value: "#00FF00", label: "အစိမ်း" },
  { value: "#FF69B4", label: "ပန်းရောင်" },
];

export const VideoSubtitleTranslateTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("video_subtitle", "Video Subtitle & Translate");

  const [videoFile, setVideoFile] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState("");
  const [targetLang, setTargetLang] = useState("my");
  const [subtitlePosition, setSubtitlePosition] = useState("bottom_center");
  const [subtitleColor, setSubtitleColor] = useState("#FFFFFF");

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastShownRef = useRef(false);

  const creditCost = (costs as any).video_subtitle || 15;

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const startPolling = useCallback((jobId: string) => {
    setPollingJobId(jobId);
    toastShownRef.current = false;
    let pollCount = 0;
    const maxPolls = 180;
    const msgs = ["ဗီဒီယို ခွဲခြမ်းနေသည်...", "အသံကို စာသားပြောင်းနေသည်...", "ဘာသာပြန်နေသည်...", "စာတန်းထိုးနေသည်...", "Render လုပ်နေသည်...", "နီးပါပြီ..."];

    pollingRef.current = setInterval(async () => {
      pollCount++;
      setProgress(Math.min(10 + (pollCount / maxPolls) * 85, 95));
      setStatusText(msgs[Math.min(Math.floor(pollCount / (maxPolls / msgs.length)), msgs.length - 1)]);

      if (pollCount >= maxPolls) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setIsLoading(false);
        setPollingJobId(null);
        toast({ title: "Store ထဲတွင် စစ်ဆေးပါ", description: "ရလဒ်ကို Store ထဲမှ ကြည့်ပါ" });
        return;
      }

      try {
        try { await supabase.functions.invoke("check-job-status", { body: {} }); } catch {}
        const { data: job } = await supabase.from("generation_jobs").select("status, output_url, error_message").eq("id", jobId).single();

        if (job?.status === "completed" && job.output_url && job.output_url !== "srt_ready") {
          setResultVideo(job.output_url);
          if (pollingRef.current) clearInterval(pollingRef.current);
          setProgress(100);
          setStatusText("အောင်မြင်ပါပြီ!");
          refetchCredits();
          setIsLoading(false);
          setPollingJobId(null);
          if (!toastShownRef.current) { toastShownRef.current = true; toast({ title: "အောင်မြင်ပါသည် 🎬" }); }
        } else if (job?.status === "failed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsLoading(false);
          setPollingJobId(null);
          if (!toastShownRef.current) { toastShownRef.current = true; toast({ title: "အမှားရှိပါသည်", description: job.error_message || "Failed", variant: "destructive" }); }
        }
      } catch {}
    }, 5000);
  }, [toast, refetchCredits]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "ဖိုင်ကြီးလွန်းပါသည်", description: "25MB အောက် ဖိုင်ရွေးပါ", variant: "destructive" });
      return;
    }
    setVideoFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setVideoFile(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!userId || !videoFile) { toast({ title: "ဗီဒီယို ဖိုင်ထည့်ပါ", variant: "destructive" }); return; }
    if (credits < creditCost) { toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", variant: "destructive" }); return; }

    setIsLoading(true);
    setResultVideo(null);
    setProgress(5);
    setStatusText("ဗီဒီယို တင်နေသည်...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" }); setIsLoading(false); return; }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-subtitle-translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          videoBase64: videoFile.split(",")[1],
          targetLang,
          subtitlePosition,
          subtitleColor,
        }),
      });

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed");

      if (result.status === "processing" && result.jobId) {
        setProgress(10);
        startPolling(result.jobId);
        return;
      }
    } catch (err: any) {
      toast({ title: "အမှားရှိပါသည်", description: err.message, variant: "destructive" });
    } finally {
      if (!pollingJobId) setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI Video Subtitle & Translate" subtitle="ဗီဒီယိုမှာ စာတန်းထိုး + ဘာသာပြန်" onBack={onBack} />
      <FirstOutputGuide toolName="Video Subtitle" show={showGuide} steps={["ဗီဒီယို ထည့်ပါ", "ဘာသာစကား ရွေးပါ", "ဖန်တီးမည် နှိပ်ပါ"]} />

      {/* Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          <Upload className="w-4 h-4 inline mr-1" /> ဗီဒီယို ဖိုင်ထည့်ပါ (25MB အောက်)
        </label>
        {videoFile ? (
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/30">
            <span className="text-sm truncate max-w-[200px]">{videoFileName}</span>
            <button onClick={() => { setVideoFile(null); setVideoFileName(""); }} className="p-1 bg-destructive rounded-full text-destructive-foreground"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-full h-24 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5">
            <Upload className="w-6 h-6 text-primary" />
            <span className="text-xs text-muted-foreground font-myanmar">MP4, MOV, AVI ဖိုင်</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="block text-sm font-medium text-primary mb-2 font-myanmar"><Languages className="w-4 h-4 inline mr-1" /> ဘာသာပြန်</label>
          <Select value={targetLang} onValueChange={setTargetLang} disabled={isLoading}>
            <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="block text-sm font-medium text-primary mb-2 font-myanmar">📍 တည်နေရာ</label>
          <Select value={subtitlePosition} onValueChange={setSubtitlePosition} disabled={isLoading}>
            <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{SUBTITLE_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Subtitle Color */}
      <div className="gradient-card rounded-2xl p-3 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎨 စာတန်းအရောင်</label>
        <div className="flex gap-2">
          {SUBTITLE_COLORS.map(c => (
            <button key={c.value} onClick={() => setSubtitleColor(c.value)}
              className={`w-8 h-8 rounded-full border-2 ${subtitleColor === c.value ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border/50"}`}
              style={{ backgroundColor: c.value }} title={c.label} />
          ))}
        </div>
      </div>

      {/* Cost */}
      <div className="gradient-card rounded-2xl p-3 border border-accent/30 bg-accent/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-myanmar">ကုန်ကျမည့် Credits:</span>
          <span className="text-lg font-bold text-primary">{creditCost} <span className="text-xs font-normal text-muted-foreground">Credits</span></span>
        </div>
      </div>

      {/* Progress */}
      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">{statusText}</span><span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {pollingJobId && <p className="text-[10px] text-muted-foreground text-center font-myanmar">🔄 နောက်ကွယ်မှ ဖန်တီးနေပါသည်...</p>}
        </motion.div>
      )}

      <Button onClick={handleGenerate} disabled={isLoading || !videoFile} className="w-full btn-gradient-green py-4 rounded-2xl font-semibold font-myanmar">
        {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />ဖန်တီးနေသည်...</> : <><Captions className="w-5 h-5 mr-2" />စာတန်းထိုးမည် ({creditCost} Credit)</>}
      </Button>

      {/* Result */}
      {resultVideo && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="gradient-card rounded-2xl p-4 border border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary font-myanmar">🎬 ရလဒ် ဗီဒီယို</h3>
            <Button onClick={() => downloadVideo(resultVideo, "subtitled-video")} size="sm" variant="outline" className="text-xs"><Download className="w-3 h-3 mr-1" />Download</Button>
          </div>
          <video controls className="w-full rounded-xl" src={resultVideo} />
        </motion.div>
      )}
    </motion.div>
  );
};
