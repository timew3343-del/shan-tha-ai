import { useState, useRef } from "react";
import { Loader2, Download, Plus, X, ImagePlus, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion, AnimatePresence } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

const MAX_IMAGES = 10;

export const PhotoRestoreTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("photo_restore", "Photo Restore");
  const [images, setImages] = useState<string[]>([]);
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const costPerImage = costs.photo_restoration || 10;
  const totalCost = images.length * costPerImage;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - images.length;
    const toProcess = files.slice(0, remaining);
    
    toProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages(prev => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, ev.target?.result as string];
        });
      };
      reader.readAsDataURL(file);
    });

    if (files.length > remaining) {
      toast({ title: `အများဆုံး ${MAX_IMAGES} ပုံသာ ထည့်နိုင်ပါသည်`, variant: "destructive" });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setResults([]);
  };

  const handleGenerate = async () => {
    if (images.length === 0 || !userId) return;
    if (credits < totalCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${totalCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setResults([]);
    setProgress({ done: 0, total: images.length });

    try {
      const { data, error } = await supabase.functions.invoke("photo-restore", {
        body: { images },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      
      setResults(data?.results || []);
      setProgress({ done: data?.results?.length || 0, total: images.length });
      refetch();
      if (data?.results?.length) saveOutput("image", data.results[0]);
      toast({ 
        title: "အောင်မြင်ပါသည်!", 
        description: `ဓာတ်ပုံ ${data?.results?.length || 0} ပုံ ပြုပြင်ပြီးပါပြီ (${data.creditsUsed} Cr)` 
      });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (url: string, index: number) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `restored-${index + 1}-${Date.now()}.png`;
    a.click();
  };

  const handleDownloadAll = () => {
    results.forEach((url, idx) => handleDownload(url, idx));
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI ဓာတ်ပုံဟောင်း ပြုပြင်သူ" subtitle={`ပုံဟောင်းများကို အများဆုံး ${MAX_IMAGES} ပုံ တစ်ပြိုင်နက် ပြုပြင်ပေးခြင်း`} onBack={onBack} />
      <FirstOutputGuide toolName="Photo Restore" show={showGuide} steps={["ပုံဟောင်းများ တင်ပါ", "ပြုပြင်မည် နှိပ်ပါ"]} />

      {/* Upload Area */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-primary font-myanmar">ပုံဟောင်းများ တင်ပါ</label>
          <span className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES}</span>
        </div>
        
        {/* Image Grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {images.map((img, idx) => (
              <div key={idx} className="relative">
                <img src={img} alt={`Upload ${idx + 1}`} className="w-full h-20 object-cover rounded-xl border border-primary/30" />
                <button onClick={() => removeImage(idx)} className="absolute -top-1.5 -right-1.5 p-0.5 bg-destructive rounded-full text-white">
                  <X className="w-2.5 h-2.5" />
                </button>
                <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[8px] px-1 rounded">{idx + 1}</span>
              </div>
            ))}
          </div>
        )}

        {images.length < MAX_IMAGES && (
          <button onClick={() => fileRef.current?.click()} className="w-full h-24 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-primary/5 transition-colors">
            <Plus className="w-6 h-6 text-primary" />
            <span className="text-xs text-muted-foreground font-myanmar">
              {images.length === 0 ? "ဓာတ်ပုံများ ရွေးပါ (အများဆုံး 10)" : "နောက်ထပ် ပုံထည့်ရန်"}
            </span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
      </div>

      {/* Cost Display */}
      {images.length > 0 && (
        <div className="bg-secondary/30 rounded-xl p-3 border border-primary/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-myanmar">စုစုပေါင်း Credit</span>
            <span className="font-bold text-primary">{totalCost} Credits</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {costPerImage} Cr/ပုံ × {images.length} ပုံ
          </div>
        </div>
      )}

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isLoading || images.length === 0 || credits < totalCost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ပြုပြင်နေသည်... ({progress.done}/{progress.total})</>
        ) : (
          <><ImagePlus className="w-4 h-4 mr-2" />ပုံ {images.length} ခု ပြုပြင်မည် ({totalCost} Cr)</>
        )}
      </Button>

      {/* Results Grid */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary font-myanmar flex items-center gap-2">
                <Images className="w-4 h-4" /> ပြုပြင်ပြီး ရလဒ်များ ({results.length})
              </h3>
              {results.length > 1 && (
                <Button onClick={handleDownloadAll} variant="outline" size="sm" className="text-xs">
                  <Download className="w-3 h-3 mr-1" /> Download All
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {results.map((url, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }}
                  className="relative group gradient-card rounded-xl overflow-hidden border border-primary/20"
                >
                  <img src={url} alt={`Restored ${idx + 1}`} className="w-full h-auto" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button onClick={() => handleDownload(url, idx)} size="sm" className="bg-primary text-primary-foreground text-xs">
                      <Download className="w-3 h-3 mr-1" /> #{idx + 1}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
