import { useState, useRef } from "react";
import { Upload, Sparkles, Download, Loader2, X, Video, Wand2, Play } from "lucide-react";
import { downloadVideo } from "@/lib/downloadHelper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion } from "framer-motion";

interface VideoRedesignToolProps {
  userId?: string;
  onBack: () => void;
}

const STYLE_PRESETS = [
  { label: "🐯 Tiger Walking", prompt: "A majestic tiger walking through a dense jungle, cinematic lighting, 4K" },
  { label: "🦁 Lion in Savanna", prompt: "A powerful lion walking across the African savanna at golden hour" },
  { label: "🐉 Dragon Flying", prompt: "A mythical dragon flying through stormy skies, epic fantasy, fire breathing" },
  { label: "🤖 Robot Cyborg", prompt: "A futuristic cyborg robot in a neon-lit cyberpunk city, metallic skin" },
  { label: "🧙 Wizard Magic", prompt: "A wizard casting magical spells, purple energy, mystical forest" },
  { label: "🎨 Anime Style", prompt: "Anime style, vibrant colors, Studio Ghibli inspired, beautiful scenery" },
  { label: "🌆 Cyberpunk", prompt: "Cyberpunk neon city, holographic signs, rain-soaked streets, synthwave" },
  { label: "🎭 Van Gogh", prompt: "Van Gogh painting style, swirling brushstrokes, starry night colors" },
  { label: "✏️ Pencil Sketch", prompt: "Detailed pencil sketch, hand-drawn illustration, crosshatching" },
  { label: "🧱 Claymation", prompt: "Claymation stop-motion style, clay figures, handcrafted texture" },
  { label: "👾 8-Bit Pixel", prompt: "Retro 8-bit pixel art style, NES era graphics, pixelated" },
  { label: "🎪 Pop Art", prompt: "Andy Warhol pop art style, bold colors, halftone dots, comic" },
  { label: "🌸 Watercolor", prompt: "Delicate watercolor painting, soft washes, flowing colors" },
  { label: "🖼️ Oil Painting", prompt: "Classical oil painting, rich textures, Renaissance style lighting" },
  { label: "🎬 Film Noir", prompt: "Black and white film noir, dramatic shadows, 1940s detective style" },
  { label: "🌈 Psychedelic", prompt: "Psychedelic 1960s art, kaleidoscope colors, trippy patterns" },
  { label: "⛩️ Ukiyo-e", prompt: "Japanese ukiyo-e woodblock print style, traditional art" },
  { label: "🏰 Medieval", prompt: "Medieval illuminated manuscript style, gold leaf, ornate borders" },
  { label: "🚀 Sci-Fi", prompt: "Hard sci-fi space opera, spacecraft, nebula backgrounds, futuristic" },
  { label: "🎃 Horror", prompt: "Dark horror aesthetic, eerie atmosphere, gothic, Tim Burton style" },
  { label: "🌿 Nature Doc", prompt: "National Geographic nature documentary, stunning wildlife, 4K HDR" },
  { label: "🎮 3D Game", prompt: "Unreal Engine 5 cinematic, photorealistic 3D, raytracing" },
  { label: "📚 Comic Book", prompt: "American comic book style, bold ink lines, Ben-Day dots" },
  { label: "🗿 Ancient", prompt: "Ancient Egyptian or Greek mythology style, golden artifacts" },
  { label: "🎻 Baroque", prompt: "Baroque art style, dramatic chiaroscuro, Caravaggio inspired" },
  { label: "❄️ Frozen Ice", prompt: "Frozen ice crystal world, winter wonderland, sparkling frost" },
  { label: "🔥 Fire & Lava", prompt: "Volcanic landscape, molten lava flows, dramatic fire effects" },
  { label: "🌊 Underwater", prompt: "Deep underwater scene, bioluminescent creatures, coral reefs" },
  { label: "☁️ Dreamy", prompt: "Dreamy ethereal atmosphere, soft focus, pastel colors, clouds" },
  { label: "🤡 Cartoon", prompt: "Exaggerated cartoon style, Looney Tunes inspired, slapstick" },
  { label: "🦾 Steampunk", prompt: "Victorian steampunk, brass gears, clockwork machinery, steam" },
  { label: "🌌 Galaxy", prompt: "Cosmic galaxy theme, nebula colors, stars, space exploration" },
];

