import { useState, useEffect } from "react";
import { Film, Power, Clock, Copy, TrendingUp, Loader2, Play, RefreshCw, Edit3, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VideoConfig {
  enabled: boolean;
  duration: number;
  customTopic: string;
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
  { key: "marketing", label: "Marketing Ad", emoji: "📢", topicSettingKey: "content_factory_marketing_topic" },
  { key: "burmese_tutorial", label: "မြန်မာ Tutorial", emoji: "🇲🇲", topicSettingKey: "content_factory_burmese_topic" },
  { key: "english_tutorial", label: "English Tutorial", emoji: "🇬🇧", topicSettingKey: "content_factory_english_topic" },
];

export const ContentFactoryTab = () => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Record<string, VideoConfig>>({
    marketing: { enabled: true, duration: 60, customTopic: "" },
    burmese_tutorial: { enabled: true, duration: 120, customTopic: "" },
    english_tutorial: { enabled: true, duration: 120, customTopic: "" },
  });
  const [videos, setVideos] = useState<DailyVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [tutorialPrice, setTutorialPrice] = useState(500);
  const [systemStatus, setSystemStatus] = useState<"checking" | "ok" | "error">("checking");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadConfigs();
    loadVideos();
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    setSystemStatus("checking");
    try {
      // Check if required settings exist
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["gemini_api_key", "replicate_api_token", "shotstack_api_key"]);

      const hasGemini = data?.some(s => s.key === "gemini_api_key" && s.value);
      const hasReplicate = data?.some(s => s.key === "replicate_api_token" && s.value);

      if (!hasGemini && !hasReplicate) {
        setSystemStatus("error");
        setStatusMessage("API Keys (Gemini/Replicate) မရှိသေးပါ - Script generation အတွက် လိုအပ်ပါသည်");
      } else {
        setSystemStatus("ok");
        setStatusMessage("Script generation system အလုပ်လုပ်နေပါသည်");
      }
    } catch {
      setSystemStatus("error");
      setStatusMessage("System status စစ်ဆေးရာတွင် ပြဿနာရှိပါသည်");
    }
  };

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
          "content_factory_marketing_topic",
          "content_factory_burmese_topic",
          "content_factory_english_topic",
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
          if (s.key === "content_factory_marketing_topic") newConfigs.marketing.customTopic = s.value || "";
          if (s.key === "content_factory_burmese_topic") newConfigs.burmese_tutorial.customTopic = s.value || "";
          if (s.key === "content_factory_english_topic") newConfigs.english_tutorial.customTopic = s.value || "";
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
        { key: "content_factory_marketing_topic", value: configs.marketing.customTopic },
        { key: "content_factory_burmese_topic", value: configs.burmese_tutorial.customTopic },
        { key: "content_factory_english_topic", value: configs.english_tutorial.customTopic },
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

  const regenerateToday = async () => {
    setIsRegenerating(true);
    try {
      // Save custom topics first
      await saveConfigs();

      const { data, error } = await supabase.functions.invoke("daily-content-generate");
      if (error) throw error;

      toast({
        title: "ပြန်ထုတ်ပေးပြီးပါပြီ",
        description: `ယနေ့ content ${data?.results?.length || 0} ခု generate လုပ်ပြီးပါပြီ`,
      });
      await loadVideos();
    } catch (error: any) {
      console.error("Regeneration error:", error);
      toast({
        title: "ပြဿနာရှိပါသည်",
        description: error.message || "Content generate လုပ်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
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
      {/* System Status */}
      <div className={`rounded-xl p-3 border flex items-center gap-3 ${
        systemStatus === "ok" ? "border-green-500/30 bg-green-500/5"
          : systemStatus === "error" ? "border-destructive/30 bg-destructive/5"
          : "border-primary/30 bg-primary/5"
      }`}>
        <div className={`w-3 h-3 rounded-full shrink-0 ${
          systemStatus === "ok" ? "bg-green-500 animate-pulse"
            : systemStatus === "error" ? "bg-destructive"
            : "bg-primary animate-pulse"
        }`} />
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-medium ${
            systemStatus === "ok" ? "text-green-500"
              : systemStatus === "error" ? "text-destructive"
              : "text-primary"
          }`}>
            {systemStatus === "ok" ? "System Active" : systemStatus === "error" ? "System Error" : "Checking..."}
          </span>
          <p className="text-[10px] text-muted-foreground truncate">{statusMessage}</p>
        </div>
        {systemStatus === "error" && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
      </div>

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

      {/* Video Type Controls with Custom Topics */}
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
                <Power className={`w-3.5 h-3.5 ${configs[key]?.enabled ? "text-green-500" : "text-muted-foreground"}`} />
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

            {/* Duration */}
            <div className="flex items-center gap-2 mb-3">
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

            {/* Custom Topic Input */}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Edit3 className="w-3 h-3 text-muted-foreground" />
                <label className="text-xs text-muted-foreground font-myanmar">
                  နောက်ရက် အကြောင်းအရာ (ထည့်ထားရင် အဲ့အကြောင်း ထုတ်ပေးမည်)
                </label>
              </div>
              <Textarea
                value={configs[key]?.customTopic || ""}
                onChange={(e) =>
                  setConfigs((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], customTopic: e.target.value },
                  }))
                }
                placeholder={
                  key === "marketing"
                    ? "ဥပမာ: AI Face Swap tool ကို promote လုပ်မယ့် ကြော်ငြာ..."
                    : key === "burmese_tutorial"
                    ? "ဥပမာ: AI Image Tool ကို အကောင့်ဖွင့်နည်းကနေ စပြီး သင်ပေးမယ်..."
                    : "e.g. How to use AI Video Tool from account creation to export..."
                }
                className="text-xs min-h-[60px]"
              />
              {configs[key]?.customTopic && (
                <p className="text-[10px] text-primary font-myanmar">
                  ✓ Custom topic save ထားပါပြီ - နောက်ရက် ဒီအကြောင်းအရာနဲ့ ထုတ်ပေးပါမည်
                </p>
              )}
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
      </div>

      {/* Save & Regenerate Buttons */}
      <div className="flex gap-2">
        <Button onClick={saveConfigs} disabled={isSaving} className="flex-1 rounded-xl">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Settings
        </Button>
        <Button onClick={regenerateToday} disabled={isRegenerating} variant="outline" className="flex-1 rounded-xl">
          {isRegenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          ယနေ့ ပြန်ထုတ်မည်
        </Button>
      </div>

      {/* Recent Generated Videos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground font-myanmar flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Generated Content
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
              Content မရှိသေးပါ။ "ယနေ့ ပြန်ထုတ်မည်" ကို နှိပ်ပါ
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
                    {video.video_url && (
                      <a href={video.video_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary underline mt-1 inline-block">
                        📥 Video Download
                      </a>
                    )}
                  </div>
                  {video.is_published && (
                    <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">Published</span>
                  )}
                </div>

                {video.facebook_caption && (
                  <div className="mt-2 p-2 bg-secondary/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Facebook Caption</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(video.facebook_caption!)} className="h-6 px-2">
                        <Copy className="w-3 h-3 mr-1" /> Copy
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
                    <Button variant="ghost" size="sm"
                      onClick={() => copyToClipboard(video.hashtags!.map((t) => `#${t}`).join(" "))}
                      className="h-5 px-1">
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
