import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Key, Eye, EyeOff, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export const ApiSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [geminiKey, setGeminiKey] = useState("");
  const [stabilityKey, setStabilityKey] = useState("");
  const [showGemini, setShowGemini] = useState(false);
  const [showStability, setShowStability] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load saved keys from localStorage
    const savedGemini = localStorage.getItem("gemini_api_key") || "";
    const savedStability = localStorage.getItem("stability_api_key") || "";
    setGeminiKey(savedGemini);
    setStabilityKey(savedStability);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    
    // Save to localStorage
    localStorage.setItem("gemini_api_key", geminiKey);
    localStorage.setItem("stability_api_key", stabilityKey);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setIsSaving(false);
    toast({
      title: "သိမ်းဆည်းပြီးပါပြီ",
      description: "API Keys များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ",
    });
  };

  return (
    <div className="min-h-screen gradient-navy">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">API ဆက်တင်များ</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Info Card */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 animate-fade-up">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-primary">API Keys အကြောင်း</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ပုံထုတ်ခြင်းနှင့် အသံပြောင်းခြင်း လုပ်ဆောင်ချက်များအတွက် 
            Google Gemini နှင့် Stability AI API Keys များ လိုအပ်ပါသည်။
          </p>
        </div>

        {/* Google Gemini API Key */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <label className="font-medium text-foreground">Google Gemini API Key</label>
          </div>
          <p className="text-xs text-muted-foreground">
            အသံပြောင်းခြင်းအတွက် အသုံးပြုပါသည်
          </p>
          <div className="relative">
            <Input
              type={showGemini ? "text" : "password"}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="pr-10 bg-background/50 border-primary/30 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowGemini(!showGemini)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Stability AI API Key */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <label className="font-medium text-foreground">Stability AI API Key</label>
          </div>
          <p className="text-xs text-muted-foreground">
            ပုံထုတ်ခြင်းအတွက် အသုံးပြုပါသည်
          </p>
          <div className="relative">
            <Input
              type={showStability ? "text" : "password"}
              value={stabilityKey}
              onChange={(e) => setStabilityKey(e.target.value)}
              placeholder="sk-..."
              className="pr-10 bg-background/50 border-primary/30 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowStability(!showStability)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showStability ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full gradient-gold text-primary-foreground font-semibold py-6 rounded-2xl text-base animate-fade-up"
          style={{ animationDelay: "0.3s" }}
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              သိမ်းဆည်းမည်
            </>
          )}
        </Button>

        {/* Help Links */}
        <div className="text-center space-y-2 text-xs text-muted-foreground animate-fade-up" style={{ animationDelay: "0.4s" }}>
          <p>API Keys ရယူရန်:</p>
          <div className="flex flex-col gap-1">
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Google AI Studio →
            </a>
            <a 
              href="https://platform.stability.ai/account/keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Stability AI Platform →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiSettings;
