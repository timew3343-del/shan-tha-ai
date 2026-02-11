import { useState, useRef, useMemo } from "react";
import { Loader2, Download, Plus, X, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  { key: "modern", label: "Modern & Luxury" },
  { key: "cozy", label: "Cozy & Natural" },
  { key: "classic", label: "Classic & Royal" },
  { key: "unique", label: "Unique & Vibrant" },
  { key: "special", label: "Specialized" },
];

const STYLES: StyleOption[] = [
  // MODERN & LUXURY
  { value: "modern_minimalist", label: "Modern Minimalist", emoji: "⬜", prompt: "modern minimalist interior, clean lines, neutral palette, open space, uncluttered, contemporary furniture", category: "modern" },
  { value: "industrial_loft", label: "Industrial Loft", emoji: "🏗️", prompt: "industrial loft interior, exposed brick, metal beams, concrete floor, Edison bulbs, raw materials", category: "modern" },
  { value: "luxury_gold", label: "Luxury Gold", emoji: "✨", prompt: "luxury gold interior, gilded accents, marble surfaces, crystal chandelier, velvet upholstery, opulent", category: "modern" },
  { value: "high_tech", label: "High-Tech Futuristic", emoji: "🤖", prompt: "high-tech futuristic interior, smart home, LED ambient lighting, sleek surfaces, automated systems", category: "modern" },
  { value: "art_deco", label: "Art Deco", emoji: "💎", prompt: "Art Deco interior, geometric patterns, gold and black, glamorous 1920s style, lacquered surfaces", category: "modern" },
  { value: "mid_century", label: "Mid-Century Modern", emoji: "🪑", prompt: "mid-century modern interior, organic curves, teak wood furniture, retro colors, iconic Eames chairs", category: "modern" },
  { value: "contemporary_chic", label: "Contemporary Chic", emoji: "🖼️", prompt: "contemporary chic interior, statement art pieces, designer furniture, curated accessories, sophisticated", category: "modern" },

  // COZY & NATURAL
  { value: "scandinavian", label: "Scandinavian", emoji: "🇸🇪", prompt: "Scandinavian interior, white walls, light wood, cozy textiles, hygge atmosphere, functional beauty", category: "cozy" },
  { value: "japandi", label: "Japandi", emoji: "🎋", prompt: "Japandi interior, Japanese-Scandinavian fusion, wabi-sabi aesthetic, natural materials, minimal warmth", category: "cozy" },
  { value: "rustic_farmhouse", label: "Rustic Farmhouse", emoji: "🌾", prompt: "rustic farmhouse interior, reclaimed wood, shiplap walls, vintage decor, warm country charm", category: "cozy" },
  { value: "zen_oriental", label: "Zen Oriental", emoji: "🧘", prompt: "Zen oriental interior, tatami mats, low furniture, bamboo screens, rock garden view, tranquil", category: "cozy" },
  { value: "tropical_resort", label: "Tropical Resort", emoji: "🌴", prompt: "tropical resort interior, rattan furniture, palm leaf prints, open-air feel, natural fibers, lush green", category: "cozy" },
  { value: "bohemian", label: "Bohemian (Boho)", emoji: "🪬", prompt: "bohemian interior, layered textiles, macrame, plants, eclectic mix, warm earth tones, free-spirited", category: "cozy" },
  { value: "traditional_myanmar", label: "မြန်မာ့ရိုးရာ", emoji: "🇲🇲", prompt: "traditional Myanmar interior, teak wood, lacquerware decor, golden accents, Buddhist art, warm wood tones", category: "cozy" },
  { value: "hygge", label: "Hygge", emoji: "🕯️", prompt: "Danish hygge interior, candlelight, soft blankets, warm wood, cozy nooks, comfort-focused, intimate", category: "cozy" },

  // CLASSIC & ROYAL
  { value: "victorian", label: "Victorian Elegance", emoji: "👑", prompt: "Victorian interior, ornate moldings, rich wallpaper, tufted furniture, dark wood, crystal chandeliers", category: "classic" },
  { value: "french_country", label: "French Country", emoji: "🇫🇷", prompt: "French country interior, toile fabric, distressed wood, lavender accents, provincial charm, elegant rustic", category: "classic" },
  { value: "neoclassical", label: "Neoclassical", emoji: "🏛️", prompt: "neoclassical interior, Corinthian columns, symmetrical layout, marble floors, classical sculptures, grand", category: "classic" },
  { value: "royal_palace", label: "Royal Palace", emoji: "🏰", prompt: "royal palace interior, throne room elegance, silk drapes, gold leaf ceiling, grand staircase, Versailles", category: "classic" },
  { value: "colonial_classic", label: "Colonial Classic", emoji: "🪖", prompt: "colonial classic interior, dark wood paneling, leather furniture, brass hardware, traditional elegance", category: "classic" },
  { value: "english_country", label: "English Country", emoji: "🌹", prompt: "English country house interior, chintz fabrics, antique furniture, fireplace, cozy library, tea room", category: "classic" },

  // UNIQUE & VIBRANT
  { value: "cyberpunk_neon", label: "Cyberpunk Neon", emoji: "🌆", prompt: "cyberpunk neon interior, purple and cyan neon lights, dark walls, futuristic tech panels, LED strips", category: "unique" },
  { value: "retro_pop_art", label: "Retro Pop Art", emoji: "🎨", prompt: "retro pop art interior, bold primary colors, comic-inspired decor, graphic prints, playful furniture", category: "unique" },
  { value: "coastal_hamptons", label: "Coastal/Hamptons", emoji: "🏖️", prompt: "coastal Hamptons interior, white and navy blue, nautical decor, wicker furniture, ocean-inspired", category: "unique" },
  { value: "mediterranean", label: "Mediterranean", emoji: "🏺", prompt: "Mediterranean interior, terracotta tiles, arched doorways, wrought iron, warm earth tones, mosaic", category: "unique" },
  { value: "moroccan", label: "Moroccan", emoji: "🇲🇦", prompt: "Moroccan interior, zellige tile, carved screens, lanterns, rich jewel tones, ornate patterns, riad style", category: "unique" },
  { value: "urban_chic", label: "Urban Chic", emoji: "🏙️", prompt: "urban chic loft interior, modern art, designer lighting, polished concrete, city penthouse vibe", category: "unique" },
  { value: "maximalist", label: "Maximalist", emoji: "🌈", prompt: "maximalist interior, bold patterns mixed, rich layered colors, statement pieces, more-is-more aesthetic", category: "unique" },

  // SPECIALIZED
  { value: "montessori", label: "Montessori ကလေးခန်း", emoji: "🧒", prompt: "Montessori children's room, floor bed, low shelves, natural wood toys, pastel colors, child-accessible", category: "special" },
  { value: "gaming_room", label: "Gaming Room Setup", emoji: "🎮", prompt: "gaming room setup, RGB LED lighting, dual monitors, racing chair, soundproofing, dark theme, neon accents", category: "special" },
  { value: "home_cinema", label: "Home Cinema", emoji: "🎬", prompt: "home cinema room, large projection screen, tiered seating, acoustic panels, mood lighting, surround sound", category: "special" },
  { value: "library_cafe", label: "Library/Study Cafe", emoji: "📚", prompt: "library study cafe interior, floor-to-ceiling bookshelves, reading nook, warm lighting, wood ladder, cozy", category: "special" },
  { value: "spa_bathroom", label: "Spa Bathroom", emoji: "🛁", prompt: "luxury spa bathroom, freestanding tub, rain shower, natural stone, candles, zen garden view, serene", category: "special" },
  { value: "wine_cellar", label: "Wine Cellar", emoji: "🍷", prompt: "luxury wine cellar, wooden racks, stone walls, barrel-vaulted ceiling, tasting area, ambient lighting", category: "special" },
];

