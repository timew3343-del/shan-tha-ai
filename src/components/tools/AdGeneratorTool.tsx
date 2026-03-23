import { useState, useRef, useEffect } from "react";
import { Upload, Sparkles, Download, Loader2, X, Megaphone, Copy, Check, Clock, Globe, Mic2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToolOutput } from "@/hooks/useToolOutput";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";

interface AdGeneratorToolProps {
  userId?: string;
  onBack: () => void;
}

interface AdResult {
  adScript: {
    headline_my?: string;
    headline_en?: string;
    headline_th?: string;
    body_my?: string;
    body_en?: string;
    body_th?: string;
    cta_my?: string;
    cta_en?: string;
    cta_th?: string;
    hashtags?: string[];
    voiceover_script?: string;
  };
  enhancedImage: string;
  video?: string;
  creditsUsed: number;
}

const DURATION_OPTIONS = [
  { value: "15s", label: "15 စက္ကန့်", seconds: 15 },
  { value: "30s", label: "30 စက္ကန့်", seconds: 30 },
  { value: "60s", label: "1 မိနစ်", seconds: 60 },
  { value: "2m", label: "2 မိနစ်", seconds: 120 },
  { value: "3m", label: "3 မိနစ်", seconds: 180 },
  { value: "4m", label: "4 မိနစ်", seconds: 240 },
  { value: "5m", label: "5 မိနစ်", seconds: 300 },
  { value: "6m", label: "6 မိနစ်", seconds: 360 },
  { value: "7m", label: "7 မိနစ်", seconds: 420 },
  { value: "8m", label: "8 မိနစ်", seconds: 480 },
  { value: "10m", label: "10 မိနစ်", seconds: 600 },
  { value: "15m", label: "15 မိနစ်", seconds: 900 },
];

const LANGUAGE_OPTIONS = [
  { value: "my", label: "🇲🇲 မြန်မာ", name: "Myanmar" },
  { value: "en", label: "🇺🇸 English", name: "English" },
  { value: "th", label: "🇹🇭 ไทย", name: "Thai" },
];

const AD_STYLES = [
  { value: "cinematic", label: "🎬 Cinematic", desc: "Movie-quality dramatic visuals" },
  { value: "viral", label: "🔥 Social Media Viral", desc: "Trending, attention-grabbing" },
  { value: "minimalist", label: "✨ Minimalist", desc: "Clean, elegant simplicity" },
  { value: "testimonial", label: "💬 Testimonial", desc: "Customer review style" },
  { value: "storytelling", label: "📖 Storytelling", desc: "Narrative-driven ad" },
  { value: "corporate", label: "🏢 Corporate", desc: "Professional business tone" },
  { value: "energetic", label: "⚡ Energetic", desc: "High-energy, fast-paced" },
  { value: "luxury", label: "👑 Luxury Premium", desc: "High-end, exclusive feel" },
  { value: "bold", label: "💥 Bold & Vibrant", desc: "Eye-catching, colorful" },
  { value: "modern", label: "🎨 Modern & Clean", desc: "Contemporary design" },
  { value: "retro", label: "📼 Retro / Vintage", desc: "Nostalgic classic feel" },
  { value: "playful", label: "🎈 Playful & Fun", desc: "Light-hearted, cheerful" },
  { value: "emotional", label: "❤️ Emotional", desc: "Heart-touching, sentimental" },
  { value: "tech", label: "🚀 Tech / Futuristic", desc: "Sci-fi, innovative vibes" },
  { value: "fashion", label: "👗 Fashion & Beauty", desc: "Stylish, glamorous" },
  { value: "food", label: "🍽️ Food & Beverage", desc: "Appetizing, mouth-watering" },
  { value: "realestate", label: "🏠 Real Estate", desc: "Property showcase" },
  { value: "automotive", label: "🚗 Automotive", desc: "Speed, power, performance" },
  { value: "health", label: "💪 Health & Wellness", desc: "Fresh, natural, vitality" },
  { value: "travel", label: "✈️ Travel & Adventure", desc: "Wanderlust, exploration" },
];

