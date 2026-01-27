import { useState } from "react";
import { Image, Video, Volume2, Loader2, Sparkles, Crown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export const AIToolsTab = () => {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; content: string } | null>(null);

  const handleAction = async (action: string) => {
    if (!inputText.trim()) return;
    
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
    <div className="flex flex-col gap-6 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <Crown className="w-6 h-6 text-primary animate-pulse-soft" />
          <h1 className="text-2xl font-bold text-glow-gold text-primary">Myanmar AI</h1>
          <Crown className="w-6 h-6 text-primary animate-pulse-soft" />
        </div>
        <p className="text-muted-foreground text-sm">
          သင့်စိတ်ကူးကို AI ဖြင့် အကောင်အထည်ဖော်ပါ
        </p>
      </div>

      {/* Text Input */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 shadow-gold animate-fade-up">
        <label className="block text-sm font-medium text-primary mb-2">
          စာသားထည့်ပါ
        </label>
        <Textarea
          placeholder="ဥပမာ - နေဝင်ချိန် ပင်လယ်ကမ်းခြေ ပုံဆွဲပေးပါ..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="min-h-[120px] bg-background/50 border-primary/30 rounded-xl resize-none text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
        <div className="text-right mt-2">
          <span className="text-xs text-muted-foreground">
            {inputText.length} စာလုံး
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 gap-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        {actionButtons.map((btn) => {
          const Icon = btn.icon;
          const isActive = activeAction === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => handleAction(btn.id)}
              disabled={isLoading || !inputText.trim()}
              className={`${btn.gradient} flex items-center justify-center gap-3 py-5 px-6 rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-foreground shadow-lg`}
            >
              {isActive ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Icon className="w-6 h-6" />
              )}
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* Result Display */}
      {result && (
        <div className="gradient-card rounded-2xl p-6 border border-primary/30 shadow-gold animate-scale-in">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-primary">ရလဒ်</h3>
          </div>
          <div className="bg-background/50 rounded-xl p-4 border border-border">
            <p className="text-foreground">{result.content}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            AI မှ ထုတ်လုပ်ထားသော ရလဒ်ဖြစ်ပါသည်
          </p>
        </div>
      )}

      {/* Info Card */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <h3 className="text-sm font-semibold text-primary mb-2">💡 အကြံပြုချက်</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          အကောင်းဆုံး ရလဒ်ရရှိရန် အသေးစိတ် ဖော်ပြချက်များ ထည့်သွင်းပါ။ ဥပမာ - အရောင်၊ ပုံစံ၊ ခံစားချက် စသည်တို့ ပါဝင်စေပါ။
        </p>
      </div>
    </div>
  );
};
