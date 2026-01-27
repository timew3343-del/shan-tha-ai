import { useState } from "react";
import { Image, Video, Volume2, Loader2, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export const AIToolsTab = () => {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ type: string; content: string } | null>(null);

  const handleAction = async (action: string) => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setResult(null);
    
    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    setResult({
      type: action,
      content: `${action === "image" ? "🖼️ ပုံထုတ်ပြီးပါပြီ" : action === "video" ? "🎬 ဗီဒီယိုထုတ်ပြီးပါပြီ" : "🔊 အသံပြောင်းပြီးပါပြီ"}: "${inputText.substring(0, 50)}${inputText.length > 50 ? "..." : ""}"`,
    });
    
    setIsLoading(false);
  };

  const actionButtons = [
    {
      id: "image",
      label: "ပုံထုတ်မည်",
      icon: Image,
      gradient: "btn-gradient-blue",
      shadow: "shadow-glow",
    },
    {
      id: "video",
      label: "ဗီဒီယိုလုပ်မည်",
      icon: Video,
      gradient: "btn-gradient-red",
      shadow: "shadow-glow-red",
    },
    {
      id: "speech",
      label: "အသံပြောင်းမည်",
      icon: Volume2,
      gradient: "btn-gradient-green",
      shadow: "shadow-glow-green",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-primary animate-pulse-soft" />
          <h1 className="text-2xl font-bold text-glow">Myanmar AI</h1>
          <Sparkles className="w-6 h-6 text-primary animate-pulse-soft" />
        </div>
        <p className="text-muted-foreground text-sm">
          သင့်စိတ်ကူးကို AI ဖြင့် အကောင်အထည်ဖော်ပါ
        </p>
      </div>

      {/* Text Input */}
      <div className="card-gradient rounded-2xl p-4 border border-border/50 animate-fade-up">
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          စာသားထည့်ပါ
        </label>
        <Textarea
          placeholder="ဥပမာ - နေဝင်ချိန် ပင်လယ်ကမ်းခြေ ပုံဆွဲပေးပါ..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="min-h-[120px] bg-background/50 border-border/50 rounded-xl resize-none text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/50"
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
          return (
            <button
              key={btn.id}
              onClick={() => handleAction(btn.id)}
              disabled={isLoading || !inputText.trim()}
              className={`${btn.gradient} ${btn.shadow} flex items-center justify-center gap-3 py-5 px-6 rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-foreground`}
            >
              {isLoading ? (
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
        <div className="card-gradient rounded-2xl p-6 border border-border/50 animate-scale-in">
          <h3 className="text-lg font-semibold mb-3 text-primary">ရလဒ်</h3>
          <div className="bg-background/50 rounded-xl p-4">
            <p className="text-foreground">{result.content}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            AI မှ ထုတ်လုပ်ထားသော ရလဒ်ဖြစ်ပါသည်
          </p>
        </div>
      )}

      {/* Info Card */}
      <div className="card-gradient rounded-2xl p-4 border border-border/50 animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <h3 className="text-sm font-semibold text-primary mb-2">💡 အကြံပြုချက်</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          အကောင်းဆုံး ရလဒ်ရရှိရန် အသေးစိတ် ဖော်ပြချက်များ ထည့်သွင်းပါ။ ဥပမာ - အရောင်၊ ပုံစံ၊ ခံစားချက် စသည်တို့ ပါဝင်စေပါ။
        </p>
      </div>
    </div>
  );
};
