import { useState, useEffect } from "react";
import { Save, Gift, Play, Loader2, Settings2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppSettings } from "@/hooks/useAppSettings";

export const AppSettingsTab = () => {
  const { settings, isLoading, isSaving, saveSettings } = useAppSettings();
  
  const [adRewardAmount, setAdRewardAmount] = useState(5);
  const [dailyAdLimit, setDailyAdLimit] = useState(10);
  const [campaignReward, setCampaignReward] = useState(100);
  const [adTimerDuration, setAdTimerDuration] = useState(60);

  useEffect(() => {
    if (!isLoading) {
      setAdRewardAmount(settings.ad_reward_amount);
      setDailyAdLimit(settings.daily_ad_limit);
      setCampaignReward(settings.campaign_approval_reward);
      setAdTimerDuration(settings.ad_timer_duration);
    }
  }, [settings, isLoading]);

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
