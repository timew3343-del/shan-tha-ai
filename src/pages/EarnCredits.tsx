import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Play, CreditCard, Loader2, CheckCircle, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { useAppSettings } from "@/hooks/useAppSettings";
import { AdWatchModal } from "@/components/AdWatchModal";
import { PromoCodeRedeem } from "@/components/PromoCodeRedeem";
import { motion } from "framer-motion";

const EarnCredits = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { credits, isLoading: creditsLoading } = useCredits(user?.id);
  const { settings, isLoading: settingsLoading } = useAppSettings();
  
  // Campaign submission state
  const [fbLink, setFbLink] = useState("");
  const [tiktokLink, setTiktokLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Ad watching state
  const [showAdModal, setShowAdModal] = useState(false);
  const [dailyAdCredits, setDailyAdCredits] = useState(0);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);
      setIsLoading(false);
      
      // Fetch today's ad credits
      fetchDailyAdCredits(user.id);
    };
    getUser();
  }, [navigate]);

  const fetchDailyAdCredits = async (userId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from("ad_credit_logs")
      .select("credits_earned")
      .eq("user_id", userId)
      .gte("created_at", today.toISOString());
    
    if (!error && data) {
      const total = data.reduce((sum, log) => sum + (log.credits_earned || 0), 0);
      setDailyAdCredits(total);
    }
  };

  const validateLink = (url: string, platform: "facebook" | "tiktok"): boolean => {
    if (!url.trim()) return true; // Empty is OK if at least one is provided
    
    if (platform === "facebook") {
      return /(?:facebook\.com|fb\.com|fb\.watch)/i.test(url);
    }
    return /(?:tiktok\.com|vm\.tiktok\.com)/i.test(url);
  };

  const handleSubmitCampaign = async () => {
    if (!fbLink.trim() && !tiktokLink.trim()) {
      toast({
        title: "Link လိုအပ်ပါသည်",
        description: "Facebook သို့မဟုတ် TikTok link အနည်းဆုံး တစ်ခု ထည့်ပေးပါ",
        variant: "destructive",
      });
      return;
    }

    if (fbLink && !validateLink(fbLink, "facebook")) {
      toast({
        title: "Facebook Link မမှန်ကန်ပါ",
        description: "မှန်ကန်သော Facebook URL ထည့်ပေးပါ",
        variant: "destructive",
      });
      return;
    }

    if (tiktokLink && !validateLink(tiktokLink, "tiktok")) {
      toast({
        title: "TikTok Link မမှန်ကန်ပါ",
        description: "မှန်ကန်သော TikTok URL ထည့်ပေးပါ",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("campaigns").insert({
        user_id: user.id,
        fb_link: fbLink.trim() || null,
        tiktok_link: tiktokLink.trim() || null,
        link: fbLink.trim() || tiktokLink.trim(), // For backwards compatibility
        platform: fbLink.trim() ? "facebook" : "tiktok",
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
        title: "အောင်မြင်ပါသည်!",
        description: `Admin စစ်ဆေးပြီးနောက် ${settings.campaign_approval_reward} Credits ရရှိပါမည်`,
      });
    } catch (error: any) {
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "Campaign တင်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWatchAd = () => {
    if (dailyAdCredits >= settings.daily_ad_limit) {
      toast({
        title: "ယနေ့ကန့်သတ်ချက်ပြည့်ပြီ",
        description: `တစ်ရက်လျှင် ${settings.daily_ad_limit} Credits သာ ရယူနိုင်ပါသည်`,
        variant: "destructive",
      });
      return;
    }
    setShowAdModal(true);
  };

  const handleClaimCredits = async () => {
    try {
      // Call edge function to add credits securely
      const { data, error } = await supabase.functions.invoke("add-ad-credits", {
        body: { user_id: user.id },
      });

      if (error) throw error;

      if (data?.success) {
        const earned = data.credits_added || settings.ad_reward_amount;
        setDailyAdCredits(prev => prev + earned);
        toast({
          title: `🎉 ${earned} Credits ရရှိပါပြီ!`,
          description: `ယနေ့ စုစုပေါင်း: ${dailyAdCredits + earned}/${settings.daily_ad_limit} Credits`,
        });
      } else {
        throw new Error(data?.error || "Failed to add credits");
      }
    } catch (error: any) {
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message,
        variant: "destructive",
      });
      throw error; // Re-throw to prevent modal from showing success
    }
  };

  if (isLoading || settingsLoading) {
    return (
      <div className="min-h-screen gradient-navy flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const showBuyCreditsPrompt = credits === 0;

  return (
    <div className="min-h-screen gradient-navy pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-full hover:bg-secondary/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground font-myanmar">Earn Credits</h1>
            <p className="text-xs text-muted-foreground">အခမဲ့ Credits များ ရယူပါ</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Premium Upsell - Show when 0 credits */}
        {showBuyCreditsPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground font-myanmar">Credits ကုန်သွားပါပြီ</h3>
                <p className="text-sm text-muted-foreground mt-1 font-myanmar">
                  AI Tools များ အသုံးပြုရန် Credits ဝယ်ယူပါ
                </p>
                <Button 
                  onClick={() => navigate("/top-up")} 
                  className="mt-3 gradient-gold text-primary-foreground"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Buy Credits
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Watch Ads Section */}
        <div className="gradient-card rounded-2xl p-5 border border-primary/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Play className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground font-myanmar">ကြော်ငြာကြည့်၍ Credits ရယူပါ</h3>
              <p className="text-xs text-muted-foreground">
                တစ်ရက် {settings.daily_ad_limit} Credits အထိ ရယူနိုင်ပါသည်
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>ယနေ့ ရရှိပြီး</span>
              <span>{dailyAdCredits}/{settings.daily_ad_limit} Credits</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${(dailyAdCredits / settings.daily_ad_limit) * 100}%` }}
              />
            </div>
          </div>

          <Button
            onClick={handleWatchAd}
            disabled={dailyAdCredits >= settings.daily_ad_limit}
            className="w-full gradient-gold text-primary-foreground"
          >
            {dailyAdCredits >= settings.daily_ad_limit ? (
              "ယနေ့ ကန့်သတ်ချက် ပြည့်ပြီ"
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Watch Ad to Earn {settings.ad_reward_amount} Credits
              </>
            )}
          </Button>
        </div>

        {/* Ad Watch Modal */}
        <AdWatchModal
          isOpen={showAdModal}
          onClose={() => setShowAdModal(false)}
          onClaim={handleClaimCredits}
          timerDuration={settings.ad_timer_duration}
          rewardAmount={settings.ad_reward_amount}
        />

        {/* Promo Code Section */}
        {user && <PromoCodeRedeem userId={user.id} />}

        {/* Campaign Submission Section */}
        <div className="gradient-card rounded-2xl p-5 border border-primary/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Gift className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground font-myanmar">Review Post တင်၍ {settings.campaign_approval_reward} Credits ရယူပါ</h3>
              <p className="text-xs text-muted-foreground">
                Myanmar AI အကြောင်း Video Review တင်ပါ
              </p>
            </div>
          </div>

          {!submitted ? (
            <div className="space-y-4">
              {/* Rules */}
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                <h4 className="font-semibold text-sm mb-2 font-myanmar text-primary">
                  🎁 {settings.campaign_approval_reward} Credits အခမဲ့ ရယူရန်
                </h4>
                <ul className="space-y-2 text-xs text-muted-foreground font-myanmar">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">1.</span>
                    <span>Facebook သို့မဟုတ် TikTok တွင် Myanmar AI အကြောင်း Review Video တင်ပါ</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">2.</span>
                    <span>Video သည် မိနစ် ၂ အထက် ဖြစ်ရမည်</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">3.</span>
                    <span>Post links များကို အောက်တွင် ထည့်ပါ</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">4.</span>
                    <span>Admin စစ်ဆေးပြီးနောက် {settings.campaign_approval_reward} Credits ပေးပါမည်</span>
                  </li>
                </ul>
              </div>

              {/* Facebook Link Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium font-myanmar flex items-center gap-2">
                  <span className="text-blue-500">📘</span> Facebook Video Link
                </label>
                <Input
                  value={fbLink}
                  onChange={(e) => setFbLink(e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="font-myanmar"
                />
              </div>

              {/* TikTok Link Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium font-myanmar flex items-center gap-2">
                  <span>🎵</span> TikTok Video Link
                </label>
                <Input
                  value={tiktokLink}
                  onChange={(e) => setTiktokLink(e.target.value)}
                  placeholder="https://tiktok.com/..."
                  className="font-myanmar"
                />
              </div>

              <p className="text-xs text-muted-foreground font-myanmar">
                အနည်းဆုံး link တစ်ခု ထည့်ပေးပါ
              </p>

              <Button
                onClick={handleSubmitCampaign}
                disabled={isSubmitting || (!fbLink.trim() && !tiktokLink.trim())}
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
                    Links တင်မည်
                  </>
                )}
              </Button>
            </div>
          ) : (
            <motion.div
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
                  Admin စစ်ဆေးပြီးနောက် {settings.campaign_approval_reward} Credits ရရှိပါမည်
                </p>
              </div>
              <Button 
                onClick={() => {
                  setSubmitted(false);
                  setFbLink("");
                  setTiktokLink("");
                }} 
                variant="outline" 
                className="font-myanmar"
              >
                နောက်ထပ်တင်မည်
              </Button>
            </motion.div>
          )}
        </div>

        {/* Current Balance */}
        <div className="text-center text-sm text-muted-foreground">
          လက်ရှိ Balance: <span className="text-primary font-semibold">{creditsLoading ? "..." : credits} Credits</span>
        </div>
      </div>
    </div>
  );
};

export default EarnCredits;
