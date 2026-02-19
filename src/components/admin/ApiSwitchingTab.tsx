import { useState, useEffect } from "react";
import { Save, Loader2, Power, Zap, AlertTriangle, Gift, Eye, EyeOff, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyConfig {
  key: string;
  label: string;
  description: string;
  settingKey: string;
  toggleKey: string;
  tasks: string[];
}

const API_KEYS: ApiKeyConfig[] = [
  {
    key: "openai",
    label: "OpenAI",
    description: "GPT-5, AI Caption, Translator, Agentic AI (Primary Provider)",
    settingKey: "openai_api_key",
    toggleKey: "api_enabled_openai",
    tasks: ["AI Caption", "Translator", "Agentic AI", "Text Generation", "Complex Reasoning"],
  },
  {
    key: "gemini",
    label: "Google Gemini",
    description: "Text, Audio, Complex Reasoning",
    settingKey: "gemini_api_key",
    toggleKey: "api_enabled_gemini",
    tasks: ["Text Generation", "Content Writing", "Complex Reasoning", "Audio"],
  },
  {
    key: "replicate",
    label: "Replicate AI",
    description: "Image, Video, Llama 3, TTS (Backup for Gemini)",
    settingKey: "replicate_api_token",
    toggleKey: "api_enabled_replicate",
    tasks: ["Image Generation", "Video", "Face Swap", "Upscale", "TTS Backup"],
  },
  {
    key: "stability",
    label: "Stability AI",
    description: "Image Generation, Style Transfer",
    settingKey: "stability_api_key",
    toggleKey: "api_enabled_stability",
    tasks: ["Image Generation", "Style Transfer", "BG Remove"],
  },
  {
    key: "shotstack",
    label: "Shotstack",
    description: "Video Rendering, Captions",
    settingKey: "shotstack_api_key",
    toggleKey: "api_enabled_shotstack",
    tasks: ["Video Rendering", "Captions", "Video Export"],
  },
  {
    key: "rapidapi",
    label: "RapidAPI (Downloader)",
    description: "YouTube/TikTok/FB Video Download",
    settingKey: "rapidapi_key",
    toggleKey: "api_enabled_rapidapi",
    tasks: ["Video Download", "Video Multi-Tool Source Fetch"],
  },
  {
    key: "acrcloud",
    label: "ACRCloud",
    description: "Copyright Detection, Music Recognition",
    settingKey: "acrcloud_access_key",
    toggleKey: "api_enabled_acrcloud",
    tasks: ["Copyright Check", "Music Detection"],
  },
  {
    key: "sunoapi",
    label: "SunoAPI.org",
    description: "AI Song Generation with Human Vocals, MTV Music (Suno v4)",
    settingKey: "sunoapi_org_key",
    toggleKey: "api_enabled_sunoapi",
    tasks: ["Song Generation", "Human Vocals", "MTV Audio", "Lyrics"],
  },
  {
    key: "goapi_suno",
    label: "GoAPI Suno",
    description: "Suno AI via GoAPI (Backup Song Generation)",
    settingKey: "goapi_suno_api_key",
    toggleKey: "api_enabled_goapi_suno",
    tasks: ["Song Generation Backup", "Music AI", "Vocals Backup"],
  },
];

export const ApiSwitchingTab = () => {
  const { toast } = useToast();
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({});
  const [keyConfigured, setKeyConfigured] = useState<Record<string, boolean>>({});
  const [dailyFreeUses, setDailyFreeUses] = useState(3);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // SunoAPI key input
  const [sunoKeyInput, setSunoKeyInput] = useState("");
  const [showSunoKey, setShowSunoKey] = useState(false);
  const [isSavingSunoKey, setIsSavingSunoKey] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .or(
          API_KEYS.map(a => `key.eq.${a.toggleKey}`).join(",") +
          "," + API_KEYS.map(a => `key.eq.${a.settingKey}`).join(",") +
          ",key.eq.daily_free_uses"
        );

      if (data) {
        const toggles: Record<string, boolean> = {};
        const configured: Record<string, boolean> = {};

        // Default all toggles to ON
        API_KEYS.forEach(api => {
          toggles[api.key] = true;
          configured[api.key] = false;
        });

        data.forEach(setting => {
          // Check toggle states
          const toggleApi = API_KEYS.find(a => a.toggleKey === setting.key);
          if (toggleApi) {
            toggles[toggleApi.key] = setting.value !== "false";
          }

          // Check if key is configured
          const configApi = API_KEYS.find(a => a.settingKey === setting.key);
          if (configApi && setting.value && !setting.value.startsWith("••••")) {
            configured[configApi.key] = true;
          }

          // Load SunoAPI key (masked)
          if (setting.key === "sunoapi_org_key" && setting.value) {
            const masked = setting.value.length > 8 ? "••••••••" + setting.value.slice(-4) : "••••••••";
            setSunoKeyInput(masked);
          }

          if (setting.key === "daily_free_uses") {
            setDailyFreeUses(parseInt(setting.value || "3", 10));
          }
        });

        setToggleStates(toggles);
        setKeyConfigured(configured);
      }
    } catch (error) {
      console.error("Error loading API config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (apiKey: string, enabled: boolean) => {
    const api = API_KEYS.find(a => a.key === apiKey);
    if (!api) return;

    setToggleStates(prev => ({ ...prev, [apiKey]: enabled }));

    try {
      await supabase
        .from("app_settings")
        .upsert({ key: api.toggleKey, value: enabled.toString() }, { onConflict: "key" });

      toast({
        title: enabled ? `${api.label} ဖွင့်လိုက်ပါပြီ` : `${api.label} ပိတ်လိုက်ပါပြီ`,
        description: enabled
          ? `${api.label} ကို primary engine အဖြစ် ပြန်သုံးပါမည်`
          : `Tasks များကို backup API ဖြင့် route လုပ်ပါမည်`,
      });
    } catch (error) {
      console.error("Error toggling API:", error);
      setToggleStates(prev => ({ ...prev, [apiKey]: !enabled }));
    }
  };

  const saveDailyFreeUses = async () => {
    setIsSaving(true);
    try {
      await supabase
        .from("app_settings")
        .upsert({ key: "daily_free_uses", value: dailyFreeUses.toString() }, { onConflict: "key" });

      toast({
        title: "သိမ်းဆည်းပြီးပါပြီ",
        description: `တစ်ရက် ${dailyFreeUses} ကြိမ် အခမဲ့သုံးခွင့် သတ်မှတ်ပြီးပါပြီ`,
      });
    } catch (error) {
      console.error("Error saving daily free uses:", error);
      toast({
        title: "အမှား",
        description: "သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveSunoKey = async () => {
    if (!sunoKeyInput || sunoKeyInput.startsWith("••••")) {
      toast({ title: "API Key ထည့်ပါ", description: "SunoAPI.org key အသစ်ထည့်ပေးပါ", variant: "destructive" });
      return;
    }
    setIsSavingSunoKey(true);
    try {
      await supabase.from("app_settings").upsert({ key: "sunoapi_org_key", value: sunoKeyInput }, { onConflict: "key" });
      toast({ title: "သိမ်းဆည်းပြီးပါပြီ", description: "SunoAPI.org key ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ" });
      setSunoKeyInput("••••••••" + sunoKeyInput.slice(-4));
      setKeyConfigured(prev => ({ ...prev, sunoapi: true }));
    } catch (error) {
      console.error("Error saving SunoAPI key:", error);
      toast({ title: "အမှား", description: "SunoAPI key သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်", variant: "destructive" });
    } finally {
      setIsSavingSunoKey(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeCount = Object.values(toggleStates).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Smart API Switching</h3>
          <p className="text-xs text-muted-foreground">
            API Keys ON/OFF Toggle & Failover Logic ({activeCount}/{API_KEYS.length} Active)
          </p>
        </div>
      </div>

      {/* Failover Info */}
      <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
          <span>
            OpenAI Primary ဖြစ်ပါက Gemini OFF ဖြစ်ပါက Text/Audio tasks များကို OpenAI (GPT-5) သို့ auto-route လုပ်ပါမည်။
            OpenAI fail ဖြစ်ပါက Replicate (Llama 3) သို့ fallback လုပ်ပါမည်။
            ⚠️ OpenAI fail ဖြစ်ပါက billing စစ်ဆေးပါ။
          </span>
        </p>
      </div>

      {/* API Toggle Table */}
      <div className="space-y-3">
        {API_KEYS.map(api => {
          const isOn = toggleStates[api.key] ?? true;
          const hasKey = keyConfigured[api.key];

          return (
            <div
              key={api.key}
              className={`gradient-card rounded-xl p-4 border transition-all ${
                isOn && hasKey
                  ? "border-green-500/30"
                  : isOn && !hasKey
                  ? "border-amber-500/30"
                  : "border-destructive/30 opacity-70"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isOn && hasKey
                        ? "bg-green-500/10"
                        : isOn && !hasKey
                        ? "bg-amber-500/10"
                        : "bg-destructive/10"
                    }`}
                  >
                    <Power
                      className={`w-4 h-4 ${
                        isOn && hasKey
                          ? "text-green-500"
                          : isOn && !hasKey
                          ? "text-amber-500"
                          : "text-destructive"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-foreground">{api.label}</h4>
                    <p className="text-xs text-muted-foreground truncate">{api.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {api.tasks.slice(0, 3).map(task => (
                        <span
                          key={task}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground"
                        >
                          {task}
                        </span>
                      ))}
                      {api.tasks.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
                          +{api.tasks.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                      isOn && hasKey
                        ? "bg-green-500/20 text-green-500"
                        : isOn && !hasKey
                        ? "bg-amber-500/20 text-amber-500"
                        : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {isOn && hasKey ? "ACTIVE" : isOn && !hasKey ? "NO KEY" : "OFF"}
                  </span>
                  <Switch checked={isOn} onCheckedChange={val => handleToggle(api.key, val)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SunoAPI.org Key Input */}
      <div className="gradient-card rounded-xl p-5 border border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Key className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">SunoAPI.org API Key</h4>
            <p className="text-xs text-muted-foreground">
              Song Generation, Human Vocals, MTV Audio အတွက် API Key ထည့်ပါ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showSunoKey ? "text" : "password"}
              value={sunoKeyInput}
              onChange={e => setSunoKeyInput(e.target.value)}
              placeholder="SunoAPI.org API Key ထည့်ပါ..."
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSunoKey(!showSunoKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSunoKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button
            onClick={saveSunoKey}
            disabled={isSavingSunoKey}
            size="sm"
            className="gradient-gold text-primary-foreground"
          >
            {isSavingSunoKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          🔗 <a href="https://sunoapi.org" target="_blank" rel="noopener noreferrer" className="underline text-primary">sunoapi.org</a> မှ API Key ရယူပြီး ဤနေရာတွင် ထည့်ပါ။ Edge Functions များမှ auto-fetch လုပ်ပါမည်။
        </p>
      </div>

      {/* Daily Free Uses */}
      <div className="gradient-card rounded-xl p-5 border border-green-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Gift className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Daily Free Uses</h4>
            <p className="text-xs text-muted-foreground">
              User တိုင်း တစ်ရက်လျှင် အခမဲ့ အကြိမ်ရေ (24 နာရီ reset)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Input
            type="number"
            value={dailyFreeUses}
            onChange={e => setDailyFreeUses(parseInt(e.target.value) || 0)}
            min={0}
            max={50}
            className="max-w-[100px]"
          />
          <span className="text-sm text-muted-foreground">ကြိမ် / ရက်</span>
          <Button
            onClick={saveDailyFreeUses}
            disabled={isSaving}
            size="sm"
            className="gradient-gold text-primary-foreground ml-auto"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
