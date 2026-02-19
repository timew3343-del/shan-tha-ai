import { useState, useEffect } from "react";
import { 
  Save, Loader2, Power, Zap, AlertTriangle, Gift, Eye, EyeOff, Key, 
  DollarSign, Activity, ChevronDown, ChevronUp 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────
interface ApiKeyConfig {
  key: string;
  label: string;
  description: string;
  settingKey: string;
  toggleKey: string;
  tasks: string[];
}

interface ApiBalance {
  id: string;
  api_name: string;
  initial_balance: number;
  current_balance: number;
  low_balance_threshold: number;
  last_updated: string;
}

// ─── API Definitions ─────────────────────────────────────────
const API_KEYS: ApiKeyConfig[] = [
  {
    key: "openai",
    label: "OpenAI",
    description: "GPT-5, AI Caption, Translator, Agentic AI",
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

// Additional keys that don't have toggle/auto-switch (Stripe, ACRCloud secret)
const EXTRA_KEYS = [
  { settingKey: "stripe_publishable_key", label: "Stripe Publishable Key" },
  { settingKey: "stripe_secret_key", label: "Stripe Secret Key" },
  { settingKey: "acrcloud_access_secret", label: "ACRCloud Access Secret" },
  { settingKey: "rapidapi_host", label: "RapidAPI Host (X-RapidAPI-Host)" },
  { settingKey: "rapidapi_base_url", label: "RapidAPI Base URL (Downloader)" },
];

// ─── Component ───────────────────────────────────────────────
export const ApiManagementTab = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Toggle states (on/off for auto-switch)
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({});
  // Whether key is configured in DB
  const [keyConfigured, setKeyConfigured] = useState<Record<string, boolean>>({});
  // Key input values (masked or raw)
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  // Show/hide password for each key
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  // Saving states per key
  const [savingKeyId, setSavingKeyId] = useState<string | null>(null);
  // Raw (unmasked) values fetched from DB
  const [rawValues, setRawValues] = useState<Record<string, string>>({});

  // Daily free uses
  const [dailyFreeUses, setDailyFreeUses] = useState(3);
  const [isSavingFree, setIsSavingFree] = useState(false);

  // API Balance tracking
  const [balances, setBalances] = useState<ApiBalance[]>([]);
  const [savingBalanceId, setSavingBalanceId] = useState<string | null>(null);

  // Collapsible sections
  const [expandedSection, setExpandedSection] = useState<string>("switch");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setIsLoading(true);
    await Promise.all([loadConfig(), loadBalances()]);
    setIsLoading(false);
  };

  const loadConfig = async () => {
    try {
      const allKeys = [
        ...API_KEYS.map(a => a.toggleKey),
        ...API_KEYS.map(a => a.settingKey),
        ...EXTRA_KEYS.map(e => e.settingKey),
        "daily_free_uses",
      ];

      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", allKeys);

      if (!data) return;

      const toggles: Record<string, boolean> = {};
      const configured: Record<string, boolean> = {};
      const inputs: Record<string, string> = {};

      // Default all toggles to ON
      API_KEYS.forEach(api => {
        toggles[api.key] = true;
        configured[api.key] = false;
        inputs[api.settingKey] = "";
      });
      EXTRA_KEYS.forEach(e => {
        configured[e.settingKey] = false;
        inputs[e.settingKey] = "";
      });

      const maskKey = (val: string) =>
        val && val.length > 8 ? "••••••••" + val.slice(-4) : val ? "••••••••" : "";

      data.forEach(setting => {
        // Toggle states
        const toggleApi = API_KEYS.find(a => a.toggleKey === setting.key);
        if (toggleApi) toggles[toggleApi.key] = setting.value !== "false";

        // Key configured status + masked display
        const configApi = API_KEYS.find(a => a.settingKey === setting.key);
        if (configApi && setting.value) {
          configured[configApi.key] = true;
          inputs[configApi.settingKey] = maskKey(setting.value);
        }

        const extraKey = EXTRA_KEYS.find(e => e.settingKey === setting.key);
        if (extraKey && setting.value) {
          configured[extraKey.settingKey] = true;
          inputs[extraKey.settingKey] = maskKey(setting.value);
        }

        if (setting.key === "daily_free_uses") {
          setDailyFreeUses(parseInt(setting.value || "3", 10));
        }
      });

      setToggleStates(toggles);
      setKeyConfigured(configured);
      setKeyInputs(inputs);
    } catch (error) {
      console.error("Error loading API config:", error);
    }
  };

  const loadBalances = async () => {
    try {
      const { data } = await supabase
        .from("api_balance_tracking")
        .select("*")
        .order("api_name");
      setBalances(data || []);
    } catch (error) {
      console.error("Error fetching API balances:", error);
    }
  };

  // ─── Handlers ──────────────────────────────────────────────
  const handleToggle = async (apiKey: string, enabled: boolean) => {
    const api = API_KEYS.find(a => a.key === apiKey);
    if (!api) return;
    setToggleStates(prev => ({ ...prev, [apiKey]: enabled }));
    try {
      await supabase.from("app_settings")
        .upsert({ key: api.toggleKey, value: enabled.toString() }, { onConflict: "key" });
      toast({
        title: enabled ? `${api.label} ဖွင့်လိုက်ပါပြီ` : `${api.label} ပိတ်လိုက်ပါပြီ`,
      });
    } catch {
      setToggleStates(prev => ({ ...prev, [apiKey]: !enabled }));
    }
  };

  const saveIndividualKey = async (settingKey: string, label: string) => {
    const val = keyInputs[settingKey];
    if (!val || val.startsWith("••••")) {
      toast({ title: "Key ထည့်ပါ", description: `${label} key အသစ်ထည့်ပြီးမှ save လုပ်ပါ`, variant: "destructive" });
      return;
    }
    setSavingKeyId(settingKey);
    try {
      await supabase.from("app_settings")
        .upsert({ key: settingKey, value: val }, { onConflict: "key" });
      toast({ title: `${label} Key သိမ်းဆည်းပြီးပါပြီ` });
      // Update configured status
      const apiDef = API_KEYS.find(a => a.settingKey === settingKey);
      if (apiDef) setKeyConfigured(prev => ({ ...prev, [apiDef.key]: true }));
      else setKeyConfigured(prev => ({ ...prev, [settingKey]: true }));
      // Re-mask
      const maskKey = (v: string) => v && v.length > 8 ? "••••••••" + v.slice(-4) : v ? "••••••••" : "";
      setKeyInputs(prev => ({ ...prev, [settingKey]: maskKey(val) }));
      setRawValues(prev => ({ ...prev, [settingKey]: val }));
      setShowKey(prev => ({ ...prev, [settingKey]: false }));
    } catch (error) {
      console.error(`Error saving ${label} key:`, error);
      toast({ title: "အမှား", description: `${label} Key သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်`, variant: "destructive" });
    } finally {
      setSavingKeyId(null);
    }
  };

  const handleToggleShowKey = async (settingKey: string) => {
    const currentlyShowing = showKey[settingKey] || false;
    if (currentlyShowing) {
      // Hide: re-mask
      const raw = rawValues[settingKey];
      if (raw) {
        const maskKey = (v: string) => v && v.length > 8 ? "••••••••" + v.slice(-4) : v ? "••••••••" : "";
        setKeyInputs(prev => ({ ...prev, [settingKey]: maskKey(raw) }));
      }
      setShowKey(prev => ({ ...prev, [settingKey]: false }));
    } else {
      // Show: fetch real value from DB
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", settingKey)
          .maybeSingle();
        if (data?.value) {
          setRawValues(prev => ({ ...prev, [settingKey]: data.value! }));
          setKeyInputs(prev => ({ ...prev, [settingKey]: data.value! }));
        }
      } catch (e) {
        console.error("Error fetching key:", e);
      }
      setShowKey(prev => ({ ...prev, [settingKey]: true }));
    }
  };

  const saveDailyFreeUses = async () => {
    setIsSavingFree(true);
    try {
      await supabase.from("app_settings")
        .upsert({ key: "daily_free_uses", value: dailyFreeUses.toString() }, { onConflict: "key" });
      toast({ title: "သိမ်းဆည်းပြီးပါပြီ", description: `တစ်ရက် ${dailyFreeUses} ကြိမ် အခမဲ့` });
    } catch {
      toast({ title: "အမှား", variant: "destructive" });
    } finally {
      setIsSavingFree(false);
    }
  };

  const updateBalance = (id: string, field: string, value: number) => {
    setBalances(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const saveBalance = async (balance: ApiBalance) => {
    setSavingBalanceId(balance.id);
    try {
      await supabase.from("api_balance_tracking").update({
        initial_balance: balance.initial_balance,
        current_balance: balance.current_balance,
        low_balance_threshold: balance.low_balance_threshold,
        last_updated: new Date().toISOString(),
      }).eq("id", balance.id);
      toast({ title: `${balance.api_name} balance updated` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingBalanceId(null);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? "" : section);
  };

  // ─── Render ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeCount = Object.values(toggleStates).filter(Boolean).length;
  const lowBalanceApis = balances.filter(b => b.current_balance > 0 && b.current_balance <= b.low_balance_threshold);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">API Management</h3>
          <p className="text-xs text-muted-foreground">
            Keys, Auto-Switch, Balance ({activeCount}/{API_KEYS.length} Active)
          </p>
        </div>
      </div>

      {/* Low Balance Alert */}
      {lowBalanceApis.length > 0 && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-xs font-semibold text-destructive">Low Balance Alert!</span>
          </div>
          {lowBalanceApis.map(api => (
            <p key={api.id} className="text-[10px] text-destructive/80 ml-6">
              {api.api_name}: ${api.current_balance.toFixed(2)} (alert: ${api.low_balance_threshold.toFixed(2)})
            </p>
          ))}
        </div>
      )}

      {/* Failover Info */}
      <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
          <span>
            API OFF ဖြစ်ပါက tasks များကို backup API သို့ auto-route လုပ်ပါမည်။
            ပြန်ဖွင့်လိုက်သည်နှင့် priority ပေးပါမည်။
          </span>
        </p>
      </div>

      {/* ═══ SECTION 1: Auto-Switch & Status ═══ */}
      <SectionHeader
        title="Auto-Switch & Status"
        icon={<Power className="w-4 h-4" />}
        expanded={expandedSection === "switch"}
        onToggle={() => toggleSection("switch")}
      />
      {expandedSection === "switch" && (
        <div className="space-y-2">
          {API_KEYS.map(api => {
            const isOn = toggleStates[api.key] ?? true;
            const hasKey = keyConfigured[api.key];
            return (
              <div
                key={api.key}
                className={`rounded-xl p-3 border transition-all ${
                  isOn && hasKey ? "border-green-500/30 bg-green-500/5"
                    : isOn && !hasKey ? "border-amber-500/30 bg-amber-500/5"
                    : "border-destructive/30 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Power className={`w-3.5 h-3.5 shrink-0 ${
                      isOn && hasKey ? "text-green-500" : isOn && !hasKey ? "text-amber-500" : "text-destructive"
                    }`} />
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm text-foreground">{api.label}</h4>
                      <p className="text-[10px] text-muted-foreground truncate">{api.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      isOn && hasKey ? "bg-green-500/20 text-green-500"
                        : isOn && !hasKey ? "bg-amber-500/20 text-amber-500"
                        : "bg-destructive/20 text-destructive"
                    }`}>
                      {isOn && hasKey ? "ACTIVE" : isOn && !hasKey ? "NO KEY" : "OFF"}
                    </span>
                    <Switch checked={isOn} onCheckedChange={val => handleToggle(api.key, val)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5 ml-5">
                  {api.tasks.map(task => (
                    <span key={task} className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
                      {task}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ SECTION 2: API Key Inputs ═══ */}
      <SectionHeader
        title="API Keys ထည့်/ပြင်ရန်"
        icon={<Key className="w-4 h-4" />}
        expanded={expandedSection === "keys"}
        onToggle={() => toggleSection("keys")}
      />
      {expandedSection === "keys" && (
        <div className="space-y-3">
          {/* Main API Keys */}
          {API_KEYS.map(api => (
            <KeyInput
              key={api.settingKey}
              label={api.label}
              settingKey={api.settingKey}
              value={keyInputs[api.settingKey] || ""}
              onChange={val => setKeyInputs(prev => ({ ...prev, [api.settingKey]: val }))}
              show={showKey[api.settingKey] || false}
              onToggleShow={() => handleToggleShowKey(api.settingKey)}
              configured={keyConfigured[api.key] || false}
              onSave={() => saveIndividualKey(api.settingKey, api.label)}
              isSaving={savingKeyId === api.settingKey}
            />
          ))}

          {/* Extra Keys (Stripe, ACRCloud secret) */}
          {EXTRA_KEYS.map(extra => (
            <KeyInput
              key={extra.settingKey}
              label={extra.label}
              settingKey={extra.settingKey}
              value={keyInputs[extra.settingKey] || ""}
              onChange={val => setKeyInputs(prev => ({ ...prev, [extra.settingKey]: val }))}
              show={showKey[extra.settingKey] || false}
              onToggleShow={() => handleToggleShowKey(extra.settingKey)}
              configured={keyConfigured[extra.settingKey] || false}
              onSave={() => saveIndividualKey(extra.settingKey, extra.label)}
              isSaving={savingKeyId === extra.settingKey}
            />
          ))}
        </div>
      )}

      {/* ═══ SECTION 3: Balance Tracking ═══ */}
      <SectionHeader
        title="API Balance & ငွေလက်ကျန်"
        icon={<DollarSign className="w-4 h-4" />}
        expanded={expandedSection === "balance"}
        onToggle={() => toggleSection("balance")}
      />
      {expandedSection === "balance" && (
        <div className="space-y-3">
          {balances.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              API Balance data မရှိသေးပါ
            </p>
          ) : (
            balances.map(balance => {
              const isLow = balance.current_balance > 0 && balance.current_balance <= balance.low_balance_threshold;
              const usagePercent = balance.initial_balance > 0
                ? ((balance.initial_balance - balance.current_balance) / balance.initial_balance * 100)
                : 0;
              return (
                <div key={balance.id} className={`rounded-xl p-3 border ${isLow ? "border-destructive/50 bg-destructive/5" : "border-border/30"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isLow && <AlertTriangle className="w-3 h-3 text-destructive" />}
                      <h4 className="font-medium text-sm text-foreground">{balance.api_name}</h4>
                    </div>
                    <span className={`text-lg font-bold ${isLow ? "text-destructive" : "text-primary"}`}>
                      ${balance.current_balance.toFixed(2)}
                    </span>
                  </div>
                  {balance.initial_balance > 0 && (
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Used: {usagePercent.toFixed(1)}%</span>
                        <span>Initial: ${balance.initial_balance.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isLow ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground block">Initial ($)</label>
                      <Input type="number" step="0.01" value={balance.initial_balance}
                        onChange={e => updateBalance(balance.id, "initial_balance", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground block">Current ($)</label>
                      <Input type="number" step="0.01" value={balance.current_balance}
                        onChange={e => updateBalance(balance.id, "current_balance", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground block">Alert ($)</label>
                      <Input type="number" step="0.01" value={balance.low_balance_threshold}
                        onChange={e => updateBalance(balance.id, "low_balance_threshold", parseFloat(e.target.value) || 5)}
                        className="h-7 text-xs" />
                    </div>
                  </div>
                  <Button onClick={() => saveBalance(balance)} disabled={savingBalanceId === balance.id}
                    size="sm" className="w-full mt-2 gradient-gold text-primary-foreground">
                    {savingBalanceId === balance.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3 mr-1" /> Save</>}
                  </Button>
                  <p className="text-[9px] text-muted-foreground/60 mt-1">
                    Updated: {new Date(balance.last_updated).toLocaleString()}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ SECTION 4: Daily Free Uses ═══ */}
      <div className="rounded-xl p-4 border border-green-500/20 bg-green-500/5">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-4 h-4 text-green-500" />
          <h4 className="font-semibold text-sm text-foreground">Daily Free Uses</h4>
        </div>
        <div className="flex items-center gap-3">
          <Input type="number" value={dailyFreeUses}
            onChange={e => setDailyFreeUses(parseInt(e.target.value) || 0)}
            min={0} max={50} className="max-w-[100px]" />
          <span className="text-xs text-muted-foreground">ကြိမ် / ရက်</span>
          <Button onClick={saveDailyFreeUses} disabled={isSavingFree} size="sm"
            className="gradient-gold text-primary-foreground ml-auto">
            {isSavingFree ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-Components ──────────────────────────────────────────

const SectionHeader = ({
  title, icon, expanded, onToggle,
}: {
  title: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
  >
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-sm font-semibold text-foreground">{title}</span>
    </div>
    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
  </button>
);

const KeyInput = ({
  label, settingKey, value, onChange, show, onToggleShow, configured, onSave, isSaving,
}: {
  label: string; settingKey: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void; configured: boolean;
  onSave: () => void; isSaving: boolean;
}) => (
  <div className="rounded-xl p-3 border border-border/30">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
        configured ? "bg-green-500/20 text-green-500" : "bg-amber-500/20 text-amber-500"
      }`}>
        {configured ? "✓ Set" : "Not Set"}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`${label} API Key...`}
          className="pr-9 h-8 text-xs"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      <Button onClick={onSave} disabled={isSaving} size="sm" className="h-8 px-3 gradient-gold text-primary-foreground shrink-0">
        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
      </Button>
    </div>
  </div>
);
