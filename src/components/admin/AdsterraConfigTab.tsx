import { useState, useEffect } from "react";
import { Save, Loader2, Globe, Code, DollarSign, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AdsterraConfigTab = () => {
  const { toast } = useToast();
  const [publisherId, setPublisherId] = useState("");
  const [scriptCode, setScriptCode] = useState("");
  const [adUnitId, setAdUnitId] = useState("");
  const [apiInitialBalance, setApiInitialBalance] = useState("");
  const [apiRemainingBalance, setApiRemainingBalance] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("key, value")
          .in("key", [
            "adsterra_publisher_id",
            "adsterra_script_code",
            "adsterra_ad_unit_id",
            "api_initial_balance",
            "api_remaining_balance",
          ]);

        if (data) {
          data.forEach(s => {
            switch (s.key) {
              case "adsterra_publisher_id": setPublisherId(s.value || ""); break;
              case "adsterra_script_code": setScriptCode(s.value || ""); break;
              case "adsterra_ad_unit_id": setAdUnitId(s.value || ""); break;
              case "api_initial_balance": setApiInitialBalance(s.value || ""); break;
              case "api_remaining_balance": setApiRemainingBalance(s.value || ""); break;
            }
          });
        }
      } catch (err) {
        console.error("Error loading adsterra config:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: "adsterra_publisher_id", value: publisherId },
        { key: "adsterra_script_code", value: scriptCode },
        { key: "adsterra_ad_unit_id", value: adUnitId },
        { key: "api_initial_balance", value: apiInitialBalance },
        { key: "api_remaining_balance", value: apiRemainingBalance },
      ];

      for (const u of updates) {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: u.key, value: u.value }, { onConflict: "key" });
        if (error) throw error;
      }

      toast({ title: "သိမ်းဆည်းပြီးပါပြီ", description: "Adsterra နှင့် API Balance settings သိမ်းဆည်းပြီးပါပြီ" });
    } catch (err) {
      console.error("Save error:", err);
      toast({ title: "အမှား", description: "သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const remaining = parseFloat(apiRemainingBalance) || 0;
  const showWarning = remaining > 0 && remaining <= 5;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Low Balance Warning */}
      {showWarning && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-destructive font-myanmar">⚠️ API Balance နိမ့်နေပါပြီ!</h4>
            <p className="text-xs text-destructive/80 font-myanmar">
              Remaining Balance: ${remaining.toFixed(2)} - ထပ်မံဖြည့်သွင်းရန် လိုအပ်ပါသည်
            </p>
          </div>
        </div>
      )}

      {/* API Balance Tracking */}
      <div className="gradient-card rounded-xl p-5 border border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground font-myanmar">API Balance Tracking</h4>
            <p className="text-xs text-muted-foreground">API Key များ၏ လက်ကျန်ငွေ စာရင်း</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium font-myanmar text-foreground">Initial Top-up Amount ($)</label>
            <Input
              type="number"
              value={apiInitialBalance}
              onChange={e => setApiInitialBalance(e.target.value)}
              placeholder="e.g. 50.00"
              step="0.01"
              className="max-w-[200px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium font-myanmar text-foreground">Estimated Remaining Balance ($)</label>
            <Input
              type="number"
              value={apiRemainingBalance}
              onChange={e => setApiRemainingBalance(e.target.value)}
              placeholder="e.g. 45.00"
              step="0.01"
              className={`max-w-[200px] ${showWarning ? "border-destructive" : ""}`}
            />
            {showWarning && (
              <p className="text-xs text-destructive font-myanmar">⚠️ $5.00 သို့မဟုတ် အောက်ရောက်နေပါပြီ</p>
            )}
          </div>
        </div>
      </div>

      {/* Adsterra Config */}
      <div className="gradient-card rounded-xl p-5 border border-amber-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Globe className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground font-myanmar">Adsterra Integration</h4>
            <p className="text-xs text-muted-foreground">Publisher ID နှင့် Script Code</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium font-myanmar text-foreground">Publisher ID</label>
            <Input
              value={publisherId}
              onChange={e => setPublisherId(e.target.value)}
              placeholder="Adsterra Publisher ID"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium font-myanmar text-foreground">Ad Unit ID</label>
            <Input
              value={adUnitId}
              onChange={e => setAdUnitId(e.target.value)}
              placeholder="e.g. 28594848"
            />
            <p className="text-[10px] text-muted-foreground font-myanmar">Native Banner Ad Unit ID (Earn Credits modal တွင် အသုံးပြုမည်)</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium font-myanmar text-foreground flex items-center gap-2">
              <Code className="w-4 h-4 text-muted-foreground" />
              Script Code (Native Banner)
            </label>
            <Textarea
              value={scriptCode}
              onChange={e => setScriptCode(e.target.value)}
              placeholder='<script async="async" data-cfasync="false" src="https://..."></script><div id="container-..."></div>'
              rows={4}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground font-myanmar">Native Banner script + container div ကို ထည့်ပါ (Social Bar မသုံးပါနှင့်)</p>
          </div>
        </div>
      </div>

      {/* Revenue Share Info */}
      <div className="gradient-card rounded-xl p-5 border border-primary/20">
        <h4 className="font-semibold text-foreground mb-3 font-myanmar">💰 Revenue Share Model (30/70)</h4>
        <div className="space-y-2 text-xs font-myanmar text-muted-foreground">
          <div className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
            <span>User Reward (Free Credits)</span>
            <span className="font-semibold text-green-500">30%</span>
          </div>
          <div className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
            <span>Platform Profit</span>
            <span className="font-semibold text-primary">70%</span>
          </div>
          <p className="mt-2 text-muted-foreground/70">
            User များ ကြော်ငြာကြည့်၍ ရရှိသော Credits = Ad Revenue × 30%
          </p>
        </div>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full gradient-gold text-primary-foreground">
        {isSaving ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />သိမ်းဆည်းနေသည်...</>
        ) : (
          <><Save className="w-4 h-4 mr-2" />Settings သိမ်းဆည်းမည်</>
        )}
      </Button>
    </div>
  );
};
