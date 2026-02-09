import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, RefreshCw, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface EmailVerificationScreenProps {
  email: string;
  onBackToLogin: () => void;
}

export const EmailVerificationScreen = ({ email, onBackToLogin }: EmailVerificationScreenProps) => {
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { toast } = useToast();

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      toast({
        title: "အီးမေးလ် ပြန်ပို့ပြီးပါပြီ",
        description: "သင့် Gmail inbox ကို စစ်ဆေးပါ",
      });

      // Start 60-second cooldown
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      toast({
        title: "အမှား",
        description: error.message || "အီးမေးလ် ပို့ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen gradient-navy flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center animate-scale-in">
        {/* Success Icon */}
        <div className="relative mx-auto w-24 h-24 mb-6">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="relative w-24 h-24 rounded-full gradient-gold flex items-center justify-center shadow-gold">
            <Mail className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-foreground mb-2">
          အီးမေးလ် အတည်ပြုရန်
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          အတည်ပြုရန် လင့်ခ်ကို သင့်အီးမေးလ်သို့ ပို့ပေးပြီးပါပြီ
        </p>

        {/* Email Display */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/30 mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-foreground">ပို့ပြီးသော အီးမေးလ်</span>
          </div>
          <p className="text-primary font-semibold text-lg break-all">{email}</p>
        </div>

        {/* Instructions */}
        <div className="gradient-card rounded-2xl p-4 border border-border/50 mb-6 text-left space-y-3">
          <h3 className="text-sm font-semibold text-primary">📋 လုပ်ဆောင်ရမည့် အဆင့်များ</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold text-sm">1.</span>
              <p className="text-sm text-muted-foreground">Gmail (သို့) Email app ကို ဖွင့်ပါ</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold text-sm">2.</span>
              <p className="text-sm text-muted-foreground">"Confirm your signup" ဆိုတဲ့ mail ကို ရှာပါ</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold text-sm">3.</span>
              <p className="text-sm text-muted-foreground">Mail ထဲက "Confirm your mail" လင့်ခ်ကို နှိပ်ပါ</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold text-sm">4.</span>
              <p className="text-sm text-muted-foreground">အလိုအလျောက် App သို့ ပြန်ရောက်ပါမည်</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-2">
            💡 Spam/Junk folder ကိုလည်း စစ်ဆေးပါ
          </p>
        </div>

        {/* Resend Button */}
        <Button
          onClick={handleResendEmail}
          disabled={isResending || resendCooldown > 0}
          variant="outline"
          className="w-full h-12 rounded-xl border-primary/30 text-primary hover:bg-primary/10 mb-3"
        >
          {isResending ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-5 h-5 mr-2" />
          )}
          {resendCooldown > 0
            ? `${resendCooldown} စက္ကန့် စောင့်ပါ`
            : "အီးမေးလ် ပြန်ပို့ရန်"}
        </Button>

        {/* Back to Login */}
        <button
          onClick={onBackToLogin}
          className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto mt-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          အကောင့်ဝင်ရန် ပြန်သွားမည်
        </button>
      </div>
    </div>
  );
};
