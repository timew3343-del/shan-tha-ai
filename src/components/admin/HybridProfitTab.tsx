import { useState, useEffect, useCallback } from "react";
import { Lock, Unlock, Save, Loader2, Shield, TrendingUp, ToggleLeft, ToggleRight, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BASE_API_COSTS, CreditCostKey } from "@/hooks/useCreditCosts";

const ADMIN_PIN = "992452";

const TOOL_LABELS: Record<CreditCostKey, string> = {
  image_generation: "Image Generation",
  video_generation: "Video Generation",
  video_with_speech: "Video + Speech",
  text_to_speech: "Text-to-Speech",
  speech_to_text: "Speech-to-Text",
  ai_chat: "AI Chat",
  face_swap: "Face Swap",
  upscale: "4K Upscale",
  bg_remove: "BG Remove",
  live_camera: "AI Live Cam",
  video_export: "Video Export",
  youtube_to_text: "YouTube → Text",
  character_animation: "Character Animation",
  doc_slide_gen: "Doc & Slide",
  caption_per_minute: "Caption/min",
  ad_generator: "Ad Generator",
  live_camera_chat: "Live Camera Chat",
  social_media_agent: "Social Media Agent",
  photoshoot: "Photoshoot",
  story_video: "Story → Video",
  copyright_check: "Copyright Check",
  scene_summarizer: "Scene Summarizer",
  bg_studio: "BG Studio",
  song_mtv: "Song & MTV",
  auto_ad: "Auto Ad",
  video_redesign: "Video Redesign",
};

interface ToolPricing {
  key: CreditCostKey;
  baseCost: number;
  autoPrice: number;
  manualPrice: number;
  isManual: boolean;
  effectivePrice: number;
  profitPercent: number;
}

