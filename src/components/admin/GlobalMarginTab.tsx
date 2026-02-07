import { useState, useEffect } from "react";
import { Lock, Unlock, Save, Loader2, Shield, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BASE_API_COSTS } from "@/hooks/useCreditCosts";

const ADMIN_PIN = "992452";

export const GlobalMarginTab = () => {
  const { toast } = useToast();
  const [margin, setMargin] = useState(40);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    const fetchMargin = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "profit_margin")
          .maybeSingle();
        
        if (data?.value) {
          setMargin(Number(data.value) || 40);
        }
      } catch (err) {
        console.error("Error loading margin:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMargin();
  }, []);

  const handleUnlock = () => {
    if (pinInput === ADMIN_PIN) {
      setIsLocked(false);
      setPinError(false);
      setPinInput("");
      toast({ title: "🔓 Unlocked", description: "Profit Margin ပြင်ဆင်ခွင့် ရရှိပါပြီ" });
    } else {
      setPinError(true);
      toast({ title: "PIN မှားနေပါသည်", description: "မှန်ကန်သော PIN ထည့်ပါ", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (isLocked) return;
    setIsSaving(true);
    try {
      // Save the margin
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "profit_margin", value: margin.toString() }, { onConflict: "key" });
      
      if (error) throw error;

      // Auto-update all credit costs based on new margin
      for (const [key, baseCost] of Object.entries(BASE_API_COSTS)) {
        const userCost = Math.ceil(baseCost * (1 + margin / 100));
        await supabase
          .from("app_settings")
          .upsert({ key: `credit_cost_${key}`, value: userCost.toString() }, { onConflict: "key" });
      }
      
      setIsLocked(true);
      toast({ title: "သိမ်းဆည်းပြီးပါပြီ", description: `Global Profit Margin ${margin}% သတ်မှတ်ပြီး Credit Costs အားလုံး အပ်ဒိတ်ပြီးပါပြီ` });
    } catch (err) {
      console.error("Save margin error:", err);
      toast({ title: "အမှား", description: "Margin သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground font-myanmar">Global Profit Margin</h3>
          <p className="text-xs text-muted-foreground">AI Tools အားလုံးအတွက် အမြတ်နှုန်း တစ်ခုတည်း</p>
        </div>
      </div>

      {/* Lock Status */}
      <div className={`gradient-card rounded-xl p-5 border ${isLocked ? "border-destructive/30" : "border-green-500/30"}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLocked ? "bg-destructive/10" : "bg-green-500/10"}`}>
            {isLocked ? <Lock className="w-4 h-4 text-destructive" /> : <Unlock className="w-4 h-4 text-green-500" />}
          </div>
          <div>
            <h4 className="font-semibold text-foreground font-myanmar">
              {isLocked ? "🔒 Locked" : "🔓 Unlocked"}
            </h4>
            <p className="text-xs text-muted-foreground">
              {isLocked ? "PIN ထည့်၍ unlock လုပ်ပါ" : "Margin ပြင်ဆင်နိုင်ပါပြီ"}
            </p>
          </div>
        </div>

        {isLocked && (
          <div className="flex gap-2">
            <Input
              type="password"
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
              placeholder="PIN ထည့်ပါ"
              className={`max-w-[180px] ${pinError ? "border-destructive" : ""}`}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            />
            <Button onClick={handleUnlock} variant="outline" size="sm">
              <Shield className="w-4 h-4 mr-1" />
              Unlock
            </Button>
          </div>
        )}
      </div>

      {/* Margin Slider - Now supports up to 150% */}
      <div className="gradient-card rounded-xl p-5 border border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-foreground font-myanmar">Profit Margin</h4>
          <span className="text-2xl font-bold text-primary">{margin}%</span>
        </div>
        
        <Slider
          value={[margin]}
          onValueChange={(val) => !isLocked && setMargin(val[0])}
          min={10}
          max={150}
          step={5}
          disabled={isLocked}
          className="mb-4"
        />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>10%</span>
          <span>50%</span>
          <span>100%</span>
          <span>150%</span>
        </div>

        <p className="text-xs text-muted-foreground mt-3 font-myanmar">
          Formula: User Cost = API Cost + (API Cost × {margin}%)
        </p>
      </div>

      {/* Cost Preview */}
      <div className="gradient-card rounded-xl p-5 border border-primary/20">
        <h4 className="font-semibold text-foreground mb-4 font-myanmar">
          Credit Cost Preview ({margin}% Margin)
        </h4>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {Object.entries(BASE_API_COSTS).map(([key, baseCost]) => {
            const userCost = Math.ceil(baseCost * (1 + margin / 100));
            return (
              <div key={key} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg text-sm">
                <span className="text-foreground capitalize">{key.replace(/_/g, " ")}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">Base: {baseCost}</span>
                  <span className="font-semibold text-primary">{userCost} Cr</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={isLocked || isSaving}
        className="w-full gradient-gold text-primary-foreground"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            သိမ်းဆည်းနေသည်...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            {isLocked ? "🔒 Locked - PIN ထည့်ပါ" : "Global Margin + Credit Costs သိမ်းဆည်းမည်"}
          </>
        )}
      </Button>
    </div>
  );
};
