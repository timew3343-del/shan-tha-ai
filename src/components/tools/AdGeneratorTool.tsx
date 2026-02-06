import { useState, useRef, useEffect } from "react";
import { Upload, Sparkles, Download, Loader2, X, Megaphone, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdGeneratorToolProps {
  userId?: string;
  onBack: () => void;
}

interface AdResult {
  adScript: {
    headline_my?: string;
    headline_en?: string;
    body_my?: string;
    body_en?: string;
    cta_my?: string;
    cta_en?: string;
    hashtags?: string[];
  };
  enhancedImage: string;
  creditsUsed: number;
}

export const AdGeneratorTool = ({ userId, onBack }: AdGeneratorToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productDescription, setProductDescription] = useState("");
  const [adStyle, setAdStyle] = useState("modern");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<AdResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const creditCost = costs.ad_generator || 9;

  // Progress animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      const statuses = [
        "ကြော်ငြာ Script ရေးနေသည်...",
        "ပုံကို Enhancement လုပ်နေသည်...",
        "အပြီးသတ်နေသည်...",
      ];
      let statusIndex = 0;
      setStatusText(statuses[0]);

      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + Math.random() * 4;
          if (newProgress >= 95) return 95;
          const newStatusIndex = Math.min(Math.floor(newProgress / 33), statuses.length - 1);
          if (newStatusIndex !== statusIndex) {
            statusIndex = newStatusIndex;
            setStatusText(statuses[statusIndex]);
          }
          return newProgress;
        });
      }, 1500);
    } else {
      setProgress(100);
      setStatusText("");
      const timeout = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timeout);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "ဖိုင်ကြီးလွန်းပါသည်",
        description: "10MB အထိသာ upload လုပ်နိုင်ပါသည်",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setProductImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setProductImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerate = async () => {
    if (!productImage || !productDescription.trim() || !userId) return;

    if (credits < creditCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `${creditCost} Credits လိုအပ်ပါသည် (လက်ရှိ: ${credits})`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ad`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            productImageBase64: productImage,
            productDescription: productDescription.trim(),
            adStyle,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ad generation failed");
      }

      setResult({
        adScript: data.adScript,
        enhancedImage: data.enhancedImage,
        creditsUsed: data.creditsUsed,
      });
      refetchCredits();

      toast({
        title: "အောင်မြင်ပါသည်! ✨",
        description: `ကြော်ငြာ ဖန်တီးပြီးပါပြီ (${data.creditsUsed} Credits)`,
      });
    } catch (error: any) {
      console.error("Ad generation error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "ကြော်ငြာဖန်တီးရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (!result?.enhancedImage) return;
    const link = document.createElement("a");
    link.href = result.enhancedImage;
    link.download = `ad-${adStyle}-${Date.now()}.png`;
    link.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-4 pb-24"
    >
      <ToolHeader
        title="AI Ad Generator"
        subtitle="ကုန်ပစ္စည်း ကြော်ငြာ ဖန်တီးခြင်း"
        onBack={onBack}
      />

      {/* Product Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
          ကုန်ပစ္စည်း ပုံထည့်ရန်
        </label>

        {productImage ? (
          <div className="relative inline-block">
            <img
              src={productImage}
              alt="Product"
              className="w-full max-w-[200px] h-auto object-cover rounded-xl border border-primary/30"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
          >
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ပုံထည့်ရန် နှိပ်ပါ</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Product Description */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          ကုန်ပစ္စည်းအကြောင်း ဖော်ပြချက်
        </label>
        <Textarea
          placeholder="ဥပမာ - ကိုရီးယား Skincare Cream, အသားအရေ ဖြူဝင်း စေသည်..."
          value={productDescription}
          onChange={(e) => setProductDescription(e.target.value)}
          className="min-h-[80px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
        />
      </div>

      {/* Ad Style */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          <Megaphone className="w-4 h-4 inline mr-1" />
          ကြော်ငြာ Style
        </label>
        <Select value={adStyle} onValueChange={setAdStyle}>
          <SelectTrigger className="bg-background/50 border-primary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="modern">🎨 Modern & Clean</SelectItem>
            <SelectItem value="bold">💥 Bold & Vibrant</SelectItem>
            <SelectItem value="minimal">✨ Minimal & Elegant</SelectItem>
            <SelectItem value="elegant">👑 Premium & Luxury</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Progress */}
      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">{statusText}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isLoading || !productImage || !productDescription.trim()}
        className="w-full btn-gradient-red py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ကြော်ငြာဖန်တီးနေသည်...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            ကြော်ငြာဖန်တီးမည် ({creditCost} Credits)
          </>
        )}
      </Button>

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          {/* Enhanced Image */}
          <div className="gradient-card rounded-2xl p-4 border border-success/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-success" />
                <h3 className="text-sm font-semibold text-success font-myanmar">ကြော်ငြာ ပုံ</h3>
              </div>
              <Button onClick={downloadImage} size="sm" variant="outline" className="text-xs">
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            </div>
            <img
              src={result.enhancedImage}
              alt="Ad"
              className="w-full rounded-xl border border-border"
            />
          </div>

          {/* Ad Copy */}
          <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
            <h3 className="text-sm font-semibold text-primary font-myanmar">📝 ကြော်ငြာ Script</h3>

            {result.adScript.headline_my && (
              <div className="p-3 bg-secondary/30 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Headline (Myanmar)</span>
                  <button
                    onClick={() => copyToClipboard(result.adScript.headline_my!, "headline_my")}
                    className="text-xs text-primary"
                  >
                    {copiedField === "headline_my" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <p className="text-sm font-medium text-foreground font-myanmar">{result.adScript.headline_my}</p>
              </div>
            )}

            {result.adScript.headline_en && (
              <div className="p-3 bg-secondary/30 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Headline (English)</span>
                  <button
                    onClick={() => copyToClipboard(result.adScript.headline_en!, "headline_en")}
                    className="text-xs text-primary"
                  >
                    {copiedField === "headline_en" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <p className="text-sm font-medium text-foreground">{result.adScript.headline_en}</p>
              </div>
            )}

            {result.adScript.body_my && (
              <div className="p-3 bg-secondary/30 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Body (Myanmar)</span>
                  <button
                    onClick={() => copyToClipboard(result.adScript.body_my!, "body_my")}
                    className="text-xs text-primary"
                  >
                    {copiedField === "body_my" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <p className="text-sm text-foreground font-myanmar">{result.adScript.body_my}</p>
              </div>
            )}

            {result.adScript.cta_my && (
              <div className="p-3 bg-primary/10 rounded-xl text-center">
                <span className="text-xs text-muted-foreground block mb-1">CTA</span>
                <p className="text-sm font-bold text-primary font-myanmar">{result.adScript.cta_my}</p>
              </div>
            )}

            {result.adScript.hashtags && result.adScript.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.adScript.hashtags.map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground">
            {result.creditsUsed} Credits သုံးပြီး
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