export const HybridProfitTab = () => {
  const { toast } = useToast();
  const [margin, setMargin] = useState(40);
  const [autoAdMargin, setAutoAdMargin] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [toolPricing, setToolPricing] = useState<ToolPricing[]>([]);

  const buildPricing = useCallback((currentMargin: number, manualPrices: Record<string, { price: number; isManual: boolean }>) => {
    return (Object.entries(BASE_API_COSTS) as [CreditCostKey, number][]).map(([key, baseCost]) => {
      const autoPrice = Math.ceil(baseCost * (1 + currentMargin / 100));
      const manual = manualPrices[key];
      const isManual = manual?.isManual ?? false;
      const manualPrice = manual?.price ?? autoPrice;
      const effectivePrice = isManual ? manualPrice : autoPrice;
      const profitPercent = baseCost > 0 ? Math.round(((effectivePrice - baseCost) / baseCost) * 100) : 0;

      return { key, baseCost, autoPrice, manualPrice, isManual, effectivePrice, profitPercent };
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("key, value");

        let currentMargin = 40;
        const manualPrices: Record<string, { price: number; isManual: boolean }> = {};

        data?.forEach((setting) => {
          if (setting.key === "profit_margin") {
            currentMargin = Number(setting.value) || 40;
          }
          if (setting.key === "auto_ad_profit_margin") {
            setAutoAdMargin(Number(setting.value) || 50);
          }
          if (setting.key.startsWith("manual_price_")) {
            const toolKey = setting.key.replace("manual_price_", "");
            try {
              const parsed = JSON.parse(setting.value || "{}");
              manualPrices[toolKey] = { price: parsed.price || 0, isManual: parsed.isManual ?? false };
            } catch {}
          }
        });

        setMargin(currentMargin);
        setToolPricing(buildPricing(currentMargin, manualPrices));
      } catch (err) {
        console.error("Error loading hybrid pricing:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [buildPricing]);

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

  const handleMarginChange = (val: number[]) => {
    if (isLocked) return;
    const newMargin = val[0];
    setMargin(newMargin);
    setToolPricing(prev => prev.map(tp => {
      const autoPrice = Math.ceil(tp.baseCost * (1 + newMargin / 100));
      const effectivePrice = tp.isManual ? tp.manualPrice : autoPrice;
      const profitPercent = tp.baseCost > 0 ? Math.round(((effectivePrice - tp.baseCost) / tp.baseCost) * 100) : 0;
      return { ...tp, autoPrice, effectivePrice, profitPercent };
    }));
  };

  const toggleManual = (key: CreditCostKey) => {
    if (isLocked) return;
    setToolPricing(prev => prev.map(tp => {
      if (tp.key !== key) return tp;
      const isManual = !tp.isManual;
      const effectivePrice = isManual ? tp.manualPrice : tp.autoPrice;
      const profitPercent = tp.baseCost > 0 ? Math.round(((effectivePrice - tp.baseCost) / tp.baseCost) * 100) : 0;
      return { ...tp, isManual, effectivePrice, profitPercent };
    }));
  };

  const updateManualPrice = (key: CreditCostKey, price: number) => {
    if (isLocked) return;
    setToolPricing(prev => prev.map(tp => {
      if (tp.key !== key) return tp;
      const effectivePrice = tp.isManual ? price : tp.autoPrice;
      const profitPercent = tp.baseCost > 0 ? Math.round(((effectivePrice - tp.baseCost) / tp.baseCost) * 100) : 0;
      return { ...tp, manualPrice: price, effectivePrice, profitPercent };
    }));
  };

  const handleSave = async () => {
    if (isLocked) return;
    setIsSaving(true);
    try {
      // Save global margin
      await supabase
        .from("app_settings")
        .upsert({ key: "profit_margin", value: margin.toString() }, { onConflict: "key" });

      // Save Auto Ad specific margin
      await supabase
        .from("app_settings")
        .upsert({ key: "auto_ad_profit_margin", value: autoAdMargin.toString() }, { onConflict: "key" });

      // Save per-tool manual settings AND publish pre-calculated credit costs
      // Credit costs are stored as credit_cost_* so regular users can read them
      // without ever seeing the raw profit margin values
      for (const tp of toolPricing) {
        await supabase
          .from("app_settings")
          .upsert({
            key: `manual_price_${tp.key}`,
            value: JSON.stringify({ price: tp.manualPrice, isManual: tp.isManual }),
          }, { onConflict: "key" });

        // Calculate effective cost: auto_ad uses its own margin, others use global/manual
        const effectiveCost = tp.key === "auto_ad"
          ? Math.ceil(tp.baseCost * (1 + autoAdMargin / 100))
          : tp.effectivePrice;

        await supabase
          .from("app_settings")
          .upsert({
            key: `credit_cost_${tp.key}`,
            value: effectiveCost.toString(),
          }, { onConflict: "key" });
      }

      setIsLocked(true);
      toast({ title: "သိမ်းဆည်းပြီးပါပြီ", description: "Hybrid Pricing သိမ်းဆည်းပြီးပါပြီ" });
    } catch (err) {
      console.error("Save error:", err);
      toast({ title: "အမှား", description: "Pricing သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const lowMarginTools = toolPricing.filter(tp => tp.profitPercent < 40);

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
          <h3 className="font-semibold text-foreground font-myanmar">Hybrid Profit Manager</h3>
          <p className="text-xs text-muted-foreground">Auto/Manual pricing per tool</p>
        </div>
      </div>

      {/* Lock */}
      <div className={`gradient-card rounded-xl p-4 border ${isLocked ? "border-destructive/30" : "border-green-500/30"}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLocked ? "bg-destructive/10" : "bg-green-500/10"}`}>
            {isLocked ? <Lock className="w-4 h-4 text-destructive" /> : <Unlock className="w-4 h-4 text-green-500" />}
          </div>
          <span className="text-sm font-semibold">{isLocked ? "🔒 Locked" : "🔓 Unlocked"}</span>
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
              <Shield className="w-4 h-4 mr-1" /> Unlock
            </Button>
          </div>
        )}
      </div>

      {/* Red Warnings */}
      {lowMarginTools.length > 0 && (
        <div className="gradient-card rounded-xl p-4 border border-destructive/40 bg-destructive/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <span className="text-sm font-bold text-destructive">⚠️ Low Profit Warning</span>
          </div>
          <div className="space-y-1">
            {lowMarginTools.map(tp => (
              <div key={tp.key} className="flex justify-between text-xs">
                <span className="text-destructive">{TOOL_LABELS[tp.key]}</span>
                <span className="font-bold text-destructive">{tp.profitPercent}% margin</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Margin Slider */}
      <div className="gradient-card rounded-xl p-4 border border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-foreground text-sm">Global Auto Margin</h4>
          <span className="text-2xl font-bold text-primary">{margin}%</span>
        </div>
        <Slider
          value={[margin]}
          onValueChange={handleMarginChange}
          min={10} max={100} step={5}
          disabled={isLocked}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>10%</span><span>50%</span><span>100%</span>
        </div>
      </div>

      {/* Auto Ad Specific Profit Margin */}
      <div className="gradient-card rounded-xl p-4 border border-orange-500/30 bg-orange-500/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-sm font-myanmar">Auto ကြော်ငြာအပ်ရန် Profit Margin %</h4>
            <p className="text-[10px] text-muted-foreground font-myanmar">Auto Ad tool အတွက် သီးသန့် အမြတ်နှုန်း (Global Margin နှင့် သက်ဆိုင်မှု မရှိပါ)</p>
          </div>
          <span className="text-2xl font-bold text-orange-500 ml-auto">{autoAdMargin}%</span>
        </div>
        <Slider
          value={[autoAdMargin]}
          onValueChange={(val) => !isLocked && setAutoAdMargin(val[0])}
          min={10} max={150} step={5}
          disabled={isLocked}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>10%</span><span>50%</span><span>100%</span><span>150%</span>
        </div>
        <div className="mt-2 p-2 rounded-lg bg-secondary/30">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Base Cost:</span>
            <span className="text-foreground font-medium">{BASE_API_COSTS.auto_ad} Credits</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">User Price:</span>
            <span className="text-orange-500 font-bold">{Math.ceil(BASE_API_COSTS.auto_ad * (1 + autoAdMargin / 100))} Credits/platform</span>
          </div>
        </div>
      </div>

      {/* Per-Tool Pricing */}
      <div className="gradient-card rounded-xl p-4 border border-primary/20">
        <h4 className="font-semibold text-foreground text-sm mb-3">Tool Pricing (Auto / Manual)</h4>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {toolPricing.map((tp) => (
            <div
              key={tp.key}
              className={`p-3 rounded-lg border transition-all ${
                tp.profitPercent < 40
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border/50 bg-secondary/20"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">{TOOL_LABELS[tp.key]}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {tp.isManual ? "Manual" : "Auto"}
                  </span>
                  <Switch
                    checked={tp.isManual}
                    onCheckedChange={() => toggleManual(tp.key)}
                    disabled={isLocked}
                    className="scale-75"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">API: {tp.baseCost}</span>
                <span className="text-[10px] text-muted-foreground">→</span>
                {tp.isManual ? (
                  <Input
                    type="number"
                    value={tp.manualPrice}
                    onChange={(e) => updateManualPrice(tp.key, parseInt(e.target.value) || 0)}
                    disabled={isLocked}
                    className="h-7 w-20 text-xs"
                  />
                ) : (
                  <span className="text-xs font-bold text-primary">{tp.autoPrice} Cr</span>
                )}
                <span className={`text-[10px] font-bold ml-auto ${
                  tp.profitPercent < 40 ? "text-destructive" : "text-green-500"
                }`}>
                  {tp.profitPercent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Profit Comparison */}
      <div className="gradient-card rounded-xl p-4 border border-primary/20">
        <h4 className="font-semibold text-foreground text-sm mb-3">📊 Profit Comparison</h4>
        <div className="space-y-1.5">
          {toolPricing.map((tp) => {
            const barWidth = Math.min(100, (tp.effectivePrice / (Math.max(...toolPricing.map(t => t.effectivePrice)) || 1)) * 100);
            const apiBarWidth = Math.min(100, (tp.baseCost / (Math.max(...toolPricing.map(t => t.effectivePrice)) || 1)) * 100);
            return (
              <div key={tp.key} className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground truncate max-w-[120px]">{TOOL_LABELS[tp.key]}</span>
                  <span className={tp.profitPercent < 40 ? "text-destructive font-bold" : "text-green-500"}>
                    {tp.effectivePrice} Cr ({tp.profitPercent}%)
                  </span>
                </div>
                <div className="relative h-3 bg-secondary/40 rounded-full overflow-hidden">
                  <div className="absolute h-full bg-destructive/40 rounded-full" style={{ width: `${apiBarWidth}%` }} />
                  <div className="absolute h-full bg-primary/60 rounded-full" style={{ width: `${barWidth}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-destructive/40 rounded" /> API Cost
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-primary/60 rounded" /> User Price
          </div>
        </div>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={isLocked || isSaving} className="w-full gradient-gold text-primary-foreground">
        {isSaving ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> သိမ်းဆည်းနေသည်...</>
        ) : (
          <><Save className="w-4 h-4 mr-2" /> {isLocked ? "🔒 PIN ထည့်ပါ" : "Hybrid Pricing သိမ်းဆည်းမည်"}</>
        )}
      </Button>
    </div>
  );
};
