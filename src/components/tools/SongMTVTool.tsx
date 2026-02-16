import { useState, useRef, useEffect, useCallback } from "react";
import { Music, Video, Sparkles, Download, Loader2, Upload, X, Mic2 } from "lucide-react";
import { downloadVideo, downloadAudio } from "@/lib/downloadHelper";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SongMTVToolProps {
  userId?: string;
  onBack: () => void;
}

type ServiceOption = "song_only" | "mtv_only" | "full_auto";

const GENRE_OPTIONS = [
  { value: "pop", label: "🎵 Pop" },
  { value: "rock", label: "🎸 Rock" },
  { value: "hiphop", label: "🎤 Hip-Hop" },
  { value: "edm", label: "🎧 EDM" },
  { value: "ballad", label: "💕 Ballad" },
  { value: "jazz", label: "🎷 Jazz" },
  { value: "classical", label: "🎻 Classical" },
  { value: "rnb", label: "🎶 R&B" },
  { value: "country", label: "🤠 Country" },
  { value: "myanmar_traditional", label: "🇲🇲 မြန်မာ့ရိုးရာ" },
];

const MOOD_OPTIONS = [
  { value: "happy", label: "😊 ပျော်ရွှင်" },
  { value: "sad", label: "😢 ဝမ်းနည်း" },
  { value: "energetic", label: "⚡ တက်ကြွ" },
  { value: "romantic", label: "💕 ခစ္စာ" },
  { value: "chill", label: "😌 အေးဆေး" },
  { value: "epic", label: "🏔️ ကြီးကျယ်" },
];

const LANGUAGE_OPTIONS = [
  { value: "my", label: "🇲🇲 မြန်မာ" },
  { value: "en", label: "🇺🇸 English" },
  { value: "th", label: "🇹🇭 Thai" },
  { value: "ko", label: "🇰🇷 Korean" },
  { value: "ja", label: "🇯🇵 Japanese" },
  { value: "zh", label: "🇨🇳 Chinese" },
];

const MTV_STYLE_OPTIONS = [
  { value: "cartoon", label: "🎨 ကာတွန်း" },
  { value: "3d", label: "🧊 3D Animation" },
  { value: "realistic", label: "👤 လူပုံစံ" },
  { value: "anime", label: "🌸 Anime" },
  { value: "abstract", label: "🎭 Abstract Art" },
  { value: "cinematic", label: "🎬 Cinematic" },
];

const DURATION_OPTIONS = [
  { value: "1", label: "⏱️ 1 မိနစ်" },
  { value: "3", label: "⏱️ 3 မိနစ်" },
  { value: "5", label: "⏱️ 5 မိနစ်" },
  { value: "10", label: "⏱️ 10 မိနစ်" },
];

