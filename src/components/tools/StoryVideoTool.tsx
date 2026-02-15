import { useState, useEffect } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpen, Loader2, Download, Sparkles, Monitor,
  Smartphone, Square, Image, Film, Palette
} from "lucide-react";
import { downloadImage } from "@/lib/downloadHelper";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface StoryVideoToolProps {
  userId?: string;
  onBack: () => void;
}

interface GeneratedScene {
  sceneNumber: number;
  description: string;
  narration: string;
  image: string;
}

const ART_STYLES = [
  { id: "cinematic_realistic", name: "Cinematic Realistic", emoji: "🎬" },
  { id: "anime_manga", name: "Anime/Manga", emoji: "🎌" },
  { id: "watercolor_painting", name: "Watercolor Painting", emoji: "🎨" },
  { id: "3d_pixar", name: "3D Pixar Style", emoji: "🧊" },
  { id: "comic_book", name: "Comic Book", emoji: "📚" },
  { id: "oil_painting", name: "Oil Painting", emoji: "🖼️" },
  { id: "fantasy_illustration", name: "Fantasy Illustration", emoji: "🧙" },
  { id: "minimalist_flat", name: "Minimalist Flat", emoji: "◻️" },
];

const ASPECT_RATIOS = [
  { id: "16:9", label: "YouTube (16:9)", icon: Monitor },
  { id: "9:16", label: "TikTok/Reels (9:16)", icon: Smartphone },
  { id: "1:1", label: "Square (1:1)", icon: Square },
];

const PROCESSING_STEPS = [
  { label: "ဇာတ်လမ်းကို Scene များခွဲနေပါသည်...", icon: "📖" },
  { label: "ဇာတ်ကောင် Visual ID ဖန်တီးနေပါသည်...", icon: "🎭" },
  { label: "Scene ပုံများ ဆွဲနေပါသည်...", icon: "🎨" },
  { label: "အပြီးသတ်နေပါသည်...", icon: "✨" },
];

