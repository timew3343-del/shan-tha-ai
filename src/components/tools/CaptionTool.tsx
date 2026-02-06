import { useState, useRef, useEffect } from "react";
import { Upload, Sparkles, Download, Loader2, X, Languages, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";
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

export const CaptionTool = ({ userId, onBack }: CaptionToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
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

  // Calculate estimated credits
  const freeSeconds = 10;
  const creditsPerMinute = 6;
  const billableSeconds = Math.max(0, videoDuration - freeSeconds);
  const estimatedCost = billableSeconds > 0 ? Math.ceil((billableSeconds / 60) * creditsPerMinute) : 0;

  // Progress animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      const statuses = [
        "ဗီဒီယိုကို upload လုပ်နေသည်...",
        "အသံကို ဖမ်းယူနေသည် (Whisper AI)...",
        "ဘာသာပြန်နေသည် (Gemini AI)...",
        "အပြီးသတ်နေသည်...",
      ];
      let statusIndex = 0;
      setStatusText(statuses[0]);

      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + Math.random() * 3;
          if (newProgress >= 95) return 95;
          const newStatusIndex = Math.min(Math.floor(newProgress / 25), statuses.length - 1);
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

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 100MB
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "ဖိုင်ကြီးလွန်းပါသည်",
        description: "100MB အထိသာ upload လုပ်နိုင်ပါသည်",
        variant: "destructive",
      });
      return;
    }

    setUploadedVideo(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    setSrtResult(null);
    setOriginalSrt(null);
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setVideoDuration(Math.round(videoRef.current.duration));
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

      // Upload video to Supabase storage
      const fileName = `${userId}/caption-${Date.now()}.${uploadedVideo.name.split(".").pop()}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, uploadedVideo, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("ဗီဒီယို upload မအောင်မြင်ပါ");
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("videos").getPublicUrl(fileName);
      const videoUrl = urlData.publicUrl;

      console.log("Video uploaded, public URL:", videoUrl);

      // Call caption edge function
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
            targetLanguage: targetLang,
            videoDuration,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Caption generation failed");
      }

      setSrtResult(result.srt);
      setOriginalSrt(result.originalSrt);
      setDetectedLang(result.detectedLanguage);
      setCreditsUsed(result.creditsUsed);
      refetchCredits();

      toast({
        title: "အောင်မြင်ပါသည်! ✨",
        description: `Caption ထုတ်ပြီးပါပြီ (${result.creditsUsed} Credits)`,
      });
    } catch (error: any) {
      console.error("Caption error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "Caption ထုတ်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-4 pb-24"
    >
      <ToolHeader
        title="AI Caption Tool"
        subtitle="ဗီဒီယိုမှ စာတန်းထိုး ထုတ်ယူခြင်း"
        onBack={onBack}
      />

      {/* Video Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          ဗီဒီယိုထည့်ရန်
        </label>
        <p className="text-xs text-muted-foreground mb-3 font-myanmar">
          MP4, MOV, WebM (100MB အထိ)
        </p>

        {uploadedVideo ? (
          <div className="space-y-3">
            <div className="relative">
              <video
                ref={videoRef}
                src={videoPreviewUrl || undefined}
                onLoadedMetadata={handleVideoLoaded}
                controls
                className="w-full rounded-xl border border-primary/30 max-h-48"
              />
              <button
                onClick={removeVideo}
                className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {videoDuration > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-myanmar">
                  အရှည်: {Math.floor(videoDuration / 60)}:{String(videoDuration % 60).padStart(2, "0")}
                </span>
                <span className={`font-medium ${estimatedCost === 0 ? "text-success" : "text-primary"}`}>
                  {estimatedCost === 0
                    ? "🎉 အခမဲ့ (10s အတွင်း)"
                    : `${estimatedCost} Credits ကုန်ကျမည်`}
                </span>
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

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoUpload}
          className="hidden"
        />
      </div>

      {/* Language Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          <Languages className="w-4 h-4 inline mr-1" />
          ဘာသာပြန်မည့်ဘာသာစကား
        </label>
        <Select value={targetLang} onValueChange={setTargetLang}>
          <SelectTrigger className="bg-background/50 border-primary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="original">မူရင်းအတိုင်း (ဘာသာမပြန်)</SelectItem>
            <SelectItem value="my">🇲🇲 မြန်မာဘာသာ</SelectItem>
            <SelectItem value="en">🇬🇧 English</SelectItem>
            <SelectItem value="th">🇹🇭 ไทย (Thai)</SelectItem>
            <SelectItem value="ja">🇯🇵 日本語 (Japanese)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Credit Info */}
      <div className="gradient-card rounded-2xl p-3 border border-primary/10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-myanmar">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span>ပထမ {freeSeconds} စက္ကန့် အခမဲ့ • ပြီးရင် မိနစ်တိုင်း {creditsPerMinute} Credits</span>
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
        disabled={isLoading || !uploadedVideo || videoDuration === 0}
        className="w-full btn-gradient-red py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Caption ထုတ်နေသည်...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Caption ထုတ်မည် {estimatedCost > 0 ? `(${estimatedCost} Credits)` : "(အခမဲ့)"}
          </>
        )}
      </Button>

      {/* Results */}
      {srtResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          {/* Info */}
          <div className="gradient-card rounded-2xl p-4 border border-success/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-success" />
              <h3 className="text-sm font-semibold text-success font-myanmar">Caption ရလဒ်</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {detectedLang && (
                <span className="px-2 py-1 bg-secondary rounded-lg">
                  မူရင်းဘာသာ: {detectedLang}
                </span>
              )}
              <span className="px-2 py-1 bg-secondary rounded-lg">
                {creditsUsed} Credits သုံးပြီး
              </span>
            </div>
          </div>

          {/* SRT Preview */}
          <div className="gradient-card rounded-2xl p-4 border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-primary font-myanmar">Subtitle (SRT)</h4>
              <div className="flex gap-2">
                {originalSrt && originalSrt !== srtResult && (
                  <Button
                    onClick={() => downloadSrt(originalSrt, "original")}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    မူရင်း
                  </Button>
                )}
                <Button
                  onClick={() => downloadSrt(srtResult, targetLang)}
                  size="sm"
                  variant="default"
                  className="text-xs"
                >
                  <Download className="w-3 h-3 mr-1" />
                  SRT Download
                </Button>
              </div>
            </div>
            <Textarea
              readOnly
              value={srtResult}
              className="min-h-[200px] text-xs font-mono bg-background/50 border-primary/20"
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
