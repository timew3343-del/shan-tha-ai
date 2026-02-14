import { useState, useRef, useEffect } from "react";
import { Upload, Sparkles, Download, Loader2, X, Languages, AlertTriangle, Mic, Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";
import { useToolOutput } from "@/hooks/useToolOutput";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CaptionToolProps {
  userId?: string;
  onBack: () => void;
}

const LANGUAGES_LIST = [
  { value: "original", label: "🌐 မူရင်းအတိုင်း (ဘာသာမပြန်)" },
  { value: "my", label: "🇲🇲 မြန်မာဘာသာ" },
  { value: "en", label: "🇬🇧 English" },
  { value: "th", label: "🇹🇭 ไทย (Thai)" },
  { value: "ja", label: "🇯🇵 日本語 (Japanese)" },
  { value: "ko", label: "🇰🇷 한국어 (Korean)" },
  { value: "zh", label: "🇨🇳 中文 (Chinese)" },
  { value: "hi", label: "🇮🇳 हिन्दी (Hindi)" },
  { value: "ar", label: "🇸🇦 العربية (Arabic)" },
  { value: "fr", label: "🇫🇷 Français (French)" },
  { value: "de", label: "🇩🇪 Deutsch (German)" },
  { value: "es", label: "🇪🇸 Español (Spanish)" },
  { value: "pt", label: "🇧🇷 Português (Portuguese)" },
  { value: "ru", label: "🇷🇺 Русский (Russian)" },
  { value: "it", label: "🇮🇹 Italiano (Italian)" },
  { value: "vi", label: "🇻🇳 Tiếng Việt (Vietnamese)" },
  { value: "id", label: "🇮🇩 Bahasa Indonesia" },
  { value: "ms", label: "🇲🇾 Bahasa Melayu" },
  { value: "tl", label: "🇵🇭 Filipino/Tagalog" },
  { value: "tr", label: "🇹🇷 Türkçe (Turkish)" },
  { value: "pl", label: "🇵🇱 Polski (Polish)" },
  { value: "nl", label: "🇳🇱 Nederlands (Dutch)" },
  { value: "sv", label: "🇸🇪 Svenska (Swedish)" },
  { value: "da", label: "🇩🇰 Dansk (Danish)" },
  { value: "no", label: "🇳🇴 Norsk (Norwegian)" },
  { value: "fi", label: "🇫🇮 Suomi (Finnish)" },
  { value: "el", label: "🇬🇷 Ελληνικά (Greek)" },
  { value: "cs", label: "🇨🇿 Čeština (Czech)" },
  { value: "ro", label: "🇷🇴 Română (Romanian)" },
  { value: "hu", label: "🇭🇺 Magyar (Hungarian)" },
  { value: "uk", label: "🇺🇦 Українська (Ukrainian)" },
  { value: "bn", label: "🇧🇩 বাংলা (Bengali)" },
  { value: "ta", label: "🇮🇳 தமிழ் (Tamil)" },
  { value: "te", label: "🇮🇳 తెలుగు (Telugu)" },
  { value: "ur", label: "🇵🇰 اردو (Urdu)" },
  { value: "fa", label: "🇮🇷 فارسی (Persian)" },
  { value: "he", label: "🇮🇱 עברית (Hebrew)" },
  { value: "sw", label: "🇰🇪 Kiswahili (Swahili)" },
  { value: "am", label: "🇪🇹 አማርኛ (Amharic)" },
  { value: "km", label: "🇰🇭 ខ្មែរ (Khmer)" },
  { value: "lo", label: "🇱🇦 ລາວ (Lao)" },
  { value: "si", label: "🇱🇰 සිංහල (Sinhala)" },
  { value: "ne", label: "🇳🇵 नेपाली (Nepali)" },
  { value: "ka", label: "🇬🇪 ქართული (Georgian)" },
  { value: "hy", label: "🇦🇲 Հայերեն (Armenian)" },
  { value: "az", label: "🇦🇿 Azərbaycan (Azerbaijani)" },
  { value: "uz", label: "🇺🇿 Oʻzbek (Uzbek)" },
  { value: "kk", label: "🇰🇿 Қазақ (Kazakh)" },
  { value: "mn", label: "🇲🇳 Монгол (Mongolian)" },
  { value: "af", label: "🇿🇦 Afrikaans" },
];

const VOICE_STYLES = [
  { value: "professional_male", label: "👨‍💼 Professional Male" },
  { value: "professional_female", label: "👩‍💼 Professional Female" },
  { value: "warm_male", label: "🧑 Warm & Friendly Male" },
  { value: "warm_female", label: "👩 Warm & Friendly Female" },
  { value: "news_male", label: "📺 News Anchor Male" },
  { value: "news_female", label: "📺 News Anchor Female" },
  { value: "narrator_male", label: "📖 Deep Narrator Male" },
  { value: "narrator_female", label: "📖 Narrator Female" },
  { value: "young_male", label: "🧒 Young Energetic Male" },
  { value: "young_female", label: "👧 Young Energetic Female" },
];

export const CaptionTool = ({ userId, onBack }: CaptionToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [targetLang, setTargetLang] = useState("my");
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [srtResult, setSrtResult] = useState<string | null>(null);
  const [originalSrt, setOriginalSrt] = useState<string | null>(null);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { showGuide, markAsLearned, saveOutput } = useToolOutput("caption", "AI Caption & Translator");

  // Feature toggles
  const [captionEnabled, setCaptionEnabled] = useState(true);
  const [translatorEnabled, setTranslatorEnabled] = useState(false);
  const [translatorLang, setTranslatorLang] = useState("en");
  const [voiceStyle, setVoiceStyle] = useState("professional_male");
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("male");
  const [copyrightCheck, setCopyrightCheck] = useState(false);

  // Credit calculation
  const creditPerMinute = costs.caption_per_minute || 9;
  const baseCost = videoDuration > 0 ? Math.max(1, Math.ceil((videoDuration / 60) * creditPerMinute)) : 0;
  const translatorCost = translatorEnabled ? Math.ceil(baseCost * 0.5) : 0;
  const copyrightCost = copyrightCheck ? Math.ceil(baseCost * 0.3) : 0;
  const estimatedCost = baseCost + translatorCost + copyrightCost;
  const maxDurationSeconds = 60 * 60; // 60 minutes (1 hour)

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      const statuses = [
        "ဗီဒီယိုကို upload လုပ်နေသည်...",
        "အသံကို ဖမ်းယူနေသည် (Whisper AI)...",
        captionEnabled ? "စာတန်းထိုး ဖန်တီးနေသည်..." : "ဘာသာပြန်နေသည်...",
        translatorEnabled ? "AI Voice Dubbing လုပ်နေသည်..." : "အပြီးသတ်နေသည်...",
        copyrightCheck ? "Copyright စစ်ဆေးနေသည်..." : "အပြီးသတ်နေသည်...",
      ].filter(Boolean);
      let statusIndex = 0;
      setStatusText(statuses[0]);

      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + Math.random() * 2;
          if (newProgress >= 95) return 95;
          const newStatusIndex = Math.min(Math.floor(newProgress / (100 / statuses.length)), statuses.length - 1);
          if (newStatusIndex !== statusIndex) {
            statusIndex = newStatusIndex;
            setStatusText(statuses[statusIndex]);
          }
          return newProgress;
        });
      }, 3000);
    } else {
      setProgress(100);
      setStatusText("");
      const timeout = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timeout);
    }
    return () => clearInterval(interval);
  }, [isLoading, captionEnabled, translatorEnabled, copyrightCheck]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedVideo(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    setSrtResult(null);
    setOriginalSrt(null);
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const dur = Math.round(videoRef.current.duration);
      if (dur > maxDurationSeconds) {
        toast({
          title: "ဗီဒီယို ရှည်လွန်းပါသည်",
          description: `အများဆုံး ${maxDurationSeconds / 60} မိနစ်အထိသာ တင်နိုင်ပါသည်`,
          variant: "destructive",
        });
        removeVideo();
        return;
      }
      setVideoDuration(dur);
    }
  };

  const removeVideo = () => {
    setUploadedVideo(null);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    setVideoDuration(0);
    setSrtResult(null);
    setOriginalSrt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!uploadedVideo || !userId) return;

    if (estimatedCost > 0 && credits < estimatedCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `${estimatedCost} Credits လိုအပ်ပါသည် (လက်ရှိ: ${credits})`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setSrtResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" });
        return;
      }

      const fileName = `${userId}/caption-${Date.now()}.${uploadedVideo.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, uploadedVideo, { cacheControl: "3600", upsert: false });

      if (uploadError) throw new Error("ဗီဒီယို upload မအောင်မြင်ပါ");

      const { data: urlData } = supabase.storage.from("videos").getPublicUrl(fileName);
      const videoUrl = urlData.publicUrl;

      toast({ title: "Caption ထုတ်နေပါသည်", description: "ဗီဒီယို ကြာချိန်အလိုက် အချိန်ယူပါမည်" });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/caption-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            videoUrl,
            targetLanguage: captionEnabled ? targetLang : "original",
            videoDuration,
            translatorEnabled,
            translatorLang: translatorEnabled ? translatorLang : undefined,
            voiceStyle: translatorEnabled ? voiceStyle : undefined,
            voiceGender: translatorEnabled ? voiceGender : undefined,
            copyrightCheck,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Caption generation failed");

      setSrtResult(result.srt);
      setOriginalSrt(result.originalSrt);
      setDetectedLang(result.detectedLanguage);
      setCreditsUsed(result.creditsUsed);
      refetchCredits();
      saveOutput("text", result.srt);

      toast({ title: "အောင်မြင်ပါသည်! ✨", description: `Caption ထုတ်ပြီးပါပြီ (${result.creditsUsed} Credits)` });
    } catch (error: any) {
      console.error("Caption error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadSrt = (content: string, suffix: string) => {
    const blob = new Blob([content], { type: "text/srt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `caption-${suffix}-${Date.now()}.srt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-4 pb-24"
    >
      <ToolHeader
        title="AI Caption & Translator/Speaker"
        subtitle="စာတန်းထိုး နှင့် ဘာသာစကားပြောင်းလဲပြောဆိုသူ"
        onBack={onBack}
      />

      <FirstOutputGuide toolName="AI Caption & Translator" steps={["ဗီဒီယိုထည့်ပါ", "Feature ရွေးပါ", "Generate နှိပ်ပါ"]} show={showGuide} onDismiss={markAsLearned} />

      {/* Warning Notice */}
      <div className="gradient-card rounded-2xl p-3 border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 font-myanmar">သတိပေးချက်</p>
            <p className="text-xs text-muted-foreground font-myanmar mt-0.5">
              အများဆုံး {maxDurationSeconds / 60} မိနစ် (1 နာရီ) အထိ တင်နိုင်ပါသည်။
              ခရက်ဒစ်ကုန်ကျမှု - Feature ရွေးချယ်မှုအလိုက် ပြောင်းလဲပါမည်။
            </p>
          </div>
        </div>
      </div>

      {/* Video Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">ဗီဒီယိုထည့်ရန်</label>
        <p className="text-xs text-muted-foreground mb-3 font-myanmar">
          MP4, MOV, WebM • ဖိုင်ဆိုဒ် အကန့်အသတ်မရှိ • အများဆုံး {maxDurationSeconds / 60} မိနစ်
        </p>

        {uploadedVideo ? (
          <div className="space-y-3">
            <div className="relative">
              <video ref={videoRef} src={videoPreviewUrl || undefined} onLoadedMetadata={handleVideoLoaded} controls className="w-full rounded-xl border border-primary/30 max-h-48" />
              <button onClick={removeVideo} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
            {videoDuration > 0 && (
              <div className="gradient-card rounded-xl p-3 border border-primary/10 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-myanmar">⏱ ကြာချိန်: {formatDuration(videoDuration)}</span>
                  <span className="font-semibold text-primary">{estimatedCost} Credits ကုန်ကျမည်</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-myanmar">📏 ဖိုင်ဆိုဒ်: {(uploadedVideo.size / (1024 * 1024)).toFixed(1)} MB</span>
                  <span className="text-muted-foreground font-myanmar">💰 Base: {creditPerMinute} Cr/မိနစ်</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
          >
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ဗီဒီယိုထည့်ရန် နှိပ်ပါ</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
      </div>

      {/* Section 1: Caption Toggle */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-primary font-myanmar flex items-center gap-2">
            <Languages className="w-4 h-4" />
            စာတန်းထိုးမည်
          </label>
          <Switch checked={captionEnabled} onCheckedChange={setCaptionEnabled} />
        </div>
        {captionEnabled && (
          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="bg-background/50 border-primary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {LANGUAGES_LIST.map(l => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Section 2: Translator/Speaker Toggle */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-primary font-myanmar flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Translator/Speaker
          </label>
          <Switch checked={translatorEnabled} onCheckedChange={setTranslatorEnabled} />
        </div>
        <p className="text-[10px] text-muted-foreground font-myanmar">
          {translatorEnabled ? "AI ဖြင့် ဘာသာပြန်ပြီး AI Voice ဖြင့် Dub လုပ်ပေးပါမည် (+50% Cost)" : "ပိတ်ထားပါသည်"}
        </p>
        {translatorEnabled && (
          <div className="space-y-2">
            <Select value={translatorLang} onValueChange={setTranslatorLang}>
              <SelectTrigger className="bg-background/50 border-primary/30">
                <SelectValue placeholder="ဘာသာစကား ရွေးပါ" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {LANGUAGES_LIST.filter(l => l.value !== "original").map(l => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={voiceStyle} onValueChange={setVoiceStyle}>
              <SelectTrigger className="bg-background/50 border-primary/30">
                <SelectValue placeholder="Voice Style ရွေးပါ" />
              </SelectTrigger>
              <SelectContent>
                {VOICE_STYLES.map(v => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" variant={voiceGender === "male" ? "default" : "outline"} onClick={() => setVoiceGender("male")} className="flex-1 text-xs">👨 Male</Button>
              <Button size="sm" variant={voiceGender === "female" ? "default" : "outline"} onClick={() => setVoiceGender("female")} className="flex-1 text-xs">👩 Female</Button>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Copyright Check Toggle */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-primary font-myanmar flex items-center gap-2">
            {copyrightCheck ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
            Copyright Check
          </label>
          <Switch checked={copyrightCheck} onCheckedChange={setCopyrightCheck} />
        </div>
        <p className="text-[10px] text-muted-foreground font-myanmar">
          {copyrightCheck
            ? "သင့်ကို ကော်ပီရိုက်လုံးဝလွတ်အောင်ထုတ်ပေးပါမည် (+30% Cost)"
            : "ကော်ပီရိုက်အတွက် အာမမခံပါ"
          }
        </p>
      </div>

      {/* Dynamic Cost Display */}
      {videoDuration > 0 && (
        <div className="bg-secondary/30 rounded-xl p-3 border border-primary/10 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-myanmar">စုစုပေါင်း Credit</span>
            <span className="font-bold text-primary text-lg">{estimatedCost} Credits</span>
          </div>
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Base Caption</span><span>{baseCost} Cr</span>
            </div>
            {translatorEnabled && <div className="flex justify-between"><span>Translator/Speaker</span><span>+{translatorCost} Cr</span></div>}
            {copyrightCheck && <div className="flex justify-between"><span>Copyright Check</span><span>+{copyrightCost} Cr</span></div>}
          </div>
        </div>
      )}

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
      <Button
        onClick={handleGenerate}
        disabled={isLoading || !uploadedVideo || videoDuration === 0}
        className="w-full btn-gradient-red py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isLoading ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing... (ကြာနိုင်ပါသည်)</>
        ) : (
          <><Sparkles className="w-5 h-5 mr-2" />Generate ({estimatedCost > 0 ? `${estimatedCost} Credits` : "0 Credits"})</>
        )}
      </Button>

      {/* Results */}
      {srtResult && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
          <div className="gradient-card rounded-2xl p-4 border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-semibold text-green-500 font-myanmar">Caption ရလဒ်</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {detectedLang && <span className="px-2 py-1 bg-secondary rounded-lg">မူရင်းဘာသာ: {detectedLang}</span>}
              <span className="px-2 py-1 bg-secondary rounded-lg">{creditsUsed} Credits သုံးပြီး</span>
            </div>
          </div>

          <div className="gradient-card rounded-2xl p-4 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-primary font-myanmar">Subtitle (SRT) - ပြင်ဆင်နိုင်ပါသည်</h4>
              {originalSrt && (
                <Button onClick={() => setSrtResult(originalSrt)} size="sm" variant="ghost" className="text-xs">↩ မူရင်းပြန်ထား</Button>
              )}
            </div>
            <Textarea
              value={srtResult}
              onChange={(e) => setSrtResult(e.target.value)}
              className="min-h-[200px] text-xs font-mono bg-background/50 border-primary/20"
            />
            <div className="flex gap-2 mt-3">
              {originalSrt && originalSrt !== srtResult && (
                <Button onClick={() => downloadSrt(originalSrt, "original")} size="sm" variant="outline" className="text-xs flex-1">
                  <Download className="w-3 h-3 mr-1" />မူရင်း Download
                </Button>
              )}
              <Button onClick={() => downloadSrt(srtResult, targetLang)} size="sm" variant="default" className="text-xs flex-1">
                <Download className="w-3 h-3 mr-1" />SRT Download
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
