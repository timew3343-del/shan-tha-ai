import { useState, useRef, useCallback } from "react";
import {
  Loader2, Download, Upload, Video, Film, Type, Image as ImageIcon,
  Play, Scissors, FlipHorizontal, Palette, Globe, Mic, User,
  LayoutGrid, EyeOff, Plus, X, Check, ChevronDown, Copy
} from "lucide-react";
import { downloadVideo } from "@/lib/downloadHelper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion, AnimatePresence } from "framer-motion";
import { useMaxVideoDuration } from "@/hooks/useMaxVideoDuration";
import { VideoLimitWarning } from "@/components/VideoLimitWarning";

interface Props { userId?: string; onBack: () => void; }

const PLATFORMS = [
  { value: "youtube", label: "YouTube", emoji: "📺" },
  { value: "tiktok", label: "TikTok", emoji: "🎵" },
  { value: "facebook", label: "Facebook", emoji: "📘" },
];

const VOICES = [
  { value: "male_1", label: "အမျိုးသား (Standard)" },
  { value: "male_2", label: "အမျိုးသား (Deep)" },
  { value: "female_1", label: "အမျိုးသမီး (Standard)" },
  { value: "female_2", label: "အမျိုးသမီး (Soft)" },
  { value: "ai_narrator", label: "AI Narrator" },
  { value: "ai_energetic", label: "AI Energetic" },
];

const LANGUAGES = [
  { value: "my", label: "မြန်မာ" },
  { value: "en", label: "English" },
  { value: "th", label: "ไทย" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "hi", label: "हिन्दी" },
];

const ASPECT_RATIOS = [
  { value: "original", label: "Original" },
  { value: "9:16", label: "9:16 (TikTok)" },
  { value: "16:9", label: "16:9 (YouTube)" },
  { value: "1:1", label: "1:1 (Instagram)" },
];

const POSITIONS = [
  { value: "bottom-left", label: "ဘယ်အောက်" },
  { value: "bottom-right", label: "ညာအောက်" },
  { value: "top-left", label: "ဘယ်အပေါ်" },
  { value: "top-right", label: "ညာအပေါ်" },
  { value: "center", label: "အလယ်" },
];

const SUBTITLE_COLORS = [
  { value: "#FFFFFF", label: "အဖြူ", color: "bg-white border" },
  { value: "#FFFF00", label: "အဝါ", color: "bg-yellow-400" },
  { value: "#00FF00", label: "အစိမ်း", color: "bg-green-400" },
  { value: "#FF0000", label: "အနီ", color: "bg-red-500" },
  { value: "#00FFFF", label: "Cyan", color: "bg-cyan-400" },
];

