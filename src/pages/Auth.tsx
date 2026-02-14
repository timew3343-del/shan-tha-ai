import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, Eye, EyeOff, Loader2, Crown, ArrowRight, ArrowLeft, Play, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { EmailVerificationScreen } from "@/components/EmailVerificationScreen";
import { SEOHead } from "@/components/SEOHead";
import { PublicFeatureDirectory } from "@/components/PublicFeatureDirectory";

const authSchema = z.object({
  email: z.string().email("မှန်ကန်သော အီးမေးလ် ထည့်ပါ"),
  password: z.string().min(6, "စကားဝှက်သည် အနည်းဆုံး ၆ လုံး ရှိရမည်"),
});

const emailSchema = z.object({
  email: z.string().email("မှန်ကန်သော အီးမေးလ် ထည့်ပါ"),
});

type AuthMode = "login" | "signup" | "forgot";

interface GuideVideo {
  id: string;
  title: string;
  video_url: string | null;
  description: string | null;
}

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [resetSent, setResetSent] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [guideVideos, setGuideVideos] = useState<GuideVideo[]>([]);
  const [manualReferralCode, setManualReferralCode] = useState("");
  const [referralReward, setReferralReward] = useState(5);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const referralCode = searchParams.get("ref");

  // Auto-switch to signup if referral link
  useEffect(() => {
    if (referralCode) setMode("signup");
  }, [referralCode]);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user && event === 'SIGNED_IN') {
        // Process referral code if present (from URL or manual input)
        const codeToUse = referralCode || manualReferralCode.trim();
        if (codeToUse) {
          try {
            await supabase.functions.invoke("process-referral", {
              body: { referral_code: codeToUse, new_user_id: session.user.id },
            });
          } catch (e) {
            console.error("Referral processing error:", e);
          }
        }
        navigate("/", { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        navigate("/", { replace: true });
      }
    });

    // Load guide videos for unauthenticated users
    supabase
      .from("daily_content_videos")
      .select("id, title, video_url, description")
      .eq("video_type", "guide")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setGuideVideos(data as GuideVideo[]);
      });

    // Fetch referral reward amount
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["referral_new_user_reward"])
      .then(({ data }) => {
        if (data) {
          data.forEach(s => {
            if (s.key === "referral_new_user_reward" && s.value) {
              setReferralReward(parseInt(s.value, 10) || 5);
            }
          });
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const validateForm = () => {
    if (mode === "forgot") {
      try {
        emailSchema.parse({ email });
        setErrors({});
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          setErrors({ email: error.errors[0]?.message });
        }
        return false;
      }
    }
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === "email") fieldErrors.email = err.message;
          if (err.path[0] === "password") fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleForgotPassword = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setResetSent(true);
      toast({
        title: "အီးမေးလ် ပို့ပြီးပါပြီ",
        description: "စကားဝှက် ပြန်လည်သတ်မှတ်ရန် လင့်ခ်ကို သင့်အီးမေးလ်သို့ ပို့ပေးပြီးပါပြီ",
      });
    } catch (error: any) {
      toast({
        title: "အမှား",
        description: error.message || "အီးမေးလ် ပို့ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === "forgot") {
      handleForgotPassword();
      return;
    }

    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Email not confirmed")) {
            toast({
              title: "အီးမေးလ် အတည်မပြုရသေးပါ",
              description: "ကျေးဇူးပြု၍ Gmail တွင် အရင်ဆုံး အတည်ပြုပေးပါ။",
              variant: "destructive",
            });
            setVerificationEmail(email);
            setShowVerification(true);
            return;
          }
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "အကောင့်ဝင်ရောက်မှု မအောင်မြင်ပါ",
              description: "အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်",
              variant: "destructive",
            });
          } else {
            toast({ title: "အမှား", description: error.message, variant: "destructive" });
          }
          return;
        }
        toast({ title: "အောင်မြင်ပါသည်", description: "အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်" });
      } else {
        const redirectUrl = `${window.location.origin}/`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "အကောင့်ရှိပြီးသား",
              description: "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်ပါသည်။ အကောင့်ဝင်ပါ",
              variant: "destructive",
            });
          } else {
            toast({ title: "အမှား", description: error.message, variant: "destructive" });
          }
          return;
        }

        if (data.user && !data.session) {
          setVerificationEmail(email);
          setShowVerification(true);
          return;
        }

        toast({ title: "အောင်မြင်ပါသည်", description: "အကောင့်ဖွင့်မှု အောင်မြင်ပါသည်" });
      }
    } catch (error) {
      toast({ title: "အမှား", description: "တစ်ခုခု မှားယွင်းနေပါသည်", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (showVerification) {
    return (
      <EmailVerificationScreen
        email={verificationEmail}
        onBackToLogin={() => {
          setShowVerification(false);
          setMode("login");
          setPassword("");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen gradient-navy flex flex-col items-center justify-center p-4">
      <SEOHead />
      {/* Header */}
      <div className="text-center mb-8 animate-fade-up">
        <div className="inline-flex items-center gap-2 mb-3">
          <Crown className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-glow-gold text-primary">Myanmar AI Studio</h1>
        </div>
        <p className="text-muted-foreground">
          {mode === "login" ? "သင့်အကောင့်သို့ ဝင်ရောက်ပါ" 
            : mode === "signup" ? "အကောင့်အသစ် ဖန်တီးပါ" 
            : "စကားဝှက် ပြန်လည်သတ်မှတ်ပါ"}
        </p>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-md gradient-card rounded-2xl p-6 border border-primary/30 shadow-gold animate-scale-in">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary">အီးမေးလ်</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-background/50 border-primary/30 focus:border-primary focus:ring-primary/50 rounded-xl h-12"
              />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Password (not shown for forgot mode) */}
          {mode !== "forgot" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-primary">စကားဝှက်</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-background/50 border-primary/30 focus:border-primary focus:ring-primary/50 rounded-xl h-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
          )}

          {/* Referral Code Input (only in signup mode, only if no URL referral) */}
          {mode === "signup" && !referralCode && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-primary font-myanmar flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" />
                Referral Code (Optional)
              </label>
              <Input
                type="text"
                placeholder="ဖိတ်ခေါ်သူ့ Code ထည့်ပါ (ရှိပါက)"
                value={manualReferralCode}
                onChange={(e) => setManualReferralCode(e.target.value.toUpperCase())}
                className="bg-background/50 border-primary/30 focus:border-primary focus:ring-primary/50 rounded-xl h-12 font-mono"
              />
              <p className="text-[10px] text-muted-foreground font-myanmar">
                Referral Code ထည့်ပါက နှစ်ဦးစလုံး {referralReward} Credits စီ ရရှိပါမည်
              </p>
            </div>
          )}

          {/* Forgot Password Link (only in login mode) */}
          {mode === "login" && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => { setMode("forgot"); setErrors({}); setResetSent(false); }}
                className="text-xs text-primary hover:underline"
              >
                စကားဝှက် မေ့နေပါသလား?
              </button>
            </div>
          )}

          {/* Reset sent message */}
          {mode === "forgot" && resetSent && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
              <p className="text-sm text-primary font-medium">
                ✅ စကားဝှက် ပြန်လည်သတ်မှတ်ရန် လင့်ခ်ကို သင့်အီးမေးလ်သို့ ပို့ပေးပြီးပါပြီ
              </p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 gradient-gold text-primary-foreground font-semibold rounded-xl shadow-gold hover:opacity-90 transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {mode === "login" ? "အကောင့်ဝင်မည်" 
                  : mode === "signup" ? "အကောင့်ဖွင့်မည်" 
                  : "Password Reset Link ပို့မည်"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </form>

        {/* Toggle between modes */}
        <div className="mt-6 text-center space-y-2">
          {mode === "forgot" ? (
            <button
              type="button"
              onClick={() => { setMode("login"); setErrors({}); setResetSent(false); }}
              className="flex items-center justify-center gap-1 text-sm text-primary font-semibold hover:underline mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              အကောင့်ဝင်ရန် ပြန်သွားမည်
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "အကောင့်မရှိသေးဘူးလား?" : "အကောင့်ရှိပြီးသားလား?"}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="ml-2 text-primary font-semibold hover:underline"
              >
                {mode === "login" ? "အကောင့်ဖွင့်မည်" : "အကောင့်ဝင်မည်"}
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Guide Videos for New Users */}
      {guideVideos.length > 0 && (
        <div className="w-full max-w-md mt-6 space-y-3 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <h3 className="text-sm font-semibold text-primary text-center">
            📖 အသုံးပြုနည်း လမ်းညွှန်
          </h3>
          {guideVideos.map((video) => (
            <div key={video.id} className="gradient-card rounded-2xl overflow-hidden border border-primary/20">
              {video.video_url ? (
                <video src={video.video_url} controls playsInline className="w-full aspect-video" poster="" />
              ) : (
                <div className="w-full aspect-video bg-secondary flex items-center justify-center">
                  <Play className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-3">
                <p className="text-sm font-medium text-foreground">{video.title}</p>
                {video.description && (
                  <p className="text-xs text-muted-foreground mt-1">{video.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Referral Banner */}
      {referralCode && (
        <div className="w-full max-w-md mt-4 gradient-card rounded-2xl p-4 border border-green-500/30 text-center animate-fade-up" style={{ animationDelay: "0.35s" }}>
          <p className="text-sm text-green-500 font-semibold mb-1">
            🎉 Referral Link ဖြင့် အကောင့်ဖွင့်ပါ
          </p>
          <p className="text-xs text-muted-foreground">
            အကောင့်ဖွင့်လိုက်ရင် {referralReward} Credits အခမဲ့ ရရှိပါမယ်!
          </p>
        </div>
      )}

      {/* Promo Info for New Users */}
      <div className="w-full max-w-md mt-4 gradient-card rounded-2xl p-4 border border-primary/20 text-center animate-fade-up" style={{ animationDelay: "0.4s" }}>
        <p className="text-sm text-foreground font-semibold mb-1">
          🎁 ပထမဆုံးအကြိမ် ငွေဖြည့်သူများအတွက်
        </p>
        <p className="text-xs text-muted-foreground">
          Bonus Credit ၂၀% ပိုပေးမည် • AI ပုံဆွဲခြင်း၊ Video နှင့် Speech ပြောင်းခြင်း အားလုံး တစ်နေရာတည်းမှာ
        </p>
      </div>

      {/* Public Feature Directory for SEO crawlers */}
      <div className="w-full max-w-md mt-6 animate-fade-up" style={{ animationDelay: "0.5s" }}>
        <PublicFeatureDirectory />
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-muted-foreground text-center animate-fade-up" style={{ animationDelay: "0.6s" }}>
        ဝန်ဆောင်မှုစည်းမျဉ်းများကို လက်ခံပြီး ဆက်လက်ဆောင်ရွက်ပါ
      </p>
    </div>
  );
};

export default Auth;
