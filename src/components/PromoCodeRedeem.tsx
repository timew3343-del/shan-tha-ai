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
      // Use secure server-side RPC for entire redemption flow
      const { data, error } = await supabase.rpc("redeem_promo_code", {
        _user_id: userId,
        _code: trimmed,
      });

      if (error) throw error;

      const redeemResult = data as { success?: boolean; error?: string; bonus_credits?: number; discount_percent?: number } | null;

      if (!redeemResult?.success) {
        const errorMsg = redeemResult?.error || "Code မမှန်ကန်ပါ";
        toast({ title: errorMsg, variant: "destructive" });
        return;
      }

      setResult({ bonus: redeemResult.bonus_credits || 0, discount: redeemResult.discount_percent || 0 });
      setRedeemed(true);
      toast({
        title: `🎉 Promo Code အသုံးပြုပြီးပါပြီ!`,
        description: `${redeemResult.bonus_credits} Credits ရရှိပါပြီ`,
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
