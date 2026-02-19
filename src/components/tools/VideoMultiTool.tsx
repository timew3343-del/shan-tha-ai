import { useState, useRef, useCallback, useEffect } from "react";
import {
  Loader2, Download, Upload, Video, Film, Type, Image as ImageIcon,
  Play, Scissors, FlipHorizontal, Palette, Globe, Mic, User,
  LayoutGrid, EyeOff, Plus, X, Check, ChevronDown, Copy, FileVideo, FileText, AlertTriangle
} from "lucide-react";
import { downloadVideo } from "@/lib/downloadHelper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  { value: "alloy", label: "Alloy (Standard)" },
  { value: "echo", label: "Echo (Deep)" },
  { value: "fable", label: "Fable (Warm)" },
  { value: "onyx", label: "Onyx (Authoritative)" },
  { value: "nova", label: "Nova (Female)" },
  { value: "shimmer", label: "Shimmer (Soft)" },
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
const MAX_FFMPEG_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit for browser FFmpeg

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
  if (opts.flipVideo) filters.push("hflip");
  if (opts.copyrightBypass) {
    filters.push("scale=iw*1.04:ih*1.04");
    filters.push("hue=h=5");
  }
  if (opts.autoColorGrade) {
    filters.push("eq=contrast=1.1:brightness=0.03:saturation=1.15");
  }
  if (opts.aspectRatio === "9:16") {
    filters.push("crop=ih*9/16:ih");
  } else if (opts.aspectRatio === "16:9") {
    filters.push("crop=iw:iw*9/16");
  } else if (opts.aspectRatio === "1:1") {
    filters.push("crop=min(iw\\,ih):min(iw\\,ih)");
  }
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
  const { maxDuration, maxLabel } = useMaxVideoDuration();

  // Source mode
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice & Language
  const [voice, setVoice] = useState("alloy");
  const [language, setLanguage] = useState("my");
  const [ttsEnabled, setTtsEnabled] = useState(false);

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
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [srtContent, setSrtContent] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);

  // Job polling
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

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
    (autoSubtitles ? 3 : 0) +
    (ttsEnabled ? 3 : 0) +
    (characterEnabled ? 2 : 0);
  const cost = baseCost + extraCost;

  const hasFFmpegEffect = copyrightBypass || autoColorGrade || flipVideo || textWatermark || logoOverlay || aspectRatio !== "original";
  const hasAIFeature = autoSubtitles || ttsEnabled || objectRemoval;
  const hasConcat = !!introFile || !!outroFile;
  const hasAnyEffect = hasFFmpegEffect || hasAIFeature || hasConcat || characterEnabled;

  const handleImageUpload = (setter: (v: string | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setter(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      toast({ title: "ဖိုင် ကြီးလွန်းပါသည်", description: "500MB ထက်မကျော်ရပါ", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(file);
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.onloadedmetadata = () => {
      if (videoEl.duration > 300) { // 5 minutes hard limit
        toast({ title: "ဗီဒီယို ရှည်လွန်းပါသည်", description: "အများဆုံး ၅ မိနစ် အထိသာ ထုပ်ယူနိုင်ပါသည်", variant: "destructive" });
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

  useEffect(() => {
    return () => { if (uploadedPreview) URL.revokeObjectURL(uploadedPreview); };
  }, [uploadedPreview]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const hasSource = sourceMode === "url" ? videoUrl.trim().length > 0 : !!uploadedFile;

  // ─── Poll job status ──────────────────────────────────
  const startJobPolling = useCallback((jobId: string, onComplete: (job: any) => void, onFail?: (err: string) => void) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setActiveJobId(jobId);

    let pollCount = 0;
    pollRef.current = setInterval(async () => {
      pollCount++;
      try {
        const { data: job } = await supabase
          .from("generation_jobs")
          .select("status, output_url, error_message, input_params")
          .eq("id", jobId)
          .single();

        if (!job) return;

        const simulatedProgress = Math.min(20 + pollCount * 3, 85);
        setProgress(simulatedProgress);

        if (pollCount % 3 === 0) {
          const msgs = [
            "🎯 AI ပြုလုပ်နေသည်...",
            "🔄 ဆက်လက် လုပ်ဆောင်နေသည်...",
            "📡 Server-side processing...",
            "⏳ နောက်ထပ် ခဏ စောင့်ပါ...",
          ];
          setProgressMsg(msgs[Math.floor(pollCount / 3) % msgs.length]);
        }

        if (job.status === "completed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setActiveJobId(null);
          onComplete(job);
        } else if (job.status === "failed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setActiveJobId(null);
          const errMsg = job.error_message || "AI processing failed";
          if (onFail) onFail(errMsg);
          else throw new Error(errMsg);
        }
      } catch (e: any) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setActiveJobId(null);
        setErrorDetail(e.message);
        toast({ title: "AI processing error", description: e.message, variant: "destructive" });
        setIsProcessing(false);
      }
    }, 5000);
  }, [toast]);

  // ─── Upload file to storage and get URL ──────────────
  const uploadVideoToStorage = async (file: File): Promise<string> => {
    if (!userId) throw new Error("Not authenticated");
    const fileName = `${userId}/input-${Date.now()}.mp4`;
    const { error: uploadErr } = await supabase.storage
      .from("videos")
      .upload(fileName, file, { contentType: "video/mp4", upsert: true });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
    const { data: signedData } = await supabase.storage
      .from("videos")
      .createSignedUrl(fileName, 3600);
    if (!signedData?.signedUrl) throw new Error("Failed to get signed URL");
    return signedData.signedUrl;
  };

  // ─── Run FFmpeg processing (with memory optimization) ──
  const runFFmpegProcessing = async (
    videoBlob: Blob,
    ttsAudio?: string | null,
    intro?: File | null,
    outro?: File | null
  ): Promise<Blob> => {
    // Check file size - if too large for browser, throw with specific error
    if (videoBlob.size > MAX_FFMPEG_FILE_SIZE) {
      throw new Error(`FFMPEG_MEMORY_LIMIT:ဗီဒီယို ဖိုင် (${(videoBlob.size / 1024 / 1024).toFixed(0)}MB) သည် browser FFmpeg အတွက် ကြီးလွန်းပါသည်။ ဖိုင်အရွယ်အစား 100MB အောက် သုံးပါ။`);
    }

    setProgressMsg("FFmpeg ဖွင့်နေသည်...");
    console.log(`[FFmpeg] Loading... Video size: ${(videoBlob.size / 1024 / 1024).toFixed(1)}MB`);

    let ffmpeg: any;
    let fetchFile: any;
    try {
      const loaded = await loadFFmpeg();
      ffmpeg = loaded.ffmpeg;
      fetchFile = loaded.fetchFile;
    } catch (e: any) {
      console.error("[FFmpeg] Load failed:", e);
      throw new Error(`FFMPEG_LOAD_FAIL:FFmpeg WASM ဖွင့်၍မရပါ: ${e.message}`);
    }

    // Set up progress logging
    ffmpeg.on("progress", ({ progress: p, time }: any) => {
      const pct = Math.round(p * 100);
      console.log(`[FFmpeg] Progress: ${pct}% (time: ${time})`);
      // Map FFmpeg progress (0-100) to our progress range (40-85)
      setProgress(40 + Math.round(pct * 0.45));
    });

    ffmpeg.on("log", ({ message }: any) => {
      // Only log important messages
      if (message.includes("Error") || message.includes("error") || message.includes("failed")) {
        console.error(`[FFmpeg LOG] ${message}`);
      }
    });

    try {
      setProgressMsg("ဗီဒီယို ဖတ်နေသည်...");
      console.log("[FFmpeg] Writing input file...");
      const inputData = await fetchFile(videoBlob instanceof File ? videoBlob : new File([videoBlob], "input.mp4"));
      await ffmpeg.writeFile("input.mp4", inputData);

      // Write logo file if needed
      let hasLogoFile = false;
      if (logoOverlay && logoImage) {
        try {
          const logoResp = await fetch(logoImage);
          const logoBlob = await logoResp.blob();
          const logoData = await fetchFile(new File([logoBlob], "logo.png"));
          await ffmpeg.writeFile("logo.png", logoData);
          hasLogoFile = true;
          console.log("[FFmpeg] Logo file written");
        } catch (e) {
          console.warn("[FFmpeg] Failed to load logo:", e);
        }
      }

      // Write TTS audio if available
      let hasTtsAudio = false;
      if (ttsAudio) {
        try {
          setProgressMsg("TTS audio ထည့်နေသည်...");
          const audioResp = await fetch(ttsAudio);
          const audioBlob = await audioResp.blob();
          const audioData = await fetchFile(new File([audioBlob], "tts.mp3"));
          await ffmpeg.writeFile("tts.mp3", audioData);
          hasTtsAudio = true;
          console.log("[FFmpeg] TTS audio written");
        } catch (e) {
          console.warn("[FFmpeg] Failed to load TTS audio:", e);
        }
      }

      // Write intro/outro files
      let hasIntro = false, hasOutro = false;
      if (intro) {
        try {
          setProgressMsg("Intro video ထည့်နေသည်...");
          const introData = await fetchFile(intro);
          await ffmpeg.writeFile("intro.mp4", introData);
          hasIntro = true;
          console.log("[FFmpeg] Intro file written");
        } catch (e) { console.warn("[FFmpeg] Failed to load intro:", e); }
      }
      if (outro) {
        try {
          setProgressMsg("Outro video ထည့်နေသည်...");
          const outroData = await fetchFile(outro);
          await ffmpeg.writeFile("outro.mp4", outroData);
          hasOutro = true;
          console.log("[FFmpeg] Outro file written");
        } catch (e) { console.warn("[FFmpeg] Failed to load outro:", e); }
      }

      const filters = buildFFmpegFilters({
        flipVideo,
        aspectRatio,
        autoColorGrade,
        copyrightBypass,
        watermarkText: textWatermark ? watermarkText : "",
        watermarkPosition,
      });

      setProgressMsg("Effects ထည့်နေသည်...");

      // ─── Step A: Apply visual effects to main video ───
      const mainOutputName = (hasIntro || hasOutro) ? "main_processed.mp4" : "output.mp4";
      const cmd: string[] = ["-i", "input.mp4"];

      if (hasTtsAudio) {
        cmd.push("-i", "tts.mp3");
      }

      // Build unified filter_complex to avoid duplicate -filter_complex flags (FFmpeg only accepts ONE)
      const logoInputIdx = hasTtsAudio ? 2 : 1;
      const hasLogo = hasLogoFile;

      if (hasLogo) {
        cmd.push("-i", "logo.png");
      }

      const posMap: Record<string, string> = {
        "bottom-left": "20:H-h-20",
        "bottom-right": "W-w-20:H-h-20",
        "top-left": "20:20",
        "top-right": "W-w-20:20",
        "center": "(W-w)/2:(H-h)/2",
      };
      const logoPos = posMap[logoPosition] || posMap["top-right"];

      // Determine if we need a single unified filter_complex
      const needsFilterComplex = hasLogo || (hasTtsAudio && (filters.length > 0 || hasLogo));

      if (needsFilterComplex) {
        // Build single unified filter_complex with video + audio graphs
        let fc = "";

        // Video graph
        if (filters.length > 0 && hasLogo) {
          fc += `[0:v]${filters.join(",")}[base];[${hasLogo ? (hasTtsAudio ? 2 : 1) : 0}:v]scale=80:80[logo];[base][logo]overlay=${logoPos}[vout]`;
        } else if (hasLogo) {
          fc += `[${hasLogo ? (hasTtsAudio ? 2 : 1) : 0}:v]scale=80:80[logo];[0:v][logo]overlay=${logoPos}[vout]`;
        } else if (filters.length > 0) {
          fc += `[0:v]${filters.join(",")}[vout]`;
        }

        // Audio graph (TTS mixing)
        if (hasTtsAudio) {
          if (fc) fc += ";";
          fc += `[0:a]volume=0.3[orig];[1:a]volume=1.0[tts];[orig][tts]amix=inputs=2:duration=shortest:dropout_transition=2[aout]`;
        }

        cmd.push("-filter_complex", fc);

        // Map outputs
        if (fc.includes("[vout]")) {
          cmd.push("-map", "[vout]");
        } else {
          cmd.push("-map", "0:v");
        }
        if (hasTtsAudio) {
          cmd.push("-map", "[aout]");
        } else {
          cmd.push("-map", "0:a?");
        }
      } else if (filters.length > 0 && !hasTtsAudio) {
        // Simple case: only video filters, no logo, no TTS
        cmd.push("-vf", filters.join(","));
      } else if (hasTtsAudio && !hasLogo && filters.length === 0) {
        // Only TTS audio mixing, no video filters or logo
        cmd.push("-filter_complex", `[0:a]volume=0.3[orig];[1:a]volume=1.0[tts];[orig][tts]amix=inputs=2:duration=shortest:dropout_transition=2[aout]`);
        cmd.push("-map", "0:v", "-map", "[aout]");
      }

      // Memory-optimized encoding settings
      cmd.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "28");

      cmd.push("-c:a", "aac", "-b:a", "128k");

      if (hasTtsAudio) {
        cmd.push("-shortest");
      }

      cmd.push("-movflags", "+faststart", "-y", mainOutputName);

      console.log("[FFmpeg] Running main encode:", cmd.join(" "));
      setProgressMsg("ဗီဒီယို တည်းဖြတ်နေသည်...");
      await ffmpeg.exec(cmd);

      // ─── Step B: Concat intro + main + outro if needed ───
      if (hasIntro || hasOutro) {
        setProgressMsg("Intro/Outro ပေါင်းနေသည်...");
        console.log("[FFmpeg] Concatenating intro/outro...");

        // Re-encode intro/outro to same format first
        if (hasIntro) {
          await ffmpeg.exec(["-i", "intro.mp4", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-c:a", "aac", "-b:a", "128k", "-y", "intro_norm.mp4"]);
        }
        if (hasOutro) {
          await ffmpeg.exec(["-i", "outro.mp4", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-c:a", "aac", "-b:a", "128k", "-y", "outro_norm.mp4"]);
        }

        // Build concat list
        let concatList = "";
        if (hasIntro) concatList += "file 'intro_norm.mp4'\n";
        concatList += `file '${mainOutputName}'\n`;
        if (hasOutro) concatList += "file 'outro_norm.mp4'\n";

        const encoder = new TextEncoder();
        await ffmpeg.writeFile("concat.txt", encoder.encode(concatList));
        await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "-y", "output.mp4"]);
      }

      setProgressMsg("Output ဖိုင် ပြင်ဆင်နေသည်...");
      const outputData = await ffmpeg.readFile("output.mp4");
      const outputBlob = new Blob([(outputData as any)], { type: "video/mp4" });
      console.log(`[FFmpeg] Output ready: ${(outputBlob.size / 1024 / 1024).toFixed(1)}MB`);

      // Cleanup
      try {
        await ffmpeg.deleteFile("input.mp4");
        if (hasLogoFile) await ffmpeg.deleteFile("logo.png");
        if (hasTtsAudio) await ffmpeg.deleteFile("tts.mp3");
        if (hasIntro) { await ffmpeg.deleteFile("intro.mp4"); await ffmpeg.deleteFile("intro_norm.mp4"); }
        if (hasOutro) { await ffmpeg.deleteFile("outro.mp4"); await ffmpeg.deleteFile("outro_norm.mp4"); }
      } catch { /* ignore cleanup errors */ }

      return outputBlob;
    } catch (e: any) {
      console.error("[FFmpeg] Processing error:", e);
      // Re-throw with context
      if (e.message?.startsWith("FFMPEG_")) throw e;
      throw new Error(`FFMPEG_PROCESS_FAIL:FFmpeg processing failed at ${progress}%: ${e.message}`);
    }
  };

  // ─── Upload output and save to gallery ───────────────
  const uploadAndSave = async (blob: Blob): Promise<string> => {
    if (!userId) throw new Error("Not authenticated");
    const fileName = `${userId}/video-multi-${Date.now()}.mp4`;
    const { error: uploadErr } = await supabase.storage
      .from("videos")
      .upload(fileName, blob, { contentType: "video/mp4", upsert: true });

    let finalUrl: string;
    if (uploadErr) {
      console.warn("Storage upload failed:", uploadErr);
      finalUrl = URL.createObjectURL(blob);
    } else {
      const { data: signedData } = await supabase.storage
        .from("videos")
        .createSignedUrl(fileName, 86400 * 7);
      finalUrl = signedData?.signedUrl || URL.createObjectURL(blob);
    }

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

    return finalUrl;
  };

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
    setSrtContent(null);
    setTtsAudioUrl(null);
    setErrorDetail(null);
    setProgress(0);

    try {
      let videoBlob: Blob | null = null;
      let videoSignedUrl: string | null = null;

      // ── Step 1: Get raw video data ──
      if (sourceMode === "url") {
        setProgress(5);
        setProgressMsg("Video ဒေါင်းလုဒ်လုပ်နေသည်...");

        const { data: dlData, error: dlError } = await supabase.functions.invoke("video-download", {
          body: { videoUrl, platform },
        });
        if (dlError) throw new Error(`Download error: ${dlError.message}`);
        if (dlData?.error) throw new Error(dlData.error);

        setProgress(25);
        setProgressMsg("ဒေါင်းလုဒ် ပြီးပါပြီ...");
        videoSignedUrl = dlData?.fileUrl;

        if (!hasAnyEffect) {
          setProgress(100);
          setResult(dlData?.fileUrl || videoUrl);
          refetch();
          saveOutput("video", dlData?.fileUrl || videoUrl, undefined, dlData?.fileUrl);
          toast({ title: "✅ ဗီဒီယို ဒေါင်းလုဒ် ပြီးပါပြီ!", description: `${dlData?.creditsUsed ?? cost} Credits` });
          return;
        }

        // Fetch blob for FFmpeg processing
        if (hasFFmpegEffect || logoOverlay || hasConcat) {
          try {
            const resp = await fetch(dlData?.fileUrl);
            if (resp.ok) videoBlob = await resp.blob();
          } catch {
            if (!hasAIFeature) {
              setResult(dlData?.fileUrl || videoUrl);
              refetch();
              toast({ title: "✅ ဗီဒီယို ရပြီး (Effects မထည့်နိုင်ပါ)" });
              return;
            }
          }
        }
      } else {
        videoBlob = uploadedFile!;
        setProgress(5);
        setProgressMsg("ဗီဒီယို ဖိုင် ဖတ်နေသည်...");

        if (hasAIFeature) {
          setProgress(10);
          setProgressMsg("Storage သို့ တင်နေသည်...");
          videoSignedUrl = await uploadVideoToStorage(uploadedFile!);
          setProgress(20);
        }
      }

      // ── Step 2: AI Subtitles (background job) ──
      if (autoSubtitles && videoSignedUrl) {
        setProgress(25);
        setProgressMsg("AI စာတန်းထိုး စတင်နေသည်...");

        const subtitleCreditCost = 3;
        const { data: startData, error: startError } = await supabase.functions.invoke("video-multi-start", {
          body: { videoUrl: videoSignedUrl, autoSubtitles: true, subtitleLanguage, creditCost: subtitleCreditCost },
        });

        if (startError) throw new Error(`Subtitle start error: ${startError.message}`);
        if (startData?.error) throw new Error(startData.error);

        const jobId = startData?.jobId;
        if (!jobId) throw new Error("Subtitle Job ID not returned");

        setProgress(30);
        setProgressMsg("Whisper ASR ခွဲခြမ်းနေသည်... (၁-၃ မိနစ် ကြာနိုင်ပါသည်)");

        await new Promise<void>((resolve, reject) => {
          startJobPolling(jobId, (completedJob) => {
            const params = completedJob.input_params as any;
            if (params?.srtContent) {
              setSrtContent(params.srtContent);
              setAiAnalysis(`✅ စာတန်းထိုး ပြီးပါပြီ!\n\n🌐 ရှာတွေ့သောဘာသာ: ${params.detectedLanguage || "auto"}\n📝 ဘာသာပြန်: ${params.translatedTo || subtitleLanguage}\n📄 SRT စာကြောင်း: ${(params.srtContent || "").split("\n").filter((l: string) => l.trim()).length} ကြောင်း`);
            }
            resolve();
          }, (errMsg) => reject(new Error(errMsg)));

          setTimeout(() => {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            reject(new Error("Subtitle generation timed out (10 min)"));
          }, 10 * 60 * 1000);
        });
      }

      // ── Step 3: TTS Audio (server-side) ──
      let generatedTtsUrl: string | null = null;
      if (ttsEnabled && srtContent) {
        setProgress(55);
        setProgressMsg("🔊 TTS Voice ထုတ်နေသည်...");

        const { data: ttsData, error: ttsError } = await supabase.functions.invoke("video-multi-process", {
          body: {
            action: "tts",
            srtText: srtContent,
            voice,
            language,
            creditCost: 3,
          },
        });

        if (ttsError) throw new Error(`TTS error: ${ttsError.message}`);
        if (ttsData?.error) throw new Error(ttsData.error);

        generatedTtsUrl = ttsData?.audioUrl;
        setTtsAudioUrl(generatedTtsUrl);
        console.log("[TTS] Audio generated:", generatedTtsUrl);
      }

      // ── Step 4: Object Removal (background job) ──
      if (objectRemoval && videoSignedUrl) {
        setProgress(60);
        setProgressMsg("🧹 Object removal AI processing...");

        const { data: orData, error: orError } = await supabase.functions.invoke("video-multi-process", {
          body: {
            action: "object_removal",
            videoUrl: videoSignedUrl,
            creditCost: 2,
          },
        });

        if (orError) throw new Error(`Object removal error: ${orError.message}`);
        if (orData?.error) throw new Error(orData.error);

        if (orData?.jobId) {
          setProgressMsg("🧹 Object removal processing... (Background)");
          await new Promise<void>((resolve, reject) => {
            startJobPolling(orData.jobId, (completedJob) => {
              if (completedJob.output_url) {
                videoSignedUrl = completedJob.output_url;
                setAiAnalysis((prev) => (prev || "") + "\n\n✅ Object removal ပြီးပါပြီ!");
              }
              resolve();
            }, (errMsg) => {
              // Don't fail entire pipeline, just note the error
              setAiAnalysis((prev) => (prev || "") + `\n\n⚠️ Object removal: ${errMsg}`);
              resolve();
            });

            setTimeout(() => {
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
              resolve(); // Don't fail, just skip
            }, 10 * 60 * 1000);
          });
        }
      }

      // ── Step 5: FFmpeg processing (if needed) ──
      let finalUrl: string | null = null;

      if (videoBlob && (hasFFmpegEffect || hasConcat || generatedTtsUrl)) {
        setProgress(40);
        setProgressMsg("FFmpeg Effects ထည့်နေသည်...");

        try {
          const outputBlob = await runFFmpegProcessing(
            videoBlob,
            generatedTtsUrl,
            introFile,
            outroFile
          );

          setProgress(90);
          setProgressMsg("Storage သို့ တင်နေသည်...");
          finalUrl = await uploadAndSave(outputBlob);
        } catch (ffmpegErr: any) {
          const errMsg = ffmpegErr.message || "";
          console.error("[FFmpeg] Error caught:", errMsg);

        if (errMsg.startsWith("FFMPEG_MEMORY_LIMIT:") || errMsg.startsWith("FFMPEG_PROCESS_FAIL:") || errMsg.startsWith("FFMPEG_LOAD_FAIL:")) {
            const userMsg = errMsg.split(":").slice(1).join(":");
            console.warn("[FFmpeg Fallback] Saving original video instead. Error:", userMsg);

            // Fallback: save original video to user's Store
            if (videoSignedUrl) {
              try {
                setProgressMsg("Original video ကို Store သို့ သိမ်းနေသည်...");
                const fallbackResp = await fetch(videoSignedUrl);
                if (fallbackResp.ok) {
                  const fallbackBlob = await fallbackResp.blob();
                  finalUrl = await uploadAndSave(fallbackBlob);
                  setAiAnalysis((prev) => (prev || "") + "\n\n⚠️ Effects apply မရပါ - original video ကို Store တွင် ထည့်ပြီးပါပြီ");
                } else {
                  finalUrl = videoSignedUrl;
                  setAiAnalysis((prev) => (prev || "") + "\n\n⚠️ FFmpeg effects apply မရပါ - original video link ပြပါမည်");
                }
              } catch {
                finalUrl = videoSignedUrl;
                setAiAnalysis((prev) => (prev || "") + "\n\n⚠️ FFmpeg effects apply မရပါ - original video ပြပါမည်");
              }
            }

            toast({
              title: "⚠️ Effects apply မရပါ",
              description: "Original video ကို Store တွင် ထည့်ပြီးပါပြီ",
              variant: "destructive",
            });
          } else {
            throw ffmpegErr;
          }
        }
      } else if (videoBlob && !hasFFmpegEffect && !hasConcat && !generatedTtsUrl) {
        setProgress(90);
        setProgressMsg("Storage သို့ တင်နေသည်...");
        finalUrl = await uploadAndSave(videoBlob);
      } else if (videoSignedUrl) {
        finalUrl = videoSignedUrl;
      }

      // ── Step 6: Deduct credits ──
      if (sourceMode === "upload") {
        const aiCostAlready = (autoSubtitles ? 3 : 0) + (ttsEnabled && generatedTtsUrl ? 3 : 0) + (objectRemoval ? 2 : 0);
        const remainingCost = cost - aiCostAlready;
        if (remainingCost > 0) {
          const { error: deductErr } = await supabase.rpc("deduct_user_credits", {
            _user_id: userId,
            _amount: remainingCost,
            _action: `Video Multi-Tool (Upload + Effects)`,
          });
          if (deductErr) console.warn("Credit deduction failed:", deductErr);
        }
      }

      setProgress(100);
      setProgressMsg("ပြီးပါပြီ!");
      if (finalUrl) {
        setResult(finalUrl);
        saveOutput("video", finalUrl, undefined, finalUrl);
      }
      refetch();

      const appliedEffects: string[] = [];
      if (flipVideo) appliedEffects.push("Flip");
      if (aspectRatio !== "original") appliedEffects.push(`Aspect ${aspectRatio}`);
      if (copyrightBypass) appliedEffects.push("© Bypass");
      if (autoColorGrade) appliedEffects.push("Color Grade");
      if (textWatermark && watermarkText) appliedEffects.push("Watermark");
      if (logoOverlay) appliedEffects.push("Logo");
      if (autoSubtitles) appliedEffects.push("Subtitles");
      if (ttsEnabled && generatedTtsUrl) appliedEffects.push("TTS Voice");
      if (introFile) appliedEffects.push("Intro");
      if (outroFile) appliedEffects.push("Outro");
      if (objectRemoval) appliedEffects.push("Object Remove");

      toast({
        title: "✅ ဗီဒီယို ပြီးပါပြီ!",
        description: appliedEffects.length > 0
          ? `Effects: ${appliedEffects.join(", ")} | ${cost} Credits`
          : `${cost} Credits သုံးစွဲပါပြီ`,
      });

    } catch (e: any) {
      console.error("Video Multi-Tool error:", e);
      const errorMsg = e.message || "Processing failed";
      setErrorDetail(`❌ Error: ${errorMsg}`);
      toast({ title: "အမှားရှိပါသည်", description: errorMsg, variant: "destructive" });
    } finally {
      setIsProcessing(false);
      // Don't reset progress on error - keep error detail visible for debugging
      // User can dismiss by starting a new generation
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  };

  const downloadSrt = () => {
    if (!srtContent) return;
    const blob = new Blob([srtContent], { type: "text/srt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles-${Date.now()}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3 p-4 pb-24">
      <ToolHeader title="AI Video Multi-Tool" subtitle="ဗီဒီယို ဘက်စုံတည်းဖြတ်ခြင်း (FFmpeg + AI)" onBack={onBack} />
      <p className="text-[10px] text-muted-foreground font-myanmar text-center -mt-2 mb-1">လင့်ထည့် သို့ ဗီဒီယို တင်ပြီး Effects ထည့် (Max 5 min, 100MB)</p>
      <FirstOutputGuide toolName="Video Multi-Tool" show={showGuide} steps={["Video URL ထည့်ပါ သို့ ဖိုင်တင်ပါ", "Effects/Settings များ ရွေးပါ", "Generate Video နှိပ်ပါ"]} />

      {/* 1. Source Input */}
      <Section title="Video Source" emoji="📥" defaultOpen={true}>
        <div className="flex gap-1.5 p-0.5 bg-secondary/30 rounded-xl">
          <button onClick={() => setSourceMode("url")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${sourceMode === "url" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-primary/10"}`}>
            <Globe className="w-3.5 h-3.5" /> URL Link
          </button>
          <button onClick={() => setSourceMode("upload")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${sourceMode === "upload" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-primary/10"}`}>
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
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 border-2 border-dashed border-primary/30 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground">ဗီဒီယို ဖိုင် ရွေးပါ</p>
                    <p className="text-[10px] text-muted-foreground">MP4, MOV, WebM (100MB max, 5 min)</p>
                  </div>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" onChange={handleFileUpload} className="hidden" />
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      {/* 2. Auto Subtitles (AI) */}
      <Section title="Auto Subtitles (AI)" emoji="💬">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-myanmar">Auto Subtitles (Whisper AI)</Label>
          <Switch checked={autoSubtitles} onCheckedChange={setAutoSubtitles} />
        </div>
        {autoSubtitles && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="bg-blue-500/10 rounded-xl p-2 border border-blue-500/20">
              <p className="text-[10px] text-blue-400 font-myanmar">
                🎯 Whisper AI ဖြင့် အသံကို စာသားအဖြစ် ပြောင်းပြီး ဘာသာပြန်ပေးပါမည်။ Myanmar ဖောင့် (Noto Sans Myanmar) ကို အသုံးပြုပါသည်။
              </p>
            </div>
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

      {/* 3. Voice & Language (TTS) */}
      <Section title="Voice & TTS" emoji="🎙️">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-myanmar">AI Voice Narration (TTS)</Label>
          <Switch checked={ttsEnabled} onCheckedChange={setTtsEnabled} />
        </div>
        {ttsEnabled && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="bg-purple-500/10 rounded-xl p-2 border border-purple-500/20">
              <p className="text-[10px] text-purple-400 font-myanmar">
                🔊 Subtitle text ကို OpenAI TTS-1-HD ဖြင့် voice narration ထုတ်ပြီး video ထဲ ထည့်ပေးပါမည်။ Subtitles ကို ဖွင့်ထားပါ။
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-myanmar">Voice</Label>
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
          </motion.div>
        )}
      </Section>

      {/* 4. Aspect Ratio & Character */}
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

      {/* 5. Copyright & Editing */}
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

      {/* 6. Watermark & Logo */}
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

      {/* 7. Object/Text Removal */}
      <Section title="Object/Text Removal" emoji="🧹">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-myanmar">Text/Logo ဖယ်ရှားခြင်း (AI)</Label>
          <Switch checked={objectRemoval} onCheckedChange={setObjectRemoval} />
        </div>
        {objectRemoval && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-amber-500/10 rounded-xl p-3 text-xs text-amber-400 font-myanmar space-y-1 border border-amber-500/20">
              <p>📌 ဗီဒီယိုမှ Text/Logo များကို Replicate AI ဖြင့် ဖယ်ရှားပေးပါမည်</p>
              <p>⏱️ Background job အဖြစ် server-side တွင် process ပြုလုပ်ပါမည်</p>
              <p>⚠️ Beta - ရလဒ် အပြည့်အဝ မရနိုင်ပါ</p>
            </div>
          </motion.div>
        )}
      </Section>

      {/* 8. Intro & Outro */}
      <Section title="Intro & Outro Videos" emoji="🎬">
        <div className="bg-green-500/10 rounded-xl p-2 border border-green-500/20 mb-2">
          <p className="text-[10px] text-green-400 font-myanmar">
            🎬 Intro/Outro ကို FFmpeg concat ဖြင့် ဗီဒီယို အစ/အဆုံးတွင် ပေါင်းပေးပါမည်
          </p>
        </div>
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
            {objectRemoval && <span className="px-2 py-0.5 bg-amber-500/15 rounded-full text-[10px] text-amber-500">Object Remove</span>}
            {introFile && <span className="px-2 py-0.5 bg-green-500/15 rounded-full text-[10px] text-green-500">Intro</span>}
            {outroFile && <span className="px-2 py-0.5 bg-green-500/15 rounded-full text-[10px] text-green-500">Outro</span>}
            {autoSubtitles && <span className="px-2 py-0.5 bg-blue-500/15 rounded-full text-[10px] text-blue-500">AI Subtitles</span>}
            {ttsEnabled && <span className="px-2 py-0.5 bg-purple-500/15 rounded-full text-[10px] text-purple-500">TTS Voice</span>}
            {characterEnabled && <span className="px-2 py-0.5 bg-primary/15 rounded-full text-[10px] text-primary">Character</span>}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 font-myanmar">💰 စုစုပေါင်း: {cost} Credits</p>
        </div>
      )}

      {/* Processing Progress */}
      {isProcessing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div className="flex-1">
              <span className="text-sm font-medium text-primary font-myanmar">{progressMsg || "ဗီဒီယို တည်းဖြတ်နေသည်..."}</span>
              {activeJobId && (
                <p className="text-[10px] text-muted-foreground font-myanmar mt-0.5">
                  🔄 Background processing... browser ပိတ်ထားလည်း Store တွင် ပေါ်လာပါမည်
                </p>
              )}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground text-right">{progress}%</p>
        </motion.div>
      )}

      {/* Error Detail */}
      {errorDetail && !isProcessing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-destructive/30 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-destructive font-myanmar">Processing Error</p>
              <p className="text-[10px] text-muted-foreground font-myanmar whitespace-pre-wrap mt-1">{errorDetail}</p>
            </div>
          </div>
          <Button onClick={() => setErrorDetail(null)} variant="outline" size="sm" className="text-xs w-full">
            <X className="w-3 h-3 mr-1" /> ပိတ်မည်
          </Button>
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
      <VideoLimitWarning maxSeconds={300} />

      {/* TTS Audio Result */}
      {ttsAudioUrl && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-purple-500/30 space-y-3">
          <h3 className="text-sm font-semibold text-purple-400 font-myanmar flex items-center gap-2">
            <Mic className="w-4 h-4" /> 🔊 TTS Voice Narration
          </h3>
          <audio src={ttsAudioUrl} controls className="w-full" />
          <p className="text-[10px] text-muted-foreground font-myanmar">✅ TTS audio ကို video ထဲ ထည့်ပြီးပါပြီ</p>
        </motion.div>
      )}

      {/* SRT Subtitle Result */}
      {srtContent && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-blue-500/30 space-y-3">
          <h3 className="text-sm font-semibold text-blue-400 font-myanmar flex items-center gap-2">
            <FileText className="w-4 h-4" /> 💬 AI Subtitles (SRT)
          </h3>
          <div className="bg-secondary/30 rounded-xl p-3 max-h-[200px] overflow-y-auto">
            <pre className="text-xs text-foreground whitespace-pre-wrap font-myanmar leading-relaxed">{srtContent}</pre>
          </div>
          <div className="flex gap-2">
            <Button onClick={downloadSrt} variant="outline" className="flex-1 text-xs">
              <Download className="w-3 h-3 mr-1" /> SRT ဒေါင်းလုဒ်
            </Button>
            <Button onClick={() => {
              navigator.clipboard.writeText(srtContent);
              toast({ title: "ကူးယူပြီးပါပြီ" });
            }} variant="outline" className="flex-1 text-xs">
              <Copy className="w-3 h-3 mr-1" /> ကူးယူမည်
            </Button>
          </div>
        </motion.div>
      )}

      {/* AI Analysis */}
      {aiAnalysis && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-green-500/30 space-y-2">
          <div className="bg-secondary/30 rounded-xl p-3">
            <p className="text-xs text-foreground whitespace-pre-wrap font-myanmar">{aiAnalysis}</p>
          </div>
        </motion.div>
      )}

      {/* Video Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">🎬 Output ဗီဒီယို</h3>
          <video src={result} controls className="w-full rounded-xl border border-primary/20" />
          <Button onClick={() => downloadVideo(result, "video-multi")} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white">
            <Download className="w-4 h-4 mr-2" /> Download Video
          </Button>
        </motion.div>
      )}

      {/* Feature Summary */}
      <div className="bg-secondary/10 rounded-xl p-3 border border-primary/10">
        <p className="text-[10px] text-muted-foreground font-myanmar text-center leading-relaxed">
          ⚡ FFmpeg.wasm (Flip, Crop, Color, Watermark, Logo, Intro/Outro) •
          🤖 AI Subtitles (Whisper + ဘာသာပြန်) •
          🔊 TTS Voice (OpenAI TTS-1-HD) •
          🧹 Object Removal (Replicate AI) •
          📤 ဖိုင်တင် / URL Link (Max 5 min)
        </p>
      </div>
    </motion.div>
  );
};
