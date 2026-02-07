import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Send, Square, Loader2, Sparkles, MessageCircle, Timer, AlertCircle, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface LiveCameraChatToolProps {
  userId?: string;
  onBack: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

const FREE_SECONDS = 10;
const DEDUCT_INTERVAL_SECONDS = 12;

export const LiveCameraChatTool = ({ userId, onBack }: LiveCameraChatToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditsUsedSession, setCreditsUsedSession] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const deductTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoAnalyzeRef = useRef<NodeJS.Timeout | null>(null);

  const creditPerTick = costs.live_camera_chat || 1;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopSession();
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    
    // Check for secure context
    if (!window.isSecureContext) {
      setCameraError("HTTPS connection လိုအပ်ပါသည်။ Secure context မဟုတ်ပါ။");
      return;
    }

    // Check for getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("ဤ browser တွင် ကင်မရာ မရနိုင်ပါ။ Chrome/Safari အသုံးပြုပါ။");
      return;
    }

    try {
      // Stop existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      let stream: MediaStream;
      
      // Progressive fallback for maximum mobile compatibility
      const constraints = [
        { video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: { facingMode: { ideal: facingMode } }, audio: false },
        { video: true, audio: false },
      ];

      for (let i = 0; i < constraints.length; i++) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
          break;
        } catch (err) {
          if (i === constraints.length - 1) throw err;
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream!;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.muted = true;
        
        // Wait for metadata to load before playing
        await new Promise<void>((resolve, reject) => {
          const vid = videoRef.current!;
          const onLoaded = () => { vid.removeEventListener('loadedmetadata', onLoaded); resolve(); };
          const onError = () => { vid.removeEventListener('error', onError); reject(new Error('Video load failed')); };
          if (vid.readyState >= 1) { resolve(); return; }
          vid.addEventListener('loadedmetadata', onLoaded);
          vid.addEventListener('error', onError);
        });
        
        await videoRef.current.play();
      }
      streamRef.current = stream!;
      setCameraActive(true);
      setCameraError(null);
    } catch (err: any) {
      console.error("Camera access error:", err);
      
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setCameraError("ကင်မရာ ခွင့်ပြုချက် ပိတ်ထားပါသည်။\n\nSettings → Privacy → Camera → Allow ကို ဖွင့်ပေးပါ။");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setCameraError("ကင်မရာ ရှာမတွေ့ပါ။ ကင်မရာ ချိတ်ဆက်ထားပါ သို့မဟုတ် အခြား device ဖြင့် စမ်းကြည့်ပါ။");
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        setCameraError("ကင်မရာကို အခြား app မှ အသုံးပြုနေပါသည်။ အခြား app များ ပိတ်ပြီး ထပ်စမ်းပါ။");
      } else {
        setCameraError(`ကင်မရာ ဖွင့်၍မရပါ: ${err?.message || 'Unknown error'}`);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const switchCamera = async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    stopCamera();
    // Small delay for cleanup
    setTimeout(() => startCamera(), 200);
  };

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || videoRef.current.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    if (!vw || !vh) return null;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.7);
  }, []);

  const startSession = () => {
    if (!cameraActive) {
      toast({ title: "ကင်မရာကို ဖွင့်ပါ", variant: "destructive" });
      return;
    }
    setSessionActive(true);
    setSessionTime(0);
    setCreditsUsedSession(0);

    timerRef.current = setInterval(() => {
      setSessionTime((prev) => prev + 1);
    }, 1000);

    deductTimerRef.current = setTimeout(() => {
      const deductInterval = setInterval(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { stopSession(); return; }

          const { data: profile } = await supabase
            .from("profiles")
            .select("credit_balance")
            .eq("user_id", userId!)
            .single();

          if (!profile || profile.credit_balance < creditPerTick) {
            toast({ title: "ခရက်ဒစ် ကုန်သွားပါပြီ", description: "Session ကို ရပ်တန့်လိုက်ပါပြီ", variant: "destructive" });
            stopSession();
            return;
          }

          await supabase.rpc("deduct_user_credits", { _user_id: userId!, _amount: creditPerTick, _action: "Live Camera Chat" });
          setCreditsUsedSession((prev) => prev + creditPerTick);
          refetchCredits();
        } catch (error) {
          console.error("Credit deduction error:", error);
        }
      }, DEDUCT_INTERVAL_SECONDS * 1000);

      deductTimerRef.current = deductInterval as any;
    }, FREE_SECONDS * 1000);

    autoAnalyzeRef.current = setInterval(() => { autoAnalyze(); }, 15000);

    toast({ title: "Session စတင်ပါပြီ", description: `ပထမ ${FREE_SECONDS} စက္ကန့် အခမဲ့` });
  };

  const stopSession = () => {
    setSessionActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (deductTimerRef.current) clearInterval(deductTimerRef.current);
    if (autoAnalyzeRef.current) clearInterval(autoAnalyzeRef.current);
    timerRef.current = null;
    deductTimerRef.current = null;
    autoAnalyzeRef.current = null;
  };

  const autoAnalyze = async () => {
    if (isProcessing) return;
    const frame = captureFrame();
    if (!frame) return;
    await sendToAI("ဤပုံကို အတိုချုပ် ရှင်းပြပါ", frame);
  };

  const sendToAI = async (message: string, imageBase64?: string) => {
    if (!userId) return;
    setIsProcessing(true);

    const userMsg: ChatMessage = { role: "user", content: message, image: imageBase64 ? "📸 Camera Frame" : undefined };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message, imageBase64: imageBase64?.split(",")[1], imageType: "image/jpeg" }),
      });

      if (!response.ok) {
        const errData = await response.json();
        if (response.status === 402) { toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", variant: "destructive" }); stopSession(); return; }
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
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: fullResponse } : m));
                }
                return [...prev, { role: "assistant", content: fullResponse }];
              });
            }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }
      refetchCredits();
    } catch (error: any) {
      console.error("Live chat error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg) return;
    setInput("");
    const frame = cameraActive ? captureFrame() : undefined;
    await sendToAI(msg, frame || undefined);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const isFreeTime = sessionTime <= FREE_SECONDS;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 p-4 pb-24">
      <ToolHeader
        title="AI Live Camera Chat"
        subtitle="ကင်မရာ + AI စကားပြောခြင်း"
        onBack={() => { stopSession(); stopCamera(); onBack(); }}
      />

      {/* Camera Preview */}
      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-primary/20">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          autoPlay
          muted
          style={{ minHeight: '200px' }}
        />

        {/* Camera error state */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-4">
            <div className="text-center max-w-xs">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
              <p className="text-sm text-white font-myanmar whitespace-pre-line mb-4">{cameraError}</p>
              <Button onClick={startCamera} className="bg-primary text-primary-foreground">
                <Camera className="w-4 h-4 mr-2" />
                ထပ်စမ်းမည်
              </Button>
            </div>
          </div>
        )}

        {/* Camera not active and no error */}
        {!cameraActive && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-white/70 font-myanmar">ကင်မရာ ဖွင့်နေသည်...</p>
            </div>
          </div>
        )}

        {/* Camera switch button */}
        {cameraActive && (
          <button onClick={switchCamera} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-black/70 transition-colors">
            <SwitchCamera className="w-4 h-4 text-white" />
          </button>
        )}

        {/* Session overlay */}
        {sessionActive && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${isFreeTime ? "bg-green-500/90 text-white" : "bg-destructive/90 text-white"}`}>
              <div className={`w-2 h-2 rounded-full ${isFreeTime ? "bg-white" : "bg-white animate-pulse"}`} />
              <Timer className="w-3 h-3" />
              {formatTime(sessionTime)}
              {isFreeTime ? " (အခမဲ့)" : ` • ${creditsUsedSession}cr`}
            </div>
          </div>
        )}
      </div>

      {/* Session Controls */}
      <div className="flex gap-2">
        {!sessionActive ? (
          <Button onClick={startSession} disabled={!cameraActive} className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3">
            <Sparkles className="w-4 h-4 mr-2" />
            <span className="font-myanmar">Session စတင်မည် (ပထမ {FREE_SECONDS}s အခမဲ့)</span>
          </Button>
        ) : (
          <Button onClick={stopSession} variant="destructive" className="flex-1 rounded-2xl py-3">
            <Square className="w-4 h-4 mr-2" />
            <span className="font-myanmar">Session ရပ်မည်</span>
          </Button>
        )}
      </div>

      {/* Credit Info */}
      <div className="gradient-card rounded-2xl p-3 border border-primary/10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-myanmar">
          <Timer className="w-3.5 h-3.5 text-primary" />
          <span>ပထမ {FREE_SECONDS}s အခမဲ့ • ပြီးရင် {DEDUCT_INTERVAL_SECONDS}s တိုင်း {creditPerTick} Credit</span>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="gradient-card rounded-2xl border border-primary/20 overflow-hidden">
        <div className="h-48 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground font-myanmar">Session စတင်ပြီး AI နှင့် စကားပြောပါ</p>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl p-2.5 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {msg.image && <span className="text-xs opacity-70">📸</span>}
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

          {isProcessing && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-2xl p-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-2.5 border-t border-primary/20 bg-background/50">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="ကင်မရာနှင့် ပတ်သက်ပြီး မေးပါ..."
                className="min-h-[40px] max-h-[80px] resize-none rounded-xl bg-secondary border border-primary/30 text-xs font-myanmar px-3 py-2"
                disabled={isProcessing}
              />
            </div>
            <Button onClick={handleSend} disabled={isProcessing || !input.trim()} className="shrink-0 h-9 w-9 rounded-xl bg-primary">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
