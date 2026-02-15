import { useState, useEffect } from "react";
import { Save, Gift, Play, Loader2, Settings2, Clock, CreditCard, Eye, EyeOff, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AppSettingsTab = () => {
  const { settings, isLoading, isSaving, saveSettings } = useAppSettings();
  const { toast } = useToast();
  
  const [adRewardAmount, setAdRewardAmount] = useState(5);
  const [dailyAdLimit, setDailyAdLimit] = useState(10);
  const [campaignReward, setCampaignReward] = useState(100);
  const [adTimerDuration, setAdTimerDuration] = useState(60);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [maxVideoDuration, setMaxVideoDuration] = useState(180);
  const [savingVideoDuration, setSavingVideoDuration] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setAdRewardAmount(settings.ad_reward_amount);
      setDailyAdLimit(settings.daily_ad_limit);
      setCampaignReward(settings.campaign_approval_reward);
      setAdTimerDuration(settings.ad_timer_duration);
    }
  }, [settings, isLoading]);

  // Load webhook secret
  useEffect(() => {
    const loadSecrets = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["stripe_webhook_secret", "max_video_duration"]);
      data?.forEach((d) => {
        if (d.key === "stripe_webhook_secret" && d.value) setWebhookSecret(d.value);
        if (d.key === "max_video_duration" && d.value) setMaxVideoDuration(parseInt(d.value, 10) || 180);
      });
    };
    loadSecrets();
  }, []);

  const handleSaveWebhookSecret = async () => {
    setSavingWebhook(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "stripe_webhook_secret", value: webhookSecret }, { onConflict: "key" });
      if (error) throw error;
      toast({ title: "Webhook Secret သိမ်းဆည်းပြီးပါပြီ" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleSave = async () => {
    await saveSettings({
      ad_reward_amount: adRewardAmount,
      daily_ad_limit: dailyAdLimit,
      campaign_approval_reward: campaignReward,
      ad_timer_duration: adTimerDuration,
    });
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
          <Settings2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground font-myanmar">App Settings</h3>
          <p className="text-xs text-muted-foreground">Credits နှင့် Rewards စနစ်ကို စီမံပါ</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Ad Rewards Section */}
        <div className="gradient-card rounded-xl p-5 border border-primary/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Play className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground font-myanmar">Adsterra ကြော်ငြာ Settings</h4>
              <p className="text-xs text-muted-foreground">ကြော်ငြာကြည့်ရာတွင် ရရှိမည့် Credits</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium font-myanmar text-foreground">
                Ad Reward Amount
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={adRewardAmount}
                  onChange={(e) => setAdRewardAmount(parseInt(e.target.value) || 0)}
                  min={1}
                  max={50}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">Credits per ad</span>
              </div>
              <p className="text-xs text-muted-foreground">
                User တစ်ယောက် ကြော်ငြာတစ်ခု ကြည့်လျှင် ရရှိမည့် Credits
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium font-myanmar text-foreground">
                Daily Ad Limit
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={dailyAdLimit}
                  onChange={(e) => setDailyAdLimit(parseInt(e.target.value) || 0)}
                  min={1}
                  max={100}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">Credits per day</span>
              </div>
              <p className="text-xs text-muted-foreground">
                User တစ်ယောက် တစ်ရက်လျှင် ကြော်ငြာမှ ရယူနိုင်သည့် အများဆုံး Credits
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium font-myanmar text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Ad Timer Duration
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={adTimerDuration}
                  onChange={(e) => setAdTimerDuration(parseInt(e.target.value) || 0)}
                  min={10}
                  max={300}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
              <p className="text-xs text-muted-foreground">
                User များ ကြော်ငြာကြည့်ရန် စောင့်ဆိုင်းရမည့် အချိန် (စက္ကန့်)
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Rewards Section */}
        <div className="gradient-card rounded-xl p-5 border border-green-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Gift className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground font-myanmar">Campaign Reward Settings</h4>
              <p className="text-xs text-muted-foreground">Review Video တင်သူများအတွက် ဆုကြေး</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium font-myanmar text-foreground">
              Campaign Approval Reward
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={campaignReward}
                onChange={(e) => setCampaignReward(parseInt(e.target.value) || 0)}
                min={10}
                max={500}
                className="max-w-[120px]"
              />
              <span className="text-sm text-muted-foreground">Credits per approval</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Campaign အတည်ပြုခံရသူများ ရရှိမည့် Credits
            </p>
          </div>
        </div>

        {/* Shotstack Video Duration Limit */}
        <div className="gradient-card rounded-xl p-5 border border-blue-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Film className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground font-myanmar">Shotstack Plan Max Duration</h4>
              <p className="text-xs text-muted-foreground">Video tools များ၏ အများဆုံး Duration ကို ထိန်းချုပ်ပါ</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium font-myanmar text-foreground">
              Max Video Duration (Seconds)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={maxVideoDuration}
                onChange={(e) => setMaxVideoDuration(parseInt(e.target.value) || 0)}
                min={30}
                max={3600}
                className="max-w-[150px]"
              />
              <span className="text-sm text-muted-foreground">seconds ({Math.floor(maxVideoDuration / 60)} min)</span>
              <Button
                onClick={async () => {
                  setSavingVideoDuration(true);
                  try {
                    await supabase.from("app_settings").upsert({ key: "max_video_duration", value: maxVideoDuration.toString() }, { onConflict: "key" });
                    toast({ title: "Video Duration Limit သိမ်းဆည်းပြီးပါပြီ" });
                  } catch (e: any) {
                    toast({ title: "Error", description: e.message, variant: "destructive" });
                  } finally {
                    setSavingVideoDuration(false);
                  }
                }}
                disabled={savingVideoDuration}
                size="sm"
              >
                {savingVideoDuration ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-myanmar">
              ဤတန်ဖိုးပြောင်းလိုက်ရင် Video tools အားလုံးမှာ ချက်ချင်း အသက်ဝင်ပါမည်။ (Default: 180 = 3 min)
            </p>
          </div>
        </div>

        {/* Stripe Webhook Secret Section */}
        <div className="gradient-card rounded-xl p-5 border border-primary/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground font-myanmar">Stripe Webhook Secret</h4>
              <p className="text-xs text-muted-foreground">Webhook signature verification အတွက်</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium font-myanmar text-foreground">
              Webhook Signing Secret (whsec_...)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showWebhookSecret ? "text" : "password"}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="whsec_..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button onClick={handleSaveWebhookSecret} disabled={savingWebhook} size="sm">
                {savingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Stripe Dashboard → Webhooks → Signing secret ကို ဤနေရာတွင် ထည့်ပါ
            </p>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
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
              Settings သိမ်းဆည်းမည်
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
