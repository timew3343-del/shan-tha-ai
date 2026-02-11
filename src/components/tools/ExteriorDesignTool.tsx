import { useState, useRef, useMemo } from "react";
import { Loader2, Download, Plus, X, Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

interface StyleOption {
  value: string;
  label: string;
  emoji: string;
  prompt: string;
  category: string;
}

const STYLE_CATEGORIES = [
  { key: "all", label: "အားလုံး" },
  { key: "modern", label: "Modern & Trendy" },
  { key: "classic", label: "Classic & Elegant" },
  { key: "cultural", label: "Cultural & Regional" },
  { key: "nature", label: "Nature & Cozy" },
  { key: "luxury", label: "Premium & Luxury" },
];

const STYLES: StyleOption[] = [
  // MODERN & TRENDY
  { value: "ultra_modern_glass", label: "ခေတ်မီမှန်အိမ်", emoji: "🏙️", prompt: "ultra-modern glass house, floor-to-ceiling windows, steel frame, minimalist landscaping, infinity pool", category: "modern" },
  { value: "industrial_loft", label: "Industrial Loft", emoji: "🏗️", prompt: "industrial loft style exterior, exposed brick, metal beams, large factory windows, urban chic", category: "modern" },
  { value: "scandinavian", label: "စကင်ဒီနေးဗီးယန်း", emoji: "🏡", prompt: "Scandinavian exterior design, clean white walls, wood cladding, simple geometry, hygge aesthetic", category: "modern" },
  { value: "minimalist_white", label: "Minimalist White", emoji: "⬜", prompt: "pure minimalist white architecture, sharp clean lines, flat roof, monochrome palette, Zen simplicity", category: "modern" },
  { value: "biophilic", label: "Biophilic ဒီဇိုင်း", emoji: "🌿", prompt: "futuristic biophilic architecture, living green walls, rooftop garden, integrated plants, eco-friendly", category: "modern" },
  { value: "high_tech", label: "High-Tech", emoji: "🔬", prompt: "high-tech architecture, smart home, solar panels, automated systems, cutting-edge materials, LED lighting", category: "modern" },
  { value: "brutalist", label: "Brutalist", emoji: "🧱", prompt: "brutalist architecture, raw concrete, geometric forms, monumental scale, bold shadows", category: "modern" },
  { value: "deconstructivist", label: "Deconstructivist", emoji: "📐", prompt: "deconstructivist architecture, fragmented forms, angular shapes, Zaha Hadid inspired, dramatic curves", category: "modern" },

  // CLASSIC & ELEGANT
  { value: "french_provincial", label: "ပြင်သစ် Provincial", emoji: "🏰", prompt: "French Provincial mansion, symmetrical facade, mansard roof, stone walls, formal garden, elegant", category: "classic" },
  { value: "victorian", label: "Victorian Mansion", emoji: "🏚️", prompt: "Victorian mansion, ornate gingerbread trim, wrap-around porch, tower turret, colorful painted lady style", category: "classic" },
  { value: "colonial", label: "Colonial စတိုင်", emoji: "🏛️", prompt: "American Colonial style house, brick exterior, white columns, symmetrical windows, formal entrance", category: "classic" },
  { value: "neoclassical", label: "Neoclassical", emoji: "🏛️", prompt: "neoclassical architecture, grand columns, pediment, marble facade, symmetrical design, classical proportions", category: "classic" },
  { value: "greek_revival", label: "Greek Revival", emoji: "🇬🇷", prompt: "Greek Revival architecture, Doric columns, triangular pediment, white stucco, classical temple inspired", category: "classic" },
  { value: "georgian", label: "Georgian", emoji: "🏠", prompt: "Georgian architecture, red brick, sash windows, symmetrical facade, decorative cornices, formal elegance", category: "classic" },
  { value: "tudor", label: "Tudor စတိုင်", emoji: "🏡", prompt: "Tudor style house, half-timbered walls, steep gabled roof, tall chimneys, medieval English charm", category: "classic" },

  // CULTURAL & REGIONAL
  { value: "myanmar_modern", label: "ခေတ်မီမြန်မာမှုပုံစံ", emoji: "🇲🇲", prompt: "modern Myanmar traditional house, teak wood, elevated design, multi-tiered pyatthat roof, tropical landscaping", category: "cultural" },
  { value: "japanese_zen", label: "ဂျပန် Zen", emoji: "⛩️", prompt: "Japanese Zen minimalist house, wooden facade, rock garden, bamboo fence, sliding shoji screens, natural materials", category: "cultural" },
  { value: "balinese_resort", label: "ဘာလီ Resort", emoji: "🌺", prompt: "Balinese resort style villa, thatched roof, open pavilion, tropical garden, stone carvings, infinity pool", category: "cultural" },
  { value: "mediterranean", label: "Mediterranean Villa", emoji: "🏖️", prompt: "Mediterranean villa, terracotta roof, white stucco walls, arched windows, courtyard, bougainvillea", category: "cultural" },
  { value: "swiss_chalet", label: "Swiss Chalet", emoji: "🇨🇭", prompt: "Swiss chalet, wooden balconies, overhanging eaves, mountain backdrop, warm wood exterior, flower boxes", category: "cultural" },
  { value: "spanish_hacienda", label: "Spanish Hacienda", emoji: "🇪🇸", prompt: "Spanish hacienda, clay tile roof, stucco walls, wrought iron details, courtyard with fountain, warm tones", category: "cultural" },
  { value: "moroccan", label: "Moroccan", emoji: "🇲🇦", prompt: "Moroccan riad style, intricate tile work, horseshoe arches, courtyard garden, vibrant colors", category: "cultural" },
  { value: "korean_hanok", label: "ကိုရီးယား Hanok", emoji: "🇰🇷", prompt: "Korean Hanok style, curved tiled roof, wooden structure, ondol heating, traditional courtyard, natural harmony", category: "cultural" },

  // NATURE & COZY
  { value: "luxury_farmhouse", label: "Luxury Farmhouse", emoji: "🌾", prompt: "luxury modern farmhouse, board and batten siding, metal roof, large front porch, barn door details", category: "nature" },
  { value: "mountain_cabin", label: "တောင်ပေါ်အိမ်", emoji: "🏔️", prompt: "mountain cabin style, log construction, stone chimney, panoramic windows, forest setting, cozy warm", category: "nature" },
  { value: "tropical_bungalow", label: "အပူပိုင်း Bungalow", emoji: "🌴", prompt: "tropical bungalow, thatched roof, wooden deck, palm trees, ocean view, open-air living", category: "nature" },
  { value: "a_frame_eco", label: "A-Frame Eco House", emoji: "🔺", prompt: "A-frame eco house, steep triangular roof, large glass front, wooden exterior, forest integration", category: "nature" },
  { value: "treehouse", label: "သစ်ပင်ထိပ်အိမ်", emoji: "🌳", prompt: "luxury treehouse design, elevated wooden platform, glass walls among branches, rope bridges, eco-friendly", category: "nature" },
  { value: "earthship", label: "Earthship", emoji: "🌍", prompt: "earthship sustainable home, recycled materials, earth-bermed walls, greenhouse front, off-grid design", category: "nature" },

  // PREMIUM & LUXURY
  { value: "hollywood_mansion", label: "Hollywood Hills Mansion", emoji: "🌟", prompt: "Hollywood Hills mansion, cantilevered pool, panoramic city views, glass walls, luxury modern design", category: "luxury" },
  { value: "penthouse_terrace", label: "Penthouse Terrace", emoji: "🏙️", prompt: "penthouse terrace style, rooftop garden, outdoor lounge, city skyline view, luxury modern finishes", category: "luxury" },
  { value: "royal_palace", label: "တော်ဝင်နန်းတော်", emoji: "👑", prompt: "royal palace exterior, grand entrance, gold accents, marble columns, ornate gardens, fountain courtyard", category: "luxury" },
  { value: "five_star_resort", label: "5-Star Resort", emoji: "⭐", prompt: "5-star luxury resort facade, grand entrance, water features, tropical landscaping, infinity pool, modern elegance", category: "luxury" },
  { value: "dubai_villa", label: "Dubai Luxury Villa", emoji: "🏜️", prompt: "Dubai luxury villa, contemporary Arabic architecture, gold accents, palm-lined driveway, infinity pool, desert oasis", category: "luxury" },
  { value: "mega_yacht_house", label: "Yacht-Style House", emoji: "🛥️", prompt: "yacht-inspired house, curved white surfaces, nautical design, waterfront, sleek aerodynamic shape, luxury", category: "luxury" },
];

export const ExteriorDesignTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("exterior_design", "Exterior Design");
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState("ultra_modern_glass");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const cost = (costs as any).exterior_design || 5;

  const filteredStyles = useMemo(() => {
    let filtered = STYLES;
    if (activeCategory !== "all") filtered = filtered.filter(s => s.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => s.label.toLowerCase().includes(q) || s.value.includes(q));
    }
    return filtered;
  }, [activeCategory, searchQuery]);

  const selectedStyle = STYLES.find(s => s.value === style);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!image || !userId || !selectedStyle) return;
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("interior-design", {
        body: {
          imageBase64: image.split(",")[1],
          userId,
          style: "exterior",
          prompt: `Transform this building/land into a beautiful ${selectedStyle.prompt} exterior house design. High quality 3D architectural rendering, professional visualization, photorealistic, ultra high resolution.`,
          toolType: "exterior_design",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.imageUrl);
      refetch();
      if (data?.imageUrl) saveOutput("image", data.imageUrl);
      toast({ title: "အောင်မြင်ပါသည်!", description: `အိမ်ပြင်ပ ဒီဇိုင်း ဖန်တီးပြီးပါပြီ (${data.creditsUsed} Cr)` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI အိမ်မက်အိမ် ဒီဇိုင်နာ - အပြင်ပိုင်း" subtitle="ခေတ်မီအိမ် ပြင်ပ ဒီဇိုင်း ဖန်တီးခြင်း" onBack={onBack} />
      <FirstOutputGuide toolName="Exterior Design" show={showGuide} steps={["မြေကွက်/အိမ်ဟောင်းပုံ တင်ပါ", "Style ရွေးပါ", "ဒီဇိုင်း ဖန်တီးမည် နှိပ်ပါ"]} />

      {/* Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <label className="block text-sm font-medium text-primary font-myanmar">မြေကွက် / အိမ်ဟောင်း ဓာတ်ပုံ</label>
        {image ? (
          <div className="relative inline-block w-full">
            <img src={image} alt="Upload" className="w-full max-h-48 object-contain rounded-xl border border-primary/30" />
            <button onClick={() => { setImage(null); setResult(null); }} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
            <Plus className="w-6 h-6 text-primary" />
            <span className="text-xs text-muted-foreground font-myanmar">ဓာတ်ပုံ ရွေးပါ</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </div>

      {/* Style Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <label className="block text-sm font-medium text-primary font-myanmar">ဗိသုကာ စတိုင် ({STYLES.length} စတိုင်)</label>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Style ရှာရန်..." className="pl-9 h-9 rounded-xl text-xs bg-secondary/30 border-primary/10" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {STYLE_CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${activeCategory === cat.key ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground hover:bg-primary/10"}`}>
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {filteredStyles.map(s => (
            <button key={s.value} onClick={() => setStyle(s.value)}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-center transition-all ${style === s.value ? "bg-primary/20 border-2 border-primary shadow-md" : "bg-secondary/20 border border-transparent hover:border-primary/30"}`}>
              <span className="text-lg">{s.emoji}</span>
              <span className="text-[9px] font-medium leading-tight font-myanmar line-clamp-2">{s.label}</span>
            </button>
          ))}
        </div>

        {selectedStyle && (
          <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-2 font-myanmar">
            ရွေးချယ်ထားသော: <span className="text-primary font-medium">{selectedStyle.emoji} {selectedStyle.label}</span>
          </div>
        )}
      </div>

      <Button onClick={handleGenerate} disabled={isLoading || !image || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဒီဇိုင်းဆွဲနေသည်...</> : <><Building2 className="w-4 h-4 mr-2" />ဒီဇိုင်း ဖန်တီးမည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">🏠 ဒီဇိုင်း ရလဒ်</h3>
          <img src={result} alt="Exterior Design" className="w-full rounded-xl" />
          <Button onClick={() => { const a = document.createElement("a"); a.href = result; a.download = `exterior-${Date.now()}.png`; a.click(); }} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />Download
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
