import { useState, useCallback } from "react";
import { ArrowLeft, FileText, Presentation, FileDown, Loader2, Image, Languages, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ToolHeader } from "@/components/ToolHeader";
import { exportToPDF, exportToPPTX, exportToDOCX } from "@/lib/docExport";

interface Section {
  title: string;
  description: string;
  imagePrompt: string;
  imageBase64?: string;
}

type ProcessingStep = "idle" | "analyzing" | "generating_images" | "compiling" | "finished" | "error";
type Language = "myanmar" | "english" | "mixed";

interface DocSlideToolProps {
  userId?: string;
  onBack: () => void;
}

export const DocSlideTool = ({ userId, onBack }: DocSlideToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();

  const [content, setContent] = useState("");
  const [imageCount, setImageCount] = useState([5]);
  const [language, setLanguage] = useState<Language>("mixed");
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [progress, setProgress] = useState(0);
  const [sections, setSections] = useState<Section[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  // Calculate cost: base text (2 credits) + per image (3 credits each) + 40% margin
  const baseCost = 2;
  const perImageCost = 3;
  const calculateCost = useCallback((imgCount: number) => {
    const raw = baseCost + (perImageCost * imgCount);
    return Math.ceil(raw * 1.4); // 40% profit margin
  }, []);

  const estimatedCost = calculateCost(imageCount[0]);

  const handleGenerate = async () => {
    if (!content.trim()) {
      toast({ title: "အကြောင်းအရာ ထည့်ပါ", description: "Doc/Slide ဖန်တီးရန် အကြောင်းအရာ ရေးပါ", variant: "destructive" });
      return;
    }

    if (!userId) {
      toast({ title: "အကောင့်ဝင်ပါ", variant: "destructive" });
      return;
    }

    if (credits < estimatedCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${estimatedCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    try {
      // Step 1: Text Analysis
      setStep("analyzing");
      setProgress(10);

      const { data: analyzeData, error: analyzeError } = await supabase.functions.invoke("generate-doc-slides", {
        body: { content, imageCount: imageCount[0], language, step: "analyze" },
      });

      if (analyzeError || !analyzeData?.success) {
        throw new Error(analyzeData?.error || analyzeError?.message || "Text analysis failed");
      }

      const analyzedSections: Section[] = analyzeData.sections;
      setSections(analyzedSections);
      setProgress(30);

      // Step 2: Generate images for each section
      setStep("generating_images");
      const sectionsWithImages: Section[] = [];
      const totalImages = analyzedSections.length;

      for (let i = 0; i < totalImages; i++) {
        setCurrentImageIndex(i);
        setProgress(30 + ((i / totalImages) * 50));

        try {
          const { data: imgData, error: imgError } = await supabase.functions.invoke("generate-doc-slides", {
            body: { content: analyzedSections[i].imagePrompt, imageCount: 1, language, step: "generate_image", imagePrompt: analyzedSections[i].imagePrompt, index: i },
          });

          if (imgError || !imgData?.success) {
            console.error(`Image ${i + 1} failed:`, imgData?.error);
            sectionsWithImages.push({ ...analyzedSections[i], imageBase64: undefined });
          } else {
            sectionsWithImages.push({ ...analyzedSections[i], imageBase64: imgData.imageBase64 });
          }
        } catch (imgErr) {
          console.error(`Image ${i + 1} error:`, imgErr);
          sectionsWithImages.push({ ...analyzedSections[i], imageBase64: undefined });
        }
      }

      setSections(sectionsWithImages);
      setStep("compiling");
      setProgress(85);

      // Calculate final cost based on successful images
      const successImages = sectionsWithImages.filter(s => s.imageBase64).length;
      const finalCost = calculateCost(successImages);
      setTotalCost(finalCost);

      // Deduct credits via RPC
      const { data: deductResult, error: deductError } = await supabase.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: finalCost,
        _action: "doc_slide_generator",
      });

      const result = deductResult as { success?: boolean; error?: string } | null;
      if (deductError || !result?.success) {
        throw new Error(result?.error || "Failed to deduct credits");
      }

      // Log usage
      await supabase.from("credit_audit_log").insert({
        user_id: userId,
        amount: finalCost,
        credit_type: "doc_slide_gen",
        description: `Doc/Slide Generator - ${sectionsWithImages.length} sections, ${successImages} images`,
      });

      setStep("finished");
      setProgress(100);
      refetchCredits();

      toast({ title: "အောင်မြင်ပါသည်!", description: `${sectionsWithImages.length} sections ဖန်တီးပြီးပါပြီ` });
    } catch (error: any) {
      console.error("Generation error:", error);
      setStep("error");
      toast({ title: "အမှားရှိပါသည်", description: error.message || "API ချိတ်ဆက်မှု ပြဿနာရှိပါသည်", variant: "destructive" });
    }
  };

  const handleExport = async (format: "pdf" | "pptx" | "docx") => {
    try {
      toast({ title: `${format.toUpperCase()} ဖန်တီးနေပါသည်...` });

      if (format === "pdf") {
        await exportToPDF(sections);
      } else if (format === "pptx") {
        await exportToPPTX(sections);
      } else {
        await exportToDOCX(sections);
      }

      toast({ title: "Download အောင်မြင်ပါသည်!", description: `${format.toUpperCase()} ဖိုင်ကို download လုပ်ပြီးပါပြီ` });
    } catch (error: any) {
      toast({ title: "Export မအောင်မြင်ပါ", description: error.message, variant: "destructive" });
    }
  };

  const stepLabels: Record<ProcessingStep, string> = {
    idle: "အဆင်သင့်ဖြစ်ပါပြီ",
    analyzing: "📝 Text ခွဲခြမ်းစိတ်ဖြာနေပါသည်...",
    generating_images: `🖼️ ပုံ ${currentImageIndex + 1}/${imageCount[0]} ဖန်တီးနေပါသည်...`,
    compiling: "📦 ပေါင်းစပ်နေပါသည်...",
    finished: "✅ အားလုံး ပြီးဆုံးပါပြီ!",
    error: "❌ အမှားရှိပါသည်",
  };

  const isProcessing = ["analyzing", "generating_images", "compiling"].includes(step);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-4 p-4 pb-24"
    >
      <ToolHeader
        title="AI Doc & Slide Generator"
        subtitle="AI ဖြင့် Document နှင့် Slide ဖန်တီးပါ"
        onBack={onBack}
      />

      {/* Input Section */}
      <div className="space-y-4">
        {/* Content Text Area */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground font-myanmar">အကြောင်းအရာ ထည့်ပါ</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="ဤနေရာတွင် သင့်အကြောင်းအရာကို ရေးပါ... AI က Doc/Slide အဖြစ် ပြောင်းပေးပါမည်"
            className="w-full h-40 p-4 rounded-2xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all font-myanmar text-sm"
            disabled={isProcessing}
          />
        </div>

        {/* Image Count Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground font-myanmar flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              ပုံ အရေအတွက်
            </label>
            <span className="text-sm font-bold text-primary">{imageCount[0]} ပုံ</span>
          </div>
          <Slider
            value={imageCount}
            onValueChange={setImageCount}
            min={1}
            max={50}
            step={1}
            disabled={isProcessing}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>25</span>
            <span>50</span>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground font-myanmar flex items-center gap-2">
            <Languages className="w-4 h-4 text-primary" />
            ဘာသာစကား
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["myanmar", "english", "mixed"] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                disabled={isProcessing}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                  language === lang
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {lang === "myanmar" ? "မြန်မာ" : lang === "english" ? "English" : "Mixed"}
              </button>
            ))}
          </div>
        </div>

        {/* Cost Preview */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground font-myanmar">ခန့်မှန်း ကုန်ကျစရိတ်</span>
            <span className="text-lg font-bold text-primary">{estimatedCost} Credits</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-myanmar">
            Text ခွဲခြမ်း ({baseCost} Cr) + ပုံ {imageCount[0]} ခု ({perImageCost * imageCount[0]} Cr) + Service
          </p>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isProcessing || !content.trim()}
          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-base shadow-lg hover:opacity-90 transition-all"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Sparkles className="w-5 h-5 mr-2" />
          )}
          {isProcessing ? stepLabels[step] : "AI ဖြင့် ဖန်တီးမည်"}
        </Button>
      </div>

      {/* Progress Bar */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{stepLabels[step]}</span>
                <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              
              {/* Step indicators */}
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <div className={`flex items-center gap-1 ${step === "analyzing" || progress > 20 ? "text-primary" : ""}`}>
                  <FileText className="w-3 h-3" /> Text
                </div>
                <div className={`flex items-center gap-1 ${step === "generating_images" || progress > 50 ? "text-primary" : ""}`}>
                  <Image className="w-3 h-3" /> Images
                </div>
                <div className={`flex items-center gap-1 ${step === "compiling" || progress > 80 ? "text-primary" : ""}`}>
                  <FileDown className="w-3 h-3" /> Compile
                </div>
                <div className={`flex items-center gap-1 ${step === "finished" ? "text-primary" : ""}`}>
                  ✅ Done
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results & Export */}
      <AnimatePresence>
        {step === "finished" && sections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Preview sections */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <h3 className="text-sm font-semibold text-foreground mb-3 font-myanmar">📋 Preview ({sections.length} sections)</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {sections.map((section, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-secondary/30 rounded-xl">
                    {section.imageBase64 && (
                      <img
                        src={`data:image/png;base64,${section.imageBase64}`}
                        alt={section.title}
                        className="w-16 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{section.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{section.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={() => handleExport("pdf")}
                className="h-14 rounded-2xl btn-gradient-red text-white flex flex-col gap-1"
              >
                <FileDown className="w-5 h-5" />
                <span className="text-xs">PDF</span>
              </Button>
              <Button
                onClick={() => handleExport("pptx")}
                className="h-14 rounded-2xl gradient-gold text-primary-foreground flex flex-col gap-1"
              >
                <Presentation className="w-5 h-5" />
                <span className="text-xs">PPTX</span>
              </Button>
              <Button
                onClick={() => handleExport("docx")}
                className="h-14 rounded-2xl btn-gradient-blue text-white flex flex-col gap-1"
              >
                <FileText className="w-5 h-5" />
                <span className="text-xs">DOCX</span>
              </Button>
            </div>

            {/* Credits spent */}
            <div className="text-center text-sm text-muted-foreground font-myanmar">
              💰 {totalCost} Credits အသုံးပြုပြီး
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {step === "error" && (
        <div className="gradient-card rounded-2xl p-4 border border-destructive/30 text-center">
          <p className="text-sm text-destructive font-myanmar mb-3">ဖန်တီးရာတွင် ပြဿနာရှိပါသည်</p>
          <Button onClick={() => { setStep("idle"); setProgress(0); }} variant="outline" size="sm">
            ပြန်လည်ကြိုးစားမည်
          </Button>
        </div>
      )}
    </motion.div>
  );
};
