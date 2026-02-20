import { useState, useRef, useEffect, useCallback } from "react";
import { ImagePlus, Download, Loader2, Upload, X, Sparkles } from "lucide-react";
import { downloadVideo } from "@/lib/downloadHelper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const BG_PRESETS = [
  { value: "office", label: "🏢 ရုံးခန်း" },
  { value: "beach", label: "🏖️ ပင်လယ်ကမ်းခြေ" },
  { value: "city", label: "🌆 မြို့တော်ကြီး" },
  { value: "nature", label: "🌿 သဘာဝ တောတောင်" },
  { value: "studio", label: "📸 Studio နောက်ခံ" },
  { value: "space", label: "🚀 အာကာသ" },
  { value: "custom", label: "✍️ စိတ်ကြိုက်ရေးမည်" },
];

export const VideoBgChangerTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide } = useToolOutput("video_bg_change", "Video BG Changer");

  const [videoFile, setVideoFile] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState("");
  const [bgPreset, setBgPreset] = useState("office");
  const [customBg, setCustomBg] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastShownRef = useRef(false);

  const creditCost = (costs as any).video_bg_change || 18;

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const startPolling = useCallback((jobId: string) => {
    setPollingJobId(jobId);
    toastShownRef.current = false;
    let pollCount = 0;
    const maxPolls = 180;
    const msgs = ["နောက်ခံ ဖယ်ရှားနေသည်...", "နောက်ခံ အသစ် ဖန်တီးနေသည်...", "ဗီဒီယို ပေါင်းစပ်နေသည်...", "Render လုပ်နေသည်...", "နီးပါပြီ..."];

    pollingRef.current = setInterval(async () => {
      pollCount++;
      setProgress(Math.min(10 + (pollCount / maxPolls) * 85, 95));
      setStatusText(msgs[Math.min(Math.floor(pollCount / (maxPolls / msgs.length)), msgs.length - 1)]);

      if (pollCount >= maxPolls) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setIsLoading(false);
        setPollingJobId(null);
        toast({ title: "Store ထဲတွင် စစ်ဆေးပါ" });
        return;
      }

      try {
        try { await supabase.functions.invoke("check-job-status", { body: {} }); } catch {}
        const { data: job } = await supabase.from("generation_jobs").select("status, output_url, error_message").eq("id", jobId).single();

        if (job?.status === "completed" && job.output_url) {
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
          if (!toastShownRef.current) { toastShownRef.current = true; toast({ title: "အမှားရှိပါသည်", description: job.error_message, variant: "destructive" }); }
        }
      } catch {}
    }, 5000);
  }, [toast, refetchCredits]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "ဖိုင်ကြီးလွန်းပါသည်", description: "25MB အောက်ရွေးပါ", variant: "destructive" });
      return;
    }
    setVideoFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setVideoFile(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!userId || !videoFile) { toast({ title: "ဗီဒီယို ဖိုင်ထည့်ပါ", variant: "destructive" }); return; }
    if (bgPreset === "custom" && !customBg.trim()) { toast({ title: "နောက်ခံ ဖော်ပြချက် ရေးပါ", variant: "destructive" }); return; }
    if (credits < creditCost) { toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", variant: "destructive" }); return; }

    setIsLoading(true);
    setResultVideo(null);
    setProgress(5);
    setStatusText("ဗီဒီယို တင်နေသည်...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" }); setIsLoading(false); return; }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-bg-changer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          videoBase64: videoFile.split(",")[1],
          bgPreset,
          customBgDescription: bgPreset === "custom" ? customBg.trim() : undefined,
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
      <ToolHeader title="AI Video Background Changer" subtitle="ဗီဒီယို နောက်ခံ ပြောင်းလဲခြင်း" onBack={onBack} />
      <FirstOutputGuide toolName="Video BG Changer" show={showGuide} steps={["ဗီဒီယို ထည့်ပါ", "နောက်ခံ ရွေးပါ", "ဖန်တီးမည် နှိပ်ပါ"]} />

      {/* Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar"><Upload className="w-4 h-4 inline mr-1" /> ဗီဒီယို ဖိုင်ထည့်ပါ (25MB အောက်)</label>
        {videoFile ? (
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/30">
            <span className="text-sm truncate max-w-[200px]">{videoFileName}</span>
            <button onClick={() => { setVideoFile(null); setVideoFileName(""); }} className="p-1 bg-destructive rounded-full text-destructive-foreground"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-full h-24 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5">
            <Upload className="w-6 h-6 text-primary" /><span className="text-xs text-muted-foreground font-myanmar">MP4, MOV ဖိုင်</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
      </div>

      {/* BG Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🖼️ နောက်ခံ ရွေးချယ်ပါ</label>
        <Select value={bgPreset} onValueChange={setBgPreset} disabled={isLoading}>
          <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{BG_PRESETS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {bgPreset === "custom" && (
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="block text-sm font-medium text-primary mb-2 font-myanmar">✍️ နောက်ခံ ဖော်ပြချက်</label>
          <Input placeholder="ဥပမာ: Tokyo မြို့ လမ်းမကြီး ညဘက်" value={customBg} onChange={e => setCustomBg(e.target.value)} disabled={isLoading} className="bg-background/50 border-primary/30 text-sm" />
        </div>
      )}

      {/* Cost */}
      <div className="gradient-card rounded-2xl p-3 border border-accent/30 bg-accent/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-myanmar">ကုန်ကျမည့် Credits:</span>
          <span className="text-lg font-bold text-primary">{creditCost} <span className="text-xs font-normal text-muted-foreground">Credits</span></span>
        </div>
      </div>

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
        {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />ဖန်တီးနေသည်...</> : <><Sparkles className="w-5 h-5 mr-2" />နောက်ခံပြောင်းမည် ({creditCost} Credit)</>}
      </Button>

      {resultVideo && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="gradient-card rounded-2xl p-4 border border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary font-myanmar">🎬 ရလဒ် ဗီဒီယို</h3>
            <Button onClick={() => downloadVideo(resultVideo, "bg-changed-video")} size="sm" variant="outline" className="text-xs"><Download className="w-3 h-3 mr-1" />Download</Button>
          </div>
          <video controls className="w-full rounded-xl" src={resultVideo} />
        </motion.div>
      )}
    </motion.div>
  );
};