export const StoryVideoTool = ({ userId, onBack }: StoryVideoToolProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { showGuide, saveOutput } = useToolOutput("story_video", "Story Video");

  const [story, setStory] = useState("");
  const [sceneCount, setSceneCount] = useState(5);
  const [durationPerScene, setDurationPerScene] = useState(3);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [artStyle, setArtStyle] = useState("cinematic_realistic");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [scenes, setScenes] = useState<GeneratedScene[]>([]);
  const [characterId, setCharacterId] = useState("");

  const perSceneCost = Math.ceil(costs.story_video / 5);
  const creditCost = perSceneCost * sceneCount;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setProgress(0);
      setCurrentStep(0);
      interval = setInterval(() => {
        setProgress(prev => {
          const next = prev + Math.random() * 2;
          if (next >= 95) return 95;
          setCurrentStep(Math.min(Math.floor(next / 25), PROCESSING_STEPS.length - 1));
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleGenerate = async () => {
    if (!story.trim() || !userId) return;
    if (credits < creditCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${creditCost} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setScenes([]);
    setCharacterId("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Login လိုအပ်ပါသည်", variant: "destructive" });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/story-to-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            story: story.trim(),
            sceneCount,
            durationPerScene,
            aspectRatio,
            artStyle: ART_STYLES.find(s => s.id === artStyle)?.name || artStyle,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Generation failed");
      }

      if (result.success) {
        setScenes(result.scenes || []);
        setCharacterId(result.characterId || "");
        setProgress(100);
        refetchCredits();
        if (result.scenes && result.scenes.length > 0 && result.scenes[0].image) {
          saveOutput("image", result.scenes[0].image);
        }
        toast({
          title: "✨ Story Video ပြီးပါပြီ!",
          description: `${result.scenes?.filter((s: GeneratedScene) => s.image).length} scenes generated (${result.creditsUsed} Credits)`,
        });
      }
    } catch (error: any) {
      console.error("Story video error:", error);
      toast({ title: "ပြဿနာရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadScene = (scene: GeneratedScene) => {
    if (!scene.image) return;
    downloadImage(scene.image, `story-scene-${scene.sceneNumber}`);
  };

  const downloadAll = () => {
    scenes.filter(s => s.image).forEach((scene, i) => {
      setTimeout(() => downloadScene(scene), i * 300);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-4 pb-24 space-y-4"
    >
      <ToolHeader
        title="Story → Video"
        subtitle="AI ဖြင့် ပုံပြင်မှ ဗီဒီယို ဖန်တီးမည်"
        onBack={onBack}
      />
      <FirstOutputGuide toolName="Story Video" show={showGuide} steps={["ပုံပြင် ရေးပါ", "Scene အရေအတွက် ရွေးပါ", "ဖန်တီးမည် နှိပ်ပါ"]} />

      {/* Story Input */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          <BookOpen className="w-4 h-4 inline mr-1" /> သင့်ပုံပြင်/Script
        </label>
        <Textarea
          placeholder="ဥပမာ: မြန်မာပြည်က မိန်းကလေးတစ်ယောက် ရွာမှ မြို့ကြီးသို့ စွန့်စားခရီး ထွက်ခဲ့သည်..."
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={5}
          className="text-sm font-myanmar"
        />
      </div>

      {/* Scene Count Slider */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-primary font-myanmar">
            <Film className="w-4 h-4 inline mr-1" /> Scene အရေအတွက်
          </label>
          <span className="text-lg font-bold text-primary">{sceneCount}</span>
        </div>
        <Slider
          value={[sceneCount]}
          onValueChange={(v) => setSceneCount(v[0])}
          min={1} max={50} step={1}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1 scene</span><span>25</span><span>50 scenes</span>
        </div>
      </div>

      {/* Duration Per Scene */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-primary font-myanmar">
            Scene တစ်ခုလျှင် ကြာချိန်
          </label>
          <span className="text-lg font-bold text-primary">{durationPerScene}s</span>
        </div>
        <Slider
          value={[durationPerScene]}
          onValueChange={(v) => setDurationPerScene(v[0])}
          min={1} max={10} step={1}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1s</span><span>5s</span><span>10s</span>
        </div>
      </div>

      {/* Art Style */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          <Palette className="w-4 h-4 inline mr-1" /> Art Style
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ART_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setArtStyle(style.id)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                artStyle === style.id
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-secondary/30 hover:border-primary/30"
              }`}
            >
              <span className="text-lg mr-1">{style.emoji}</span>
              <span className={`text-xs font-medium ${artStyle === style.id ? "text-primary" : "text-foreground"}`}>
                {style.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          <Monitor className="w-4 h-4 inline mr-1" /> Aspect Ratio
        </label>
        <div className="grid grid-cols-3 gap-2">
          {ASPECT_RATIOS.map((ar) => {
            const Icon = ar.icon;
            const isSelected = aspectRatio === ar.id;
            return (
              <button
                key={ar.id}
                onClick={() => setAspectRatio(ar.id)}
                className={`p-2.5 rounded-xl border transition-all text-center ${
                  isSelected ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/30"
                }`}
              >
                <Icon className={`w-4 h-4 mx-auto mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <p className={`text-[10px] font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>{ar.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cost Preview */}
      <motion.div layout className="gradient-card rounded-2xl p-4 border border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground font-myanmar">Cost Preview</span>
          </div>
          <motion.span
            key={creditCost}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-xl font-bold text-primary"
          >
            {creditCost} Credits
          </motion.span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {sceneCount} scenes × {perSceneCost} credits/scene
        </p>
      </motion.div>

      {/* Progress */}
      {isProcessing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{PROCESSING_STEPS[currentStep]?.icon}</span>
            <span className="font-myanmar">{PROCESSING_STEPS[currentStep]?.label}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            {PROCESSING_STEPS.map((step, i) => (
              <span key={i} className={i <= currentStep ? "text-primary" : ""}>{step.icon}</span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Generate Button */}
      {scenes.length === 0 && (
        <Button
          onClick={handleGenerate}
          disabled={isProcessing || !story.trim()}
          className="w-full gradient-gold text-primary-foreground py-5 rounded-2xl font-semibold"
        >
          {isProcessing ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> AI Generating...</>
          ) : (
            <><BookOpen className="w-5 h-5 mr-2" /> Story Video ဖန်တီးမည် ({creditCost} Cr)</>
          )}
        </Button>
      )}

      {/* Results */}
      <AnimatePresence>
        {scenes.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Character ID */}
            {characterId && (
              <div className="gradient-card rounded-xl p-3 border border-primary/20">
                <h4 className="text-xs font-semibold text-primary mb-1 font-myanmar">🎭 Character Visual ID</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{characterId}</p>
              </div>
            )}

            {/* Download All */}
            <Button onClick={downloadAll} variant="outline" className="w-full font-myanmar">
              <Download className="w-4 h-4 mr-2" />
              Scene အားလုံး Download ({scenes.filter(s => s.image).length} ပုံ)
            </Button>

            {/* Scene Grid */}
            <div className="grid grid-cols-1 gap-3">
              {scenes.map((scene, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="gradient-card rounded-xl border border-primary/20 overflow-hidden"
                >
                  {scene.image ? (
                    <img src={scene.image} alt={`Scene ${scene.sceneNumber}`} className="w-full aspect-video object-cover" />
                  ) : (
                    <div className="w-full aspect-video bg-secondary/40 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Image generation failed</p>
                    </div>
                  )}
                  <div className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">Scene {scene.sceneNumber}</span>
                      {scene.image && (
                        <button onClick={() => downloadScene(scene)} className="text-xs text-muted-foreground hover:text-foreground">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-foreground font-myanmar">{scene.description}</p>
                    {scene.narration && (
                      <p className="text-[10px] text-muted-foreground font-myanmar italic">🎙️ {scene.narration}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <Button onClick={() => { setScenes([]); setStory(""); }} variant="outline" className="w-full font-myanmar">
              ပုံပြင်အသစ် ဖန်တီးမည်
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info */}
      <div className="gradient-card rounded-xl p-4 border border-primary/20">
        <p className="text-xs text-muted-foreground font-myanmar leading-relaxed">
          📖 သင့်ပုံပြင်ကို AI ဖြင့် Scene များခွဲပြီး ပုံများဆွဲပေးပါသည်။
          Smart Character Lock ဖြင့် ဇာတ်ကောင် မျက်နှာ တစ်ညီတည်း ထွက်ပါသည်။
          Credits ကို ပုံများ ထွက်ပြီးမှသာ နုတ်ယူပါသည်။
        </p>
      </div>
    </motion.div>
  );
};
