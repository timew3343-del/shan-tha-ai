import { useState, useRef, useEffect, useCallback } from "react";
import { Video, Download, Loader2, Sparkles } from "lucide-react";
import { downloadVideo } from "@/lib/downloadHelper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

const STYLE_OPTIONS = [
  { value: "cinematic", label: "🎬 Cinematic" },
  { value: "cartoon", label: "🎨 Cartoon" },
  { value: "anime", label: "🌸 Anime" },
  { value: "realistic", label: "👤 Realistic" },
  { value: "3d", label: "🧊 3D Animation" },
  { value: "watercolor", label: "🖌️ Watercolor" },
];

const DURATION_OPTIONS = [
  { value: "15", label: "⏱️ 15 စက္ကန့်" },
  { value: "30", label: "⏱️ 30 စက္ကန့်" },
  { value: "60", label: "⏱️ 1 မိနစ်" },
];

const ASPECT_OPTIONS = [
  { value: "16:9", label: "📺 16:9 (YouTube)" },
  { value: "9:16", label: "📱 9:16 (TikTok)" },
  { value: "1:1", label: "⬜ 1:1 (Square)" },
];

const LANGUAGE_OPTIONS = [
  { value: "my", label: "🇲🇲 မြန်မာ" },
  { value: "en", label: "🇺🇸 English" },
  { value: "th", label: "🇹🇭 Thai" },
  { value: "ko", label: "🇰🇷 Korean" },
];

export const TextToVideoCreatorTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide } = useToolOutput("text_to_video", "Text to Video");

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [duration, setDuration] = useState("30");
  const [aspect, setAspect] = useState("16:9");
  const [language, setLanguage] = useState("my");
  const [addBgm, setAddBgm] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastShownRef = useRef(false);

  const baseCost = (costs as any).text_to_video || 20;
  const durationMult = parseInt(duration) <= 15 ? 1 : parseInt(duration) <= 30 ? 1.5 : 2;
  const creditCost = Math.ceil(baseCost * durationMult);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const startPolling = useCallback((jobId: string) => {
    setPollingJobId(jobId);
    toastShownRef.current = false;
    let pollCount = 0;
    const maxPolls = 200;
    const msgs = ["AI မှ ဇာတ်လမ်းရေးနေသည်...", "ပုံများ ဖန်တီးနေသည်...", "ဗီဒီယို ပြောင်းနေသည်...", "Render လုပ်နေသည်...", "နောက်ခံတီးလုံး ထည့်နေသည်...", "နီးပါပြီ..."];

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

  const handleGenerate = async () => {
    if (!userId || !prompt.trim()) { toast({ title: "ဗီဒီယို အကြောင်းအရာ ရေးပါ", variant: "destructive" }); return; }
    if (credits < creditCost) { toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", variant: "destructive" }); return; }

    setIsLoading(true);
    setResultVideo(null);
    setProgress(5);
    setStatusText("AI မှ ဇာတ်လမ်းရေးနေသည်...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" }); setIsLoading(false); return; }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-video-creator`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt: prompt.trim(), style, durationSec: parseInt(duration), aspectRatio: aspect, language, addBgm }),
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
      <ToolHeader title="AI Text-to-Video Creator" subtitle="စာသားဖြင့် ဗီဒီယို ဖန်တီးရန်" onBack={onBack} />
      <FirstOutputGuide toolName="Text to Video" show={showGuide} steps={["အကြောင်းအရာ ရေးပါ", "Style ရွေးပါ", "ဖန်တီးမည် နှိပ်ပါ"]} />

      {/* Prompt */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">📝 ဗီဒီယို အကြောင်းအရာ</label>
        <Textarea
          placeholder="ဥပမာ: မြန်မာ့ရိုးရာ ထမနဲလုပ်နည်း step by step ပြ &#10;ဥပမာ: ရန်ကုန်မြို့ရဲ့ ညဘက် လမ်းမကြီးပေါ်မှာ မိုးရွာနေတဲ့ cinematic ဗီဒီယို"
          value={prompt} onChange={e => setPrompt(e.target.value)} disabled={isLoading}
          className="min-h-[100px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
        />
      </div>

      {/* Options row 1 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎨 Style</label>
          <Select value={style} onValueChange={setStyle} disabled={isLoading}>
            <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{STYLE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="block text-sm font-medium text-primary mb-2 font-myanmar">⏱️ အရှည်</label>
          <Select value={duration} onValueChange={setDuration} disabled={isLoading}>
            <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{DURATION_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Options row 2 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="block text-sm font-medium text-primary mb-2 font-myanmar">📐 Aspect Ratio</label>
          <Select value={aspect} onValueChange={setAspect} disabled={isLoading}>
            <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{ASPECT_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🌐 ဘာသာစကား</label>
          <Select value={language} onValueChange={setLanguage} disabled={isLoading}>
            <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{LANGUAGE_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* BGM Toggle */}
      <div className="gradient-card rounded-2xl p-3 border border-primary/20 flex items-center justify-between">
        <label className="text-sm font-medium text-primary font-myanmar">🎵 နောက်ခံတီးလုံး ထည့်မည်</label>
        <button onClick={() => setAddBgm(!addBgm)} disabled={isLoading} className={`w-12 h-6 rounded-full transition-colors ${addBgm ? "bg-primary" : "bg-muted"}`}>
          <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${addBgm ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
      </div>

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

      <Button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="w-full btn-gradient-green py-4 rounded-2xl font-semibold font-myanmar">
        {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />ဖန်တီးနေသည်...</> : <><Sparkles className="w-5 h-5 mr-2" />ဖန်တီးမည် ({creditCost} Credit)</>}
      </Button>

      {resultVideo && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="gradient-card rounded-2xl p-4 border border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary font-myanmar">🎬 ရလဒ် ဗီဒီယို</h3>
            <Button onClick={() => downloadVideo(resultVideo, "ai-video")} size="sm" variant="outline" className="text-xs"><Download className="w-3 h-3 mr-1" />Download</Button>
          </div>
          <video controls className="w-full rounded-xl" src={resultVideo} />
        </motion.div>
      )}
    </motion.div>
  );
};