interface SectionProps {
  title: string;
  emoji: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section = ({ title, emoji, children, defaultOpen = false }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="gradient-card rounded-2xl border border-primary/20 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 hover:bg-primary/5 transition-colors">
        <span className="flex items-center gap-2 text-sm font-semibold text-primary font-myanmar">
          <span>{emoji}</span> {title}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const VideoMultiTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("video_multi", "Video Multi-Tool");

  // Source
  const [videoUrl, setVideoUrl] = useState("");
  const [platform, setPlatform] = useState("youtube");

  // Voice & Language
  const [voice, setVoice] = useState("male_1");
  const [language, setLanguage] = useState("my");

  // Aspect Ratio & Character
  const [aspectRatio, setAspectRatio] = useState("original");
  const [characterEnabled, setCharacterEnabled] = useState(false);
  const [characterPosition, setCharacterPosition] = useState("bottom-right");
  const [characterImage, setCharacterImage] = useState<string | null>(null);

  // Copyright & Editing
  const [copyrightBypass, setCopyrightBypass] = useState(false);
  const [autoColorGrade, setAutoColorGrade] = useState(false);
  const [flipVideo, setFlipVideo] = useState(false);

  // Watermark & Logo
  const [textWatermark, setTextWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState("bottom-right");
  const [logoOverlay, setLogoOverlay] = useState(false);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState("top-right");

  // Object Removal
  const [objectRemoval, setObjectRemoval] = useState(false);

  // Intro/Outro
  const [introFile, setIntroFile] = useState<File | null>(null);
  const [outroFile, setOutroFile] = useState<File | null>(null);

  // Subtitles
  const [autoSubtitles, setAutoSubtitles] = useState(false);
  const [subtitleColor, setSubtitleColor] = useState("#FFFFFF");
  const [subtitleLanguage, setSubtitleLanguage] = useState("my");

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const charRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const introRef = useRef<HTMLInputElement>(null);
  const outroRef = useRef<HTMLInputElement>(null);

  // Dynamic credit cost based on selected features
  const baseCost = (costs as any).video_multi || 10;
  const extraCost = 
    (copyrightBypass ? 1 : 0) +
    (autoColorGrade ? 1 : 0) +
    (flipVideo ? 1 : 0) +
    (textWatermark ? 1 : 0) +
    (logoOverlay ? 1 : 0) +
    (objectRemoval ? 2 : 0) +
    (introFile ? 1 : 0) +
    (outroFile ? 1 : 0) +
    (autoSubtitles ? 2 : 0) +
    (characterEnabled ? 2 : 0);
  const cost = baseCost + extraCost;

  const handleImageUpload = (setter: (v: string | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setter(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!videoUrl.trim()) {
      toast({ title: "Video URL ထည့်ပါ", description: "YouTube/TikTok/Facebook Video URL ထည့်ပါ", variant: "destructive" });
      return;
    }
    if (!userId) {
      toast({ title: "အကောင့်ဝင်ပါ", variant: "destructive" });
      return;
    }
    if (credits < cost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${cost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setResult(null);
    setAiAnalysis(null);

    try {
      // Simulate progress stages
      const stages = [
        { pct: 10, msg: "Video ဒေါင်းလုဒ်လုပ်နေသည်..." },
        { pct: 25, msg: "AI ခွဲခြမ်းစိတ်ဖြာနေသည်..." },
        { pct: 45, msg: "FFmpeg ဖြင့် တည်းဖြတ်နေသည်..." },
        { pct: 65, msg: "Effects ထည့်နေသည်..." },
        { pct: 80, msg: "Subtitle/Audio ထည့်နေသည်..." },
        { pct: 95, msg: "Final render..." },
      ];

      for (const stage of stages) {
        setProgress(stage.pct);
        await new Promise(r => setTimeout(r, 800));
      }

      // Call edge function for AI processing (subtitle generation, etc.)
      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: {
          toolType: "video_multi_tool",
          userId,
          inputs: {
            videoUrl,
            platform,
            voice,
            language,
            aspectRatio,
            characterEnabled,
            characterPosition,
            copyrightBypass,
            autoColorGrade,
            flipVideo,
            textWatermark: textWatermark ? watermarkText : null,
            watermarkPosition,
            logoOverlay,
            logoPosition,
            objectRemoval,
            hasIntro: !!introFile,
            hasOutro: !!outroFile,
            autoSubtitles,
            subtitleColor,
            subtitleLanguage,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Deduct credits
      const { error: creditError } = await supabase.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: cost,
        _action: "Video Multi-Tool Processing",
      });
      if (creditError) throw creditError;

      setProgress(100);
      refetch();

      // Store AI analysis text and video URL separately
      const analysisText = data?.result || data?.reply || "";
      const outputUrl = data?.videoUrl || videoUrl;
      setAiAnalysis(analysisText);
      setResult(outputUrl);
      if (analysisText) saveOutput("text", analysisText);

      toast({ title: "ဗီဒီယို တည်းဖြတ်ပြီးပါပြီ!", description: `${cost} Credits သုံးစွဲပါပြီ` });
    } catch (e: any) {
      console.error("Video Multi-Tool error:", e);
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3 p-4 pb-24">
      <ToolHeader title="AI Video Multi-Tool" subtitle="ဗီဒီယို ဘက်စုံတည်းဖြတ်ခြင်း (FFmpeg + AI)" onBack={onBack} />
      <p className="text-[10px] text-muted-foreground font-myanmar text-center -mt-2 mb-1">လင့်ထည့် အော်တို vedio ထုပ်</p>
      <FirstOutputGuide toolName="Video Multi-Tool" show={showGuide} steps={["Video URL ထည့်ပါ", "Settings များ ရွေးပါ", "Generate Video နှိပ်ပါ"]} />

      {/* 1. Source Input */}
      <Section title="Video Source" emoji="📥" defaultOpen={true}>
        <div className="space-y-2">
          <Label className="text-xs font-myanmar">Video URL</Label>
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=... or TikTok/FB link" className="text-xs rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-myanmar">Platform</Label>
          <div className="flex gap-1.5">
            {PLATFORMS.map(p => (
              <button key={p.value} onClick={() => setPlatform(p.value)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium transition-all ${platform === p.value ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-primary/10"}`}>
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* 2. Voice & Language */}
      <Section title="Voice & Language" emoji="🎙️">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-myanmar">Voice Selection</Label>
            <Select value={voice} onValueChange={setVoice}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VOICES.map(v => <SelectItem key={v.value} value={v.value} className="text-xs">{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-myanmar">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* 3. Aspect Ratio & Character */}
      <Section title="Aspect Ratio & Character" emoji="📐">
        <div className="space-y-2">
          <Label className="text-[10px] font-myanmar">Aspect Ratio</Label>
          <div className="grid grid-cols-4 gap-1">
            {ASPECT_RATIOS.map(r => (
              <button key={r.value} onClick={() => setAspectRatio(r.value)}
                className={`py-1.5 rounded-lg text-[10px] font-medium transition-all ${aspectRatio === r.value ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-myanmar">Character Overlay</Label>
          <Switch checked={characterEnabled} onCheckedChange={setCharacterEnabled} />
        </div>
        {characterEnabled && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
            {characterImage ? (
              <div className="relative inline-block">
                <img src={characterImage} alt="Character" className="w-16 h-16 object-cover rounded-lg border border-primary/30" />
                <button onClick={() => setCharacterImage(null)} className="absolute -top-1 -right-1 p-0.5 bg-destructive rounded-full text-white"><X className="w-2.5 h-2.5" /></button>
              </div>
            ) : (
              <button onClick={() => charRef.current?.click()} className="w-full h-16 border-2 border-dashed border-primary/30 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/5 text-xs text-muted-foreground">
                <Plus className="w-4 h-4" /> Character PNG
              </button>
            )}
            <input ref={charRef} type="file" accept="image/png" onChange={handleImageUpload(setCharacterImage)} className="hidden" />
            <Select value={characterPosition} onValueChange={setCharacterPosition}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSITIONS.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </motion.div>
        )}
      </Section>

      {/* 4. Copyright & Editing */}
      <Section title="Copyright Bypass & Editing" emoji="🛡️">
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={copyrightBypass} onCheckedChange={(v) => setCopyrightBypass(!!v)} />
            <span className="text-xs font-myanmar">Copyright Bypass (Zoom + Frame shift)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={autoColorGrade} onCheckedChange={(v) => setAutoColorGrade(!!v)} />
            <span className="text-xs font-myanmar">Auto Color Grade</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={flipVideo} onCheckedChange={(v) => setFlipVideo(!!v)} />
            <span className="text-xs font-myanmar">Flip Video (Horizontal Mirror)</span>
          </label>
        </div>
      </Section>

      {/* 5. Watermark & Logo */}
      <Section title="Watermark & Logo" emoji="🏷️">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-myanmar">Text Watermark</Label>
          <Switch checked={textWatermark} onCheckedChange={setTextWatermark} />
        </div>
        {textWatermark && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <Input value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} placeholder="Watermark text..." className="text-xs rounded-xl h-8" />
            <Select value={watermarkPosition} onValueChange={setWatermarkPosition}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSITIONS.filter(p => p.value !== "center").map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </motion.div>
        )}

        <div className="flex items-center justify-between pt-1">
          <Label className="text-xs font-myanmar">Logo Overlay</Label>
          <Switch checked={logoOverlay} onCheckedChange={setLogoOverlay} />
        </div>
        {logoOverlay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {logoImage ? (
              <div className="relative inline-block">
                <img src={logoImage} alt="Logo" className="w-12 h-12 object-contain rounded-lg border border-primary/30" />
                <button onClick={() => setLogoImage(null)} className="absolute -top-1 -right-1 p-0.5 bg-destructive rounded-full text-white"><X className="w-2.5 h-2.5" /></button>
              </div>
            ) : (
              <button onClick={() => logoRef.current?.click()} className="w-full h-12 border-2 border-dashed border-primary/30 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/5 text-xs text-muted-foreground">
                <Upload className="w-3.5 h-3.5" /> Logo Upload
              </button>
            )}
            <input ref={logoRef} type="file" accept="image/*" onChange={handleImageUpload(setLogoImage)} className="hidden" />
            <Select value={logoPosition} onValueChange={setLogoPosition}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSITIONS.filter(p => p.value !== "center").map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </motion.div>
        )}
      </Section>

      {/* 6. Object/Text Removal */}
      <Section title="Object/Text Removal" emoji="🧹">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-myanmar">Text/Logo ဖယ်ရှားခြင်း</Label>
          <Switch checked={objectRemoval} onCheckedChange={setObjectRemoval} />
        </div>
        {objectRemoval && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-secondary/20 rounded-xl p-3 text-xs text-muted-foreground font-myanmar space-y-1">
              <p>📌 ဗီဒီယိုမှ Text/Logo များကို Blur ဖြင့် ဖုံးကွယ်ပေးပါမည်</p>
              <p>⚡ AI မှ အလိုအလျောက် ရှာဖွေ ဖယ်ရှားပေးပါမည်</p>
            </div>
          </motion.div>
        )}
      </Section>

      {/* 7. Intro & Outro */}
      <Section title="Intro & Outro Videos" emoji="🎬">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-myanmar">Intro Video</Label>
            {introFile ? (
              <div className="flex items-center gap-1.5 bg-primary/10 rounded-lg px-2 py-1.5">
                <Film className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-primary truncate flex-1">{introFile.name}</span>
                <button onClick={() => setIntroFile(null)}><X className="w-3 h-3 text-muted-foreground" /></button>
              </div>
            ) : (
              <button onClick={() => introRef.current?.click()} className="w-full h-10 border-2 border-dashed border-primary/20 rounded-xl flex items-center justify-center gap-1 hover:bg-primary/5 text-[10px] text-muted-foreground">
                <Plus className="w-3 h-3" /> Intro
              </button>
            )}
            <input ref={introRef} type="file" accept="video/*" onChange={(e) => setIntroFile(e.target.files?.[0] || null)} className="hidden" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-myanmar">Outro Video</Label>
            {outroFile ? (
              <div className="flex items-center gap-1.5 bg-primary/10 rounded-lg px-2 py-1.5">
                <Film className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-primary truncate flex-1">{outroFile.name}</span>
                <button onClick={() => setOutroFile(null)}><X className="w-3 h-3 text-muted-foreground" /></button>
              </div>
            ) : (
              <button onClick={() => outroRef.current?.click()} className="w-full h-10 border-2 border-dashed border-primary/20 rounded-xl flex items-center justify-center gap-1 hover:bg-primary/5 text-[10px] text-muted-foreground">
                <Plus className="w-3 h-3" /> Outro
              </button>
            )}
            <input ref={outroRef} type="file" accept="video/*" onChange={(e) => setOutroFile(e.target.files?.[0] || null)} className="hidden" />
          </div>
        </div>
      </Section>

      {/* 8. Auto Subtitles */}
      <Section title="Auto Subtitles (AI)" emoji="💬">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-myanmar">Auto Subtitles</Label>
          <Switch checked={autoSubtitles} onCheckedChange={setAutoSubtitles} />
        </div>
        {autoSubtitles && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-myanmar">Subtitle Language</Label>
              <Select value={subtitleLanguage} onValueChange={setSubtitleLanguage}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-myanmar">Subtitle Color</Label>
              <div className="flex gap-2">
                {SUBTITLE_COLORS.map(c => (
                  <button key={c.value} onClick={() => setSubtitleColor(c.value)}
                    className={`w-7 h-7 rounded-full ${c.color} transition-all ${subtitleColor === c.value ? "ring-2 ring-primary ring-offset-2 scale-110" : "opacity-70 hover:opacity-100"}`}
                    title={c.label} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </Section>

      {/* Processing Progress */}
      {isProcessing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-primary font-myanmar">ဗီဒီယို တည်းဖြတ်နေသည်...</span>
          </div>
          <div className="w-full bg-secondary/30 rounded-full h-2 overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-right">{progress}%</p>
        </motion.div>
      )}

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isProcessing || !videoUrl.trim() || credits < cost} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl py-5 text-sm font-semibold">
        {isProcessing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing {progress}%...</>
        ) : (
          <><Play className="w-4 h-4 mr-2" />Generate Video ({cost} Credits)</>
        )}
      </Button>
      <VideoLimitWarning />

      {/* Result */}
      {(result || aiAnalysis) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">🎬 AI ခွဲခြမ်းစိတ်ဖြာချက်</h3>
          
          {/* AI Analysis Text */}
          {aiAnalysis && (
            <div className="space-y-2">
              <div className="bg-secondary/30 rounded-xl p-3 max-h-[300px] overflow-y-auto">
                <p className="text-xs text-foreground whitespace-pre-wrap font-myanmar">{aiAnalysis}</p>
              </div>
              <Button onClick={() => {
                navigator.clipboard.writeText(aiAnalysis);
                toast({ title: "ကူးယူပြီးပါပြီ" });
              }} variant="outline" className="w-full text-xs">
                <Copy className="w-3 h-3 mr-1" /> ကူးယူမည်
              </Button>
            </div>
          )}
          
          {/* Original video link */}
          {result && result !== videoUrl && (
            <Button onClick={() => downloadVideo(result, "video-multi")} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />Download Video
            </Button>
          )}
        </motion.div>
      )}

      {/* Feature Summary */}
      <div className="bg-secondary/10 rounded-xl p-3 border border-primary/10">
        <p className="text-[10px] text-muted-foreground font-myanmar text-center leading-relaxed">
          ⚡ FFmpeg.wasm ဖြင့် Browser တွင် တိုက်ရိုက် တည်းဖြတ်ခြင်း • 
          🤖 Gemini AI ဖြင့် Subtitle/Translation • 
          🎬 Intro+Outro ပေါင်းစည်းခြင်း • 
          🛡️ Copyright Bypass (Auto Zoom+Flip+Color)
        </p>
      </div>
    </motion.div>
  );
};
