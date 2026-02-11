import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Camera, Send, Square, Loader2, Sparkles, MessageCircle, 
  AlertCircle, SwitchCamera, Mic, MicOff, Volume2, Eye, Radio
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

export const LiveCameraChatTool = ({ userId, onBack }: LiveCameraChatToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("live_camera_chat", "Live Camera Chat");

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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize TTS
  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  // Auto-start camera on mount
  useEffect(() => {
    startCamera();
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

    if (!window.isSecureContext) {
      setCameraError("HTTPS connection လိုအပ်ပါသည်။");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("ဤ browser တွင် ကင်မရာ မရနိုင်ပါ။ Chrome/Safari သုံးပါ။");
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      const constraints = [
        { video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: { facingMode: { ideal: facingMode } }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      for (const c of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch { /* try next */ }
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
        setCameraError("ကင်မရာ ခွင့်ပြုချက် ပိတ်ထားပါသည်။\nSettings → Privacy → Camera → Allow ဖွင့်ပါ။");
      } else if (err?.name === "NotFoundError") {
        setCameraError("ကင်မရာ ရှာမတွေ့ပါ။ ကင်မရာ ချိတ်ဆက်ပြီး ထပ်စမ်းပါ။");
      } else if (err?.name === "NotReadableError") {
        setCameraError("ကင်မရာကို အခြား app မှ သုံးနေသည်။ ပိတ်ပြီး ထပ်စမ်းပါ။");
      } else {
        setCameraError(`ကင်မရာ ဖွင့်၍မရပါ: ${err?.message || "Unknown error"}`);
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

  // ========== MICROPHONE (Web Speech API) ==========
  const startMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Speech Recognition မရနိုင်ပါ", description: "Chrome browser အသုံးပြုပါ", variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "my-MM"; // Myanmar, fallback to default

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInput(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        toast({ title: "Microphone ခွင့်ပြုချက် လိုအပ်သည်", variant: "destructive" });
      }
    };

    recognition.onend = () => {
      // Auto-send if we have final transcript
      if (finalTranscript.trim()) {
        setInput(finalTranscript.trim());
        // Auto-send after small delay
        setTimeout(() => {
          handleSendWithText(finalTranscript.trim());
          finalTranscript = "";
        }, 300);
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

  const toggleMic = () => {
    if (micActive) stopMic();
    else startMic();
  };

  // ========== TTS ==========
  const speakText = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    
    // Clean markdown
    const clean = text.replace(/[#*_`~>\[\]()!]/g, "").trim();
    if (!clean) return;

    // Split into chunks for long text
    const chunks = clean.match(/.{1,200}[.!?။\n]|.{1,200}/g) || [clean];
    
    setAiStatus("speaking");
    
    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      if (i === chunks.length - 1) {
        utterance.onend = () => setAiStatus("idle");
      }
      synthRef.current!.speak(utterance);
    });
  };

  // ========== SEND TO AI ==========
  const sendToAI = async (message: string, imageBase64?: string) => {
    if (!userId) return;

    // Credit check - per interaction
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
        body: JSON.stringify({
          message,
          imageBase64: imageBase64?.split(",")[1],
          imageType: "image/jpeg",
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", variant: "destructive" });
          return;
        }
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
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullResponse } : m);
                }
                return [...prev, { role: "assistant", content: fullResponse }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Deduct credits after success
      await supabase.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: creditPerInteraction,
        _action: "Live AI Vision & Voice",
      });
      setCreditsUsed(prev => prev + creditPerInteraction);
      refetchCredits();
      saveOutput("text", fullResponse);

      // Auto-speak the response
      if (fullResponse) {
        speakText(fullResponse);
      } else {
        setAiStatus("idle");
      }
    } catch (error: any) {
      console.error("Live AI error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
      setAiStatus("idle");
    }
  };

  const handleSendWithText = async (text: string) => {
    if (!text.trim()) return;
    setInput("");
    const frame = cameraActive ? captureFrame() : undefined;
    await sendToAI(text, frame || undefined);
  };

  const handleSend = () => handleSendWithText(input);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleAnalyzeNow = () => {
    const frame = captureFrame();
    if (!frame) {
      toast({ title: "ကင်မရာ ပုံ မရပါ", variant: "destructive" });
      return;
    }
    sendToAI("ဤပုံတွင် ဘာတွေ မြင်ရသနည်း။ အသေးစိတ် ရှင်းပြပါ", frame);
  };

  const handleStopAll = () => {
    stopMic();
    synthRef.current?.cancel();
    stopCamera();
    setAiStatus("idle");
    toast({ title: "Session ရပ်တန့်ပြီး", description: `စုစုပေါင်း ${creditsUsed} Credits သုံးခဲ့သည်` });
  };

  // Status label
  const statusConfig = {
    idle: { label: "Ready", color: "bg-muted text-muted-foreground" },
    listening: { label: "နားထောင်နေသည်...", color: "bg-green-500/20 text-green-400" },
    thinking: { label: "စဉ်းစားနေသည်...", color: "bg-amber-500/20 text-amber-400" },
    speaking: { label: "ပြောနေသည်...", color: "bg-blue-500/20 text-blue-400" },
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="space-y-3 p-4 pb-24">
      <ToolHeader
        title="Live AI Vision & Voice"
        subtitle="ကင်မရာ + အသံ + AI = Real-time Analysis"
        onBack={() => { handleStopAll(); onBack(); }}
      />
      <FirstOutputGuide toolName="Live Camera Chat" show={showGuide} steps={["ကင်မရာဖွင့်ပါ", "မေးခွန်းမေးပါ (အသံ/စာ)", "AI က ဖြေပါလိမ့်မည်"]} />

      {/* Camera Preview */}
      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-primary/20">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          autoPlay
          muted
          style={{ minHeight: "200px" }}
        />

        {/* LIVE indicator */}
        {cameraActive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/90 text-white text-[10px] font-bold">
              <Radio className="w-3 h-3 animate-pulse" />
              LIVE
            </div>
            {creditsUsed > 0 && (
              <div className="px-2 py-1 rounded-full bg-black/60 text-white/80 text-[10px]">
                {creditsUsed} Cr used
              </div>
            )}
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
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

        {/* Camera loading */}
        {!cameraActive && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-white/70 font-myanmar">ကင်မရာ ဖွင့်နေသည်...</p>
            </div>
          </div>
        )}

        {/* Camera switch */}
        {cameraActive && (
          <button onClick={switchCamera}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-black/70 transition-colors">
            <SwitchCamera className="w-4 h-4 text-white" />
          </button>
        )}

        {/* AI Status overlay */}
        {aiStatus !== "idle" && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm ${statusConfig[aiStatus].color}`}
            >
              {aiStatus === "listening" && <Mic className="w-3 h-3 animate-pulse" />}
              {aiStatus === "thinking" && <Loader2 className="w-3 h-3 animate-spin" />}
              {aiStatus === "speaking" && <Volume2 className="w-3 h-3 animate-pulse" />}
              <span className="font-myanmar">{statusConfig[aiStatus].label}</span>
            </motion.div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex items-center gap-2">
        {/* Mic Button */}
        <Button
          onClick={toggleMic}
          variant={micActive ? "destructive" : "outline"}
          size="icon"
          className={`shrink-0 w-12 h-12 rounded-2xl transition-all ${micActive ? "ring-2 ring-green-500 animate-pulse" : ""}`}
          disabled={aiStatus === "thinking"}
        >
          {micActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        {/* Analyze Camera Button */}
        <Button
          onClick={handleAnalyzeNow}
          variant="outline"
          className="shrink-0 h-12 rounded-2xl px-3 border-primary/30"
          disabled={!cameraActive || aiStatus === "thinking"}
        >
          <Eye className="w-4 h-4 mr-1.5" />
          <span className="text-xs font-myanmar">ကြည့်ခိုင်း</span>
        </Button>

        {/* Stop All */}
        <Button
          onClick={handleStopAll}
          variant="destructive"
          className="shrink-0 h-12 rounded-2xl px-3"
        >
          <Square className="w-4 h-4 mr-1.5" />
          <span className="text-xs font-myanmar">ရပ်မည်</span>
        </Button>

        {/* Credit info */}
        <div className="ml-auto text-right">
          <p className="text-[10px] text-muted-foreground">{creditPerInteraction} Cr/interaction</p>
          <p className="text-[10px] text-muted-foreground">Idle = Free</p>
        </div>
      </div>

      {/* Chat */}
      <div className="gradient-card rounded-2xl border border-primary/20 overflow-hidden">
        <div className="h-48 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground font-myanmar">🎤 Mic ဖွင့်ပြီး ပြောပါ သို့ 👁️ ကြည့်ခိုင်းပါ</p>
              <p className="text-[10px] text-muted-foreground/60 font-myanmar mt-1">ကင်မရာ idle = Credit မကျ</p>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl p-2.5 ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}>
                  {msg.hasImage && <span className="text-xs opacity-70">📸 </span>}
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none font-myanmar text-xs leading-relaxed">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-xs font-myanmar">{msg.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {aiStatus === "thinking" && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-2xl p-2.5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-myanmar">စဉ်းစားနေသည်...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Text input */}
        <div className="p-2.5 border-t border-primary/20 bg-background/50">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={micActive ? "🎤 နားထောင်နေသည်..." : "ကင်မရာ အကြောင်း မေးပါ..."}
                className="min-h-[40px] max-h-[80px] resize-none rounded-xl bg-secondary border border-primary/30 text-xs font-myanmar px-3 py-2"
                disabled={aiStatus === "thinking"}
              />
            </div>
            <Button onClick={handleSend} disabled={aiStatus === "thinking" || !input.trim()}
              className="shrink-0 h-9 w-9 rounded-xl bg-primary">
              {aiStatus === "thinking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
