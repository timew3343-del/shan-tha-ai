import { useState, useEffect } from "react";
import { Share2, Copy, Check, Users, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

interface ReferralSectionProps {
  userId?: string;
}

export const ReferralSection = ({ userId }: ReferralSectionProps) => {
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [usesCount, setUsesCount] = useState(0);
  const [creditsEarned, setCreditsEarned] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrCreateReferralCode = async () => {
      if (!userId) return;

      try {
        // Try to fetch existing code
        const { data: existing } = await supabase
          .from("referral_codes")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          setReferralCode(existing.code);
          setUsesCount(existing.uses_count);
          setCreditsEarned(existing.credits_earned);
        } else {
          // Generate new code
          const code = `MAI${userId.substring(0, 6).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
          const { data: newCode, error } = await supabase
            .from("referral_codes")
            .insert({ user_id: userId, code })
            .select()
            .single();

          if (!error && newCode) {
            setReferralCode(newCode.code);
          }
        }
      } catch (error) {
        console.error("Error fetching referral code:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrCreateReferralCode();
  }, [userId]);

  const handleCopy = async () => {
    if (!referralCode) return;
    const link = `${window.location.origin}/auth?ref=${referralCode}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({
      title: "ကူးယူပြီးပါပြီ",
      description: "Referral link ကို ကူးယူပြီးပါပြီ",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralCode) return;
    const link = `${window.location.origin}/auth?ref=${referralCode}`;
    const message = `ဟေး... ဒီ Myanmar AI App လေးသုံးကြည့်ပါဦး။ ပုံတွေ၊ ဗီဒီယိုတွေ အလန်းစား ထုတ်လို့ရတယ်နော်။ ${link}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Myanmar AI",
          text: message,
        });
      } catch (e) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  if (isLoading) {
    return (
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 animate-pulse">
        <div className="h-20 bg-secondary/50 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="gradient-card rounded-2xl p-4 border border-primary/20"
    >
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground font-myanmar">သူငယ်ချင်းဖိတ်ခေါ်ပါ</h3>
      </div>

      <p className="text-xs text-muted-foreground mb-3 font-myanmar">
        သင့်လင့်ခ်မှတစ်ဆင့် အသစ်ဝင်လာသူတိုင်း နှစ်ဦးစလုံး 5 Credits စီရရှိမည်။
      </p>

      <div className="bg-secondary/50 rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between gap-2">
          <code className="text-xs text-primary font-mono truncate">
            {referralCode || "Loading..."}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="shrink-0 h-8 w-8 p-0"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <Button
          onClick={handleShare}
          size="sm"
          className="flex-1 bg-primary text-primary-foreground"
        >
          <Share2 className="w-4 h-4 mr-1" />
          <span className="font-myanmar">မျှဝေမည်</span>
        </Button>
      </div>

      <div className="flex gap-4 text-center">
        <div className="flex-1 bg-secondary/30 rounded-lg p-2">
          <div className="flex items-center justify-center gap-1 text-primary font-bold">
            <Users className="w-4 h-4" />
            {usesCount}
          </div>
          <p className="text-[10px] text-muted-foreground font-myanmar">ဖိတ်ခေါ်ထားသူ</p>
        </div>
        <div className="flex-1 bg-secondary/30 rounded-lg p-2">
          <div className="flex items-center justify-center gap-1 text-primary font-bold">
            <Gift className="w-4 h-4" />
            {creditsEarned}
          </div>
          <p className="text-[10px] text-muted-foreground font-myanmar">ရရှိထားသော Credits</p>
        </div>
      </div>
    </motion.div>
  );
};
