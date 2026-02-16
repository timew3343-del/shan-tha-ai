import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Camera, CameraOff, Monitor, MonitorOff, Send, Loader2, X, Phone, PhoneOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Waveform visualizer component
const WaveformVisualizer = ({ active, color = "primary" }: { active: boolean; color?: string }) => {
  return (
    <div className="flex items-center justify-center gap-[3px] h-12">
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div
          key={i}
          className={`w-[3px] rounded-full ${color === "primary" ? "bg-primary" : "bg-green-400"}`}
          animate={active ? {
            height: [4, Math.random() * 32 + 8, 4],
          } : { height: 4 }}
          transition={active ? {
            duration: 0.4 + Math.random() * 0.4,
            repeat: Infinity,
            repeatType: "reverse",
            delay: i * 0.03,
          } : {}}
        />
      ))}
    </div>
  );
};

const LiveChat = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [screenActive, setScreenActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceLang, setVoiceLang] = useState("my-MM");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => { stopAllStreams(); };
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const stopAllStreams = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    window.speechSynthesis?.cancel();
  };

  // TTS voice output - responds in detected language
  const speakText = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const cleanText = text.replace(/[#*_`~>\[\]()]/g, "").replace(/\n+/g, " ").slice(0, 500);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Detect language from text content
    const hasBurmese = /[\u1000-\u109F]/.test(cleanText);
    const hasThai = /[\u0E00-\u0E7F]/.test(cleanText);
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(cleanText);
    const hasKorean = /[\uAC00-\uD7AF]/.test(cleanText);
    const hasChinese = /[\u4E00-\u9FFF]/.test(cleanText);
    
    if (hasBurmese) utterance.lang = "my-MM";
    else if (hasThai) utterance.lang = "th-TH";
    else if (hasJapanese) utterance.lang = "ja-JP";
    else if (hasKorean) utterance.lang = "ko-KR";
    else if (hasChinese) utterance.lang = "zh-CN";
    else utterance.lang = "en-US";
    
    utterance.rate = 0.95;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const toggleMic = () => {
    if (micActive) {
      recognitionRef.current?.stop();
      setMicActive(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast({ title: "Speech Recognition not supported", variant: "destructive" }); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = voiceLang;
    recognition.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(transcript);
      
      // Auto-detect language switch from user speech
      if (/[\u1000-\u109F]/.test(transcript)) setVoiceLang("my-MM");
      else if (/[a-zA-Z]/.test(transcript) && !/[\u1000-\u109F]/.test(transcript)) setVoiceLang("en-US");
    };
    recognition.onerror = () => setMicActive(false);
    recognition.onend = () => {
      if (micActive) {
        try { recognition.start(); } catch {}
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
    setMicActive(true);
  };

  const toggleCamera = async () => {
    if (cameraActive) {
      streamRef.current?.getVideoTracks().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraActive(false);
      return;
    }
    if (screenActive) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setScreenActive(false);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      streamRef.current = stream;
      setCameraActive(true);
    } catch { toast({ title: "ကင်မရာ ဖွင့်၍မရပါ", variant: "destructive" }); }
  };

  const toggleScreen = async () => {
    if (screenActive) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setScreenActive(false);
      return;
    }
    if (cameraActive) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setCameraActive(false);
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      streamRef.current = stream;
      setScreenActive(true);
      stream.getTracks()[0].onended = () => setScreenActive(false);
    } catch { toast({ title: "Screen share cancelled", variant: "destructive" }); }
  };

  const captureFrame = (): string | null => {
    if (!videoRef.current || (!cameraActive && !screenActive)) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.7);
  };

  const startCall = () => {
    setIsInCall(true);
    toggleMic();
  };

  const endCall = () => {
    setIsInCall(false);
    stopAllStreams();
    setMicActive(false);
    setCameraActive(false);
    setScreenActive(false);
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const handleSend = async () => {
    if (!input.trim() || !userId) return;
    const userText = input.trim();
    const userMsg: Message = { role: "user", content: userText };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const frameData = captureFrame();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          message: userText,
          imageBase64: frameData?.split(",")[1],
          imageType: frameData ? "image/jpeg" : undefined,
          roleId: "live_mode",
          rolePrompt: `You are Myanmar AI Studio's Live Assistant. Respond naturally and concisely for voice conversation. When user shares camera or screen, describe what you see. Match the user's language automatically. Default to Myanmar. Keep responses under 150 words for voice-friendly output.`,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "AI response failed");
      }
      if (!response.body) throw new Error("No stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = "", buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) {
              full += c;
              setMessages(prev => {
                const l = prev[prev.length - 1];
                if (l?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: full } : m);
                return [...prev, { role: "assistant", content: full }];
              });
            }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }

      // Auto voice output when in call mode
      if (isInCall && full) {
        speakText(full);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  // Auto-send when mic stops (voice mode)
  useEffect(() => {
    if (isInCall && !micActive && input.trim()) {
      const timer = setTimeout(() => { handleSend(); }, 800);
      return () => clearTimeout(timer);
    }
  }, [micActive, isInCall]);

  if (!userId) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground font-myanmar">ကျေးဇူးပြု၍ အရင်လော့ဂ်အင်ဝင်ပါ</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <h1 className="text-base font-bold text-foreground font-myanmar">Live AI Chat</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {isSpeaking && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
              <Volume2 className="w-3 h-3" />
              <span className="font-myanmar">ပြောနေသည်</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Video Preview */}
      <AnimatePresence>
        {(cameraActive || screenActive) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-3">
              <video ref={videoRef} className="w-full max-h-44 rounded-2xl bg-black object-contain shadow-lg" playsInline muted />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waveform - shown during active call */}
      {isInCall && !cameraActive && !screenActive && (
        <div className="px-6 py-4">
          <WaveformVisualizer active={micActive || isSpeaking} color={isSpeaking ? "green" : "primary"} />
          <p className="text-center text-xs text-muted-foreground font-myanmar mt-2">
            {isSpeaking ? "AI ပြောနေသည်..." : micActive ? "နားထောင်နေသည်..." : "Mic ကို နှိပ်ပြီး စကားပြောပါ"}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
              <Mic className="w-8 h-8 text-white" />
            </div>
            <p className="text-sm font-semibold text-foreground font-myanmar">Live AI Assistant</p>
            <p className="text-xs text-muted-foreground font-myanmar mt-1">
              အသံ၊ ကင်မရာ၊ Screen Share ဖြင့် AI နှင့် စကားပြောပါ
            </p>
            <p className="text-[11px] text-muted-foreground/60 font-myanmar mt-2">
              50+ ဘာသာစကား Voice Output ပံ့ပိုးပါသည်
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none font-myanmar">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : <span className="font-myanmar">{msg.content}</span>}
            </div>
          </motion.div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-secondary rounded-2xl px-4 py-3 flex gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Controls - Gemini Live Style */}
      <div className="p-4 border-t border-border/30 bg-card/80 backdrop-blur-sm space-y-3">
        {/* Text input row */}
        <div className="flex gap-2">
          <Textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="စာရိုက်ပါ သို့မဟုတ် အသံဖြင့် ပြောပါ..."
            className="flex-1 min-h-[44px] max-h-[80px] resize-none rounded-xl text-sm font-myanmar"
            disabled={isLoading} />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="h-10 w-10 rounded-xl shrink-0">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {/* Control buttons row - Camera, Share, Mic, End Call */}
        <div className="flex items-center justify-center gap-4">
          <Button size="icon" variant={cameraActive ? "default" : "outline"}
            onClick={toggleCamera} className="w-12 h-12 rounded-full">
            {cameraActive ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
          </Button>
          
          <Button size="icon" variant={screenActive ? "default" : "outline"}
            onClick={toggleScreen} className="w-12 h-12 rounded-full">
            {screenActive ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </Button>
          
          <Button size="icon" variant={micActive ? "default" : "outline"}
            onClick={isInCall ? toggleMic : startCall}
            className={`w-14 h-14 rounded-full ${micActive ? "bg-primary shadow-lg shadow-primary/30" : ""}`}>
            {micActive ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Button>
          
          {isInCall && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <Button size="icon" variant="destructive" onClick={endCall} className="w-12 h-12 rounded-full">
                <PhoneOff className="w-5 h-5" />
              </Button>
            </motion.div>
          )}
        </div>
        
        <p className="text-center text-[10px] text-muted-foreground/60 font-myanmar">
          Credit စနစ်ဖြင့် အလုပ်လုပ်ပါသည် • {isInCall ? "Call Mode Active" : "Mic နှိပ်ပြီး Call စတင်ပါ"}
        </p>
      </div>
    </div>
  );
};

export default LiveChat;
