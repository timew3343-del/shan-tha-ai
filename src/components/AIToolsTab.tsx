import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image, Video, Volume2, Loader2, Sparkles, Crown, Settings, Wallet } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export const AIToolsTab = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; content: string } | null>(null);

  const handleAction = async (action: string) => {
    if (!inputText.trim()) return;
    
    // Check for API keys
    const geminiKey = localStorage.getItem("gemini_api_key");
    const stabilityKey = localStorage.getItem("stability_api_key");
    
    if (action === "image" && !stabilityKey) {
      toast({
        title: "API Key မရှိပါ",
        description: "ပုံထုတ်ရန် Stability AI API Key ထည့်သွင်းပါ",
        variant: "destructive",
      });
      navigate("/api-settings");
      return;
    }
    
    if (action === "speech" && !geminiKey) {
      toast({
        title: "API Key မရှိပါ",
        description: "အသံပြောင်းရန် Google Gemini API Key ထည့်သွင်းပါ",
        variant: "destructive",
      });
      navigate("/api-settings");
      return;
    }
    
    setIsLoading(true);
    setActiveAction(action);
    setResult(null);
    
    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    setResult({
      type: action,
      content: `${action === "image" ? "🖼️ ပုံထုတ်ပြီးပါပြီ" : action === "video" ? "🎬 ဗီဒီယိုထုတ်ပြီးပါပြီ" : "🔊 အသံပြောင်းပြီးပါပြီ"}: "${inputText.substring(0, 50)}${inputText.length > 50 ? "..." : ""}"`,
    });
    
    setIsLoading(false);
    setActiveAction(null);
  };

  const actionButtons = [
    {
      id: "image",
      label: "ပုံထုတ်မည်",
      icon: Image,
      gradient: "btn-gradient-blue",
    },
    {
      id: "video",
      label: "ဗီဒီယိုလုပ်မည်",
      icon: Video,
      gradient: "btn-gradient-red",
    },
    {
      id: "speech",
      label: "အသံပြောင်းမည်",
      icon: Volume2,
      gradient: "btn-gradient-green",
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <Crown className="w-5 h-5 text-primary animate-pulse-soft" />
          <h1 className="text-xl font-bold text-glow-gold text-primary">Myanmar AI</h1>
          <Crown className="w-5 h-5 text-primary animate-pulse-soft" />
        </div>
        <p className="text-muted-foreground text-sm">
          သင့်စိတ်ကူးကို AI ဖြင့် အကောင်အထည်ဖော်ပါ
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 animate-fade-up">
        <button
          onClick={() => navigate("/api-settings")}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-secondary/50 border border-border hover:bg-secondary transition-colors"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">API ဆက်တင်</span>
        </button>
        <button
          onClick={() => navigate("/top-up")}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors"
        >
          <Wallet className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-medium">ငွေဖြည့်မည်</span>
        </button>
      </div>

      {/* Text Input */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 shadow-gold animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <label className="block text-sm font-medium text-primary mb-2">
          စာသားထည့်ပါ
        </label>
        <Textarea
          placeholder="ဥပမာ - နေဝင်ချိန် ပင်လယ်ကမ်းခြေ ပုံဆွဲပေးပါ..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="min-h-[100px] bg-background/50 border-primary/30 rounded-xl resize-none text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
        />
        <div className="text-right mt-2">
          <span className="text-xs text-muted-foreground">
            {inputText.length} စာလုံး
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 gap-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        {actionButtons.map((btn) => {
          const Icon = btn.icon;
          const isActive = activeAction === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => handleAction(btn.id)}
              disabled={isLoading || !inputText.trim()}
              className={`${btn.gradient} flex items-center justify-center gap-2 py-4 px-5 rounded-2xl font-semibold text-base transition-all duration-300 hover:scale-[1.02] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-foreground shadow-lg`}
            >
              {isActive ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* Result Display */}
      {result && (
        <div className="gradient-card rounded-2xl p-4 border border-primary/30 shadow-gold animate-scale-in">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-base font-semibold text-primary">ရလဒ်</h3>
          </div>
          <div className="bg-background/50 rounded-xl p-3 border border-border">
            <p className="text-foreground text-sm">{result.content}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            AI မှ ထုတ်လုပ်ထားသော ရလဒ်ဖြစ်ပါသည်
          </p>
        </div>
      )}

      {/* Info Card */}
      <div className="gradient-card rounded-2xl p-3 border border-primary/20 animate-fade-up" style={{ animationDelay: "0.15s" }}>
        <h3 className="text-sm font-semibold text-primary mb-1">💡 အကြံပြုချက်</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          အကောင်းဆုံး ရလဒ်ရရှိရန် အသေးစိတ် ဖော်ပြချက်များ ထည့်သွင်းပါ။ ဥပမာ - အရောင်၊ ပုံစံ၊ ခံစားချက် စသည်တို့ ပါဝင်စေပါ။
        </p>
      </div>
    </div>
  );
};
