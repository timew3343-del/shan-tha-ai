import { useState, useRef } from "react";
import { Upload, Loader2, Download, Calendar, Camera, Image, Sparkles, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion, AnimatePresence } from "framer-motion";
import { THEME_CATEGORIES, type Theme } from "./PhotoshootThemes";

interface SocialMediaManagerToolProps {
  userId?: string;
  onBack: () => void;
}

interface DayContent {
  day: number;
  dayName: string;
  caption_my: string;
  caption_en: string;
  hashtags: string[];
  bestTime: string;
  visualTheme: string;
  contentType: string;
}

type ViewMode = "upload" | "calendar" | "photoshoot" | "photoshoot-result";

export const SocialMediaManagerTool = ({ userId, onBack }: SocialMediaManagerToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [viewMode, setViewMode] = useState<ViewMode>("upload");
  const [images, setImages] = useState<string[]>([]);
  const [businessDesc, setBusinessDesc] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [calendarDays, setCalendarDays] = useState<DayContent[]>([]);
  const [enhancedImages, setEnhancedImages] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [selectedImageForShoot, setSelectedImageForShoot] = useState(0);
  const [photoshootResult, setPhotoshootResult] = useState<string | null>(null);
  const [isPhotoshooting, setIsPhotoshooting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calendarCost = (costs as any).social_media_agent || 25;
  const photoshootCost = (costs as any).photoshoot || 8;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 4 - images.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "ဖိုင်ကြီးလွန်းပါ", description: "10MB အောက် ပုံရွေးပါ", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages((prev) => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const generateCalendar = async () => {
    if (!userId) {
      toast({ title: "လော့ဂ်အင်လုပ်ပါ", variant: "destructive" });
      return;
    }
    if (images.length < 1) {
      toast({ title: "ပုံအနည်းဆုံး ၁ ပုံ ထည့်ပါ", variant: "destructive" });
      return;
    }
    if (!businessDesc.trim()) {
      toast({ title: "လုပ်ငန်းအကြောင်း ရေးပါ", variant: "destructive" });
      return;
    }
    if (credits < calendarCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${calendarCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-media-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode: "calendar",
          images,
          businessDescription: businessDesc,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Generation failed");
      }

      const result = await response.json();
      setCalendarDays(result.calendar?.days || []);
      setEnhancedImages(result.enhancedImages || []);
      setViewMode("calendar");
      refetchCredits();

      toast({ title: "အောင်မြင်ပါသည်", description: "7 ရက်စာ Content Calendar ဖန်တီးပြီးပါပြီ" });
    } catch (error: any) {
      console.error("Calendar generation error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePhotoshoot = async () => {
    if (!userId || !selectedTheme) return;

    if (credits < photoshootCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${photoshootCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsPhotoshooting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-media-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode: "photoshoot",
          images,
          businessDescription: businessDesc,
          themePrompt: selectedTheme.prompt,
          themeName: selectedTheme.name,
          selectedImageIndex: selectedImageForShoot,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Photoshoot failed");
      }

      const result = await response.json();
      setPhotoshootResult(result.resultImageUrl);
      setViewMode("photoshoot-result");
      refetchCredits();

      toast({ title: "အောင်မြင်ပါသည်", description: "Professional Photoshoot ပြီးပါပြီ" });
    } catch (error: any) {
      console.error("Photoshoot error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setIsPhotoshooting(false);
    }
  };

  const downloadAll = () => {
    enhancedImages.forEach((url, i) => {
      if (!url) return;
      const link = document.createElement("a");
      link.href = url;
      link.download = `day${i + 1}_content.png`;
      link.target = "_blank";
      link.click();
    });
  };

  const downloadImage = (url: string, name: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.target = "_blank";
    link.click();
  };

  // ==================== UPLOAD VIEW ====================
  if (viewMode === "upload") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
        <ToolHeader title="AI Social Media Manager" subtitle="7 ရက်စာ Content Calendar + Professional Photoshoot" onBack={onBack} />

        {/* Image Upload */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <h3 className="text-sm font-semibold text-foreground mb-3 font-myanmar flex items-center gap-2">
            <Image className="w-4 h-4 text-primary" />
            ထုတ်ကုန်ပုံများ တင်ပါ (၃-၄ ပုံ)
          </h3>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-primary/20">
                <img src={img} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 4 && (
              <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-1 hover:border-primary/60 transition-colors">
                <Upload className="w-5 h-5 text-primary/50" />
                <span className="text-[10px] text-muted-foreground">တင်ရန်</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
        </div>

        {/* Business Description */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <h3 className="text-sm font-semibold text-foreground mb-2 font-myanmar">လုပ်ငန်းအကြောင်း ဖော်ပြပါ</h3>
          <Textarea
            value={businessDesc}
            onChange={(e) => setBusinessDesc(e.target.value)}
            placeholder="ဥပမာ: Natural skincare products for sensitive skin. Made in Myanmar..."
            className="min-h-[80px] bg-secondary/50 border-primary/20 font-myanmar text-sm"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={generateCalendar}
            disabled={isGenerating || images.length < 1 || !businessDesc.trim()}
            className="w-full py-6 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-myanmar">AI က သင့်ထုတ်ကုန်ကို ခွဲခြမ်းနေပါသည်...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span className="font-myanmar">7 ရက်စာ Calendar ဖန်တီးမည် ({calendarCost} Cr)</span>
              </div>
            )}
          </Button>

          {images.length >= 1 && businessDesc.trim() && (
            <Button
              onClick={() => setViewMode("photoshoot")}
              variant="outline"
              className="w-full py-5 rounded-2xl border-primary/30"
            >
              <Camera className="w-5 h-5 mr-2 text-primary" />
              <span className="font-myanmar">Professional AI Photoshoot ({photoshootCost} Cr)</span>
            </Button>
          )}
        </div>

        {/* Credit Info */}
        <div className="gradient-card rounded-2xl p-3 border border-primary/10">
          <p className="text-xs text-muted-foreground font-myanmar">
            📊 Content Calendar: {calendarCost} Credits (7 ရက်စာ ပုံ + caption + hashtags)
          </p>
          <p className="text-xs text-muted-foreground font-myanmar mt-1">
            📸 Photoshoot: {photoshootCost} Credits/ပုံ (60 background themes)
          </p>
        </div>
      </motion.div>
    );
  }

  // ==================== CALENDAR VIEW ====================
  if (viewMode === "calendar") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
        <ToolHeader title="7-Day Content Calendar" subtitle="AI ဖန်တီးထားသော Content Plan" onBack={() => setViewMode("upload")} />

        <div className="flex gap-2 mb-2">
          <Button onClick={downloadAll} variant="outline" size="sm" className="rounded-xl">
            <Download className="w-4 h-4 mr-1" />
            <span className="font-myanmar text-xs">အားလုံး Download</span>
          </Button>
          <Button onClick={() => setViewMode("photoshoot")} variant="outline" size="sm" className="rounded-xl">
            <Camera className="w-4 h-4 mr-1" />
            <span className="font-myanmar text-xs">Photoshoot</span>
          </Button>
        </div>

        <div className="space-y-4">
          {calendarDays.map((day, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="gradient-card rounded-2xl p-4 border border-primary/20"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{day.day}</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{day.dayName}</h4>
                  <span className="text-xs text-muted-foreground">{day.contentType} • {day.bestTime}</span>
                </div>
              </div>

              {enhancedImages[i] && (
                <div className="relative aspect-video rounded-xl overflow-hidden mb-3 border border-primary/10">
                  <img src={enhancedImages[i]} alt={`Day ${day.day}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => downloadImage(enhancedImages[i], `day${day.day}_content.png`)}
                    className="absolute bottom-2 right-2 p-1.5 bg-black/60 rounded-lg hover:bg-black/80 transition-colors"
                  >
                    <Download className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <div className="bg-secondary/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">🇲🇲 Myanmar</p>
                  <p className="text-sm text-foreground font-myanmar">{day.caption_my}</p>
                </div>
                <div className="bg-secondary/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">🇬🇧 English</p>
                  <p className="text-sm text-foreground">{day.caption_en}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {day.hashtags?.map((tag, j) => (
                    <span key={j} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  // ==================== PHOTOSHOOT VIEW ====================
  if (viewMode === "photoshoot") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
        <ToolHeader title="Professional AI Photoshoot" subtitle="60 Background Themes ရွေးချယ်ပါ" onBack={() => setViewMode("upload")} />

        {/* Select Image */}
        <div className="gradient-card rounded-2xl p-3 border border-primary/20">
          <h4 className="text-xs font-semibold text-foreground mb-2 font-myanmar">ပုံရွေးပါ</h4>
          <div className="flex gap-2">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImageForShoot(i)}
                className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  selectedImageForShoot === i ? "border-primary shadow-lg scale-105" : "border-transparent opacity-60"
                }`}
              >
                <img src={img} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Theme Categories */}
        <div className="space-y-3">
          {THEME_CATEGORIES.map((category) => (
            <div key={category.name} className="gradient-card rounded-2xl border border-primary/20 overflow-hidden">
              <button
                onClick={() => setSelectedCategory(selectedCategory === category.name ? null : category.name)}
                className="w-full flex items-center justify-between p-3 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{category.name}</span>
                  <span className="text-xs text-muted-foreground font-myanmar">({category.nameMyanmar})</span>
                </div>
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${selectedCategory === category.name ? "rotate-90" : ""}`} />
              </button>

              <AnimatePresence>
                {selectedCategory === category.name && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-primary/10"
                  >
                    <div className="grid grid-cols-2 gap-2 p-3">
                      {category.themes.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => setSelectedTheme(theme)}
                          className={`p-2.5 rounded-xl text-left transition-all text-xs ${
                            selectedTheme?.id === theme.id
                              ? "bg-primary/20 border-2 border-primary"
                              : "bg-secondary/30 border border-transparent hover:border-primary/30"
                          }`}
                        >
                          <span className="font-medium text-foreground">{theme.name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Generate Button */}
        {selectedTheme && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="gradient-card rounded-2xl p-3 border border-primary/20 mb-2">
              <p className="text-xs text-muted-foreground font-myanmar">
                ရွေးထားသော Theme: <span className="text-primary font-semibold">{selectedTheme.name}</span>
              </p>
            </div>
            <Button
              onClick={handlePhotoshoot}
              disabled={isPhotoshooting}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary to-primary/70 text-primary-foreground"
            >
              {isPhotoshooting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-myanmar">30% ပိုလှသော ပုံ ဖန်တီးနေသည်...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  <span className="font-myanmar">Photoshoot ဖန်တီးမည် ({photoshootCost} Cr)</span>
                </div>
              )}
            </Button>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // ==================== PHOTOSHOOT RESULT ====================
  if (viewMode === "photoshoot-result" && photoshootResult) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
        <ToolHeader title="Photoshoot Result" subtitle={selectedTheme?.name || "Professional Photo"} onBack={() => setViewMode("photoshoot")} />

        <div className="relative rounded-2xl overflow-hidden border border-primary/20">
          <img src={photoshootResult} alt="Photoshoot result" className="w-full h-auto" />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => downloadImage(photoshootResult, `photoshoot_${selectedTheme?.id || "result"}.png`)} className="flex-1 rounded-2xl">
            <Download className="w-4 h-4 mr-2" />
            <span className="font-myanmar">Download</span>
          </Button>
          <Button onClick={() => { setPhotoshootResult(null); setViewMode("photoshoot"); }} variant="outline" className="flex-1 rounded-2xl">
            <Camera className="w-4 h-4 mr-2" />
            <span className="font-myanmar">နောက်ထပ် Theme</span>
          </Button>
        </div>

        {/* Comparison */}
        <div className="gradient-card rounded-2xl p-3 border border-primary/20">
          <h4 className="text-xs font-semibold text-foreground mb-2 font-myanmar">မူရင်း vs AI Photoshoot</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl overflow-hidden border border-primary/10">
              <img src={images[selectedImageForShoot]} alt="Original" className="w-full h-auto" />
              <p className="text-[10px] text-center text-muted-foreground py-1">မူရင်း</p>
            </div>
            <div className="rounded-xl overflow-hidden border border-primary/20">
              <img src={photoshootResult} alt="Enhanced" className="w-full h-auto" />
              <p className="text-[10px] text-center text-primary py-1">AI Enhanced</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
};
