import { useState, useRef } from "react";
import { Video, Upload, Sparkles, Download, Loader2, X, Play } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";

interface VideoToolProps {
  userId?: string;
}

export const VideoTool = ({ userId }: VideoToolProps) => {
  const { toast } = useToast();
  const { credits, deductCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [prompt, setPrompt] = useState("");
  const [speechText, setSpeechText] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !uploadedImage) {
      toast({
        title: "အချက်အလက်ထည့်ပါ",
        description: "ဗီဒီယိုထုတ်ရန် ပုံ သို့မဟုတ် prompt ထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    // Determine credit cost based on whether speech text is included
    const creditCost = speechText.trim() ? costs.video_with_speech : costs.video_generation;
    
    // Check and deduct credits
    const success = await deductCredits(creditCost, "ဗီဒီယိုထုတ်ခြင်း");
    if (!success) return;

    setIsLoading(true);
    setGeneratedVideo(null);

    try {
      // Simulate video generation (replace with actual API)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      // For demo, use a placeholder video
      setGeneratedVideo("https://www.w3schools.com/html/mov_bbb.mp4");
      
      toast({
        title: "အောင်မြင်ပါသည်",
        description: "ဗီဒီယိုထုတ်ပြီးပါပြီ",
      });
    } catch (error: any) {
      console.error("Video generation error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "ဗီဒီယိုထုတ်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3">
          ပုံထည့်ရန်
        </label>
        
        {uploadedImage ? (
          <div className="relative inline-block">
            <img
              src={uploadedImage}
              alt="Uploaded"
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
            <span className="text-sm text-muted-foreground">ပုံထည့်ရန် နှိပ်ပါ</span>
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
          ဗီဒီယိုဖော်ပြချက်
        </label>
        <Textarea
          placeholder="ဥပမာ - လှေတစ်စင်း ပင်လယ်ပေါ်မှာ မျှောနေသည်..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[60px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm"
        />
      </div>

      {/* Speech Overlay Text */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2">
          စကားပြောစေချင်သော စာသား (Optional)
        </label>
        <Textarea
          placeholder="ဗီဒီယိုတွင် ထည့်သွင်းစေချင်သော အသံစာသား..."
          value={speechText}
          onChange={(e) => setSpeechText(e.target.value)}
          className="min-h-[60px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm"
        />
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isLoading || (!prompt.trim() && !uploadedImage)}
        className="w-full btn-gradient-red py-4 rounded-2xl font-semibold"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ဗီဒီယိုထုတ်နေသည်...
          </>
        ) : (
          <>
            <Video className="w-5 h-5 mr-2" />
            ဗီဒီယိုထုတ်မည် ({speechText.trim() ? costs.video_with_speech : costs.video_generation} Credits)
          </>
        )}
      </Button>

      {/* Result Preview */}
      {generatedVideo && (
        <div className="gradient-card rounded-2xl p-4 border border-primary/30 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary">ရလဒ်</h3>
            </div>
            <Button
              onClick={() => {
                const link = document.createElement("a");
                link.href = generatedVideo;
                link.download = `generated-video-${Date.now()}.mp4`;
                link.click();
              }}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
          <video
            src={generatedVideo}
            controls
            className="w-full rounded-xl border border-border"
          />
        </div>
      )}
    </div>
  );
};
