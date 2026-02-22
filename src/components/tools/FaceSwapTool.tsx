import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Users, Upload, Sparkles, Download, Loader2, X, Video, Camera, Square, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";
import { useToolOutput } from "@/hooks/useToolOutput";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

interface FaceSwapToolProps {
  userId?: string;
  onBack: () => void;
}

const MAX_DURATION = 300; // 5 minutes
const SEGMENT_SIZE = 60; // 60 seconds per segment

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export const FaceSwapTool = ({ userId, onBack }: FaceSwapToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();

  const [inputMode, setInputMode] = useState<"upload" | "camera">("upload");
  const [targetVideoFile, setTargetVideoFile] = useState<File | Blob | null>(null);
  const [targetVideoUrl, setTargetVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [faceImageFile, setFaceImageFile] = useState<File | null>(null);
  const [faceImageUrl, setFaceImageUrl] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  // Camera state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const creditPerMinute = costs.face_swap || 62;
  const { showGuide, markAsLearned, saveOutput } = useToolOutput("face-swap", "Face Swap");

  // Dynamic credit calculation
  const dynamicCreditCost = useMemo(() => {
    if (videoDuration <= 0) return creditPerMinute;
    return Math.ceil(videoDuration / 60) * creditPerMinute;
  }, [videoDuration, creditPerMinute]);

  const segmentCount = useMemo(() => Math.ceil(Math.max(videoDuration, 1) / SEGMENT_SIZE), [videoDuration]);

  const estimatedTime = useMemo(() => {
    const mins = Math.max(3, Math.ceil(segmentCount * 2) + 2);
    return mins;
  }, [segmentCount]);

  // Recording timer with auto-stop at 5 minutes
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          if (prev + 1 >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startCamera = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      };
      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia(constraints); } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast({ title: "ကင်မရာဖွင့်ရန် မအောင်မြင်ပါ", description: "ကင်မရာ ခွင့်ပြုချက် ပေးပါ", variant: "destructive" });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setTargetVideoFile(blob);
      setTargetVideoUrl(url);
      setVideoDuration(recordingTime);
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopCamera();
    }
  }, []);

  useEffect(() => {
    if (inputMode === "camera") startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [inputMode]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "ဖိုင်ကြီးလွန်းပါသည်", description: "100MB အောက် ဗီဒီယိုရွေးပါ", variant: "destructive" });
      return;
    }

    const url = URL.createObjectURL(file);
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.src = url;
    tempVideo.onloadedmetadata = () => {
      const dur = Math.ceil(tempVideo.duration);
      if (dur > MAX_DURATION) {
        toast({
          title: "ဗီဒီယို ၅ မိနစ်ထက် ကျော်နေပါသည်",
          description: "၅ မိနစ်အတွင်းသာ တင်ပေးပါ",
          variant: "destructive",
        });
        URL.revokeObjectURL(url);
        return;
      }
      setTargetVideoFile(file);
      setTargetVideoUrl(url);
      setVideoDuration(dur);
    };
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "ဖိုင်ကြီးလွန်းပါသည်", description: "10MB အောက် ပုံရွေးပါ", variant: "destructive" });
      return;
    }
    setFaceImageFile(file);
    setFaceImageUrl(URL.createObjectURL(file));
  };

  const removeVideo = () => {
    if (targetVideoUrl) URL.revokeObjectURL(targetVideoUrl);
    setTargetVideoFile(null);
    setTargetVideoUrl(null);
    setVideoDuration(0);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const removeImage = () => {
    if (faceImageUrl) URL.revokeObjectURL(faceImageUrl);
    setFaceImageFile(null);
    setFaceImageUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // Split video into segments using browser-side FFmpeg
  const splitVideoWithFFmpeg = async (videoFile: File | Blob, duration: number): Promise<Blob[]> => {
    setStatusText("FFmpeg ကို ပြင်ဆင်နေသည်...");
    const ffmpeg = await getFFmpeg();

    const inputName = "input.mp4";
    const fileData = await fetchFile(videoFile instanceof File ? videoFile : new File([videoFile], "recording.webm"));
    await ffmpeg.writeFile(inputName, fileData);

    const segments: Blob[] = [];
    let offset = 0;
    let segIdx = 0;

    while (offset < duration) {
      const segLen = Math.min(SEGMENT_SIZE, duration - offset);
      const outName = `seg_${segIdx}.mp4`;

      setStatusText(`ဗီဒီယိုအပိုင်း ${segIdx + 1}/${segmentCount} ခွဲနေသည်...`);

      await ffmpeg.exec([
        "-i", inputName,
        "-ss", String(offset),
        "-t", String(segLen),
        "-c", "copy",
        "-avoid_negative_ts", "1",
        outName,
      ]);

      const data = await ffmpeg.readFile(outName);
      const blob = new Blob([new Uint8Array(data as Uint8Array)], { type: "video/mp4" });
      segments.push(blob);

      // Cleanup segment file
      await ffmpeg.deleteFile(outName);

      offset += segLen;
      segIdx++;
    }

    // Cleanup input file
    await ffmpeg.deleteFile(inputName);

    return segments;
  };

  const handleGenerate = async () => {
    if (!targetVideoFile || !faceImageFile) {
      toast({ title: "ဗီဒီယိုနှင့် ပုံထည့်ပါ", description: "Target Video နှင့် Face Image နှစ်ခုစလုံး လိုအပ်ပါသည်", variant: "destructive" });
      return;
    }
    if ((credits || 0) < dynamicCreditCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `Face Swap အတွက် ${dynamicCreditCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setResultVideo(null);
    setProgress(0);
    setStatusText("ပြင်ဆင်နေသည်...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("အကောင့်ဝင်ရန်လိုအပ်သည်");

      // Step 1: Split video using browser-side FFmpeg (saves Shotstack credits!)
      setProgress(2);
      let segmentBlobs: Blob[];

      if (videoDuration <= SEGMENT_SIZE) {
        // Single segment - no splitting needed
        segmentBlobs = [targetVideoFile instanceof Blob ? targetVideoFile : new Blob([targetVideoFile])];
        setProgress(10);
      } else {
        segmentBlobs = await splitVideoWithFFmpeg(targetVideoFile, videoDuration);
        setProgress(15);
      }

      setStatusText(`${segmentBlobs.length} အပိုင်းကို Storage သို့ တင်နေသည်...`);

      // Step 2: Upload each segment + face image to storage
      const segmentPaths: string[] = [];
      for (let i = 0; i < segmentBlobs.length; i++) {
        const segPath = `${userId}/face-swap/${Date.now()}-seg${i}.mp4`;
        const { error } = await supabase.storage.from("videos").upload(segPath, segmentBlobs[i]);
        if (error) throw new Error(`Segment ${i + 1} upload failed: ${error.message}`);
        segmentPaths.push(segPath);
        setProgress(15 + ((i + 1) / segmentBlobs.length) * 5);
        setStatusText(`Segment ${i + 1}/${segmentBlobs.length} တင်ပြီး`);
      }

      // Upload face image
      const faceExt = faceImageFile.name.split(".").pop() || "png";
      const facePath = `${userId}/face-swap/${Date.now()}-face.${faceExt}`;
      const { error: faceUpErr } = await supabase.storage.from("videos").upload(facePath, faceImageFile);
      if (faceUpErr) throw new Error("မျက်နှာပုံ အပ်လုဒ် မအောင်မြင်ပါ: " + faceUpErr.message);

      setProgress(22);
      setStatusText("Face Swap Pipeline စတင်နေသည်...");

      // Step 3: Call face-swap edge function with pre-split segment paths
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/face-swap`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            segmentPaths,
            facePath,
            duration: videoDuration,
            isLiveCamera: inputMode === "camera",
          }),
        },
      );

      const initResult = await response.json();
      if (!response.ok) throw new Error(initResult.error || "Face swap initialization failed");

      const { jobId } = initResult;

      // Step 4: Poll face-swap-process for status
      const maxPolls = 240;
      for (let i = 0; i < maxPolls; i++) {
        await new Promise(r => setTimeout(r, 5000));

        const pollResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/face-swap-process`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ jobId }),
          },
        );

        const pollData = await pollResp.json();

        if (pollData.progress) setProgress(pollData.progress);
        if (pollData.statusText) setStatusText(pollData.statusText);

        if (pollData.status === "completed") {
          setResultVideo(pollData.resultUrl);
          setProgress(100);
          refetchCredits();
          saveOutput("video", pollData.resultUrl);
          toast({
            title: "အောင်မြင်ပါသည် ✓",
            description: `Face Swap ပြီးပါပြီ (${pollData.creditsUsed || dynamicCreditCost} Credits)`,
          });
          return;
        }

        if (pollData.status === "failed") {
          throw new Error(pollData.error || "Face swap processing failed");
        }
      }

      throw new Error("Processing timed out - ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ");
    } catch (error: any) {
      console.error("Face swap error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "Face Swap လုပ်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setStatusText("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-4 pb-24"
    >
      <ToolHeader title="မျက်နှာပြောင်းဗီဒီယို" subtitle="Face Swap Technology" onBack={onBack} />

      <FirstOutputGuide
        toolName="Face Swap"
        steps={["ဗီဒီယို ထည့်ပါ", "မျက်နှာပုံ ထည့်ပါ", "Face Swap လုပ်ရန် နှိပ်ပါ"]}
        show={showGuide}
        onDismiss={markAsLearned}
      />

      {/* Input Mode Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={inputMode === "upload" ? "default" : "outline"}
          onClick={() => setInputMode("upload")}
          className="h-12 rounded-xl font-myanmar"
        >
          <Upload className="w-4 h-4 mr-2" />
          ဖိုင်တင်မည်
        </Button>
        <Button
          variant={inputMode === "camera" ? "default" : "outline"}
          onClick={() => setInputMode("camera")}
          className="h-12 rounded-xl font-myanmar"
        >
          <Camera className="w-4 h-4 mr-2" />
          Live Camera
        </Button>
      </div>

      {inputMode === "upload" ? (
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="block text-sm font-medium text-primary mb-1 font-myanmar">
            <Video className="w-4 h-4 inline mr-1" />
            Target Video (အများဆုံး ၅ မိနစ်)
          </label>
          <p className="text-[10px] text-muted-foreground mb-3 font-myanmar">
            ⚠️ ၅ မိနစ် (300 စက္ကန့်) အထိသာ တင်နိုင်ပါသည်
          </p>

          {targetVideoUrl ? (
            <div className="relative">
              <video src={targetVideoUrl} controls className="w-full max-h-48 object-contain rounded-xl border border-primary/30" />
              <button onClick={removeVideo} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white">
                <X className="w-3 h-3" />
              </button>
              {videoDuration > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground font-myanmar">
                  <Clock className="w-3 h-3" />
                  <span>ကြာချိန်: {formatTime(videoDuration)}</span>
                  <span>• အပိုင်း: {segmentCount}</span>
                  <span>• ခန့်မှန်း: ~{estimatedTime} မိနစ်</span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => videoInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
            >
              <Upload className="w-8 h-8 text-primary" />
              <span className="text-sm text-muted-foreground font-myanmar">ဗီဒီယိုထည့်ရန် နှိပ်ပါ</span>
            </button>
          )}

          <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
        </div>
      ) : (
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <label className="block text-sm font-medium text-primary mb-1 font-myanmar">
            <Camera className="w-4 h-4 inline mr-1" />
            Live Camera Recording (အများဆုံး ၅ မိနစ်)
          </label>

          {targetVideoUrl && !streamRef.current ? (
            <div className="relative">
              <video src={targetVideoUrl} controls className="w-full max-h-48 object-contain rounded-xl border border-primary/30" />
              <button onClick={() => { removeVideo(); startCamera(); }} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white">
                <X className="w-3 h-3" />
              </button>
              {videoDuration > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground font-myanmar">
                  <Clock className="w-3 h-3" />
                  <span>ကြာချိန်: {formatTime(videoDuration)}</span>
                  <span>• အပိုင်း: {segmentCount}</span>
                  <span>• ခန့်မှန်း: ~{estimatedTime} မိနစ်</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-48 object-cover rounded-xl bg-black border border-primary/30" />

              <div className="flex items-center justify-center gap-4">
                {isRecording && (
                  <span className="text-lg font-mono text-red-500 animate-pulse">
                    {formatTime(recordingTime)} / {formatTime(MAX_DURATION)}
                  </span>
                )}
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`h-14 w-14 rounded-full ${isRecording ? "bg-red-500 hover:bg-red-600" : "btn-gradient-red"}`}
                >
                  {isRecording ? <Square className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground font-myanmar">
                {isRecording ? "ရပ်ရန် နှိပ်ပါ" : "အသံဖမ်းရန် နှိပ်ပါ"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Face Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          <Users className="w-4 h-4 inline mr-1" />
          Face Image (လိုအပ်သည်)
        </label>
        <p className="text-xs text-muted-foreground mb-3 font-myanmar">အစားထိုးလိုသော မျက်နှာပုံ</p>

        {faceImageUrl ? (
          <div className="relative inline-block">
            <img src={faceImageUrl} alt="Face" className="w-full max-w-[150px] h-auto object-cover rounded-xl border border-primary/30" />
            <button onClick={removeImage} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => imageInputRef.current?.click()}
            className="w-full h-28 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
          >
            <Upload className="w-6 h-6 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">မျက်နှာပုံထည့်ပါ</span>
          </button>
        )}

        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </div>

      {/* Dynamic Credit Info */}
      {videoDuration > 0 && (
        <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground font-myanmar space-y-1">
          <div className="flex justify-between">
            <span>ဗီဒီယိုကြာချိန်:</span>
            <span className="font-medium">{formatTime(videoDuration)}</span>
          </div>
          <div className="flex justify-between">
            <span>အပိုင်းအရေအတွက်:</span>
            <span className="font-medium">{segmentCount} ပိုင်း ({SEGMENT_SIZE} စက္ကန့်စီ)</span>
          </div>
          <div className="flex justify-between">
            <span>ခန့်မှန်းကြာချိန်:</span>
            <span className="font-medium">~{estimatedTime} မိနစ်</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Shotstack ခေါ်သည့်အကြိမ်:</span>
            <span className="font-medium text-green-600">
              {segmentCount > 1 ? "၁ ကြိမ်သာ (Final Merge)" : "၀ ကြိမ် (မလိုအပ်)"}
            </span>
          </div>
          <div className="flex justify-between text-primary font-semibold text-sm pt-1 border-t border-border">
            <span>စုစုပေါင်း ခရက်ဒစ်:</span>
            <span>{dynamicCreditCost} Credits</span>
          </div>
        </div>
      )}

      {/* Progress */}
      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">{statusText || "Face Swap လုပ်နေသည်..."}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground text-center font-myanmar">
            ⏳ ခန့်မှန်း ~{estimatedTime} မိနစ် ကြာနိုင်ပါသည်။ စာမျက်နှာကို မပိတ်ပါနှင့်။
          </p>
        </motion.div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isLoading || !targetVideoFile || !faceImageFile}
        className="w-full btn-gradient-red py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Face Swap လုပ်နေသည်...
          </>
        ) : (
          <>
            <Users className="w-5 h-5 mr-2" />
            Face Swap လုပ်မည် ({videoDuration > 0 ? dynamicCreditCost : creditPerMinute} Credits)
          </>
        )}
      </Button>

      {/* Result */}
      {resultVideo && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="gradient-card rounded-2xl p-4 border border-primary/30"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary font-myanmar">ရလဒ်</h3>
            </div>
            <Button
              onClick={() => {
                const link = document.createElement("a");
                link.href = resultVideo;
                link.download = `face-swap-${Date.now()}.mp4`;
                link.click();
              }}
              size="sm"
              variant="outline"
              className="text-xs font-myanmar"
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
          <video src={resultVideo} controls autoPlay muted className="w-full rounded-xl border border-border" />
        </motion.div>
      )}
    </motion.div>
  );
};
