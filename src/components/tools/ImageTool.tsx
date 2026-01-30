import { useState, useRef, useEffect } from "react";
import { Image, Plus, Sparkles, Download, Loader2, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";

interface ImageToolProps {
  userId?: string;
}

export const ImageTool = ({ userId }: ImageToolProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { refetch: refetchCredits } = useCredits(userId);
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulate progress during loading
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);
    } else {
      setProgress(100);
      const timeout = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timeout);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferenceImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "စာသားထည့်ပါ",
        description: "ပုံဆွဲရန် prompt စာသားထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "လော့ဂ်အင်လုပ်ပါ",
        description: "ပုံထုတ်ရန် အကောင့်ဝင်ပါ",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast({
          title: "လော့ဂ်အင်လုပ်ပါ",
          description: "ပုံထုတ်ရန် အကောင့်ဝင်ပါ",
          variant: "destructive",
        });
        return;
      }

      // Call the secure Edge Function
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { 
          prompt, 
          referenceImage 
        },
      });

      if (error) {
        throw new Error(error.message || "ပုံထုတ်ရာတွင် အမှားရှိပါသည်");
      }

      if (data?.error) {
        // Handle specific error cases
        if (data.error === "Insufficient credits") {
          toast({
            title: "ခရက်ဒစ် မလုံလောက်ပါ",
            description: `ပုံထုတ်ရန် ${data.required} Credits လိုအပ်ပါသည်။ ထပ်မံဖြည့်သွင်းပါ။`,
            variant: "destructive",
          });
        } else if (data.error === "Image generation service not configured") {
          toast({
            title: "ဝန်ဆောင်မှု မပြင်ဆင်ရသေးပါ",
            description: "Admin မှ API Key ထည့်သွင်းရန် လိုအပ်ပါသည်",
            variant: "destructive",
          });
        } else {
          toast({
            title: "အမှားရှိပါသည်",
            description: data.error,
            variant: "destructive",
          });
        }
        return;
      }

      if (data?.success && data?.image) {
        setGeneratedImage(data.image);
        refetchCredits();
        toast({
          title: "အောင်မြင်ပါသည်",
          description: `ပုံထုတ်ပြီးပါပြီ (${data.creditsUsed} Credits)`,
        });
      }
    } catch (error: any) {
      console.error("Image generation error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "ပုံထုတ်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `generated-image-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Reference Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3">
          ရည်ညွှန်းပုံ (Optional)
        </label>
        
        {referenceImage ? (
          <div className="relative inline-block">
            <img
              src={referenceImage}
              alt="Reference"
              className="w-24 h-24 object-cover rounded-xl border border-primary/30"
            />
            <button
              onClick={removeReferenceImage}
              className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-6 h-6 text-primary" />
            <span className="text-xs text-muted-foreground">ပုံထည့်ရန်</span>
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

      {/* Prompt Input */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2">
          ပုံဖော်ပြချက်
        </label>
        <Textarea
          placeholder="ဥပမာ - နေဝင်ချိန် ပင်လယ်ကမ်းခြေ ပုံဆွဲပေးပါ..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[80px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
        />
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>ပုံထုတ်နေသည်...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isLoading || !prompt.trim()}
        className="w-full btn-gradient-blue py-4 rounded-2xl font-semibold"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ပုံထုတ်နေသည်...
          </>
        ) : (
          <>
            <Image className="w-5 h-5 mr-2" />
            ပုံထုတ်မည် ({costs.image_generation} Credits)
          </>
        )}
      </Button>

      {/* Result Preview */}
      {generatedImage && (
        <div className="gradient-card rounded-2xl p-4 border border-primary/30 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary">ရလဒ်</h3>
            </div>
            <Button
              onClick={handleDownload}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
          <img
            src={generatedImage}
            alt="Generated"
            className="w-full rounded-xl border border-border"
          />
        </div>
      )}
    </div>
  );
};
