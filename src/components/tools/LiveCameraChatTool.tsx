import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Send, Square, Loader2, Sparkles, X, MessageCircle, Timer } from "lucide-react";
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
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditsUsedSession, setCreditsUsedSession] = useState(0);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch (error) {
      console.error("Camera access error:", error);
      toast({
        title: "ကင်မရာ ဖွင့်၍မရပါ",
        description: "ကင်မရာခွင့်ပြုချက် ပေးပါ",
        variant: "destructive",
      });
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

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
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

    // Session timer
    timerRef.current = setInterval(() => {
      setSessionTime((prev) => prev + 1);
    }, 1000);

    // Credit deduction timer (starts after FREE_SECONDS)
    deductTimerRef.current = setTimeout(() => {
      // Start periodic deduction
      const deductInterval = setInterval(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            stopSession();
            return;
          }

          // Check balance first
          const { data: profile } = await supabase
            .from("profiles")
            .select("credit_balance")
            .eq("user_id", userId!)
            .single();

          if (!profile || profile.credit_balance < creditPerTick) {
            toast({
              title: "ခရက်ဒစ် ကုန်သွားပါပြီ",
              description: "Session ကို ရပ်တန့်လိုက်ပါပြီ",
              variant: "destructive",
            });
            stopSession();
            return;
          }

          // Deduct credits via RPC
          await supabase.rpc("deduct_user_credits", {
            _user_id: userId!,
            _amount: creditPerTick,
            _action: "Live Camera Chat",
          });

          setCreditsUsedSession((prev) => prev + creditPerTick);
          refetchCredits();
        } catch (error) {
          console.error("Credit deduction error:", error);
        }
      }, DEDUCT_INTERVAL_SECONDS * 1000);

      // Store for cleanup
      deductTimerRef.current = deductInterval as any;
    }, FREE_SECONDS * 1000);

    // Auto-analyze every 15 seconds
    autoAnalyzeRef.current = setInterval(() => {
      autoAnalyze();
    }, 15000);

    toast({
      title: "Session စတင်ပါပြီ",
      description: `ပထမ ${FREE_SECONDS} စက္ကန့် အခမဲ့`,
    });
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

    const userMsg: ChatMessage = {
      role: "user",
      content: message,
      image: imageBase64?.substring(0, 100) ? "📸 Camera Frame" : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message,
          imageBase64: imageBase64?.split(",")[1],
          imageType: "image/jpeg",
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        if (response.status === 402) {
          toast({
            title: "ခရက်ဒစ် မလုံလောက်ပါ",
            variant: "destructive",
          });
          stopSession();
          return;
        }
        throw new Error(errData.error || "AI error");
      }

      // Stream response
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
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      refetchCredits();
    } catch (error: any) {
      console.error("Live chat error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg) return;
    setInput("");

    // Capture current frame to include with question
    const frame = cameraActive ? captureFrame() : undefined;
    await sendToAI(msg, frame || undefined);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const isFreeTime = sessionTime <= FREE_SECONDS;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-3 p-4 pb-24"
    >
      <ToolHeader
        title="AI Live Camera Chat"
        subtitle="ကင်မရာ + AI စကားပြောခြင်း"
        onBack={() => {
          stopSession();
          stopCamera();
          onBack();
        }}
      />

      {/* Camera Preview */}
      <div className="relative aspect-video bg-black/80 rounded-2xl overflow-hidden border border-primary/20">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {!cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button onClick={startCamera} className="bg-primary text-primary-foreground">
              <Camera className="w-5 h-5 mr-2" />
              ကင်မရာဖွင့်ရန်
            </Button>
          </div>
        )}

        {/* Session overlay */}
        {sessionActive && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
              isFreeTime ? "bg-success/90 text-white" : "bg-destructive/90 text-white"
            }`}>
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
          <Button
            onClick={startSession}
            disabled={!cameraActive}
            className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            <span className="font-myanmar">Session စတင်မည် (ပထမ {FREE_SECONDS}s အခမဲ့)</span>
          </Button>
        ) : (
          <Button
            onClick={stopSession}
            variant="destructive"
            className="flex-1 rounded-2xl py-3"
          >
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
              <p className="text-xs text-muted-foreground font-myanmar">
                Session စတင်ပြီး AI နှင့် စကားပြောပါ
              </p>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-2.5 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {msg.image && (
                    <span className="text-xs opacity-70">📸</span>
                  )}
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
            <Button
              onClick={handleSend}
              disabled={isProcessing || !input.trim()}
              className="shrink-0 h-9 w-9 rounded-xl bg-primary"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
