import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tag, CheckCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface PromoCodeRedeemProps {
  userId: string;
}

export const PromoCodeRedeem = ({ userId }: PromoCodeRedeemProps) => {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [result, setResult] = useState<{ bonus: number; discount: number } | null>(null);

  const handleRedeem = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast({ title: "Code ထည့်ပါ", variant: "destructive" });
      return;
    }

    setIsRedeeming(true);
    try {
      // Find the promo code
      const { data: promoCode, error: findError } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", trimmed)
        .eq("is_active", true)
        .maybeSingle();

      if (findError) throw findError;

      if (!promoCode) {
        toast({ title: "Code မမှန်ကန်ပါ", description: "သက်တမ်းကုန် သို့မဟုတ် မရှိသော Code ဖြစ်ပါသည်", variant: "destructive" });
        return;
      }

      // Check expiry
      if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
        toast({ title: "Code သက်တမ်းကုန်ပြီ", variant: "destructive" });
        return;
      }

      // Check max uses
      if (promoCode.max_uses !== null && promoCode.uses_count >= promoCode.max_uses) {
        toast({ title: "Code အသုံးပြုမှု ကန့်သတ်ပြည့်ပြီ", variant: "destructive" });
        return;
      }

      // Check if already used by this user
      const { data: existingUse } = await supabase
        .from("promo_code_uses")
        .select("id")
        .eq("promo_code_id", promoCode.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingUse) {
        toast({ title: "ဤ Code ကို အသုံးပြုပြီးဖြစ်ပါသည်", variant: "destructive" });
        return;
      }

      // Award bonus credits
      if (promoCode.bonus_credits > 0) {
        const { data: creditResult, error: creditError } = await supabase.rpc("add_user_credits", {
          _user_id: userId,
          _amount: promoCode.bonus_credits,
        });

        const resultObj = creditResult as { success?: boolean; error?: string } | null;
        if (creditError || !resultObj?.success) {
          throw new Error(resultObj?.error || "Credits ထည့်ရာတွင် ပြဿနာရှိပါသည်");
        }
      }

      // Record usage
      const { error: useError } = await supabase.from("promo_code_uses").insert({
        promo_code_id: promoCode.id,
        user_id: userId,
        credits_awarded: promoCode.bonus_credits,
      });

      if (useError) {
        if (useError.code === "23505") {
          toast({ title: "ဤ Code ကို အသုံးပြုပြီးဖြစ်ပါသည်", variant: "destructive" });
          return;
        }
        throw useError;
      }

      // Update uses count
      await supabase
        .from("promo_codes")
        .update({ uses_count: promoCode.uses_count + 1 })
        .eq("id", promoCode.id);

      // Add audit log
      await supabase.from("credit_audit_log").insert({
        user_id: userId,
        amount: promoCode.bonus_credits,
        credit_type: "promo",
        description: `Promo code: ${trimmed}`,
      });

      setResult({ bonus: promoCode.bonus_credits, discount: promoCode.discount_percent });
      setRedeemed(true);
      toast({
        title: `🎉 Promo Code အသုံးပြုပြီးပါပြီ!`,
        description: `${promoCode.bonus_credits} Credits ရရှိပါပြီ`,
      });
    } catch (error: any) {
      console.error("Promo redeem error:", error);
      toast({ title: "အမှား", description: error.message, variant: "destructive" });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="gradient-card rounded-2xl p-5 border border-primary/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <Tag className="w-5 h-5 text-purple-500" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground font-myanmar">Promo Code</h3>
          <p className="text-xs text-muted-foreground">Promo Code ရှိပါက ထည့်သွင်းပါ</p>
        </div>
      </div>

      {!redeemed ? (
        <div className="flex gap-2">
          <Input
            placeholder="e.g. MYANMARAI20"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="uppercase font-mono"
            disabled={isRedeeming}
          />
          <Button onClick={handleRedeem} disabled={isRedeeming || !code.trim()}>
            {isRedeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : "အသုံးပြုမည်"}
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-4 space-y-2"
        >
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
          <p className="font-semibold text-foreground">
            🎉 {result?.bonus} Credits ရရှိပါပြီ!
          </p>
          {result && result.discount > 0 && (
            <p className="text-xs text-muted-foreground">
              {result.discount}% discount code ဖြစ်ပါသည်
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRedeemed(false); setCode(""); setResult(null); }}
          >
            နောက်ထပ် Code ထည့်မည်
          </Button>
        </motion.div>
      )}
    </div>
  );
};