const DURATION_MULTIPLIERS: Record<string, number> = {
  "15s": 1, "30s": 1.5, "60s": 2, "2m": 3, "3m": 4, "4m": 5,
  "5m": 6, "6m": 7, "7m": 8, "8m": 9, "10m": 11, "15m": 15,
};

export const AdGeneratorTool = ({ userId, onBack }: AdGeneratorToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();

  // Core states
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productDescription, setProductDescription] = useState("");

  // New input states
  const [duration, setDuration] = useState("30s");
  const [language, setLanguage] = useState("my");
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("female");
  const [adStyle, setAdStyle] = useState("cinematic");

  // Process states
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<AdResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showGuide, markAsLearned, saveOutput } = useToolOutput("ad-generator", "AI Ad Generator");

  // Dynamic credit cost based on duration
  const baseCost = costs.ad_generator || 9;
  const multiplier = DURATION_MULTIPLIERS[duration] || 1;
  const creditCost = Math.ceil(baseCost * multiplier);

  // Progress animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      const statuses = [
        "AI Script ရေးနေသည်...",
        "ပုံကို Professional Enhancement လုပ်နေသည်...",
        "Video ဖန်တီးနေသည်...",
        "Voiceover ပြင်ဆင်နေသည်...",
        "အပြီးသတ်နေသည်...",
      ];
      let statusIndex = 0;
      setStatusText(statuses[0]);

      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + Math.random() * 3;
          if (newProgress >= 95) return 95;
          const newStatusIndex = Math.min(Math.floor(newProgress / 20), statuses.length - 1);
          if (newStatusIndex !== statusIndex) {
            statusIndex = newStatusIndex;
            setStatusText(statuses[statusIndex]);
          }
          return newProgress;
        });
      }, 2000);
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
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "ဖိုင်ကြီးလွန်းပါသည်",
        description: "10MB အထိသာ upload လုပ်နိုင်ပါသည်",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => setProductImage(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setProductImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerate = async () => {
    if (!productImage || !productDescription.trim() || !userId) return;

    if (credits < creditCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `${creditCost} Credits လိုအပ်ပါသည် (လက်ရှိ: ${credits})`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ad`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            productImageBase64: productImage,
            productDescription: productDescription.trim(),
            adStyle,
            duration,
            language,
            voiceGender,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ad generation failed");
      }

      setResult({
        adScript: data.adScript,
        enhancedImage: data.enhancedImage,
        video: data.video,
        creditsUsed: data.creditsUsed,
      });
      refetchCredits();
      saveOutput("image", data.enhancedImage);

      toast({
        title: "အောင်မြင်ပါသည်! ✨",
        description: `ကြော်ငြာ ဖန်တီးပြီးပါပြီ (${data.creditsUsed} Credits)`,
      });
    } catch (error: any) {
      console.error("Ad generation error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "ကြော်ငြာဖန်တီးရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (!result?.enhancedImage) return;
    const link = document.createElement("a");
    link.href = result.enhancedImage;
    link.download = `ad-${adStyle}-${Date.now()}.png`;
    link.click();
  };

  const downloadVideo = () => {
    if (!result?.video) return;
    const link = document.createElement("a");
    link.href = result.video;
    link.download = `ad-video-${adStyle}-${Date.now()}.mp4`;
    link.click();
  };

  const selectedStyle = AD_STYLES.find(s => s.value === adStyle);
  const selectedLang = LANGUAGE_OPTIONS.find(l => l.value === language);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-4 pb-24"
    >
      <ToolHeader
        title="AI Ad Generator"
        subtitle="Professional ကြော်ငြာ Video & Image ဖန်တီးခြင်း"
        onBack={onBack}
      />

      <FirstOutputGuide toolName="AI ကြော်ငြာ ဖန်တီးရန်" steps={["ထုတ်ကုန်ပုံထည့်ပါ", "ထုတ်ကုန်ဖော်ပြချက်ထည့်ပါ", "ကြော်ငြာဖန်တီးမည် ခလုတ်ကို နှိပ်ပါ", "ရလဒ်ကို ဒေါင်းလုဒ်လုပ်ပါ"]} show={showGuide} onDismiss={markAsLearned} />

      {/* Product Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          📸 ကုန်ပစ္စည်း ပုံထည့်ရန်
        </label>

        {productImage ? (
          <div className="relative inline-block">
            <img
              src={productImage}
              alt="Product"
              className="w-full max-w-[200px] h-auto object-cover rounded-xl border border-primary/30"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-destructive-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
          >
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ပုံထည့်ရန် နှိပ်ပါ</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Product Description */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          📝 ကုန်ပစ္စည်းအကြောင်း ဖော်ပြချက်
        </label>
        <Textarea
          placeholder="ဥပမာ - ကိုရီးယား Skincare Cream, အသားအရေ ဖြူဝင်း စေသည်..."
          value={productDescription}
          onChange={(e) => setProductDescription(e.target.value)}
          className="min-h-[80px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
        />
      </div>

      {/* Duration & Language Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Duration */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="flex items-center gap-1.5 text-sm font-medium text-primary mb-2 font-myanmar">
            <Clock className="w-4 h-4" />
            ကြာချိန်
          </label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="bg-background/50 border-primary/30 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="flex items-center gap-1.5 text-sm font-medium text-primary mb-2 font-myanmar">
            <Globe className="w-4 h-4" />
            ဘာသာစကား
          </label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="bg-background/50 border-primary/30 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Voice Gender */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="flex items-center gap-1.5 text-sm font-medium text-primary mb-3 font-myanmar">
          <Mic2 className="w-4 h-4" />
          အသံ အမျိုးအစား
        </label>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium transition-colors ${voiceGender === "male" ? "text-primary" : "text-muted-foreground"}`}>
              👨 အမျိုးသား
            </span>
            <Switch
              checked={voiceGender === "female"}
              onCheckedChange={(checked) => setVoiceGender(checked ? "female" : "male")}
            />
            <span className={`text-sm font-medium transition-colors ${voiceGender === "female" ? "text-primary" : "text-muted-foreground"}`}>
              👩 အမျိုးသမီး
            </span>
          </div>
        </div>
      </div>

      {/* Ad Style - Grid Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="flex items-center gap-1.5 text-sm font-medium text-primary mb-3 font-myanmar">
          <Film className="w-4 h-4" />
          ကြော်ငြာ Style ရွေးချယ်ရန်
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
          {AD_STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => setAdStyle(style.value)}
              className={`p-3 rounded-xl text-left transition-all border ${
                adStyle === style.value
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-background/30 hover:bg-primary/5"
              }`}
            >
              <span className="text-sm font-medium block">{style.label}</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">{style.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cost Summary */}
      <div className="gradient-card rounded-2xl p-3 border border-accent/30 bg-accent/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-myanmar">ကုန်ကျမည့် Credits:</span>
          <div className="text-right">
            <span className="text-lg font-bold text-primary">{creditCost}</span>
            <span className="text-xs text-muted-foreground ml-1">Credits</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span>{selectedStyle?.label} • {DURATION_OPTIONS.find(d => d.value === duration)?.label} • {selectedLang?.name}</span>
          <span>လက်ရှိ: {credits}</span>
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
      <Button
        onClick={handleGenerate}
        disabled={isLoading || !productImage || !productDescription.trim()}
        className="w-full btn-gradient-red py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ကြော်ငြာဖန်တီးနေသည်...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            ကြော်ငြာ ဖန်တီးမည် ({creditCost} Credits)
          </>
        )}
      </Button>

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          {/* Video Result */}
          {result.video && (
            <div className="gradient-card rounded-2xl p-4 border border-success/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-success" />
                  <h3 className="text-sm font-semibold text-success font-myanmar">ကြော်ငြာ Video</h3>
                </div>
                <Button onClick={downloadVideo} size="sm" variant="outline" className="text-xs">
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
              <video
                src={result.video}
                controls
                className="w-full rounded-xl border border-border"
              />
            </div>
          )}

          {/* Enhanced Image */}
          <div className="gradient-card rounded-2xl p-4 border border-success/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-success" />
                <h3 className="text-sm font-semibold text-success font-myanmar">ကြော်ငြာ ပုံ</h3>
              </div>
              <Button onClick={downloadImage} size="sm" variant="outline" className="text-xs">
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            </div>
            <img
              src={result.enhancedImage}
              alt="Ad"
              className="w-full rounded-xl border border-border"
            />
          </div>

          {/* Ad Copy */}
          <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
            <h3 className="text-sm font-semibold text-primary font-myanmar">📝 ကြော်ငြာ Script</h3>

            {/* Voiceover Script */}
            {result.adScript.voiceover_script && (
              <div className="p-3 bg-accent/10 rounded-xl border border-accent/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-myanmar">🎤 Voiceover Script</span>
                  <button
                    onClick={() => copyToClipboard(result.adScript.voiceover_script!, "voiceover")}
                    className="text-xs text-primary"
                  >
                    {copiedField === "voiceover" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <p className="text-sm text-foreground font-myanmar whitespace-pre-line">{result.adScript.voiceover_script}</p>
              </div>
            )}

            {/* Headlines */}
            {(result.adScript.headline_my || result.adScript.headline_en || result.adScript.headline_th) && (
              <div className="space-y-2">
                {[
                  { key: "headline_my", label: "Headline (Myanmar)", value: result.adScript.headline_my },
                  { key: "headline_en", label: "Headline (English)", value: result.adScript.headline_en },
                  { key: "headline_th", label: "Headline (Thai)", value: result.adScript.headline_th },
                ].filter(h => h.value).map(({ key, label, value }) => (
                  <div key={key} className="p-3 bg-secondary/30 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <button onClick={() => copyToClipboard(value!, key)} className="text-xs text-primary">
                        {copiedField === key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-sm font-medium text-foreground font-myanmar">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Body */}
            {(result.adScript.body_my || result.adScript.body_en || result.adScript.body_th) && (
              <div className="space-y-2">
                {[
                  { key: "body_my", label: "Body (Myanmar)", value: result.adScript.body_my },
                  { key: "body_en", label: "Body (English)", value: result.adScript.body_en },
                  { key: "body_th", label: "Body (Thai)", value: result.adScript.body_th },
                ].filter(b => b.value).map(({ key, label, value }) => (
                  <div key={key} className="p-3 bg-secondary/30 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <button onClick={() => copyToClipboard(value!, key)} className="text-xs text-primary">
                        {copiedField === key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-sm text-foreground font-myanmar">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            {(result.adScript.cta_my || result.adScript.cta_en || result.adScript.cta_th) && (
              <div className="p-3 bg-primary/10 rounded-xl text-center space-y-1">
                <span className="text-xs text-muted-foreground block">CTA</span>
                {result.adScript.cta_my && <p className="text-sm font-bold text-primary font-myanmar">{result.adScript.cta_my}</p>}
                {result.adScript.cta_en && <p className="text-sm font-bold text-primary">{result.adScript.cta_en}</p>}
                {result.adScript.cta_th && <p className="text-sm font-bold text-primary">{result.adScript.cta_th}</p>}
              </div>
            )}

            {/* Hashtags */}
            {result.adScript.hashtags && result.adScript.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.adScript.hashtags.map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground font-myanmar">
            {result.creditsUsed} Credits သုံးပြီး
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
