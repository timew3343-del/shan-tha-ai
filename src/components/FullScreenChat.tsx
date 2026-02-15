import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Image, Loader2, X, MessageCircle, Sparkles, Camera, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

interface FullScreenChatProps {
  userId?: string;
}

const responseCache = new Map<string, string>();

export const FullScreenChat = ({ userId }: FullScreenChatProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageType, setSelectedImageType] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const openCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast({ title: "ကင်မရာ မရနိုင်ပါ", description: "HTTPS connection လိုအပ်ပါသည်", variant: "destructive" });
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      } catch {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }); }
        catch { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
      }
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.setAttribute('playsinline', 'true'); await videoRef.current.play(); }
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      toast({ title: "ကင်မရာ ဖွင့်၍မရပါ", description: "ကင်မရာခွင့်ပြုချက် ပေးပါ", variant: "destructive" });
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  };

  const captureFromCamera = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 320;
    canvas.height = videoRef.current.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    setSelectedImage(canvas.toDataURL("image/jpeg", 0.8));
    setSelectedImageType("image/jpeg");
    closeCamera();
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "ဖိုင်ကြီးလွန်းပါသည်", description: "5MB အောက် ရွေးပါ", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setSelectedImage(ev.target?.result as string); setSelectedImageType(file.type); };
    reader.readAsDataURL(file);
  };

  const removeImage = () => { setSelectedImage(null); setSelectedImageType(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const streamChat = useCallback(async (userMessage: string, imageBase64?: string, imageType?: string) => {
    const cacheKey = userMessage.trim().toLowerCase();
    if (!imageBase64 && responseCache.has(cacheKey)) return responseCache.get(cacheKey)!;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ message: userMessage, imageBase64: imageBase64?.split(",")[1], imageType }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 402) throw new Error("ခရက်ဒစ် မလုံလောက်ပါ");
      if (response.status === 429) throw new Error("Rate limit exceeded. ခဏစောင့်ပါ");
      throw new Error(errorData.error || "Failed to get response");
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
    if (!imageBase64 && fullResponse) responseCache.set(cacheKey, fullResponse);
    return fullResponse;
  }, []);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && !selectedImage) return;
    if (!userId) { toast({ title: "လော့ဂ်အင်လုပ်ပါ", variant: "destructive" }); return; }
    const creditCost = costs.ai_chat || 1;
    if ((credits || 0) < creditCost) { toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${creditCost} Credit လိုအပ်ပါသည်`, variant: "destructive" }); return; }

    const userMessage: Message = { role: "user", content: trimmedInput || "ဤပုံကို ရှင်းပြပါ", image: selectedImage || undefined };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    const imgSend = selectedImage, imgTypeSend = selectedImageType;
    removeImage();

    try {
      await streamChat(userMessage.content, imgSend || undefined, imgTypeSend || undefined);
      refetchCredits();
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
      setMessages(prev => prev.filter(m => m !== userMessage));
    } finally { setIsLoading(false); }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const openLiveMode = () => {
    window.open("/live-chat", "_blank", "width=800,height=600");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground font-myanmar">AI Assistant</h3>
          <p className="text-xs text-muted-foreground font-myanmar">{costs.ai_chat || 1} Credit/မေးခွန်း</p>
        </div>
        <div className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg">
          💰 {credits ?? 0}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center pt-20">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-primary/40" />
            </div>
            <p className="text-sm text-muted-foreground font-myanmar">မေးခွန်းတစ်ခုခု မေးကြည့်ပါ</p>
            <p className="text-xs text-muted-foreground/60 font-myanmar mt-1">ပုံတင်၍ AI ကို ရှင်းပြခိုင်းနိုင်ပါသည်</p>
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {msg.image && <img src={msg.image} alt="Uploaded" className="max-w-full h-auto rounded-xl mb-2 max-h-40 object-cover" />}
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none font-myanmar text-sm leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : <p className="text-sm font-myanmar">{msg.content}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-secondary rounded-2xl p-3 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Camera Preview */}
      {cameraOpen && (
        <div className="px-4 py-2 border-t border-border/50">
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video ref={videoRef} className="w-full h-32 object-cover" playsInline muted />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
              <Button size="sm" onClick={captureFromCamera} className="rounded-xl text-xs h-7 px-3"><Camera className="w-3 h-3 mr-1" /> ဓာတ်ပုံရိုက်</Button>
              <Button size="sm" variant="destructive" onClick={closeCamera} className="rounded-xl text-xs h-7 px-3"><X className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {selectedImage && !cameraOpen && (
        <div className="px-4 py-2 border-t border-border/50">
          <div className="relative inline-block">
            <img src={selectedImage} alt="Preview" className="h-16 w-auto rounded-lg object-cover" />
            <button onClick={removeImage} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground"><X className="w-3 h-3" /></button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} className="shrink-0 h-10 w-10 rounded-xl border-border/50" disabled={isLoading}>
            <Image className="w-4 h-4" />
          </Button>
          <button type="button" onClick={cameraOpen ? closeCamera : openCamera} disabled={isLoading} className="shrink-0 flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            <Camera className="w-5 h-5" />
            <span className="text-[10px] font-myanmar leading-none font-medium">ကင်မရာ</span>
          </button>
          <button type="button" onClick={openLiveMode} disabled={isLoading} className="shrink-0 flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            <Radio className="w-5 h-5" />
            <span className="text-[10px] font-myanmar leading-none font-medium">Live</span>
          </button>
          <div className="flex-1 relative">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyPress}
              placeholder="မေးခွန်းရိုက်ပါ..."
              className="min-h-[44px] max-h-[120px] w-full resize-none rounded-xl bg-secondary border border-border/50 text-sm font-myanmar px-4 py-3 focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
              disabled={isLoading} />
          </div>
          <Button onClick={handleSend} disabled={isLoading || (!input.trim() && !selectedImage)} className="shrink-0 h-10 w-10 rounded-xl">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};