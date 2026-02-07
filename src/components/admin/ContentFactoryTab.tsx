import { useState, useEffect } from "react";
import { Film, Power, Clock, Copy, TrendingUp, Loader2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VideoConfig {
  enabled: boolean;
  duration: number;
}

interface DailyVideo {
  id: string;
  video_type: string;
  title: string;
  description: string | null;
  video_url: string | null;
  facebook_caption: string | null;
  hashtags: string[] | null;
  api_cost_credits: number;
  is_published: boolean;
  generated_date: string;
  created_at: string;
}

const VIDEO_TYPES = [
  { key: "marketing", label: "Marketing Ad", emoji: "📢" },
  { key: "burmese_tutorial", label: "မြန်မာ Tutorial", emoji: "🇲🇲" },
  { key: "english_tutorial", label: "English Tutorial", emoji: "🇬🇧" },
];

export const ContentFactoryTab = () => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Record<string, VideoConfig>>({
    marketing: { enabled: true, duration: 60 },
    burmese_tutorial: { enabled: true, duration: 120 },
    english_tutorial: { enabled: true, duration: 120 },
  });
  const [videos, setVideos] = useState<DailyVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [tutorialPrice, setTutorialPrice] = useState(500);

  useEffect(() => {
    loadConfigs();
    loadVideos();
  }, []);

  const loadConfigs = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "content_factory_marketing_enabled",
          "content_factory_burmese_tutorial_enabled",
          "content_factory_english_tutorial_enabled",
          "content_factory_marketing_duration",
          "content_factory_burmese_duration",
          "content_factory_english_duration",
          "tutorial_access_fee",
        ]);

      if (data) {
        const newConfigs = { ...configs };
        data.forEach((s) => {
          if (s.key === "content_factory_marketing_enabled") newConfigs.marketing.enabled = s.value === "true";
          if (s.key === "content_factory_burmese_tutorial_enabled") newConfigs.burmese_tutorial.enabled = s.value === "true";
          if (s.key === "content_factory_english_tutorial_enabled") newConfigs.english_tutorial.enabled = s.value === "true";
          if (s.key === "content_factory_marketing_duration") newConfigs.marketing.duration = parseInt(s.value || "60");
          if (s.key === "content_factory_burmese_duration") newConfigs.burmese_tutorial.duration = parseInt(s.value || "120");
          if (s.key === "content_factory_english_duration") newConfigs.english_tutorial.duration = parseInt(s.value || "120");
          if (s.key === "tutorial_access_fee") setTutorialPrice(parseInt(s.value || "500"));
        });
        setConfigs(newConfigs);
      }
    } catch (error) {
      console.error("Error loading configs:", error);
    }
  };

  const loadVideos = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("daily_content_videos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      if (data) {
        setVideos(data as DailyVideo[]);
        const total = data.reduce((sum, v) => sum + Number(v.api_cost_credits || 0), 0);
        setTotalInvestment(total);
      }
    } catch (error) {
      console.error("Error loading videos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfigs = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: "content_factory_marketing_enabled", value: String(configs.marketing.enabled) },
        { key: "content_factory_burmese_tutorial_enabled", value: String(configs.burmese_tutorial.enabled) },
        { key: "content_factory_english_tutorial_enabled", value: String(configs.english_tutorial.enabled) },
        { key: "content_factory_marketing_duration", value: String(configs.marketing.duration) },
        { key: "content_factory_burmese_duration", value: String(configs.burmese_tutorial.duration) },
        { key: "content_factory_english_duration", value: String(configs.english_tutorial.duration) },
        { key: "tutorial_access_fee", value: String(tutorialPrice) },
      ];

      for (const u of updates) {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: u.key, value: u.value }, { onConflict: "key" });
        if (error) throw error;
      }

      toast({ title: "သိမ်းဆည်းပြီးပါပြီ", description: "Content Factory settings များ အပ်ဒိတ်ပြီးပါပြီ" });
    } catch (error) {
      console.error("Error saving configs:", error);
      toast({ title: "အမှား", description: "Settings သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "ကူးယူပြီးပါပြီ" });
  };

  const todayVideos = videos.filter(
    (v) => v.generated_date === new Date().toISOString().split("T")[0]
  );
  const todayInvestment = todayVideos.reduce((sum, v) => sum + Number(v.api_cost_credits || 0), 0);

  return (
    <div className="space-y-6">
      {/* Investment Tracker */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground font-myanmar">
            ဗီဒီယိုထုတ်လုပ်မှု ရင်းနှီးကုန်ကျငွေ
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-myanmar">ယနေ့ ရင်းနှီးငွေ</p>
            <p className="text-xl font-bold text-primary">{todayInvestment.toFixed(1)} Credits</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-myanmar">စုစုပေါင်း ရင်းနှီးငွေ</p>
            <p className="text-xl font-bold text-foreground">{totalInvestment.toFixed(1)} Credits</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-myanmar">
          ⚠️ ဤကုန်ကျစရိတ်သည် user profits မှ မနုတ်ပါ - Business Investment ဖြစ်ပါသည်
        </p>
      </div>

      {/* Video Type Controls */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground font-myanmar flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          Daily Video Controls
        </h3>

        {VIDEO_TYPES.map(({ key, label, emoji }) => (
          <div key={key} className="gradient-card rounded-xl p-4 border border-primary/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{emoji}</span>
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <Power className={`w-3.5 h-3.5 ${configs[key]?.enabled ? "text-success" : "text-muted-foreground"}`} />
                <Switch
                  checked={configs[key]?.enabled || false}
                  onCheckedChange={(checked) =>
                    setConfigs((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], enabled: checked },
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-myanmar">Duration (seconds):</span>
              <Input
                type="number"
                value={configs[key]?.duration || 60}
                onChange={(e) =>
                  setConfigs((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], duration: parseInt(e.target.value) || 60 },
                  }))
                }
                className="w-24 h-8 text-sm"
                min={10}
                max={600}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tutorial Access Fee */}
      <div className="gradient-card rounded-xl p-4 border border-primary/20">
        <h3 className="text-sm font-semibold text-foreground mb-2 font-myanmar">
          သင်တန်း Lifetime Access Fee (Credits)
        </h3>
        <Input
          type="number"
          value={tutorialPrice}
          onChange={(e) => setTutorialPrice(parseInt(e.target.value) || 0)}
          className="w-full h-10"
          min={0}
        />
        <p className="text-xs text-muted-foreground mt-1 font-myanmar">
          User များ သင်တန်းအားလုံး ကြည့်ရန် ပေးရမည့် credit ပမာဏ
        </p>
      </div>

      {/* Save Button */}
      <Button onClick={saveConfigs} disabled={isSaving} className="w-full rounded-xl">
        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Settings သိမ်းဆည်းမည်
      </Button>

      {/* Recent Generated Videos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground font-myanmar flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Generated Videos
          </h3>
          <Button variant="ghost" size="sm" onClick={loadVideos}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          </div>
        ) : videos.length === 0 ? (
          <div className="gradient-card rounded-xl p-6 border border-border/30 text-center">
            <p className="text-sm text-muted-foreground font-myanmar">
              ဗီဒီယိုများ မရှိသေးပါ။ API Keys ငွေဖြည့်ပြီးရင် အလိုအလျောက် ထုတ်လုပ်ပါမည်
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {videos.slice(0, 10).map((video) => (
              <div key={video.id} className="gradient-card rounded-xl p-3 border border-border/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {video.video_type}
                      </span>
                      <span className="text-xs text-muted-foreground">{video.generated_date}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{video.title}</p>
                    <p className="text-xs text-muted-foreground">
                      API Cost: {Number(video.api_cost_credits).toFixed(1)} credits
                    </p>
                  </div>
                  {video.is_published && (
                    <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">Published</span>
                  )}
                </div>

                {/* Social Media Kit */}
                {video.facebook_caption && (
                  <div className="mt-2 p-2 bg-secondary/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Facebook Caption</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(video.facebook_caption!)}
                        className="h-6 px-2"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{video.facebook_caption}</p>
                  </div>
                )}

                {video.hashtags && video.hashtags.length > 0 && (
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    {video.hashtags.map((tag, i) => (
                      <span key={i} className="text-xs text-primary">#{tag}</span>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(video.hashtags!.map((t) => `#${t}`).join(" "))}
                      className="h-5 px-1"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
