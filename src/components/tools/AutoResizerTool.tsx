import { useState, useRef } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Smartphone, Monitor, Square, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";

interface AutoResizerToolProps {
  userId?: string;
  onBack: () => void;
}

type AspectRatio = "9:16" | "16:9" | "1:1";

const PRESETS: { ratio: AspectRatio; label: string; platform: string; icon: typeof Smartphone; width: number; height: number }[] = [
  { ratio: "9:16", label: "TikTok / Reels", platform: "TikTok", icon: Smartphone, width: 1080, height: 1920 },
  { ratio: "16:9", label: "YouTube", platform: "YouTube", icon: Monitor, width: 1920, height: 1080 },
  { ratio: "1:1", label: "Facebook / Instagram", platform: "Facebook", icon: Square, width: 1080, height: 1080 },
];

export const AutoResizerTool = ({ onBack }: AutoResizerToolProps) => {
  const { showGuide, saveOutput } = useToolOutput("auto_resizer", "Auto Resizer");
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<"image" | "video" | null>(null);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>("9:16");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResultUrl(null);

    if (file.type.startsWith("image/")) {
      setSourceType("image");
      const reader = new FileReader();
      reader.onload = (ev) => setSourceImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("video/")) {
      setSourceType("video");
      setSourceImage(URL.createObjectURL(file));
    } else {
      toast({ title: "ပုံ သို့မဟုတ် ဗီဒီယို ဖိုင်သာ ထည့်နိုင်ပါသည်", variant: "destructive" });
    }
  };

  const processImage = async () => {
    if (!sourceImage || sourceType !== "image") return;

    setIsProcessing(true);
    try {
      const preset = PRESETS.find(p => p.ratio === selectedRatio)!;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;

      canvas.width = preset.width;
      canvas.height = preset.height;

      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = sourceImage;
      });

      // Fill background with blur effect
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate fit dimensions (contain)
      const imgAspect = img.width / img.height;
      const canvasAspect = canvas.width / canvas.height;

      let drawW: number, drawH: number, drawX: number, drawY: number;

      if (imgAspect > canvasAspect) {
        // Image is wider - fit to width
        drawW = canvas.width;
        drawH = canvas.width / imgAspect;
        drawX = 0;
        drawY = (canvas.height - drawH) / 2;
      } else {
        // Image is taller - fit to height
        drawH = canvas.height;
        drawW = canvas.height * imgAspect;
        drawX = (canvas.width - drawW) / 2;
        drawY = 0;
      }

      // Draw blurred background (stretched)
      ctx.filter = "blur(30px) brightness(0.4)";
      ctx.drawImage(img, -50, -50, canvas.width + 100, canvas.height + 100);
      ctx.filter = "none";

      // Draw sharp foreground centered
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png", 0.95);
      });

      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      saveOutput("image", url);

      toast({ title: `${preset.label} format သို့ ပြောင်းပြီးပါပြီ!` });
    } catch (error) {
      console.error("Resize error:", error);
      toast({ title: "ပုံ resize လုပ်ရာတွင် ပြဿနာရှိပါသည်", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!resultUrl) return;
    const preset = PRESETS.find(p => p.ratio === selectedRatio)!;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `${fileName.split(".")[0]}_${preset.ratio.replace(":", "x")}.png`;
    link.click();
  };

  const clearAll = () => {
    setSourceImage(null);
    setSourceType(null);
    setResultUrl(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-4 pb-24 space-y-4"
    >
      <ToolHeader title="Auto Resizer" subtitle="TikTok / YouTube / Facebook format" onBack={onBack} />
      <FirstOutputGuide toolName="Auto Resizer" show={showGuide} steps={["ပုံတင်ပါ", "Format ရွေးပါ", "Resize လုပ်ပါ"]} />

      {/* Format Selection */}
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isSelected = selectedRatio === preset.ratio;
          return (
            <button
              key={preset.ratio}
              onClick={() => { setSelectedRatio(preset.ratio); setResultUrl(null); }}
              className={`p-3 rounded-xl border transition-all text-center ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-gold"
                  : "border-border/50 bg-secondary/30 hover:border-primary/30"
              }`}
            >
              <Icon className={`w-6 h-6 mx-auto mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
              <p className={`text-xs font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>{preset.ratio}</p>
              <p className="text-[10px] text-muted-foreground">{preset.platform}</p>
            </button>
          );
        })}
      </div>

      {/* Upload Area */}
      {!sourceImage ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-primary/30 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
        >
          <Upload className="w-10 h-10 text-primary mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground font-myanmar">ပုံ သို့မဟုတ် ဗီဒီယို ထည့်ပါ</p>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP, MP4</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Preview */}
          <div className="relative rounded-xl overflow-hidden border border-border/50">
            {sourceType === "image" ? (
              <img src={sourceImage} alt="Source" className="w-full max-h-64 object-contain bg-black/50" />
            ) : (
              <video src={sourceImage} className="w-full max-h-64 object-contain bg-black/50" controls />
            )}
            <button
              onClick={clearAll}
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Process Button */}
          {sourceType === "image" && !resultUrl && (
            <Button onClick={processImage} disabled={isProcessing} className="w-full gradient-gold text-primary-foreground">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {PRESETS.find(p => p.ratio === selectedRatio)?.ratio} သို့ ပြောင်းမည်
                </>
              )}
            </Button>
          )}

          {sourceType === "video" && (
            <p className="text-xs text-muted-foreground text-center font-myanmar">
              ⚠️ Video resize လုပ်ရန် ပုံအဖြစ် screenshot ယူပြီး resize လုပ်နိုင်ပါသည်
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {resultUrl && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="rounded-xl overflow-hidden border border-primary/30">
            <img src={resultUrl} alt="Result" className="w-full max-h-80 object-contain bg-black/50" />
          </div>
          <Button onClick={downloadResult} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download {selectedRatio} Image
          </Button>
        </motion.div>
      )}

      {/* Hidden elements */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
      <canvas ref={canvasRef} className="hidden" />

      {/* Info */}
      <div className="gradient-card rounded-xl p-4 border border-primary/20">
        <p className="text-xs text-muted-foreground font-myanmar leading-relaxed">
          💡 ပုံများကို TikTok (9:16), YouTube (16:9), Facebook (1:1) format များသို့ 
          blurred background ဖြင့် အလိုအလျောက် resize လုပ်ပေးပါသည်။ 
          <span className="text-primary font-semibold"> အခမဲ့ - Credit မကုန်ပါ!</span>
        </p>
      </div>
    </motion.div>
  );
};