export const SongMTVTool = ({ userId, onBack }: SongMTVToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("song_mtv", "Song & MTV");

  const [serviceOption, setServiceOption] = useState<ServiceOption>("song_only");
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState("pop");
  const [mood, setMood] = useState("happy");
  const [language, setLanguage] = useState("my");
  const [mtvStyle, setMtvStyle] = useState("cartoon");
  const [videoDuration, setVideoDuration] = useState("1");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [subtitleColor, setSubtitleColor] = useState("#FFFFFF");
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  const [resultAudio, setResultAudio] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [resultLyrics, setResultLyrics] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getCreditCost = () => {
    let base: number;
    const durationMin = parseInt(videoDuration) || 1;
    switch (serviceOption) {
      case "song_only": base = costs.song_mtv || 20; break;
      case "mtv_only": base = Math.ceil((costs.song_mtv || 20) * 1.2 * durationMin); break;
      case "full_auto": base = Math.ceil((costs.song_mtv || 20) * 2 * durationMin); break;
      default: base = costs.song_mtv || 20;
    }
    if (!showSubtitles && (serviceOption === "full_auto" || serviceOption === "mtv_only")) {
      base = Math.ceil(base * 0.85);
    }
    return base;
  };

  const creditCost = getCreditCost();

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Poll for job completion
  const startPolling = useCallback((jobId: string, initialLyrics?: string | null) => {
    setPollingJobId(jobId);
    if (initialLyrics) setResultLyrics(initialLyrics);

    let pollCount = 0;
    const maxPolls = 120; // 10 minutes max (5s intervals)

    const pollStatusMessages = [
      "သီချင်းဖန်တီးနေပါသည်...",
      "AI မှ သီချင်းရေးနေပါသည်...",
      "အသံထုတ်နေပါသည်...",
      "ခဏစောင့်ပါ, နီးပါပြီ...",
    ];

    pollingRef.current = setInterval(async () => {
      pollCount++;
      
      // Update progress and status
      const progressPct = Math.min(10 + (pollCount / maxPolls) * 85, 95);
      setProgress(progressPct);
      const statusIdx = Math.min(Math.floor(pollCount / 15), pollStatusMessages.length - 1);
      setStatusText(pollStatusMessages[statusIdx]);

      if (pollCount >= maxPolls) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setIsLoading(false);
        setPollingJobId(null);
        toast({ title: "အချိန်ကြာလွန်းပါသည်", description: "Store ထဲတွင် ရလဒ်ကို စစ်ဆေးပါ", variant: "destructive" });
        return;
      }

      try {
        const { data: job, error } = await supabase
          .from("generation_jobs")
          .select("status, output_url, error_message, thumbnail_url")
          .eq("id", jobId)
          .single();

        if (error) {
          console.warn("Job poll error:", error);
          return;
        }

        if (job?.status === "completed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setProgress(100);
          setStatusText("အောင်မြင်ပါပြီ!");

          if (job.output_url) {
            // Check if it's audio or video based on URL
            if (job.output_url.includes(".mp3") || job.output_url.includes("audio")) {
              setResultAudio(job.output_url);
            } else {
              setResultVideo(job.output_url);
            }
          }

          // Also check for related completed jobs (e.g., MTV after song)
          const { data: relatedJobs } = await supabase
            .from("generation_jobs")
            .select("status, output_url, tool_type")
            .eq("user_id", userId || "")
            .in("tool_type", ["song_mtv_video", "song_mtv_full", "song_music"])
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(5);

          if (relatedJobs) {
            for (const rj of relatedJobs) {
              if (rj.output_url) {
                if (rj.tool_type === "song_mtv_video" && rj.output_url.includes(".mp4")) {
                  setResultVideo(rj.output_url);
                } else if ((rj.tool_type === "song_music" || rj.tool_type === "song_mtv_full") && !resultAudio) {
                  setResultAudio(rj.output_url);
                }
              }
            }
          }

          refetchCredits();
          setIsLoading(false);
          setPollingJobId(null);
          toast({ title: "အောင်မြင်ပါသည် 🎵", description: "သီချင်း ဖန်တီးပြီးပါပြီ" });

        } else if (job?.status === "failed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setIsLoading(false);
          setPollingJobId(null);
          toast({ title: "အမှားရှိပါသည်", description: job.error_message || "Generation failed", variant: "destructive" });
        }
        // else: still processing, continue polling
      } catch (err) {
        console.warn("Poll fetch error:", err);
      }
    }, 5000);
  }, [userId, toast, refetchCredits, resultAudio]);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: "ဖိုင်ကြီးလွန်းပါသည်", description: "20MB အောက် ဖိုင်ရွေးပါ", variant: "destructive" });
        return;
      }
      setAudioFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => setAudioFile(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!userId) return;

    if (serviceOption === "song_only" && !topic.trim()) {
      toast({ title: "သီချင်း အကြောင်းအရာ ထည့်ပါ", variant: "destructive" });
      return;
    }
    if (serviceOption === "mtv_only" && !audioFile) {
      toast({ title: "အသံဖိုင် ထည့်ပါ", variant: "destructive" });
      return;
    }
    if (serviceOption === "full_auto" && !topic.trim()) {
      toast({ title: "သီချင်း အကြောင်းအရာ ထည့်ပါ", variant: "destructive" });
      return;
    }

    if (credits < creditCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${creditCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setResultAudio(null);
    setResultVideo(null);
    setResultLyrics(null);
    setProgress(5);
    setStatusText("စာသားဖန်တီးနေသည်...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const requestBody = JSON.stringify({
        serviceOption,
        topic: topic.trim(),
        genre,
        mood,
        language,
        mtvStyle,
        showSubtitles,
        subtitleColor,
        videoDurationMinutes: parseInt(videoDuration) || 1,
        audioBase64: serviceOption === "mtv_only" ? audioFile?.split(",")[1] : undefined,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for initial submit

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-song`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: requestBody,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Generation failed");

      // New async flow: response contains jobId + lyrics
      if (result.status === "processing" && result.jobId) {
        console.log(`Song job submitted: ${result.jobId}`);
        setProgress(10);
        setStatusText("သီချင်းဖန်တီးနေပါသည်... ခဏစောင့်ပါ");
        
        // Show lyrics immediately if available
        if (result.lyrics) setResultLyrics(result.lyrics);
        
        // Start polling for job completion
        startPolling(result.jobId, result.lyrics);
        return; // Don't set isLoading=false yet, polling will handle it
      }

      // Legacy sync response (shouldn't happen with new code, but just in case)
      if (result.audio) setResultAudio(result.audio);
      if (result.video) setResultVideo(result.video);
      if (result.lyrics) setResultLyrics(result.lyrics);
      setProgress(100);
      refetchCredits();
      toast({ title: "အောင်မြင်ပါသည် 🎵", description: `${result.creditsUsed || 0} Credits အသုံးပြုပြီးပါပြီ` });

    } catch (error: any) {
      console.error("Song/MTV error:", error);
      if (error.name === "AbortError") {
        toast({ title: "အချိန်ကြာလွန်းပါသည်", description: "နောက်တစ်ကြိမ် ထပ်ကြိုးစားပါ", variant: "destructive" });
      } else {
        toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
      }
    } finally {
      if (!pollingJobId) {
        setIsLoading(false);
      }
    }
  };

  const SERVICE_OPTIONS = [
    { id: "song_only" as ServiceOption, icon: Music, title: "သီချင်းဖန်တီးရန်", subtitle: "Music Only", gradient: "from-emerald-500 to-teal-600" },
    { id: "mtv_only" as ServiceOption, icon: Video, title: "MTV ပြုလုပ်ရန်", subtitle: "MTV Only", gradient: "from-purple-500 to-indigo-600" },
    { id: "full_auto" as ServiceOption, icon: Sparkles, title: "တစ်ခါတည်းလုပ်ရန်", subtitle: "Full Automation", gradient: "from-amber-500 to-orange-600" },
  ];

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI သီချင်းနှင့် MTV" subtitle="AI ဖြင့် သီချင်းနှင့် MTV ဗီဒီယို ဖန်တီးရန်" onBack={onBack} />
      <FirstOutputGuide toolName="Song & MTV" show={showGuide} steps={["အမျိုးအစား ရွေးပါ (Song/MTV)", "အကြောင်းအရာ ရေးပါ", "ဖန်တီးမည် နှိပ်ပါ"]} />

      {/* Service Options */}
      <div className="grid grid-cols-3 gap-2">
        {SERVICE_OPTIONS.map((opt) => (
          <motion.button
            key={opt.id}
            onClick={() => setServiceOption(opt.id)}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
            className={`relative p-3 rounded-2xl border-2 transition-all overflow-hidden ${
              serviceOption === opt.id
                ? "border-primary shadow-gold"
                : "border-border/50 hover:border-primary/30"
            }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${opt.gradient} opacity-${serviceOption === opt.id ? "90" : "40"} transition-opacity`} />
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <opt.icon className="w-6 h-6 text-white" />
              <span className="text-[10px] font-bold text-white font-myanmar leading-tight text-center">{opt.title}</span>
              <span className="text-[8px] text-white/70">{opt.subtitle}</span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Input based on service option */}
      <AnimatePresence mode="wait">
        {(serviceOption === "song_only" || serviceOption === "full_auto") && (
          <motion.div key="lyrics-input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎵 သီချင်းအကြောင်းအရာ / စာသား</label>
              <Textarea
                placeholder={`သီချင်းစာသားကို တိုက်ရိုက်ရေးထည့်ပါ (သို့) အကြောင်းအရာတိုတိုရေးပြီး AI ကိုရေးခိုင်းပါ\n\nဥပမာ (စာသားတိုက်ရိုက်):\n[Verse 1]\nနွေဦးလေညင်းသာ တိုက်ခတ်လာ\nစိတ်ထဲက ချစ်သူကို သတိရမိ\n\nဥပမာ (အကြောင်းအရာ):\nချစ်သူရဲ့ နွေဦးရာသီ အကြောင်း Ballad သီချင်းတစ်ပုဒ်`}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isLoading}
                className="min-h-[120px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
              />
              {topic.trim().length > 0 && (
                <p className="text-xs mt-1.5 font-myanmar text-muted-foreground">
                  {topic.split("\n").filter(l => l.trim()).length >= 4 || topic.length >= 200
                    ? "✅ သီချင်းစာသား အနေနဲ့ တိုက်ရိုက်သုံးပါမည်"
                    : "💡 AI မှ သီချင်းစာသား ရေးပေးပါမည်"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎸 Genre</label>
                <Select value={genre} onValueChange={setGenre} disabled={isLoading}>
                  <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{GENRE_OPTIONS.map((g) => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎭 Mood</label>
                <Select value={mood} onValueChange={setMood} disabled={isLoading}>
                  <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{MOOD_OPTIONS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🌐 ဘာသာစကား</label>
                <Select value={language} onValueChange={setLanguage} disabled={isLoading}>
                  <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGE_OPTIONS.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              {(serviceOption === "full_auto") && (
                <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                  <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎨 MTV Style</label>
                  <Select value={mtvStyle} onValueChange={setMtvStyle} disabled={isLoading}>
                    <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{MTV_STYLE_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {serviceOption === "full_auto" && (
              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <label className="block text-sm font-medium text-primary mb-2 font-myanmar">⏱️ ဗီဒီယို အရှည်</label>
                <Select value={videoDuration} onValueChange={setVideoDuration} disabled={isLoading}>
                  <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{DURATION_OPTIONS.map((d) => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}

            {serviceOption === "full_auto" && (
              <>
                <div className="gradient-card rounded-2xl p-3 border border-primary/20 flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-primary font-myanmar">📝 စာတန်းထိုးမည်</label>
                    {!showSubtitles && (
                      <p className="text-[10px] text-green-500 font-myanmar">💰 15% discount applied!</p>
                    )}
                  </div>
                  <button onClick={() => setShowSubtitles(!showSubtitles)} disabled={isLoading} className={`w-12 h-6 rounded-full transition-colors ${showSubtitles ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${showSubtitles ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {showSubtitles && (
                  <div className="gradient-card rounded-2xl p-3 border border-primary/20">
                    <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎨 စာတန်း အရောင်</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "#FFFFFF", label: "အဖြူ" },
                        { value: "#FFFF00", label: "အဝါ" },
                        { value: "#00FFFF", label: "Cyan" },
                        { value: "#00FF00", label: "အစိမ်း" },
                        { value: "#FF0000", label: "အနီ" },
                        { value: "#4488FF", label: "အပြာ" },
                        { value: "#FF8800", label: "လိမ္မော်" },
                        { value: "#FF69B4", label: "ပန်းရောင်" },
                        { value: "#AA55FF", label: "ခရမ်း" },
                        { value: "#000000", label: "အမည်း" },
                      ].map(c => (
                        <button key={c.value} onClick={() => setSubtitleColor(c.value)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${subtitleColor === c.value ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border/50"}`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {serviceOption === "mtv_only" && (
          <motion.div key="audio-input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
                <Mic2 className="w-4 h-4 inline mr-1" />
                အသံဖိုင် ထည့်ပါ
              </label>
              {audioFile ? (
                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/30">
                  <div className="flex items-center gap-2">
                    <Music className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground truncate max-w-[200px]">{audioFileName}</span>
                  </div>
                  <button onClick={() => { setAudioFile(null); setAudioFileName(""); }} className="p-1 bg-destructive rounded-full text-destructive-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button onClick={() => audioInputRef.current?.click()} disabled={isLoading} className="w-full h-24 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
                  <Upload className="w-6 h-6 text-primary" />
                  <span className="text-xs text-muted-foreground font-myanmar">MP3, WAV ဖိုင်ထည့်ရန်</span>
                </button>
              )}
              <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎨 MTV Style</label>
                <Select value={mtvStyle} onValueChange={setMtvStyle} disabled={isLoading}>
                  <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{MTV_STYLE_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🌐 ဘာသာစကား</label>
                <Select value={language} onValueChange={setLanguage} disabled={isLoading}>
                  <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGE_OPTIONS.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <label className="block text-sm font-medium text-primary mb-2 font-myanmar">⏱️ ဗီဒီယို အရှည်</label>
              <Select value={videoDuration} onValueChange={setVideoDuration} disabled={isLoading}>
                <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{DURATION_OPTIONS.map((d) => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>

            <div className="gradient-card rounded-2xl p-3 border border-primary/20 flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-primary font-myanmar">📝 စာတန်းထိုးမည်</label>
                {!showSubtitles && (
                  <p className="text-[10px] text-green-500 font-myanmar">💰 15% discount applied!</p>
                )}
              </div>
              <button onClick={() => setShowSubtitles(!showSubtitles)} disabled={isLoading} className={`w-12 h-6 rounded-full transition-colors ${showSubtitles ? "bg-primary" : "bg-muted"}`}>
                <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${showSubtitles ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            {showSubtitles && (
              <div className="gradient-card rounded-2xl p-3 border border-primary/20">
                <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎨 စာတန်း အရောင်</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "#FFFFFF", label: "အဖြူ" },
                    { value: "#FFFF00", label: "အဝါ" },
                    { value: "#00FFFF", label: "Cyan" },
                    { value: "#00FF00", label: "အစိမ်း" },
                    { value: "#FF0000", label: "အနီ" },
                    { value: "#4488FF", label: "အပြာ" },
                    { value: "#FF8800", label: "လိမ္မော်" },
                    { value: "#FF69B4", label: "ပန်းရောင်" },
                    { value: "#AA55FF", label: "ခရမ်း" },
                    { value: "#000000", label: "အမည်း" },
                  ].map(c => (
                    <button key={c.value} onClick={() => setSubtitleColor(c.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${subtitleColor === c.value ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border/50"}`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cost Summary */}
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
            <span className="font-myanmar">{statusText}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {pollingJobId && (
            <p className="text-[10px] text-muted-foreground text-center font-myanmar">
              🔄 နောက်ကွယ်မှ ဖန်တီးနေပါသည်... ဤစာမျက်နှာကို မပိတ်ပါနှင့်
            </p>
          )}
        </motion.div>
      )}

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isLoading} className="w-full btn-gradient-green py-4 rounded-2xl font-semibold font-myanmar">
        {isLoading ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />ဖန်တီးနေသည်...</>
        ) : (
          <><Sparkles className="w-5 h-5 mr-2" />ဖန်တီးမည် ({creditCost} Credit)</>
        )}
      </Button>

      {/* Results */}
      {(resultAudio || resultVideo || resultLyrics) && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
          {resultLyrics && (
            <div className="gradient-card rounded-2xl p-4 border border-primary/30">
              <h3 className="text-sm font-semibold text-primary mb-2 font-myanmar">📝 သီချင်းစာသား</h3>
              <p className="text-xs text-foreground whitespace-pre-wrap font-myanmar">{resultLyrics}</p>
            </div>
          )}

          {resultAudio && (
            <div className="gradient-card rounded-2xl p-4 border border-primary/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-primary font-myanmar">🎵 သီချင်း</h3>
                <Button onClick={() => downloadAudio(resultAudio, "song")} size="sm" variant="outline" className="text-xs">
                  <Download className="w-3 h-3 mr-1" />Download
                </Button>
              </div>
              <audio controls className="w-full" src={resultAudio} />
            </div>
          )}

          {resultVideo && (
            <div className="gradient-card rounded-2xl p-4 border border-primary/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-primary font-myanmar">🎬 MTV Video</h3>
                <Button onClick={() => downloadVideo(resultVideo, "mtv")} size="sm" variant="outline" className="text-xs">
                  <Download className="w-3 h-3 mr-1" />Download
                </Button>
              </div>
              <video controls className="w-full rounded-xl" src={resultVideo} />
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};
