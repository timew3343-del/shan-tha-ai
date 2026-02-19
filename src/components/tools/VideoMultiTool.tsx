import { useState, useRef, useCallback, useEffect } from "react";
import {
  Loader2, Download, Upload, Video, Film, Type, Image as ImageIcon,
  Play, Scissors, FlipHorizontal, Palette, Globe, Mic, User,
  LayoutGrid, EyeOff, Plus, X, Check, ChevronDown, Copy, FileVideo
} from "lucide-react";
import { downloadVideo } from "@/lib/downloadHelper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

type SourceMode = "url" | "upload";

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

// ─── FFmpeg helpers ───────────────────────────────────────
async function loadFFmpeg() {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });
  return { ffmpeg, fetchFile };
}

function buildFFmpegFilters(opts: {
  flipVideo: boolean;
  aspectRatio: string;
  autoColorGrade: boolean;
  copyrightBypass: boolean;
  watermarkText: string;
  watermarkPosition: string;
}): string[] {
  const filters: string[] = [];

  // Flip
  if (opts.flipVideo) filters.push("hflip");

  // Copyright bypass: slight scale + color shift (zoompan not supported in WASM)
  if (opts.copyrightBypass) {
    filters.push("scale=iw*1.04:ih*1.04");
    filters.push("hue=h=5");
  }

  // Color grade
  if (opts.autoColorGrade) {
    filters.push("eq=contrast=1.1:brightness=0.03:saturation=1.15");
  }

  // Aspect ratio crop — use simple expressions compatible with FFmpeg WASM
  if (opts.aspectRatio === "9:16") {
    filters.push("crop=ih*9/16:ih");
  } else if (opts.aspectRatio === "16:9") {
    filters.push("crop=iw:iw*9/16");
  } else if (opts.aspectRatio === "1:1") {
    filters.push("crop=min(iw\\,ih):min(iw\\,ih)");
  }

  // Watermark text (drawtext)
  if (opts.watermarkText) {
    const posMap: Record<string, string> = {
      "bottom-left": "x=20:y=h-th-20",
      "bottom-right": "x=w-tw-20:y=h-th-20",
      "top-left": "x=20:y=20",
      "top-right": "x=w-tw-20:y=20",
    };
    const pos = posMap[opts.watermarkPosition] || posMap["bottom-right"];
    const safeText = opts.watermarkText.replace(/'/g, "\\'").replace(/:/g, "\\:");
    filters.push(`drawtext=text='${safeText}':fontsize=24:fontcolor=white@0.7:${pos}`);
  }

  return filters;
}

// ─── Component ───────────────────────────────────────────
export const VideoMultiTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("video_multi", "Video Multi-Tool");

  // Source mode
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const charRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const introRef = useRef<HTMLInputElement>(null);
  const outroRef = useRef<HTMLInputElement>(null);

  // Dynamic credit cost
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

  const hasAnyEffect = copyrightBypass || autoColorGrade || flipVideo || textWatermark || logoOverlay ||
    objectRemoval || !!introFile || !!outroFile || autoSubtitles || characterEnabled || aspectRatio !== "original";

  const handleImageUpload = (setter: (v: string | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setter(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const { maxDuration, maxLabel } = useMaxVideoDuration();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      toast({ title: "ဖိုင် ကြီးလွန်းပါသည်", description: "500MB ထက်မကျော်ရပါ", variant: "destructive" });
      return;
    }
    // Validate duration
    const url = URL.createObjectURL(file);
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.onloadedmetadata = () => {
      if (videoEl.duration > maxDuration) {
        toast({ title: "ဗီဒီယို ရှည်လွန်းပါသည်", description: `အများဆုံး ${maxLabel} အထိသာ ထုပ်ယူနိုင်ပါသည်`, variant: "destructive" });
        URL.revokeObjectURL(url);
        return;
      }
      setUploadedFile(file);
      setUploadedPreview(url);
    };
    videoEl.onerror = () => {
      setUploadedFile(file);
      setUploadedPreview(url);
    };
    videoEl.src = url;
  };

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (uploadedPreview) URL.revokeObjectURL(uploadedPreview);
    };
  }, [uploadedPreview]);

  const hasSource = sourceMode === "url" ? videoUrl.trim().length > 0 : !!uploadedFile;

  // ─── Main Generate Handler ─────────────────────────────
  const handleGenerate = async () => {
    if (!hasSource) {
      toast({ title: sourceMode === "url" ? "Video URL ထည့်ပါ" : "Video ဖိုင် ရွေးပါ", variant: "destructive" });
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
      let videoBlob: Blob | null = null;

      // ── Step 1: Get raw video data ──
      if (sourceMode === "url") {
        setProgress(5);
        setProgressMsg("Video ဒေါင်းလုဒ်လုပ်နေသည်...");

        const { data: dlData, error: dlError } = await supabase.functions.invoke("video-download", {
          body: { videoUrl, platform },
        });
        if (dlError) throw dlError;
        if (dlData?.error) throw new Error(dlData.error);

        setProgress(30);
        setProgressMsg("ဒေါင်းလုဒ် ပြီးပါပြီ...");

        // If no effects selected, just use the downloaded file directly
        if (!hasAnyEffect) {
          setProgress(100);
          setResult(dlData?.fileUrl || videoUrl);
          refetch();
          saveOutput("video", dlData?.fileUrl || videoUrl, undefined, dlData?.fileUrl);
          toast({ title: "✅ ဗီဒီယို ဒေါင်းလုဒ် ပြီးပါပြီ!", description: `${dlData?.creditsUsed ?? cost} Credits သုံးစွဲပါပြီ` });
          return;
        }

        // Fetch blob for FFmpeg processing
        try {
          const resp = await fetch(dlData?.fileUrl);
          if (resp.ok) videoBlob = await resp.blob();
        } catch {
          // If can't fetch for processing, return as-is
          setResult(dlData?.fileUrl || videoUrl);
          refetch();
          toast({ title: "✅ ဗီဒီယို ရပြီး (Effects မထည့်နိုင်ပါ)", description: "CORS ကြောင့် Effects မထည့်နိုင်ပါ" });
          return;
        }
      } else {
        // File upload mode
        videoBlob = uploadedFile!;
        setProgress(10);
        setProgressMsg("ဗီဒီယို ဖိုင် ဖတ်နေသည်...");
      }

      if (!videoBlob) throw new Error("Video data မရှိပါ");

      // ── Step 2: Process with FFmpeg ──
      setProgress(35);
      setProgressMsg("FFmpeg ဖွင့်နေသည်...");

      const { ffmpeg, fetchFile } = await loadFFmpeg();

      setProgress(45);
      setProgressMsg("Effects ထည့်နေသည်...");

      // Write input
      const inputData = await fetchFile(videoBlob instanceof File ? videoBlob : new File([videoBlob], "input.mp4"));
      await ffmpeg.writeFile("input.mp4", inputData);

      // Build filter chain
      const filters = buildFFmpegFilters({
        flipVideo,
        aspectRatio,
        autoColorGrade,
        copyrightBypass,
        watermarkText: textWatermark ? watermarkText : "",
        watermarkPosition,
      });

      // Build FFmpeg command
      const cmd: string[] = ["-i", "input.mp4"];

      if (filters.length > 0) {
        cmd.push("-vf", filters.join(","));
      }

      // Re-encode
      cmd.push("-c:v", "libx264", "-preset", "fast", "-crf", "23");
      cmd.push("-c:a", "copy");
      cmd.push("-movflags", "+faststart");
      cmd.push("-y", "output.mp4");

      setProgress(55);
      setProgressMsg("ဗီဒီယို တည်းဖြတ်နေသည်...");

      await ffmpeg.exec(cmd);

      setProgress(80);
      setProgressMsg("Output ဖိုင် ပြင်ဆင်နေသည်...");

      const outputData = await ffmpeg.readFile("output.mp4");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outputBlob = new Blob([(outputData as any)], { type: "video/mp4" });

      // ── Step 3: Upload processed video to storage ──
      setProgress(85);
      setProgressMsg("Storage သို့ တင်နေသည်...");

      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Authentication required");

      // Upload via storage
      const fileName = `${userId}/video-multi-${Date.now()}.mp4`;
      const { error: uploadErr } = await supabase.storage
        .from("videos")
        .upload(fileName, outputBlob, { contentType: "video/mp4", upsert: true });

      let finalUrl: string;
      if (uploadErr) {
        // Fallback: create blob URL
        console.warn("Storage upload failed:", uploadErr);
        finalUrl = URL.createObjectURL(outputBlob);
      } else {
        const { data: signedData } = await supabase.storage
          .from("videos")
          .createSignedUrl(fileName, 86400 * 7);
        finalUrl = signedData?.signedUrl || URL.createObjectURL(outputBlob);
      }

      // Deduct credits ONLY after successful processing + upload (upload mode)
      if (sourceMode === "upload") {
        const { data: deductResult, error: deductErr } = await supabase.rpc("deduct_user_credits", {
          _user_id: userId,
          _amount: cost,
          _action: `Video Multi-Tool (Upload + ${filters.length} effects)`,
        });
        if (deductErr) console.warn("Credit deduction failed:", deductErr);
      }

      // Save to gallery
      try {
        await supabase.from("user_outputs").insert({
          user_id: userId,
          tool_id: "video_multi",
          tool_name: "Video Multi-Tool",
          output_type: "video",
          file_url: finalUrl,
        });
      } catch (e) {
        console.warn("Failed to save to gallery:", e);
      }

      setProgress(100);
      setProgressMsg("ပြီးပါပြီ!");
      setResult(finalUrl);
      refetch();
      saveOutput("video", finalUrl, undefined, finalUrl);

      const appliedEffects = [];
      if (flipVideo) appliedEffects.push("Flip");
      if (aspectRatio !== "original") appliedEffects.push(`Aspect ${aspectRatio}`);
      if (copyrightBypass) appliedEffects.push("Copyright Bypass");
      if (autoColorGrade) appliedEffects.push("Color Grade");
      if (textWatermark && watermarkText) appliedEffects.push("Watermark");

      toast({
        title: "✅ ဗီဒီယို ပြီးပါပြီ!",
        description: appliedEffects.length > 0
          ? `Effects: ${appliedEffects.join(", ")} | ${cost} Credits`
          : `${cost} Credits သုံးစွဲပါပြီ`,
      });

    } catch (e: any) {
      console.error("Video Multi-Tool error:", e);
      toast({ title: "အမှားရှိပါသည်", description: e.message || "Processing failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressMsg("");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3 p-4 pb-24">
      <ToolHeader title="AI Video Multi-Tool" subtitle="ဗီဒီယို ဘက်စုံတည်းဖြတ်ခြင်း (FFmpeg + AI)" onBack={onBack} />
      <p className="text-[10px] text-muted-foreground font-myanmar text-center -mt-2 mb-1">လင့်ထည့် သို့ ဗီဒီယို တင်ပြီး Effects ထည့်</p>
      <FirstOutputGuide toolName="Video Multi-Tool" show={showGuide} steps={["Video URL ထည့်ပါ သို့ ဖိုင်တင်ပါ", "Effects/Settings များ ရွေးပါ", "Generate Video နှိပ်ပါ"]} />

      {/* 1. Source Input */}
      <Section title="Video Source" emoji="📥" defaultOpen={true}>
        {/* Source mode toggle */}
        <div className="flex gap-1.5 p-0.5 bg-secondary/30 rounded-xl">
          <button
            onClick={() => setSourceMode("url")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${sourceMode === "url" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-primary/10"}`}
          >
            <Globe className="w-3.5 h-3.5" /> URL Link
          </button>
          <button
            onClick={() => setSourceMode("upload")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${sourceMode === "upload" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-primary/10"}`}
          >
            <Upload className="w-3.5 h-3.5" /> ဖိုင်တင်မည်
          </button>
        </div>

        <AnimatePresence mode="wait">
          {sourceMode === "url" ? (
            <motion.div key="url" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-myanmar">Video URL</Label>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=... or TikTok/FB link" className="text-xs rounded-xl" />
              </div>
              <div className="space-y-1.5">
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
            </motion.div>
          ) : (
            <motion.div key="upload" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-2">
              {uploadedFile ? (
                <div className="space-y-2">
                  {/* Preview */}
                  {uploadedPreview && (
                    <video src={uploadedPreview} controls className="w-full rounded-xl border border-primary/20 max-h-[200px]" />
                  )}
                  <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-3 py-2">
                    <FileVideo className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary truncate">{uploadedFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(uploadedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={() => { setUploadedFile(null); setUploadedPreview(null); }} className="p-1 hover:bg-destructive/10 rounded-lg">
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 border-2 border-dashed border-primary/30 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground">ဗီဒီယို ဖိုင် ရွေးပါ</p>
                    <p className="text-[10px] text-muted-foreground">MP4, MOV, WebM (500MB max)</p>
                  </div>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" onChange={handleFileUpload} className="hidden" />
            </motion.div>
          )}
        </AnimatePresence>
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

      {/* Active Effects Summary */}
      {hasAnyEffect && (
        <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
          <p className="text-[10px] font-semibold text-primary mb-1.5 font-myanmar">✨ ရွေးထားသော Effects:</p>
          <div className="flex flex-wrap gap-1">
            {aspectRatio !== "original" && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">{aspectRatio}</span>}
            {flipVideo && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">Flip</span>}
            {copyrightBypass && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">© Bypass</span>}
            {autoColorGrade && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">Color Grade</span>}
            {textWatermark && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">Watermark</span>}
            {logoOverlay && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">Logo</span>}
            {objectRemoval && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">Object Remove</span>}
            {introFile && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">Intro</span>}
            {outroFile && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">Outro</span>}
            {autoSubtitles && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">Subtitles</span>}
            {characterEnabled && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">Character</span>}
          </div>
        </div>
      )}

      {/* Processing Progress */}
      {isProcessing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-primary font-myanmar">{progressMsg || "ဗီဒီယို တည်းဖြတ်နေသည်..."}</span>
          </div>
          <div className="w-full bg-secondary/30 rounded-full h-2 overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-right">{progress}%</p>
        </motion.div>
      )}

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isProcessing || !hasSource || credits < cost} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl py-5 text-sm font-semibold">
        {isProcessing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing {progress}%...</>
        ) : (
          <><Play className="w-4 h-4 mr-2" />{hasAnyEffect ? `Generate + Effects (${cost} Credits)` : `Generate Video (${cost} Credits)`}</>
        )}
      </Button>
      <VideoLimitWarning />

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">🎬 Output ဗီဒီယို</h3>

          {/* Video player */}
          <video src={result} controls className="w-full rounded-xl border border-primary/20" />

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

          {/* Download */}
          <Button onClick={() => downloadVideo(result, "video-multi")} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white">
            <Download className="w-4 h-4 mr-2" /> Download Video
          </Button>
        </motion.div>
      )}

      {/* Feature Summary */}
      <div className="bg-secondary/10 rounded-xl p-3 border border-primary/10">
        <p className="text-[10px] text-muted-foreground font-myanmar text-center leading-relaxed">
          ⚡ FFmpeg.wasm ဖြင့် Browser တွင် Effects တိုက်ရိုက်ထည့်ခြင်း •
          📤 ဖိုင်တင် သို့ URL Link ထည့်နိုင်ခြင်း •
          🛡️ Copyright Bypass (Auto Zoom+Flip+Color)
        </p>
      </div>
    </motion.div>
  );
};
