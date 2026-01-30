import { useState, forwardRef } from "react";
import { Gift, ExternalLink, Loader2, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export const CampaignModal = ({ isOpen, onClose, userId }: CampaignModalProps) => {
  const { toast } = useToast();
  const [link, setLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateLink = (url: string): { valid: boolean; platform: string } => {
    const fbRegex = /(?:facebook\.com|fb\.com|fb\.watch)/i;
    const tiktokRegex = /(?:tiktok\.com|vm\.tiktok\.com)/i;

    if (fbRegex.test(url)) {
      return { valid: true, platform: "facebook" };
    }
    if (tiktokRegex.test(url)) {
      return { valid: true, platform: "tiktok" };
    }
    return { valid: false, platform: "" };
  };

  const handleSubmit = async () => {
    if (!link.trim()) {
      toast({
        title: "Link ထည့်ပါ",
        description: "သင့် Review Post link ကို ထည့်ပေးပါ",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "အကောင့်ဝင်ပါ",
        description: "Campaign ပါဝင်ရန် အကောင့်ဝင်ပါ",
        variant: "destructive",
      });
      return;
    }

    const { valid, platform } = validateLink(link);
    if (!valid) {
      toast({
        title: "Link မမှန်ကန်ပါ",
        description: "Facebook သို့မဟုတ် TikTok link သာ ထည့်နိုင်ပါသည်",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("campaigns").insert({
        user_id: userId,
        link: link.trim(),
        platform,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("ဤ link ကို ယခင်က တင်ထားပြီး ဖြစ်ပါသည်");
        }
        throw error;
      }

      setSubmitted(true);
      toast({
        title: "အောင်မြင်ပါသည်",
        description: "သင့် Campaign ကို စစ်ဆေးပြီးနောက် Credit ပေးပါမည်",
      });
    } catch (error: any) {
      console.error("Campaign submit error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "Campaign တင်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setLink("");
    setSubmitted(false);
    onClose();
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          "sm:max-w-md"
        )}>
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <DialogPrimitive.Title className="flex items-center gap-2 font-myanmar text-lg font-semibold leading-none tracking-tight">
              <Gift className="w-5 h-5 text-primary" />
              Free Credit Campaign
            </DialogPrimitive.Title>
          </div>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Rules */}
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                <h4 className="font-semibold text-sm mb-2 font-myanmar text-primary">
                  🎁 20 Credits အခမဲ့ ရယူရန်
                </h4>
                <ul className="space-y-2 text-xs text-muted-foreground font-myanmar">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">1.</span>
                    <span>Facebook သို့မဟုတ် TikTok တွင် Myanmar AI အကြောင်း Review Post တင်ပါ</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">2.</span>
                    <span>Post သည် မိနစ် ၂ အထက် Video ဖြစ်ရမည်</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">3.</span>
                    <span>Post link ကို အောက်တွင် ထည့်ပါ</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">4.</span>
                    <span>Admin စစ်ဆေးပြီးနောက် 20 Credits ပေးပါမည်</span>
                  </li>
                </ul>
              </div>

              {/* Link Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium font-myanmar">
                  Review Post Link
                </label>
                <Input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://facebook.com/... or https://tiktok.com/..."
                  className="font-myanmar"
                />
                <p className="text-xs text-muted-foreground font-myanmar">
                  Facebook သို့မဟုတ် TikTok link သာ ထည့်နိုင်ပါသည်
                </p>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !link.trim()}
                className="w-full font-myanmar"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    တင်နေသည်...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Link တင်မည်
                  </>
                )}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6 space-y-4"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg font-myanmar">တင်ပြီးပါပြီ!</h3>
                <p className="text-sm text-muted-foreground mt-1 font-myanmar">
                  Admin စစ်ဆေးပြီးနောက် 20 Credits ရရှိပါမည်
                </p>
              </div>
              <Button onClick={handleClose} variant="outline" className="font-myanmar">
                ပိတ်မည်
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