export const VideoRedesignTool = ({ userId, onBack }: VideoRedesignToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("video_redesign", "Video Redesign");

  const [inputVideo, setInputVideo] = useState<string | null>(null);
  const [inputVideoName, setInputVideoName] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [activeStylePreset, setActiveStylePreset] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const videoInputRef = useRef<HTMLInputElement>(null);

  // 70% margin applied: base 12 * 1.7 = ~21
  const creditCost = costs.video_redesign || 21;

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "ဖိုင်ကြီးလွန်းပါသည်",
        description: "50MB အောက် ဗီဒီယိုရွေးပါ",
        variant: "destructive",
      });
      return;
    }

    setInputVideoName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setInputVideo(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeVideo = () => {
    setInputVideo(null);
    setInputVideoName("");
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const applyPreset = (presetPrompt: string, presetLabel: string) => {
    if (activeStylePreset === presetLabel) {
      // Deselect
      setActiveStylePreset(null);
      setPrompt("");
    } else {
      setActiveStylePreset(presetLabel);
      setPrompt(presetPrompt);
    }
  };

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    // If user types in prompt, deselect any quick style (mutual exclusion - Logic 8)
    if (activeStylePreset) {
      setActiveStylePreset(null);
    }
  };

  const handleTransform = async () => {
    if (!inputVideo) {
      toast({ title: "ဗီဒီယိုထည့်ပါ", description: "Input Video လိုအပ်ပါသည်", variant: "destructive" });
      return;
    }

    if (!prompt.trim()) {
      toast({ title: "Prompt ရေးပါ", description: "ဘယ်လို Style ပြောင်းချင်သလဲ ရေးပါ", variant: "destructive" });
      return;
    }

    if ((credits || 0) < creditCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `Video Redesign အတွက် ${creditCost} Credits လိုအပ်ပါသည်`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResultVideo(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        return prev + Math.random() * 2;
      });
    }, 3000);

    const statuses = [
      "ဗီဒီယိုကို ခွဲခြမ်းစိတ်ဖြာနေသည်...",
      "Motion Data ကို ထုတ်ယူနေသည်...",
      "AI Style Transfer လုပ်ဆောင်နေသည်...",
      "Frame များကို ပြန်လည်ဖန်တီးနေသည်...",
      "ရလဒ်ကို ပြင်ဆင်နေသည်...",
    ];
    let statusIndex = 0;
    setStatusText(statuses[0]);

    const statusInterval = setInterval(() => {
      statusIndex = Math.min(statusIndex + 1, statuses.length - 1);
      setStatusText(statuses[statusIndex]);
    }, 20000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-redesign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ inputVideo, prompt: prompt.trim() }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Video redesign failed");
      }

      setResultVideo(result.video);
      setProgress(100);
      refetchCredits();
      saveOutput("video", result.video);

      toast({
        title: "အောင်မြင်ပါသည်! 🎬",
        description: `Video Redesign ပြီးပါပြီ (${result.creditsUsed} Credits)`,
      });
    } catch (error: any) {
      console.error("Video redesign error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "Video Redesign လုပ်ရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      setIsLoading(false);
      setStatusText("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-4 pb-24"
    >
      <ToolHeader
        title="AI Video Redesign"
        subtitle="Style Transfer Technology"
        onBack={onBack}
      />
      <FirstOutputGuide toolName="Video Redesign" show={showGuide} steps={["Video တင်ပါ", "Style ရွေးပါ", "Transform နှိပ်ပါ"]} />

      {/* Hero Section - Luma-style */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-cyan-500/10 p-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.15),transparent_50%)]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Wand2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground font-myanmar">Video Style Transfer</h2>
            <p className="text-xs text-muted-foreground font-myanmar">
              သင့်ဗီဒီယိုကို AI နှင့် ပုံစံပြောင်းလဲပါ • {creditCost} Credits
            </p>
          </div>
        </div>
      </div>

      {/* Video Upload */}
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-foreground font-myanmar">
          <Video className="w-4 h-4 text-primary" />
          Input Video
        </label>

        {inputVideo ? (
          <div className="relative">
            <video
              src={inputVideo}
              controls
              className="w-full max-h-52 object-contain rounded-xl border border-border/50 bg-black/20"
            />
            <button
              onClick={removeVideo}
              className="absolute -top-2 -right-2 p-1.5 bg-destructive rounded-full text-white shadow-lg"
            >
              <X className="w-3 h-3" />
            </button>
            <p className="text-[10px] text-muted-foreground mt-1 truncate">{inputVideoName}</p>
          </div>
        ) : (
          <button
            onClick={() => videoInputRef.current?.click()}
            className="w-full h-36 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-3 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <span className="text-sm font-medium text-foreground font-myanmar block">ဗီဒီယိုထည့်ရန် နှိပ်ပါ</span>
              <span className="text-[10px] text-muted-foreground">MP4, WebM • 50MB အောက်</span>
            </div>
          </button>
        )}

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoUpload}
          className="hidden"
        />
      </div>

      {/* Style Presets */}
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-foreground font-myanmar">
          <Sparkles className="w-4 h-4 text-primary" />
          Quick Styles
        </label>
        <div className="grid grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
          {STYLE_PRESETS.map((preset, i) => (
            <button
              key={i}
              onClick={() => applyPreset(preset.prompt, preset.label)}
              className={`px-2 py-1.5 text-[10px] rounded-lg border transition-all text-left font-myanmar truncate ${
                activeStylePreset === preset.label
                  ? "border-primary bg-primary/15 ring-1 ring-primary/30 text-primary font-semibold"
                  : "border-border/50 bg-background/50 hover:bg-primary/10 hover:border-primary/30"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Input */}
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-foreground font-myanmar">
          <Wand2 className="w-4 h-4 text-primary" />
          Style Prompt {activeStylePreset && <span className="text-[10px] text-muted-foreground">(Quick Style ရွေးထားသဖြင့် ပိတ်ထားသည်)</span>}
        </label>
        <Textarea
          placeholder="ဗီဒီယိုကို ပြောင်းလဲစေချင်တဲ့ prompt ညွှန်ကြားချက်ကို ရေးပေးပါ"
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          disabled={!!activeStylePreset}
          className={`min-h-[80px] rounded-xl border-border/50 bg-background/50 resize-none text-sm font-myanmar ${activeStylePreset ? "opacity-50" : ""}`}
          maxLength={500}
        />
        <p className="text-[10px] text-muted-foreground text-right">{prompt.length}/500</p>
      </div>

      {/* Progress */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-primary font-medium font-myanmar">{statusText || "Processing..."}</span>
            <span className="text-muted-foreground font-mono">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground text-center font-myanmar">
            AI Style Transfer သည် 2-5 မိနစ်ခန့် ကြာနိုင်ပါသည်
          </p>
        </motion.div>
      )}

      {/* Transform Button */}
      <Button
        onClick={handleTransform}
        disabled={isLoading || !inputVideo || !prompt.trim()}
        className="w-full py-5 rounded-2xl font-semibold text-base bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:from-violet-700 hover:via-fuchsia-700 hover:to-pink-700 text-white shadow-lg shadow-violet-500/25 transition-all duration-300 font-myanmar"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Transforming...
          </>
        ) : (
          <>
            <Wand2 className="w-5 h-5 mr-2" />
            Transform Video ({creditCost} Cr)
          </>
        )}
      </Button>

      {/* Result */}
      {resultVideo && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Play className="w-4 h-4 text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-foreground font-myanmar">ရလဒ် Video</h3>
          </div>

          <video
            src={resultVideo}
            controls
            className="w-full rounded-xl border border-border/50 bg-black/20"
          />

          <Button
            onClick={() => downloadVideo(resultVideo!, "video-redesign")}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-myanmar"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Video
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
