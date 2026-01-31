import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Image, Loader2, X, MessageCircle, Sparkles, Upload } from "lucide-react";
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

interface AIChatbotProps {
  userId?: string;
}

// Simple cache for frequent questions
const responseCache = new Map<string, string>();

export const AIChatbot = ({ userId }: AIChatbotProps) => {
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "ဖိုင်ကြီးလွန်းပါသည်",
        description: "5MB အောက် ပုံရွေးပါ",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedImage(dataUrl);
      setSelectedImageType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setSelectedImageType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const streamChat = useCallback(async (userMessage: string, imageBase64?: string, imageType?: string) => {
    // Check cache first for text-only messages
    const cacheKey = userMessage.trim().toLowerCase();
    if (!imageBase64 && responseCache.has(cacheKey)) {
      return responseCache.get(cacheKey)!;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message: userMessage,
        imageBase64: imageBase64?.split(",")[1],
        imageType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 402) {
        throw new Error("Insufficient credits");
      }
      throw new Error(errorData.error || "Failed to get response");
    }

    if (!response.body) {
      throw new Error("No response stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let textBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      // Process line-by-line
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
            // Update the last assistant message progressively
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => 
                  i === prev.length - 1 ? { ...m, content: fullResponse } : m
                );
              }
              return [...prev, { role: "assistant", content: fullResponse }];
            });
          }
        } catch {
          // Incomplete JSON, put it back
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Cache the response for text-only messages
    if (!imageBase64 && fullResponse) {
      responseCache.set(cacheKey, fullResponse);
    }

    return fullResponse;
  }, []);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && !selectedImage) return;

    if (!userId) {
      toast({
        title: "လော့ဂ်အင်လုပ်ပါ",
        description: "AI နှင့် စကားပြောရန် အကောင့်ဝင်ပါ",
        variant: "destructive",
      });
      return;
    }

    const creditCost = costs.ai_chat || 1;
    if ((credits || 0) < creditCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `AI နှင့် စကားပြောရန် ${creditCost} Credit လိုအပ်ပါသည်`,
        variant: "destructive",
      });
      return;
    }

    // Add user message
    const userMessage: Message = {
      role: "user",
      content: trimmedInput || "ဤပုံကို ရှင်းပြပါ",
      image: selectedImage || undefined,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const imageToSend = selectedImage;
    const imageTypeToSend = selectedImageType;
    removeImage();

    try {
      await streamChat(userMessage.content, imageToSend || undefined, imageTypeToSend || undefined);
      refetchCredits();
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "AI မှ အဖြေရယူရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
      // Remove the failed user message or add error message
      setMessages(prev => prev.filter(m => m !== userMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="gradient-card rounded-2xl border border-primary/20 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-primary/20 bg-primary/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground font-myanmar">သိချင်တာများ မေးမြန်းရန်</h3>
          <p className="text-xs text-muted-foreground font-myanmar">
            AI နှင့် စကားပြောပါ • {costs.ai_chat || 1} Credit/မေးခွန်း
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-myanmar">
              မေးခွန်းတစ်ခုခု မေးကြည့်ပါ
            </p>
            <p className="text-xs text-muted-foreground/70 font-myanmar mt-1">
              ပုံတင်၍ AI ကို ရှင်းပြခိုင်းနိုင်ပါသည်
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
                className={`max-w-[85%] rounded-2xl p-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="Uploaded"
                    className="max-w-full h-auto rounded-xl mb-2 max-h-32 object-cover"
                  />
                )}
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none font-myanmar text-sm leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm font-myanmar">{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Skeleton loader while waiting for first token */}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-secondary rounded-2xl p-3 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {selectedImage && (
        <div className="px-4 py-2 border-t border-primary/10">
          <div className="relative inline-block">
            <img
              src={selectedImage}
              alt="Preview"
              className="h-16 w-auto rounded-lg object-cover"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-primary/20 bg-background/50">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-10 w-10 rounded-xl border-primary/30"
            disabled={isLoading}
          >
            <Image className="w-4 h-4" />
          </Button>
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="မေးခွန်းရိုက်ပါ..."
              className="min-h-[44px] max-h-[120px] w-full resize-none rounded-xl bg-secondary border border-primary/30 text-sm font-myanmar px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !selectedImage)}
            className="shrink-0 h-10 w-10 rounded-xl bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
