import { useMemo, useState } from "react";
import { Search, Sparkles, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

/** Auto-scanned feature registry — add sub-features here and the counter updates automatically */
const TOOL_REGISTRY: { tool: string; features: string[] }[] = [
  { tool: "AI Image Generator", features: ["Text-to-Image", "Prompt-based Art", "Multi-style Generation", "Aspect Ratio Selection"] },
  { tool: "AI Video Generator", features: ["Image-to-Video", "Motion Animation", "Video Export"] },
  { tool: "AI Face Swap", features: ["Single Face Swap", "Multi-face Detection", "HD Face Blending"] },
  { tool: "4K Upscale", features: ["Image Upscaling", "Resolution Enhancement", "Detail Recovery"] },
  { tool: "BG Remove", features: ["Background Removal", "Transparent Export", "Edge Refinement"] },
  { tool: "BG Studio", features: ["Product Background Change", "Auto Scene Matching", "Multiple Templates"] },
  { tool: "Logo & Graphic Design", features: ["Logo Creation", "FB Cover Design", "YouTube Banner", "TikTok Profile"] },
  { tool: "AI Photo Restore", features: ["Old Photo Repair", "Colorization", "Bulk 10-image Restoration", "Scratch Removal"] },
  { tool: "Virtual Try-On", features: ["Clothing Try-On", "7+1 Outfit Variants", "Body Shape Matching"] },
  { tool: "AI Art Style Transfer", features: ["30+ Art Styles", "Classic Arts (Van Gogh, Picasso, Monet)", "Asian & Traditional (Ukiyo-e, Myanmar Mural)", "Modern & Digital (Cyberpunk, 3D Render)", "Cartoon & Anime (Ghibli, Pixar)", "Unique Textures (Glass, Mosaic, Graffiti)", "Searchable Style Gallery"] },
  { tool: "AI Exterior Designer", features: ["30+ Architectural Styles", "Modern Glass House", "Cultural Styles (Myanmar, Japanese)", "Luxury Mansion Design", "3D Photorealistic Render"] },
  { tool: "AI Interior Designer", features: ["35+ Design Styles", "10 Room Types", "Kids/Teen/Elder Rooms", "Specialized (Gaming, Cinema, Library)", "Photorealistic Visualization"] },
  { tool: "AI Fashion Designer PRO", features: ["6 Design Categories", "Wedding/Traditional/Suit", "Measurement System (Inches/CM)", "70+ Fabric Types", "Dual Output (Marketing + Technical Sketch)", "Accessories & Embroidery"] },
  { tool: "Song & MTV Creator", features: ["AI Song Generation", "MTV Video Creation", "Lyrics Writing"] },
  { tool: "Auto Ad Generator", features: ["Full Auto Ad Creation", "Script + Video + Audio", "Multi-platform Export"] },
  { tool: "Live AI Vision & Voice", features: ["Real-time Camera AI", "Voice Interaction", "Live Scene Analysis"] },
  { tool: "AI Video Redesign", features: ["Video Style Transfer", "Visual Effect Change"] },
  { tool: "AI Caption", features: ["Auto Subtitling", "Multi-language Captions", "Timestamp Sync"] },
  { tool: "AI Ad Generator", features: ["Ad Script Writing", "Ad Visual Creation"] },
  { tool: "Video Copywriting PRO", features: ["Ad Video Creation", "Editable Subtitles", "Logo Overlay", "Multi-aspect Resize"] },
  { tool: "Copyright Checker", features: ["Music Copyright Check", "Content Originality Scan"] },
  { tool: "Story → Video", features: ["50-scene Story Video", "Character Lock", "Scene Generation"] },
  { tool: "Video Recap", features: ["Video Summarization", "Key Scene Extraction"] },
  { tool: "Text-to-Speech / STT", features: ["Text to Speech", "Speech to Text", "Multi-language Voice"] },
  { tool: "YouTube → Text", features: ["Video Transcription", "Subtitle Extraction"] },
  { tool: "AI Voice Translator", features: ["Myanmar → Foreign Translation", "Real-time Voice Translation"] },
  { tool: "Myanmar Spellcheck", features: ["Spelling Check", "Grammar Correction"] },
  { tool: "AI Creative Writer", features: ["Poetry Generation", "Short Story Writing", "Myanmar Literature"] },
  { tool: "Message Polisher", features: ["Formal Tone Adjustment", "Professional Rewriting"] },
  { tool: "AI Doc & Slide", features: ["PDF Creation", "PPTX Generation", "DOCX Export"] },
  { tool: "AI CV Builder", features: ["Resume Creation", "Cover Letter", "PDF Export with Burmese Unicode"] },
  { tool: "AI Legal Document", features: ["Contract Generation", "Legal Template"] },
  { tool: "Social Media Manager", features: ["Content Calendar", "Platform Strategy", "Post Planning"] },
  { tool: "AI Business Consultant", features: ["Investment Analysis", "Market Research", "Business Plan"] },
  { tool: "AI Legal Advisor", features: ["Legal Analysis", "Case Assessment"] },
  { tool: "AI Health Checker", features: ["Symptom Analysis", "Health Advice"] },
  { tool: "AI Nutrition Planner", features: ["Calorie Calculation", "Meal Planning", "Diet Analysis"] },
  { tool: "AI Astrology", features: ["Horoscope Reading", "Fortune Prediction"] },
  { tool: "AI Baby Namer", features: ["Name Suggestion", "Numerology Analysis"] },
  { tool: "AI Car Dealer", features: ["Car Valuation", "Market Price Analysis"] },
  { tool: "AI Smart Chef", features: ["Recipe Generation", "Ingredient Cost Calculation"] },
  { tool: "AI Travel Planner", features: ["Trip Planning", "Itinerary Creation", "Budget Estimation"] },
];

export const FeatureRegistry = () => {
  const [search, setSearch] = useState("");

  const { totalTools, totalFeatures, filteredFeatures } = useMemo(() => {
    const totalTools = TOOL_REGISTRY.length;
    const allFeatures = TOOL_REGISTRY.flatMap(t => t.features.map(f => ({ tool: t.tool, feature: f })));
    const totalFeatures = allFeatures.length;

    let filtered = allFeatures;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = allFeatures.filter(f => f.tool.toLowerCase().includes(q) || f.feature.toLowerCase().includes(q));
    }
    return { totalTools, totalFeatures, filteredFeatures: filtered };
  }, [search]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4"
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2">
          <Crown className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-primary font-myanmar">System Capabilities</h2>
          <Crown className="w-4 h-4 text-primary" />
        </div>
        <div className="flex items-center justify-center gap-3">
          <div className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-1.5">
            <span className="text-lg font-bold text-primary">{totalTools}</span>
            <span className="text-[10px] text-muted-foreground ml-1">AI Tools</span>
          </div>
          <div className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-1.5">
            <span className="text-lg font-bold text-primary">{totalFeatures}</span>
            <span className="text-[10px] text-muted-foreground ml-1">Capabilities</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground font-myanmar">
          All features developed and maintained by <span className="text-primary font-semibold">Ko Ko Phyo</span>
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Feature ရှာရန်..."
          className="pl-9 h-9 rounded-xl text-xs bg-secondary/30 border-primary/10"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {filteredFeatures.map((f, i) => (
          <div key={`${f.tool}-${i}`} className="bg-secondary/20 rounded-lg px-2 py-1.5 border border-transparent hover:border-primary/20 transition-colors">
            <p className="text-[9px] font-medium text-primary truncate">{f.feature}</p>
            <p className="text-[8px] text-muted-foreground truncate">{f.tool}</p>
          </div>
        ))}
      </div>

      {filteredFeatures.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">ရလဒ် မတွေ့ပါ</p>
      )}
    </motion.div>
  );
};
