import { useState, useRef } from "react";
import { Upload, Sparkles, Download, Loader2, X, Globe, Film } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AutoAdToolProps {
  userId?: string;
  onBack: () => void;
}

const PLATFORM_OPTIONS = [
  { id: "youtube", label: "📺 YouTube (16:9)", ratio: "16:9" },
  { id: "fb_tiktok", label: "📱 FB/TikTok (9:16)", ratio: "9:16" },
  { id: "square", label: "⬜ Square (1:1)", ratio: "1:1" },
];

const LANGUAGE_OPTIONS = [
  { value: "my", label: "🇲🇲 Myanmar" },
  { value: "en", label: "🇺🇸 English" },
  { value: "th", label: "🇹🇭 Thai" },
];

// Resolution removed per Logic 2 - auto-determined by platform

const STYLE_OPTIONS = [
  { value: "cartoon", label: "🎨 ကာတွန်း" },
  { value: "3d", label: "🧊 3D Animation" },
  { value: "realistic", label: "👤 လူပုံစံ" },
  { value: "cinematic", label: "🎬 Cinematic" },
  { value: "anime", label: "🌸 Anime" },
];

const AD_DURATION_OPTIONS = [
  { value: "1", label: "⏱️ 1 မိနစ်" },
  { value: "3", label: "⏱️ 3 မိနစ်" },
  { value: "5", label: "⏱️ 5 မိနစ်" },
  { value: "10", label: "⏱️ 10 မိနစ်" },
];

