import { useState, useRef } from "react";
import { MessageCircle, Send, Upload, X, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface TopUpSupportChatProps {
  userId?: string;
}

const FAQ_ITEMS = [
  { q: "ခရက်ဒစ် မတိုးပါ", answer: "slip_upload" },
  { q: "ငွေလွှဲနည်း", answer: "KBZPay သို့မဟုတ် WaveMoney ဖြင့် အထက်ပါ ဖုန်းနံပါတ်သို့ ငွေလွှဲပြီး Screenshot တင်ပေးပါ။ Admin မှ စစ်ဆေးပြီး Credit ထည့်ပေးပါမည်။" },
  { q: "Credit ဘယ်နှစ်မိနစ်ကြာမှ ရမလဲ", answer: "ပုံမှန်အားဖြင့် ၃ မိနစ်အတွင်း ခရက်ဒစ်ထည့်ပေးပါသည်။ အချိန်ကြာပါက ငွေလွဲစလစ် Screenshot ကို ထပ်တင်ပေးပါ။" },
  { q: "Refund ရနိုင်သလား", answer: "Credit ဝယ်ပြီးပါက Refund ပြန်ပေးနိုင်ခြင်း မရှိပါ။ သို့သော် ပြဿနာရှိပါက Admin ထံ ဆက်သွယ်နိုင်ပါသည်။" },
];

export const TopUpSupportChat = ({ userId }: TopUpSupportChatProps) => {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string; isSlipUpload?: boolean }[]>([
    { role: "bot", text: "မင်္ဂလာပါ! ငွေဖြည့်ခြင်းနှင့် ပတ်သက်ပြီး အကူအညီ လိုအပ်ပါက မေးမြန်းနိုင်ပါသည်။" }
  ]);
  const [customMessage, setCustomMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showSlipUpload, setShowSlipUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFAQ = (faq: typeof FAQ_ITEMS[0]) => {
    setMessages(prev => [...prev, { role: "user", text: faq.q }]);
    
    if (faq.answer === "slip_upload") {
      setMessages(prev => [...prev, { 
        role: "bot", 
        text: "ခရက်ဒစ်မတိုးရသေးပါက သင့်ငွေလွဲစလစ် Screenshot ကို အောက်တွင် တင်ပေးပါ။ Admin မှ စစ်ဆေးပြီး ခရက်ဒစ်ထည့်ပေးပါမည်။",
        isSlipUpload: true
      }]);
      setShowSlipUpload(true);
    } else {
      setMessages(prev => [...prev, { role: "bot", text: faq.answer }]);
    }
  };

  const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setIsUploading(true);
    try {
      // Save inquiry to user_feedback for admin visibility
      await supabase.from("user_feedback").insert({
        user_id: userId,
        message: `[SUPPORT TICKET] ခရက်ဒစ်မတိုးပါ - ငွေလွဲစလစ် တင်ထားပါသည်။ Screenshot uploaded.`,
        user_name: "Support Request",
      });

      setMessages(prev => [...prev, { role: "user", text: "📸 ငွေလွဲစလစ် တင်ပြီးပါပြီ" }]);
      setMessages(prev => [...prev, { 
        role: "bot", 
        text: "ကျွန်ုပ်တို့အဖွဲ့မှ သင်၏ ငွေလွဲစလစ်ကို စစ်ဆေးနေပါသည်။ ခဏစောင့်ဆိုင်းပေးပါ။ ပုံမှန်အားဖြင့် ၅ မိနစ်အတွင်း ခရက်ဒစ်ထည့်ပေးပါမည်။" 
      }]);
      setShowSlipUpload(false);

      toast({ title: "✅ တင်ပြီးပါပြီ", description: "Admin မှ စစ်ဆေးနေပါသည်" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "အမှား", description: "ထပ်မံကြိုးစားပါ", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCustomMessage = async () => {
    if (!customMessage.trim() || !userId) return;
    
    const msg = customMessage.trim();
    setCustomMessage("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);

    // Save to feedback for admin
    await supabase.from("user_feedback").insert({
      user_id: userId,
      message: `[SUPPORT] ${msg}`,
      user_name: "Top-up Support",
    });

    setMessages(prev => [...prev, { 
      role: "bot", 
      text: "သင်၏ မေးခွန်းကို Admin ထံ ပေးပို့ပြီးပါပြီ။ အမြန်ဆုံး ပြန်လည်ဖြေကြားပေးပါမည်။" 
    }]);
  };

  return (
    <div className="gradient-card rounded-2xl border border-border/30 overflow-hidden animate-fade-up" style={{ animationDelay: "0.25s" }}>
      {/* Alert Notice */}
      <div className="px-4 py-3 bg-primary/5 border-b border-border/30 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed font-myanmar">
          ငွေလွှဲပြီး ၃ မိနစ်အတွင်း ခရက်ဒစ်မတိုးပါက ဤ Chatbot မှတစ်ဆင့် ဆက်သွယ်နိုင်ပါသည်။
        </p>
      </div>

      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground font-myanmar">အကူအညီ & ပံ့ပိုးမှု</p>
            <p className="text-[10px] text-muted-foreground">24/7 Support Chat</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Chat Messages */}
            <div className="px-4 pb-3 space-y-2 max-h-60 overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs font-myanmar leading-relaxed
                    ${msg.role === "user" 
                      ? "bg-primary/20 text-foreground rounded-br-md" 
                      : "bg-secondary/50 text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Slip Upload Section */}
            {showSlipUpload && (
              <div className="px-4 pb-3">
                <label className="flex flex-col items-center justify-center w-full py-4 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                  <Upload className="w-5 h-5 text-primary mb-1" />
                  <span className="text-xs text-muted-foreground font-myanmar">
                    {isUploading ? "တင်နေသည်..." : "ငွေလွဲစလစ် Screenshot တင်ပါ"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSlipUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>
            )}

            {/* FAQ Buttons */}
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {FAQ_ITEMS.map((faq, i) => (
                <button
                  key={i}
                  onClick={() => handleFAQ(faq)}
                  className="px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all font-myanmar"
                >
                  {faq.q}
                </button>
              ))}
            </div>

            {/* Custom Message Input */}
            <div className="px-4 pb-4 flex gap-2">
              <Input
                placeholder="မေးခွန်း ရိုက်ထည့်ပါ..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomMessage()}
                className="text-xs h-9"
              />
              <Button 
                size="sm" 
                onClick={handleCustomMessage}
                disabled={!customMessage.trim()}
                className="h-9 px-3"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
