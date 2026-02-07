import { useState, useRef } from "react";
import { Music, Video, Sparkles, Download, Loader2, Upload, X, Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
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

export const SongMTVTool = ({ userId, onBack }: SongMTVToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();

  const [serviceOption, setServiceOption] = useState<ServiceOption>("song_only");
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState("pop");
  const [mood, setMood] = useState("happy");
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const [resultAudio, setResultAudio] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [resultLyrics, setResultLyrics] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);

  const getCreditCost = () => {
    switch (serviceOption) {
      case "song_only": return costs.song_mtv || 20;
      case "mtv_only": return Math.ceil((costs.song_mtv || 20) * 1.2);
      case "full_auto": return Math.ceil((costs.song_mtv || 20) * 2);
      default: return costs.song_mtv || 20;
    }
  };

  const creditCost = getCreditCost();

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
    setProgress(0);

    const statusMessages: Record<ServiceOption, string[]> = {
      song_only: ["စာသားဖန်တီးနေသည်...", "သီချင်းထုတ်နေသည်...", "အပြီးသတ်နေသည်..."],
      mtv_only: ["ဗီဒီယို ဖန်တီးနေသည်...", "MTV ဗီဒီယို တည်းဖြတ်နေသည်...", "အပြီးသတ်နေသည်..."],
      full_auto: ["စာသားဖန်တီးနေသည်...", "သီချင်းထုတ်နေသည်...", "MTV ဗီဒီယို တည်းဖြတ်နေသည်...", "အပြီးသတ်နေသည်..."],
    };

    let statusIdx = 0;
    const statuses = statusMessages[serviceOption];
    setStatusText(statuses[0]);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95;
        const next = prev + Math.random() * 3;
        const newIdx = Math.min(Math.floor(next / (100 / statuses.length)), statuses.length - 1);
        if (newIdx !== statusIdx) {
          statusIdx = newIdx;
          setStatusText(statuses[statusIdx]);
        }
        return next;
      });
    }, 2000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-song`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            serviceOption,
            topic: topic.trim(),
            genre,
            mood,
            audioBase64: serviceOption === "mtv_only" ? audioFile?.split(",")[1] : undefined,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Generation failed");

      if (result.audio) setResultAudio(result.audio);
      if (result.video) setResultVideo(result.video);
      if (result.lyrics) setResultLyrics(result.lyrics);
      setProgress(100);
      refetchCredits();

      toast({ title: "အောင်မြင်ပါသည် 🎵", description: `${result.creditsUsed} Credits အသုံးပြုပြီးပါပြီ` });
    } catch (error: any) {
      console.error("Song/MTV error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
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

      {/* Service Options */}
      <div className="grid grid-cols-3 gap-2">
        {SERVICE_OPTIONS.map((opt) => (
          <motion.button
            key={opt.id}
            onClick={() => setServiceOption(opt.id)}
            whileTap={{ scale: 0.95 }}
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
                placeholder="ဥပမာ - ချစ်သူရဲ့ နွေဦးရာသီ အကြောင်း Ballad သီချင်းတစ်ပုဒ် ရေးပေးပါ..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="min-h-[100px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎸 Genre</label>
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger className="bg-background/50 border-primary/30 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRE_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <label className="block text-sm font-medium text-primary mb-2 font-myanmar">🎭 Mood</label>
                <Select value={mood} onValueChange={setMood}>
                  <SelectTrigger className="bg-background/50 border-primary/30 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOOD_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        )}

        {serviceOption === "mtv_only" && (
          <motion.div key="audio-input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
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
                <button onClick={() => audioInputRef.current?.click()} className="w-full h-24 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
                  <Upload className="w-6 h-6 text-primary" />
                  <span className="text-xs text-muted-foreground font-myanmar">MP3, WAV ဖိုင်ထည့်ရန်</span>
                </button>
              )}
              <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
            </div>
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
                <Button onClick={() => { const a = document.createElement("a"); a.href = resultAudio; a.download = `song-${Date.now()}.mp3`; a.click(); }} size="sm" variant="outline" className="text-xs">
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
                <Button onClick={() => { const a = document.createElement("a"); a.href = resultVideo; a.download = `mtv-${Date.now()}.mp4`; a.click(); }} size="sm" variant="outline" className="text-xs">
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
