import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Camera, Send, Square, Loader2, Sparkles, MessageCircle, 
  AlertCircle, SwitchCamera, Mic, MicOff, Volume2, Eye, Radio, X,
  Video, Phone, Upload, ImageOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface LiveCameraChatToolProps {
  userId?: string;
  onBack: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  hasImage?: boolean;
}

type AIStatus = "idle" | "listening" | "thinking" | "speaking";
type LiveMode = "camera" | "voice";

export const LiveCameraChatTool = ({ userId, onBack }: LiveCameraChatToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("live_camera_chat", "Live Camera Chat");

  // Mode
  const [mode, setMode] = useState<LiveMode | null>(null);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // AI state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiStatus, setAiStatus] = useState<AIStatus>("idle");
  const [creditsUsed, setCreditsUsed] = useState(0);

  // Mic state
  const [micActive, setMicActive] = useState(false);
  const recognitionRef = useRef<any>(null);

  // TTS state
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const creditPerInteraction = costs.live_camera_chat || 2;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
    return () => { synthRef.current?.cancel(); };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopMic();
      synthRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== CAMERA ==========
  const startCamera = async () => {
    setCameraError(null);
    if (!window.isSecureContext) { setCameraError("HTTPS connection လိုအပ်ပါသည်။"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError("ဤ browser တွင် ကင်မရာ မရနိုင်ပါ။"); return; }

    try {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }

      const constraints = [
        { video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: { facingMode: { ideal: facingMode } }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      for (const c of constraints) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch { /* next */ }
      }
      if (!stream) throw new Error("No camera available");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("webkit-playsinline", "true");
        videoRef.current.muted = true;
        await new Promise<void>((resolve, reject) => {
          const vid = videoRef.current!;
          if (vid.readyState >= 1) { resolve(); return; }
          const onLoaded = () => { vid.removeEventListener("loadedmetadata", onLoaded); resolve(); };
          const onErr = () => { vid.removeEventListener("error", onErr); reject(new Error("Video load failed")); };
          vid.addEventListener("loadedmetadata", onLoaded);
          vid.addEventListener("error", onErr);
        });
        await videoRef.current.play();
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setCameraError("PERMISSION_DENIED");
      } else if (err?.name === "NotFoundError") {
        setCameraError("ကင်မရာ ရှာမတွေ့ပါ။");
      } else {
        setCameraError(`ကင်မရာ ဖွင့်၍မရပါ: ${err?.message || "Unknown"}`);
      }
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
    stopCamera();
    setTimeout(() => startCamera(), 250);
  };

  // ========== CAPTURE FRAME ==========
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || videoRef.current.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    if (!vw || !vh) return null;
    canvas.width = Math.min(vw, 640);
    canvas.height = Math.min(vh, 480);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6);
  }, []);

  // ========== MIC ==========
  const startMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Speech Recognition မရနိုင်ပါ", description: "Chrome browser အသုံးပြုပါ", variant: "destructive" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "my-MM";
    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + " ";
        else interim += event.results[i][0].transcript;
      }
      setInput(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") toast({ title: "Microphone ခွင့်ပြုချက် လိုအပ်သည်", variant: "destructive" });
    };

    recognition.onend = () => {
      if (finalTranscript.trim()) {
        setInput(finalTranscript.trim());
        setTimeout(() => { handleSendWithText(finalTranscript.trim()); finalTranscript = ""; }, 300);
      }
      setMicActive(false);
      setAiStatus("idle");
    };

    recognition.start();
    recognitionRef.current = recognition;
    setMicActive(true);
    setAiStatus("listening");
  };

  const stopMic = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setMicActive(false);
    if (aiStatus === "listening") setAiStatus("idle");
  };

  const toggleMic = () => { if (micActive) stopMic(); else startMic(); };

  // ========== TTS ==========
  const speakText = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const clean = text.replace(/[#*_`~>\[\]()!]/g, "").trim();
    if (!clean) return;
    const chunks = clean.match(/.{1,200}[.!?။\n]|.{1,200}/g) || [clean];
    setAiStatus("speaking");
    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      if (i === chunks.length - 1) utterance.onend = () => setAiStatus("idle");
      synthRef.current!.speak(utterance);
    });
  };

  // ========== SEND TO AI ==========
  const sendToAI = async (message: string, imageBase64?: string) => {
    if (!userId) return;
    if ((credits || 0) < creditPerInteraction) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${creditPerInteraction} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }
    setAiStatus("thinking");
    const userMsg: ChatMessage = { role: "user", content: message, hasImage: !!imageBase64 };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message, imageBase64: imageBase64?.split(",")[1], imageType: "image/jpeg" }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 402) { toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", variant: "destructive" }); return; }
        throw new Error(errData.error || "AI error");
      }
      if (!response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullResponse } : m);
                return [...prev, { role: "assistant", content: fullResponse }];
              });
            }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }

      await supabase.rpc("deduct_user_credits", { _user_id: userId, _amount: creditPerInteraction, _action: "Live AI Vision & Voice" });
      setCreditsUsed(prev => prev + creditPerInteraction);
      refetchCredits();
      saveOutput("text", fullResponse);
      if (fullResponse) speakText(fullResponse); else setAiStatus("idle");
    } catch (error: any) {
      console.error("Live AI error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
      setAiStatus("idle");
    }
  };

  const handleSendWithText = async (text: string) => {
    if (!text.trim()) return;
    setInput("");
    const frame = mode === "camera" && cameraActive ? captureFrame() : undefined;
    await sendToAI(text, frame || undefined);
  };

  const handleSend = () => handleSendWithText(input);
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleAnalyzeNow = () => {
    const frame = captureFrame();
    if (!frame) { toast({ title: "ကင်မရာ ပုံ မရပါ", variant: "destructive" }); return; }
    sendToAI("ဤပုံတွင် ဘာတွေ မြင်ရသနည်း။ အသေးစိတ် ရှင်းပြပါ", frame);
  };

  const handleStopAll = () => {
    stopMic();
    synthRef.current?.cancel();
    stopCamera();
    setAiStatus("idle");
    toast({ title: "Session ရပ်တန့်ပြီး", description: `စုစုပေါင်း ${creditsUsed} Credits သုံးခဲ့သည်` });
  };

  // Enter a mode
  const enterMode = (m: LiveMode) => {
    setMode(m);
    setMessages([]);
    setCreditsUsed(0);
    if (m === "camera") {
      setTimeout(() => startCamera(), 200);
    }
  };

  const exitMode = () => {
    handleStopAll();
    setMode(null);
  };

  // ========== MODE SELECTOR ==========
  if (!mode) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-4 pb-24">
        <ToolHeader title="Live AI" subtitle="ကင်မရာ + အသံ + AI = Real-time" onBack={onBack} />
        <FirstOutputGuide toolName="Live AI" show={showGuide} steps={["Mode ရွေးပါ", "မေးခွန်းမေးပါ", "AI က ဖြေပါလိမ့်မည်"]} />

        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-lg font-bold text-foreground font-myanmar mb-1">Live AI</h2>
          <p className="text-sm text-muted-foreground font-myanmar">သင့်အတွက် အဆင်ပြေရာ mode ကို ရွေးပါ</p>
        </div>

        <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => enterMode("camera")}
            className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-6 text-left transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground font-myanmar text-base mb-1">📸 Live Camera Chat</h3>
                <p className="text-xs text-muted-foreground font-myanmar leading-relaxed">ကင်မရာဖွင့်ပြီး ပုံပြ၍ AI ကို မေးပါ။ Real-time vision analysis</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Camera + Text + Voice</span>
            </div>
          </motion.button>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => enterMode("voice")}
            className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-6 text-left transition-all hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <Mic className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground font-myanmar text-base mb-1">🎤 Voice Chat</h3>
                <p className="text-xs text-muted-foreground font-myanmar leading-relaxed">အသံနဲ့ ပြောပြီး AI ကို မေးပါ။ AI ကလည်း အသံနဲ့ ပြန်ဖြေပါမည်</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">Voice-to-Voice</span>
            </div>
          </motion.button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground font-myanmar mt-4">
          {creditPerInteraction} Credit / interaction • Idle = Free
        </p>
      </motion.div>
    );
  }

  // ========== CAMERA MODE (Gemini Live Style - Dark Full Screen) ==========
  if (mode === "camera") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Top Bar */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white/80" />
            <span className="text-white/90 font-semibold text-sm">Live</span>
          </div>
          {cameraActive && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/80 text-white text-[10px] font-bold">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
              </div>
              {creditsUsed > 0 && (
                <span className="text-[10px] text-white/60 px-2 py-0.5 rounded-full bg-white/10">{creditsUsed} Cr</span>
              )}
            </div>
          )}
          <button onClick={() => { /* toggle image off - placeholder */ }} className="p-1.5">
            <ImageOff className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Camera View - Full screen */}
        <div className="flex-1 relative overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline autoPlay muted />

          {/* Camera Permission Denied - Explanation */}
          {cameraError === "PERMISSION_DENIED" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/95 p-6">
              <div className="text-center max-w-xs space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-white font-bold font-myanmar text-base">ကင်မရာ ခွင့်ပြုချက် လိုအပ်ပါသည်</h3>
                <div className="bg-white/10 rounded-xl p-4 text-left space-y-2">
                  <p className="text-white/80 text-xs font-myanmar leading-relaxed">
                    ဤ feature ကို အသုံးပြုရန် သင့် browser မှ ကင်မရာ ခွင့်ပြုချက် လိုအပ်ပါသည်။
                  </p>
                  <div className="space-y-1.5 text-[11px] text-white/60 font-myanmar">
                    <p>📱 <strong>Mobile:</strong> Settings → Apps → Browser → Permissions → Camera → Allow</p>
                    <p>💻 <strong>Desktop:</strong> Address bar ဘေး 🔒 Lock icon → Camera → Allow</p>
                    <p>⚠️ Messenger Bubble / Screen Recorder / Overlay Apps များ ပိတ်ပါ</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={exitMode} variant="outline" className="flex-1 text-white border-white/20 bg-white/5">
                    <X className="w-4 h-4 mr-1" /> ပိတ်မည်
                  </Button>
                  <Button onClick={startCamera} className="flex-1 bg-primary">
                    <Camera className="w-4 h-4 mr-1" /> ထပ်စမ်းမည်
                  </Button>
                </div>
              </div>
            </div>
          )}

          {cameraError && cameraError !== "PERMISSION_DENIED" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-4">
              <div className="text-center max-w-xs">
                <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
                <p className="text-sm text-white font-myanmar whitespace-pre-line mb-4">{cameraError}</p>
                <Button onClick={startCamera} className="bg-primary text-primary-foreground">
                  <Camera className="w-4 h-4 mr-2" /> ထပ်စမ်းမည်
                </Button>
              </div>
            </div>
          )}

          {!cameraActive && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-xs text-white/70 font-myanmar">ကင်မရာ ဖွင့်နေသည်...</p>
              </div>
            </div>
          )}

          {/* AI Status Overlay */}
          {aiStatus !== "idle" && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md bg-black/40 border border-white/10 text-white text-xs font-medium">
                {aiStatus === "listening" && <><Mic className="w-3.5 h-3.5 text-green-400 animate-pulse" /><span className="font-myanmar">နားထောင်နေသည်...</span></>}
                {aiStatus === "thinking" && <><Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" /><span className="font-myanmar">စဉ်းစားနေသည်...</span></>}
                {aiStatus === "speaking" && <><Volume2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" /><span className="font-myanmar">ပြောနေသည်...</span></>}
              </motion.div>
            </div>
          )}

          {/* AI Subtitle Response - Bottom overlay */}
          <AnimatePresence>
            {messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute bottom-4 left-3 right-3 z-10">
                <div className="bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-white/10 max-h-28 overflow-y-auto">
                  <p className="text-xs text-white/90 font-myanmar leading-relaxed">
                    {messages[messages.length - 1].content.slice(0, 400)}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Controls - Gemini Live style */}
        <div className="relative z-10 pb-8 pt-4 px-6">
          {/* Text input row */}
          <div className="flex items-end gap-2 mb-4">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyPress}
              placeholder={micActive ? "🎤 နားထောင်နေသည်..." : "စာရိုက်၍ မေးပါ..."}
              className="min-h-[36px] max-h-[60px] resize-none rounded-2xl bg-white/10 border border-white/20 text-xs font-myanmar px-3 py-2 text-white placeholder:text-white/40 flex-1"
              disabled={aiStatus === "thinking"} />
            <Button onClick={handleSend} disabled={aiStatus === "thinking" || !input.trim()}
              className="shrink-0 h-9 w-9 rounded-xl bg-primary">
              {aiStatus === "thinking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-5">
            {/* Camera Switch */}
            <button onClick={switchCamera} disabled={!cameraActive}
              className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-white/25 transition-all disabled:opacity-30">
              <Video className="w-6 h-6 text-white" />
            </button>

            {/* Analyze */}
            <button onClick={handleAnalyzeNow} disabled={!cameraActive || aiStatus === "thinking"}
              className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-white/25 transition-all disabled:opacity-30">
              <Upload className="w-6 h-6 text-white" />
            </button>

            {/* Mic - Large */}
            <button onClick={toggleMic} disabled={aiStatus === "thinking"}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                micActive
                  ? "bg-white/90 ring-4 ring-white/30 animate-pulse"
                  : "bg-white/15 backdrop-blur-sm border border-white/20 hover:bg-white/25"
              }`}>
              {micActive ? <MicOff className="w-7 h-7 text-black" /> : <Mic className="w-7 h-7 text-white" />}
            </button>

            {/* Close - Red */}
            <button onClick={exitMode}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ========== VOICE MODE (Gemini Live style - Dark ambient) ==========
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-[#0a0a1a] via-[#0d1b2a] to-[#1b2838] flex flex-col">
      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white/80" />
          <span className="text-white/90 font-semibold text-sm">Live</span>
        </div>
        {creditsUsed > 0 && (
          <span className="text-[10px] text-white/50 px-2 py-0.5 rounded-full bg-white/10">{creditsUsed} Credits</span>
        )}
      </div>

      {/* Main Ambient Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Large ambient glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120%] aspect-square">
          <motion.div
            animate={{
              scale: aiStatus === "speaking" ? [1, 1.08, 0.96, 1.04, 1] : aiStatus === "listening" ? [1, 1.05, 1] : 1,
              opacity: aiStatus === "idle" ? 0.3 : 0.7,
            }}
            transition={{ duration: aiStatus === "speaking" ? 0.8 : 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-full h-full rounded-[40%] bg-gradient-to-t from-blue-500/30 via-cyan-400/15 to-transparent blur-3xl"
          />
        </div>

        {/* Secondary glow */}
        <motion.div
          animate={{
            scale: aiStatus !== "idle" ? [1, 1.1, 1] : 1,
            opacity: aiStatus === "idle" ? 0.15 : 0.4,
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[80%] aspect-[2/1] rounded-[50%] bg-gradient-to-t from-blue-400/20 via-sky-300/10 to-transparent blur-2xl"
        />

        {/* Status text */}
        <motion.p key={aiStatus} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-sm font-myanmar text-center text-white/60 mb-8">
          {aiStatus === "idle" && "🎤 Mic ဖွင့်ပြီး ပြောပါ"}
          {aiStatus === "listening" && "နားထောင်နေသည်..."}
          {aiStatus === "thinking" && "AI စဉ်းစားနေသည်..."}
          {aiStatus === "speaking" && "AI ပြောနေသည်..."}
        </motion.p>

        {/* AI Subtitle Response - floating at bottom of ambient area */}
        <AnimatePresence>
          {messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute bottom-6 left-4 right-4 z-10 max-h-28 overflow-y-auto">
              <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3 border border-white/5">
                <p className="text-xs text-white/80 font-myanmar leading-relaxed">
                  {messages[messages.length - 1].content.slice(0, 400)}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 pb-8 pt-4 px-6">
        {/* Text input */}
        <div className="flex items-end gap-2 mb-4">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyPress}
            placeholder={micActive ? "🎤 နားထောင်နေသည်..." : "စာရိုက်၍ မေးပါ..."}
            className="min-h-[36px] max-h-[60px] resize-none rounded-2xl bg-white/10 border border-white/15 text-xs font-myanmar px-3 py-2 text-white placeholder:text-white/30 flex-1"
            disabled={aiStatus === "thinking"} />
          <Button onClick={handleSend} disabled={aiStatus === "thinking" || !input.trim()}
            className="shrink-0 h-9 w-9 rounded-xl bg-primary">
            {aiStatus === "thinking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {/* Action buttons - matching reference image layout */}
        <div className="flex items-center justify-center gap-5">
          {/* Switch to Camera */}
          <button onClick={() => { exitMode(); setTimeout(() => enterMode("camera"), 100); }}
            className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-white/25 transition-all">
            <Video className="w-6 h-6 text-white" />
          </button>

          {/* Upload placeholder */}
          <button className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-white/25 transition-all opacity-40" disabled>
            <Upload className="w-6 h-6 text-white" />
          </button>

          {/* Mic - Large center */}
          <button onClick={toggleMic} disabled={aiStatus === "thinking"}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              micActive
                ? "bg-white/90 ring-4 ring-white/30 animate-pulse"
                : "bg-white/15 backdrop-blur-sm border border-white/20 hover:bg-white/25"
            }`}>
            {micActive ? <MicOff className="w-7 h-7 text-black" /> : <Mic className="w-7 h-7 text-white" />}
          </button>

          {/* Close - Red */}
          <button onClick={exitMode}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
