import { useState, useRef, useEffect } from "react";
import { Video, Upload, Sparkles, Download, Loader2, X, Clock, Music } from "lucide-react";
import { downloadVideo } from "@/lib/downloadHelper";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
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
import { useToolOutput } from "@/hooks/useToolOutput";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";

interface VideoToolProps {
  userId?: string;
  onBack: () => void;
}

const MUSIC_STYLES = [
  { value: "cinematic_epic", label: "🎬 Cinematic Epic" },
  { value: "cinematic_emotional", label: "🎭 Cinematic Emotional" },
  { value: "upbeat_pop", label: "🎵 Upbeat Pop" },
  { value: "chill_lofi", label: "☕ Chill Lo-Fi" },
  { value: "ambient_relaxing", label: "🌊 Ambient Relaxing" },
  { value: "corporate", label: "💼 Corporate / Business" },
  { value: "inspiring", label: "✨ Inspiring / Motivational" },
  { value: "romantic", label: "❤️ Romantic" },
  { value: "suspense", label: "🎭 Suspense / Thriller" },
  { value: "happy_cheerful", label: "😊 Happy & Cheerful" },
  { value: "sad_melancholy", label: "😢 Sad & Melancholy" },
  { value: "electronic_dance", label: "🎧 Electronic / Dance" },
  { value: "acoustic", label: "🎸 Acoustic" },
  { value: "jazz", label: "🎷 Jazz" },
  { value: "classical", label: "🎻 Classical" },
  { value: "hip_hop", label: "🎤 Hip Hop" },
  { value: "rock", label: "🎸 Rock" },
  { value: "country", label: "🤠 Country" },
  { value: "rnb", label: "🎶 R&B / Soul" },
  { value: "world_music", label: "🌍 World Music" },
  { value: "myanmar_traditional", label: "🇲🇲 Myanmar Traditional" },
  { value: "meditation", label: "🧘 Meditation" },
  { value: "nature_sounds", label: "🌿 Nature Sounds" },
  { value: "christmas", label: "🎄 Christmas / Holiday" },
  { value: "action", label: "💥 Action / Intense" },
];

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
  const { showGuide, markAsLearned, saveOutput } = useToolOutput("video-gen", "Image to Video");

  // New toggles
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(false);
  const [bgMusicEnabled, setBgMusicEnabled] = useState(false);
  const [musicStyle, setMusicStyle] = useState("cinematic_epic");

  // Dynamic credit calculation
  const baseCredits = costs.video_generation || 15;
  const voiceoverExtra = voiceoverEnabled ? (costs.video_with_speech - costs.video_generation) || 5 : 0;
  const musicExtra = bgMusicEnabled ? 3 : 0;
  const totalCredits = baseCredits + voiceoverExtra + musicExtra;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      const statuses = ["ပုံကို ပြင်ဆင်နေသည်...", "AI မော်ဒယ်သို့ ပို့နေသည်...", "ဗီဒီယိုထုတ်နေသည်...", "အပြီးသတ်နေသည်..."];
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
      reader.onload = (event) => setUploadedImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast({ title: "ပုံထည့်ရန်လိုအပ်ပါသည်", variant: "destructive" });
      return;
    }

    if (credits < totalCredits) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${totalCredits} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setGeneratedVideo(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" });
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
            speechText: voiceoverEnabled ? speechText.trim() || undefined : undefined,
            duration: parseInt(duration),
            bgMusic: bgMusicEnabled ? musicStyle : undefined,
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
      saveOutput("video", result.video);
      
      toast({ title: "အောင်မြင်ပါသည်", description: `ဗီဒီယိုထုတ်ပြီးပါပြီ (${result.creditsUsed} Credits)` });
    } catch (error: any) {
      console.error("Video generation error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
      <ToolHeader 
        title="Image to Video & Voiceover & Music" 
        subtitle="ပုံ မှ ဗီဒီယို၊ စကားပြောအသံ နှင့် နောက်ခံတီးလုံး ထည့်သွင်းခြင်း"
        onBack={onBack} 
      />

      <FirstOutputGuide toolName="Image to Video" steps={["ပုံထည့်ပါ", "Options ရွေးပါ", "Generate နှိပ်ပါ"]} show={showGuide} onDismiss={markAsLearned} />

      {/* Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">ပုံထည့်ရန် (လိုအပ်သည်)</label>
        {uploadedImage ? (
          <div className="relative inline-block">
            <img src={uploadedImage} alt="Uploaded" className="w-full max-w-[200px] h-auto object-cover rounded-xl border border-primary/30" />
            <button onClick={removeImage} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ပုံထည့်ရန် နှိပ်ပါ</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </div>

      {/* Duration Selector */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          <Clock className="w-4 h-4 inline mr-1" />
          ဗီဒီယိုအရှည်
        </label>
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger className="bg-background/50 border-primary/30"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">၃ စက္ကန့်</SelectItem>
            <SelectItem value="5">၅ စက္ကန့်</SelectItem>
            <SelectItem value="10">၁၀ စက္ကန့်</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Prompt */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">ဗီဒီယိုဖော်ပြချက် (Optional)</label>
        <Textarea
          placeholder="ဥပမာ - လှေတစ်စင်း ပင်လယ်ပေါ်မှာ မျှောနေသည်..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[60px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
        />
      </div>

      {/* Voiceover Toggle */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-primary font-myanmar">🎙️ Voiceover</label>
          <Switch checked={voiceoverEnabled} onCheckedChange={setVoiceoverEnabled} />
        </div>
        {voiceoverEnabled && (
          <Textarea
            placeholder="ဗီဒီယိုတွင် ထည့်သွင်းစေချင်သော အသံစာသား..."
            value={speechText}
            onChange={(e) => setSpeechText(e.target.value)}
            className="min-h-[60px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
          />
        )}
        <p className="text-[10px] text-muted-foreground font-myanmar">
          {voiceoverEnabled ? `+${voiceoverExtra} Credits ပိုကုန်ပါမည်` : "ပိတ်ထားပါသည်"}
        </p>
      </div>

      {/* Background Music Toggle */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-primary font-myanmar flex items-center gap-2">
            <Music className="w-4 h-4" />
            Background Music
          </label>
          <Switch checked={bgMusicEnabled} onCheckedChange={setBgMusicEnabled} />
        </div>
        {bgMusicEnabled && (
          <Select value={musicStyle} onValueChange={setMusicStyle}>
            <SelectTrigger className="bg-background/50 border-primary/30"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {MUSIC_STYLES.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-[10px] text-muted-foreground font-myanmar">
          {bgMusicEnabled ? `+${musicExtra} Credits ပိုကုန်ပါမည်` : "ပိတ်ထားပါသည်"}
        </p>
      </div>

      {/* Dynamic Cost Display */}
      <div className="bg-secondary/30 rounded-xl p-3 border border-primary/10">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-myanmar">စုစုပေါင်း Credit</span>
          <span className="font-bold text-primary text-lg">{totalCredits} Credits</span>
        </div>
        <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
          <div className="flex justify-between"><span>Base Video ({duration}s)</span><span>{baseCredits} Cr</span></div>
          {voiceoverEnabled && <div className="flex justify-between"><span>Voiceover</span><span>+{voiceoverExtra} Cr</span></div>}
          {bgMusicEnabled && <div className="flex justify-between"><span>Background Music</span><span>+{musicExtra} Cr</span></div>}
        </div>
      </div>

      {/* Progress */}
      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">{statusText || "ဗီဒီယိုထုတ်နေသည်..."}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isLoading || !uploadedImage} className="w-full btn-gradient-red py-4 rounded-2xl font-semibold font-myanmar">
        {isLoading ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />ဗီဒီယိုထုတ်နေသည်...</>
        ) : (
          <><Video className="w-5 h-5 mr-2" />ဗီဒီယိုထုတ်မည် ({totalCredits} Credits)</>
        )}
      </Button>

      {/* Result */}
      {generatedVideo && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="gradient-card rounded-2xl p-4 border border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary font-myanmar">ရလဒ်</h3>
            </div>
            <Button
              onClick={() => downloadVideo(generatedVideo, "generated-video")}
              size="sm" variant="outline" className="text-xs font-myanmar"
            >
              <Download className="w-3 h-3 mr-1" />Download
            </Button>
          </div>
          <Watermark userId={userId} type="video">
            <video src={generatedVideo} controls autoPlay muted className="w-full rounded-xl border border-border" />
          </Watermark>
        </motion.div>
      )}
    </motion.div>
  );
};
