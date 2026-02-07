import { useState, forwardRef } from "react";
import { MessageSquare, Send, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface UserFeedbackProps {
  userId?: string;
}

export const UserFeedback = forwardRef<HTMLDivElement, UserFeedbackProps>(({ userId }, ref) => {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({ title: "မက်ဆေ့ ရေးပါ", variant: "destructive" });
      return;
    }
    if (!userId) {
      toast({ title: "အကောင့်ဝင်ပါ", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("user_feedback").insert({
        user_id: userId,
        user_name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User",
        user_email: null,
        message: message.trim(),
      });

      if (error) throw error;

      setSubmitted(true);
      setMessage("");
      toast({ title: "🎉 ကျေးဇူးတင်ပါသည်!", description: "သင့်အကြံပြုချက်ကို လက်ခံရရှိပါပြီ" });
      
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error: any) {
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={ref} className="gradient-card rounded-2xl p-4 border border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground font-myanmar">
          အကြံပြုချက် / Feature Request
        </h3>
      </div>

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="thanks"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-4"
          >
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground font-myanmar">ကျေးဇူးတင်ပါသည်!</p>
            <p className="text-xs text-muted-foreground font-myanmar">သင့်အကြံပြုချက်ကို စိစစ်ပါမည်</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="သင့်အကြံပြုချက် သို့မဟုတ် Feature Request ကို ဤနေရာတွင် ရေးပါ..."
              rows={3}
              className="text-sm font-myanmar resize-none"
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{message.length}/1000</span>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !message.trim()}
                size="sm"
                className="gradient-gold text-primary-foreground"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1" />
                    ပို့မည်
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

UserFeedback.displayName = "UserFeedback";