const ROOMS = [
  { value: "living room", label: "ဧည့်ခန်း", emoji: "🛋️" },
  { value: "single bedroom", label: "တစ်ယောက်အိပ်ခန်း", emoji: "🛏️" },
  { value: "master bedroom", label: "မာစတာရွန်း", emoji: "👑" },
  { value: "kids bedroom 5-10", label: "ကလေးအိပ်ခန်း (၅-၁၀ နှစ်)", emoji: "🧒" },
  { value: "teen bedroom 10-20", label: "လူငယ်အိပ်ခန်း (၁၀-၂၀ နှစ်)", emoji: "🎮" },
  { value: "elderly bedroom", label: "လူကြီးအိပ်ခန်း", emoji: "🧓" },
  { value: "kitchen", label: "မီးဖိုချောင်", emoji: "🍳" },
  { value: "bathroom", label: "ရေချိုးခန်း", emoji: "🚿" },
  { value: "office", label: "ရုံးခန်း", emoji: "💼" },
  { value: "dining room", label: "ထမင်းစားခန်း", emoji: "🍽️" },
];

export const InteriorDesignTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("interior_design", "Interior Design");
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState("modern_minimalist");
  const [roomType, setRoomType] = useState("living room");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const cost = costs.interior_design || 15;

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
    if (file) { const reader = new FileReader(); reader.onload = (ev) => setImage(ev.target?.result as string); reader.readAsDataURL(file); }
  };

  const handleGenerate = async () => {
    if (!image || !userId || !selectedStyle) return;
    setIsLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("interior-design", {
        body: { imageBase64: image, style: selectedStyle.value, roomType },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.imageUrl); refetch();
      if (data?.imageUrl) saveOutput("image", data.imageUrl);
      toast({ title: "ဒီဇိုင်း ဖန်တီးပြီးပါပြီ!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI အိမ်တွင်းအလှဆင် ဒီဇိုင်နာ" subtitle="အခန်းပုံတင်ပြီး AI ဖြင့် ပြန်လည်ဒီဇိုင်းဆွဲခြင်း" onBack={onBack} />
      <FirstOutputGuide toolName="Interior Design" show={showGuide} steps={["အခန်းပုံ တင်ပါ", "Style နှင့် အခန်းအမျိုးအစား ရွေးပါ", "ဒီဇိုင်း ဖန်တီးမည် နှိပ်ပါ"]} />

      {/* Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-2 font-myanmar">အခန်းပုံ တင်ပါ</label>
          {image ? (
            <div className="relative">
              <img src={image} alt="Room" className="w-full max-h-48 object-cover rounded-xl border border-primary/30" />
              <button onClick={() => { setImage(null); setResult(null); }} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5">
              <Plus className="w-8 h-8 text-primary" /><span className="text-sm text-muted-foreground font-myanmar">အခန်းပုံ ရွေးပါ</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </div>

        {/* Room Type */}
        <div className="space-y-2">
          <Label className="text-sm font-myanmar">အခန်းအမျိုးအစား</Label>
          <Select value={roomType} onValueChange={setRoomType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROOMS.map(r => <SelectItem key={r.value} value={r.value}>{r.emoji} {r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Style Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <label className="block text-sm font-medium text-primary font-myanmar">ဒီဇိုင်း Style ({STYLES.length} စတိုင်)</label>

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
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဒီဇိုင်းဆွဲနေသည်...</> : <><Home className="w-4 h-4 mr-2" />ဒီဇိုင်း ဖန်တီးမည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">ဖန်တီးထားသော ဒီဇိုင်း</h3>
          <img src={result} alt="Redesigned" className="w-full rounded-xl" />
          <Button onClick={() => { const a = document.createElement("a"); a.href = result!; a.download = `interior-${Date.now()}.png`; a.click(); }} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />Download
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
