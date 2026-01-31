import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Camera, Upload, Play, Square, Download, Share2, 
  Loader2, AlertCircle, Sparkles, Video, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { Watermark } from "@/components/Watermark";
import { cn } from "@/lib/utils";

// MediaPipe types
declare global {
  interface Window {
    FaceMesh: any;
    Pose: any;
    Camera: any;
  }
}

type ProcessingStage = "idle" | "tracking" | "uploading" | "animating" | "finalizing" | "complete" | "error";

const AILiveCam = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceFace, setSourceFace] = useState<File | null>(null);
  const [sourceFacePreview, setSourceFacePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
  const [progress, setProgress] = useState(0);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [mediaPipeLoaded, setMediaPipeLoaded] = useState(false);
  
  const { credits, deductCredits, refetch: refetchCredits } = useCredits(userId || undefined);
  const { costs } = useCreditCosts();
  
  const CHARACTER_ANIMATION_COST = costs.live_camera || 15;
  const MAX_RECORDING_TIME = 10; // seconds

  // Initialize user session
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
      setIsLoading(false);
    };
    checkAuth();
  }, [navigate]);

  // Load MediaPipe scripts
  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        // Load MediaPipe Face Mesh
        const faceMeshScript = document.createElement("script");
        faceMeshScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
        faceMeshScript.crossOrigin = "anonymous";
        
        // Load MediaPipe Pose
        const poseScript = document.createElement("script");
        poseScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js";
        poseScript.crossOrigin = "anonymous";
        
        // Load Camera Utils
        const cameraScript = document.createElement("script");
        cameraScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
        cameraScript.crossOrigin = "anonymous";

        document.body.appendChild(faceMeshScript);
        document.body.appendChild(poseScript);
        document.body.appendChild(cameraScript);

        // Wait for scripts to load
        await Promise.all([
          new Promise(resolve => { faceMeshScript.onload = resolve; }),
          new Promise(resolve => { poseScript.onload = resolve; }),
          new Promise(resolve => { cameraScript.onload = resolve; }),
        ]);

        setMediaPipeLoaded(true);
      } catch (error) {
        console.error("Failed to load MediaPipe:", error);
        toast({
          title: "MediaPipe Loading Error",
          description: "Failed to load tracking libraries. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    loadMediaPipe();
  }, [toast]);

  // Start camera with MediaPipe tracking
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);

        // Start MediaPipe tracking overlay
        if (mediaPipeLoaded && canvasRef.current) {
          initializeMediaPipeTracking();
        }
      }
    } catch (error) {
      console.error("Camera access error:", error);
      toast({
        title: "Camera Error",
        description: "ကင်မရာကို ဝင်ရောက်ခွင့်မရပါ။ ကျေးဇူးပြု၍ ခွင့်ပြုချက်ပေးပါ။",
        variant: "destructive",
      });
    }
  };

  // Initialize MediaPipe Face Mesh and Pose tracking
  const initializeMediaPipeTracking = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !window.FaceMesh) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;

    // Draw tracking overlay on animation frame
    const drawOverlay = () => {
      if (!videoRef.current || !cameraActive) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw glowing neon skeleton effect
      ctx.strokeStyle = "#00ff88";
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = 15;
      ctx.lineWidth = 2;

      // Simple face mesh outline simulation (actual MediaPipe would provide landmarks)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Face outline
      ctx.beginPath();
      ctx.ellipse(centerX, centerY - 50, 80, 100, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Eye indicators
      ctx.beginPath();
      ctx.arc(centerX - 30, centerY - 70, 15, 0, Math.PI * 2);
      ctx.arc(centerX + 30, centerY - 70, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Pose skeleton lines
      ctx.strokeStyle = "#ff00ff";
      ctx.shadowColor = "#ff00ff";
      
      // Shoulders
      ctx.beginPath();
      ctx.moveTo(centerX - 100, centerY + 80);
      ctx.lineTo(centerX + 100, centerY + 80);
      ctx.stroke();

      // Arms
      ctx.beginPath();
      ctx.moveTo(centerX - 100, centerY + 80);
      ctx.lineTo(centerX - 150, centerY + 200);
      ctx.moveTo(centerX + 100, centerY + 80);
      ctx.lineTo(centerX + 150, centerY + 200);
      ctx.stroke();

      if (cameraActive) {
        requestAnimationFrame(drawOverlay);
      }
    };

    drawOverlay();
  }, [cameraActive]);

  // Handle source face upload
  const handleSourceFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceFace(file);
      setSourceFacePreview(URL.createObjectURL(file));
    }
  };

  // Start recording
  const startRecording = () => {
    if (!videoRef.current?.srcObject) {
      toast({
        title: "Camera Not Active",
        description: "ကျေးဇူးပြု၍ ကင်မရာကို ဖွင့်ပါ။",
        variant: "destructive",
      });
      return;
    }

    chunksRef.current = [];
    const stream = videoRef.current.srcObject as MediaStream;
    
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedVideo(blob);
      setRecordedVideoUrl(URL.createObjectURL(blob));
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
    setRecordingTime(0);

    // Recording timer
    const timer = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= MAX_RECORDING_TIME) {
          stopRecording();
          clearInterval(timer);
          return MAX_RECORDING_TIME;
        }
        return prev + 1;
      });
    }, 1000);
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Process with AI (Replicate wan-animate)
  const processWithAI = async () => {
    if (!recordedVideo || !sourceFace || !userId) {
      toast({
        title: "Missing Input",
        description: "ဗီဒီယိုနှင့် Source Face နှစ်ခုလုံး လိုအပ်ပါသည်။",
        variant: "destructive",
      });
      return;
    }

    // Validate video duration
    if (recordingTime > MAX_RECORDING_TIME) {
      toast({
        title: "Video Too Long",
        description: "ဗီဒီယိုမှာ ၁၀ စက္ကန့်ထက် ပိုရှည်နေပါသည်။ ၁၀ စက္ကန့်အောက်သာ ထည့်ပေးပါ။",
        variant: "destructive",
      });
      return;
    }

    // Check credits
    if (credits < CHARACTER_ANIMATION_COST) {
      toast({
        title: "Insufficient Credits",
        description: "ခရက်ဒစ် မလောက်တော့ပါ။ ကျေးဇူးပြု၍ ခရက်ဒစ် ထပ်ဖြည့်ပေးပါ။",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessingStage("uploading");
      setProgress(10);

      // Convert files to base64
      const videoBase64 = await fileToBase64(recordedVideo);
      const faceBase64 = await fileToBase64(sourceFace);

      setProcessingStage("tracking");
      setProgress(25);

      // Call Replicate edge function
      setProcessingStage("animating");
      setProgress(40);

      const { data, error } = await supabase.functions.invoke("character-animate", {
        body: {
          video_base64: videoBase64,
          source_face_base64: faceBase64,
          user_id: userId,
        },
      });

      if (error) {
        throw new Error(error.message || "AI Processing Error");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Animation failed");
      }

      setProcessingStage("finalizing");
      setProgress(80);

      // Deduct credits after successful generation
      const deducted = await deductCredits(CHARACTER_ANIMATION_COST, "character_animation");
      if (!deducted) {
        throw new Error("Failed to deduct credits");
      }

      setResultVideoUrl(data.video_url);
      setProcessingStage("complete");
      setProgress(100);

      toast({
        title: "Animation Complete!",
        description: "AI Character Animation အောင်မြင်စွာ ပြီးဆုံးပါပြီ။",
      });

      refetchCredits();
    } catch (error: any) {
      console.error("AI Processing Error:", error);
      setProcessingStage("error");
      
      toast({
        title: "AI Processing Error",
        description: error.message || "API လက်ကျန်ငွေ မလုံလောက်ပါ သို့မဟုတ် API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။",
        variant: "destructive",
      });
    }
  };

  // Helper: Convert file to base64
  const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  // Download result
  const downloadResult = () => {
    if (resultVideoUrl) {
      const a = document.createElement("a");
      a.href = resultVideoUrl;
      a.download = `ai-animation-${Date.now()}.mp4`;
      a.click();
    }
  };

  // Share result
  const shareResult = async () => {
    if (resultVideoUrl && navigator.share) {
      try {
        await navigator.share({
          title: "AI Character Animation",
          text: "Check out my AI-animated video!",
          url: resultVideoUrl,
        });
      } catch (error) {
        console.error("Share failed:", error);
      }
    } else {
      navigator.clipboard.writeText(resultVideoUrl || "");
      toast({
        title: "Link Copied",
        description: "Video link copied to clipboard!",
      });
    }
  };

  // Get progress label
  const getProgressLabel = (): string => {
    switch (processingStage) {
      case "uploading": return "Uploading...";
      case "tracking": return "Tracking...";
      case "animating": return "Animating on H100...";
      case "finalizing": return "Finalizing Output...";
      case "complete": return "Complete!";
      case "error": return "Error occurred";
      default: return "Ready";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-navy flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-navy">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2 bg-primary/20 px-3 py-1.5 rounded-full">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">လက်ကျန်ခရက်ဒစ်: {credits}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold gradient-text mb-2">AI Character Animation</h1>
          <p className="text-muted-foreground text-sm">
            သင့်မျက်နှာကို Character နဲ့ လဲလှယ်ပြီး Animation ဖန်တီးပါ
          </p>
          <p className="text-xs text-amber-500 mt-1">
            Cost: {CHARACTER_ANIMATION_COST} Credits per video (Max 10 seconds)
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Camera & Recording */}
          <div className="space-y-4">
            {/* Live Camera Feed */}
            <div className="relative aspect-video bg-black/50 rounded-xl overflow-hidden border border-border/50">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              
              {!cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button onClick={startCamera} className="gradient-gold text-primary-foreground">
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </Button>
                </div>
              )}

              {/* Recording indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/90 px-3 py-1.5 rounded-full">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-sm font-medium">
                    {recordingTime}s / {MAX_RECORDING_TIME}s
                  </span>
                </div>
              )}

              {/* Watermark */}
              {userId && <Watermark userId={userId} />}
            </div>

            {/* Recording Controls */}
            <div className="flex justify-center gap-4">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  disabled={!cameraActive}
                  className="gradient-gold text-primary-foreground"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Record (Max 10s)
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </Button>
              )}
            </div>

            {/* Recorded Video Preview */}
            {recordedVideoUrl && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Recorded Video:</p>
                <video
                  src={recordedVideoUrl}
                  className="w-full aspect-video bg-black/50 rounded-lg"
                  controls
                />
              </div>
            )}
          </div>

          {/* Right: Source Face & Processing */}
          <div className="space-y-4">
            {/* Source Face Upload */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Upload Source Face (Character)</p>
              <label className="block aspect-square max-w-[200px] bg-muted/30 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden">
                {sourceFacePreview ? (
                  <img
                    src={sourceFacePreview}
                    alt="Source face"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Upload className="w-8 h-8" />
                    <span className="text-xs">Click to upload</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSourceFaceUpload}
                />
              </label>
            </div>

            {/* Process Button */}
            <Button
              onClick={processWithAI}
              disabled={!recordedVideo || !sourceFace || processingStage !== "idle"}
              className="w-full gradient-gold text-primary-foreground h-12"
            >
              {processingStage !== "idle" && processingStage !== "complete" && processingStage !== "error" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Animation ({CHARACTER_ANIMATION_COST} Credits)
                </>
              )}
            </Button>

            {/* Progress */}
            {processingStage !== "idle" && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{getProgressLabel()}</span>
                  <span className="text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Result Preview */}
            {resultVideoUrl && (
              <div className="space-y-3 p-4 bg-muted/20 rounded-xl border border-primary/30">
                <p className="text-sm font-medium text-primary">AI Generated Result:</p>
                <video
                  src={resultVideoUrl}
                  className="w-full aspect-video bg-black rounded-lg"
                  controls
                  autoPlay
                  loop
                />
                <div className="flex gap-2">
                  <Button onClick={downloadResult} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Save to Gallery
                  </Button>
                  <Button onClick={shareResult} variant="outline" className="flex-1">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            )}

            {/* Error State */}
            {processingStage === "error" && (
              <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">AI Processing Error</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    API လက်ကျန်ငွေ မလုံလောက်ပါ သို့မဟုတ် API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      setProcessingStage("idle");
                      setProgress(0);
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side-by-Side Comparison */}
        {recordedVideoUrl && resultVideoUrl && (
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-center text-muted-foreground">Original</p>
              <video
                src={recordedVideoUrl}
                className="w-full aspect-video bg-black rounded-lg"
                controls
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-center text-primary">AI Transformed</p>
              <video
                src={resultVideoUrl}
                className="w-full aspect-video bg-black rounded-lg"
                controls
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AILiveCam;