export const AutoAdTool = ({ userId, onBack }: AutoAdToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("auto_ad", "Auto ကြော်ငြာ");

  const [images, setImages] = useState<string[]>([]);
  const [productDetails, setProductDetails] = useState("");
  const [language, setLanguage] = useState("my");
  // Resolution auto-determined by platform (Logic 2)
  const [adStyle, setAdStyle] = useState("cinematic");
  const [adDuration, setAdDuration] = useState("1");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["youtube"]);

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [resultVideos, setResultVideos] = useState<{ platform: string; url: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseCost = costs.auto_ad || 25;
  const durationMultiplier = parseInt(adDuration) || 1;
  const creditCost = Math.ceil(baseCost * selectedPlatforms.length * durationMultiplier);

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 10 - images.length;
    const filesToProcess = files.slice(0, remaining);

    filesToProcess.forEach(file => {
      if (file.size > 10 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages(prev => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleGenerate = async () => {
    if (!userId || images.length === 0 || !productDetails.trim()) {
      toast({ title: "ပုံနှင့် အသေးစိတ် ဖြည့်ပါ", variant: "destructive" });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({ title: "Platform ရွေးချယ်ပါ", variant: "destructive" });
      return;
    }

    if (credits < creditCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${creditCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setResultVideos([]);
    setProgress(0);

    const statuses = [
      "ပုံများ စစ်ဆေးနေသည်...",
      "AI Script ဖန်တီးနေသည်...",
      "ကြော်ငြာ ဗီဒီယို ထုတ်နေသည်...",
      "Voiceover ပြင်ဆင်နေသည်...",
      "အပြီးသတ်နေသည်...",
    ];
    let statusIdx = 0;
    setStatusText(statuses[0]);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95;
        const next = prev + Math.random() * 3;
        const newIdx = Math.min(Math.floor(next / 20), statuses.length - 1);
        if (newIdx !== statusIdx) {
          statusIdx = newIdx;
          setStatusText(statuses[statusIdx]);
        }
        return next;
      });
    }, 2500);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" });
        return;
      }

      const { data: result, error } = await supabase.functions.invoke("auto-ad", {
        body: {
          images: images.map(img => img.split(",")[1]),
          productDetails: productDetails.trim(),
          language,
          adStyle,
          showSubtitles,
          videoDurationMinutes: parseInt(adDuration) || 1,
          platforms: selectedPlatforms,
        },
      });

      if (error) throw new Error(error.message || "Auto ad generation failed");
      if (!result) throw new Error("Auto ad generation failed");

      setResultVideos(result.videos || []);
      setProgress(100);
      refetchCredits();
      // Server already saves to user_outputs - no need for client-side save

      toast({ title: "အောင်မြင်ပါသည် 🎬", description: `${result.creditsUsed} Credits အသုံးပြုပြီးပါပြီ` });
    } catch (error: any) {
      console.error("Auto Ad error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="Auto ကြော်ငြာအပ်ရန်" subtitle="AI tools အကုန်လုံးကို ခြုံကာ အော်တိုကြော်ငြာ ထုတ်ပေးမည်" onBack={onBack} />
      <FirstOutputGuide toolName="Auto ကြော်ငြာ" show={showGuide} steps={["ပစ္စည်းပုံများ တင်ပါ", "အသေးစိတ် ရေးပါ", "Platform ရွေးပါ", "ကြော်ငြာ ထုတ်ပါ"]} />

      {/* Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">📸 ပစ္စည်းပုံများ ({images.length}/10)</label>
        <p className="text-[10px] text-muted-foreground mb-3 font-myanmar">ရှုထောင့်မတူသော ပစ္စည်းပုံ (၁၀) ပုံအထိ တင်ပေးပါ။</p>

        <div className="grid grid-cols-5 gap-2 mb-3">
          {images.map((img, idx) => (
            <div key={idx} className="relative aspect-square">
              <img src={img} alt={`Product ${idx + 1}`} className="w-full h-full object-cover rounded-lg border border-primary/20" />
              <button onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 p-0.5 bg-destructive rounded-full text-destructive-foreground">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {images.length < 10 && (
            <button onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center hover:bg-primary/5 transition-colors">
              <Upload className="w-5 h-5 text-primary" />
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImagesUpload} className="hidden" />
      </div>

      {/* Product Details */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">📝 ပစ္စည်းအကြောင်း အသေးစိတ် ရေးပေးပါ</label>
        <Textarea
          placeholder="ဥပမာ - ကိုရီးယား Skincare Set, အသားအရေ ဖြူဝင်းစေ, ဈေးနှုန်း 25,000 Ks..."
          value={productDetails}
          onChange={(e) => setProductDetails(e.target.value)}
          onPaste={(e) => {
            e.stopPropagation();
            const pastedText = e.clipboardData.getData("text");
            if (pastedText) {
              e.preventDefault();
              const target = e.target as HTMLTextAreaElement;
              const start = target.selectionStart;
              const end = target.selectionEnd;
              const newValue = productDetails.substring(0, start) + pastedText + productDetails.substring(end);
              setProductDetails(newValue);
              // Restore cursor position after paste
              setTimeout(() => {
                target.selectionStart = target.selectionEnd = start + pastedText.length;
              }, 0);
            }
          }}
          className="min-h-[80px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar select-text"
          style={{ WebkitUserSelect: "text", userSelect: "text" }}
        />
      </div>

      {/* Language & Style */}
      <div className="grid grid-cols-2 gap-3">
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="flex items-center gap-1.5 text-sm font-medium text-primary mb-2 font-myanmar">
            <Globe className="w-4 h-4" />ဘာသာစကား
          </label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{LANGUAGE_OPTIONS.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="flex items-center gap-1.5 text-sm font-medium text-primary mb-2 font-myanmar">
            <Film className="w-4 h-4" />ဒီဇိုင်း Style
          </label>
          <Select value={adStyle} onValueChange={setAdStyle}>
            <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{STYLE_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Duration Selector */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="flex items-center gap-1.5 text-sm font-medium text-primary mb-2 font-myanmar">
          ⏱️ ဗီဒီယို အရှည်
        </label>
        <Select value={adDuration} onValueChange={setAdDuration}>
          <SelectTrigger className="bg-background/50 border-primary/30 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{AD_DURATION_OPTIONS.map((d) => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}</SelectContent>
        </Select>
      </div>

      <div className="gradient-card rounded-2xl p-3 border border-primary/20 flex items-center justify-between">
        <label className="text-sm font-medium text-primary font-myanmar">📝 စာတန်းထိုး</label>
        <button onClick={() => setShowSubtitles(!showSubtitles)} className={`w-12 h-6 rounded-full transition-colors ${showSubtitles ? "bg-primary" : "bg-muted"}`}>
          <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${showSubtitles ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
      </div>

      {/* Platform Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="flex items-center gap-1.5 text-sm font-medium text-primary mb-3 font-myanmar">
          <Film className="w-4 h-4" />Platform ရွေးချယ်ပါ (တစ်ခုထက်ပိုရွေးနိုင်)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORM_OPTIONS.map((p) => (
            <button
              key={p.id}
              onClick={() => togglePlatform(p.id)}
              className={`p-3 rounded-xl text-center transition-all border ${
                selectedPlatforms.includes(p.id)
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-background/30 hover:bg-primary/5"
              }`}
            >
              <span className="text-sm font-medium block">{p.label}</span>
              <span className="text-[9px] text-muted-foreground">{p.ratio}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cost Summary */}
      <div className="gradient-card rounded-2xl p-3 border border-accent/30 bg-accent/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-myanmar">ကုန်ကျမည့် Credits:</span>
          <span className="text-lg font-bold text-primary">{creditCost} <span className="text-xs font-normal text-muted-foreground">Credits</span></span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          {selectedPlatforms.length} platform × {baseCost} credits = {creditCost} credits
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
      <Button onClick={handleGenerate} disabled={isLoading || images.length === 0} className="w-full btn-gradient-green py-4 rounded-2xl font-semibold font-myanmar">
        {isLoading ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />ကြော်ငြာ ဖန်တီးနေသည်...</>
        ) : (
          <><Sparkles className="w-5 h-5 mr-2" />Auto ကြော်ငြာ ထုတ်မည် ({creditCost} Cr)</>
        )}
      </Button>

      {/* Results */}
      {resultVideos.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
          {resultVideos.map((vid, idx) => (
            <div key={idx} className="gradient-card rounded-2xl p-4 border border-primary/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-primary font-myanmar">
                  🎬 {PLATFORM_OPTIONS.find(p => p.id === vid.platform)?.label || vid.platform}
                </h3>
                <Button onClick={() => downloadVideo(vid.url, `auto-ad-${vid.platform}`)} size="sm" variant="outline" className="text-xs">
                  <Download className="w-3 h-3 mr-1" />Download
                </Button>
              </div>
              <video controls className="w-full rounded-xl" src={vid.url} />
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};
