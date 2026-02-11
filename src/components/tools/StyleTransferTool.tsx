import { useState, useRef, useMemo } from "react";
import { Loader2, Download, Plus, X, Paintbrush, Search } from "lucide-react";
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
  { key: "classic", label: "Classic Arts" },
  { key: "asian", label: "Asian & Traditional" },
  { key: "modern", label: "Modern & Digital" },
  { key: "cartoon", label: "Cartoon & Anime" },
  { key: "texture", label: "Unique Textures" },
];

const STYLES: StyleOption[] = [
  // CLASSIC ARTS
  { value: "oil_paint", label: "ဆီဆေးပန်းချီ", emoji: "🎨", prompt: "oil painting style, thick brushstrokes, rich colors, artistic masterpiece", category: "classic" },
  { value: "van_gogh", label: "Van Gogh စတိုင်", emoji: "🌻", prompt: "Van Gogh post-impressionist style, swirling brushstrokes, starry night texture, bold colors", category: "classic" },
  { value: "picasso_cubism", label: "Picasso (Cubism)", emoji: "🔷", prompt: "Pablo Picasso cubism style, geometric shapes, fragmented forms, multiple perspectives, abstract art", category: "classic" },
  { value: "monet_impression", label: "Monet (Impressionism)", emoji: "🌸", prompt: "Claude Monet impressionism style, soft light, water lily reflections, pastel hues, dreamy atmosphere", category: "classic" },
  { value: "renaissance_oil", label: "Renaissance Oil", emoji: "🏛️", prompt: "Italian Renaissance oil painting, classical proportions, chiaroscuro lighting, Raphael and Da Vinci inspired", category: "classic" },
  { value: "charcoal", label: "မီးသွေးခဲပန်းချီ", emoji: "✏️", prompt: "charcoal drawing, dramatic contrast, fine shading, textured paper, detailed sketch", category: "classic" },
  { value: "pastel_art", label: "Pastel Art", emoji: "🖍️", prompt: "soft pastel art, chalky texture, gentle blending, warm tones, fine art quality", category: "classic" },
  { value: "sketch", label: "ခဲတံပန်းချီ", emoji: "✏️", prompt: "detailed pencil sketch, graphite drawing, fine lines, realistic shading", category: "classic" },
  { value: "watercolor", label: "ရေဆေးပန်းချီ", emoji: "💧", prompt: "watercolor painting, soft colors, flowing washes, artistic wet-on-wet technique", category: "classic" },
  { value: "baroque", label: "Baroque စတိုင်", emoji: "👑", prompt: "Baroque art style, dramatic lighting, rich dark tones, ornate details, Caravaggio inspired", category: "classic" },

  // ASIAN & TRADITIONAL
  { value: "myanmar_art", label: "မြန်မာ့ရိုးရာပန်းချီ", emoji: "🇲🇲", prompt: "traditional Myanmar art style, gold leaf, intricate patterns, Burmese mural painting, royal court art", category: "asian" },
  { value: "myanmar_mural", label: "မြန်မာ နံရံပန်းချီ", emoji: "🏯", prompt: "detailed Myanmar mural art, Bagan temple painting style, rich gold and red, Buddhist motifs, ancient royal style", category: "asian" },
  { value: "ukiyoe", label: "ဂျပန် Ukiyo-e", emoji: "🗾", prompt: "Japanese Ukiyo-e woodblock print style, flat colors, bold outlines, Hokusai wave inspired", category: "asian" },
  { value: "chinese_ink", label: "တရုတ် မင်ပန်းချီ", emoji: "🖌️", prompt: "Chinese ink wash painting, sumi-e style, minimalist brush strokes, mountain landscape, Zen aesthetic", category: "asian" },
  { value: "mandala", label: "Mandala Art", emoji: "🕉️", prompt: "intricate mandala art, sacred geometry, symmetrical patterns, detailed line work, spiritual design", category: "asian" },
  { value: "thai_art", label: "ထိုင်း ရိုးရာ", emoji: "🇹🇭", prompt: "traditional Thai art style, gold leaf patterns, Ramakien inspired, temple art, elegant curves", category: "asian" },
  { value: "indian_miniature", label: "အိန္ဒိယ Miniature", emoji: "🇮🇳", prompt: "Indian miniature painting, Mughal style, vibrant colors, fine detail, royal court scene", category: "asian" },

  // MODERN & DIGITAL
  { value: "cyberpunk", label: "Cyberpunk", emoji: "🌆", prompt: "cyberpunk art style, neon lights, futuristic cityscape, dark atmosphere, holographic elements", category: "modern" },
  { value: "scifi_futuristic", label: "Sci-Fi အနာဂတ်", emoji: "🚀", prompt: "futuristic sci-fi art, advanced technology, sleek metallic surfaces, space-age design, cinematic lighting", category: "modern" },
  { value: "vaporwave", label: "Vaporwave", emoji: "🌴", prompt: "vaporwave aesthetic, pink and purple gradients, retro 80s, glitch effects, Greek statues, sunset palette", category: "modern" },
  { value: "3d_render", label: "3D Render (Octane)", emoji: "💎", prompt: "3D Octane render, photorealistic materials, volumetric lighting, subsurface scattering, studio quality", category: "modern" },
  { value: "vector_art", label: "Vector Art", emoji: "📐", prompt: "clean vector art illustration, flat design, bold colors, geometric precision, Adobe Illustrator style", category: "modern" },
  { value: "flat_design", label: "Flat Design", emoji: "🟦", prompt: "modern flat design illustration, minimal shadows, solid colors, clean geometric shapes", category: "modern" },
  { value: "pixel_art", label: "Pixel Art (8-bit)", emoji: "👾", prompt: "pixel art 8-bit retro style, limited color palette, blocky pixels, nostalgic video game aesthetic", category: "modern" },
  { value: "neon_glow", label: "Neon Glow", emoji: "💡", prompt: "neon glow art, vibrant electric colors, dark background, glowing edges, LED light painting", category: "modern" },
  { value: "synthwave", label: "Synthwave", emoji: "🎶", prompt: "synthwave retro-futuristic art, chrome reflections, sunset grids, 80s neon, outrun aesthetic", category: "modern" },

  // CARTOON & ANIME
  { value: "anime", label: "Anime စတိုင်", emoji: "🎌", prompt: "anime art style, cel shading, vibrant colors, Japanese animation, expressive eyes", category: "cartoon" },
  { value: "ghibli", label: "Studio Ghibli", emoji: "🏔️", prompt: "Studio Ghibli anime style, soft watercolor backgrounds, whimsical atmosphere, Hayao Miyazaki inspired", category: "cartoon" },
  { value: "disney_pixar", label: "Disney Pixar", emoji: "✨", prompt: "Disney Pixar 3D animation style, cute proportions, expressive characters, warm lighting, family friendly", category: "cartoon" },
  { value: "retro_comic", label: "Retro Comic Book", emoji: "💥", prompt: "retro comic book style, halftone dots, bold outlines, speech bubbles, vintage pulp art colors", category: "cartoon" },
  { value: "manga_line", label: "Manga Line Art", emoji: "📖", prompt: "manga line art style, black and white ink, detailed cross-hatching, dynamic action poses, Japanese comic", category: "cartoon" },
  { value: "superhero", label: "Superhero စတိုင်", emoji: "🦸", prompt: "superhero comic art style, dynamic poses, bold colors, dramatic lighting, Marvel/DC inspired", category: "cartoon" },
  { value: "chibi", label: "Chibi Art", emoji: "🧸", prompt: "chibi anime style, oversized head, tiny body, cute kawaii aesthetic, pastel colors", category: "cartoon" },
  { value: "pop_art", label: "Pop Art", emoji: "🌈", prompt: "pop art style, bold colors, halftone dots, Andy Warhol inspired, graphic design", category: "cartoon" },

  // UNIQUE TEXTURES
  { value: "glass_art", label: "ဖန်အနုပညာ", emoji: "🔮", prompt: "glass art style, transparent crystal, light refraction, stained glass cathedral window effect, colorful", category: "texture" },
  { value: "paper_cutout", label: "စက္ကူဖြတ်ပန်းချီ", emoji: "✂️", prompt: "paper cutout art, layered paper craft, 3D paper sculpture, origami style, shadow depth", category: "texture" },
  { value: "sand_art", label: "သဲပန်းချီ", emoji: "🏖️", prompt: "sand art style, fine grain texture, earth tones, desert landscape, intricate sand mandala", category: "texture" },
  { value: "mosaic", label: "Mosaic Art", emoji: "🧩", prompt: "mosaic art, small tiles arranged into image, Roman mosaic style, colorful tessellation", category: "texture" },
  { value: "stained_glass", label: "Stained Glass", emoji: "⛪", prompt: "stained glass window art, vibrant translucent colors, lead outlines, cathedral style, light through glass", category: "texture" },
  { value: "graffiti", label: "Graffiti/Street Art", emoji: "🎨", prompt: "street art graffiti style, spray paint texture, urban wall, bold lettering, Banksy inspired", category: "texture" },
  { value: "low_poly", label: "Low Poly Art", emoji: "🔺", prompt: "low poly 3D art, geometric triangular facets, minimalist polygon mesh, pastel gradient colors", category: "texture" },
  { value: "embroidery", label: "ပန်းထိုးပန်းချီ", emoji: "🧵", prompt: "embroidery art style, thread texture, cross-stitch pattern, fabric canvas, handmade needlework look", category: "texture" },
  { value: "woodcut", label: "သစ်သားထွင်းပန်းချီ", emoji: "🪵", prompt: "woodcut print art, bold black lines, carved wood texture, vintage illustration, linocut style", category: "texture" },
];

export const StyleTransferTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("style_transfer", "Style Transfer");
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState("oil_paint");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const cost = (costs as any).style_transfer || 3;

  const filteredStyles = useMemo(() => {
    let filtered = STYLES;
    if (activeCategory !== "all") {
      filtered = filtered.filter(s => s.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.label.toLowerCase().includes(q) || s.value.includes(q) || s.prompt.toLowerCase().includes(q)
      );
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
          style: "artistic",
          prompt: `Transform this photo into ${selectedStyle.prompt}. High quality artistic rendering, beautiful detailed artwork, ultra high resolution.`,
          toolType: "style_transfer",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.imageUrl);
      refetch();
      if (data?.imageUrl) saveOutput("image", data.imageUrl);
      toast({ title: "အောင်မြင်ပါသည်!", description: `Art Style ပြောင်းလဲပြီးပါပြီ (${data.creditsUsed} Cr)` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI အနုပညာ စတိုင်ပြောင်းလဲသူ" subtitle="ဓာတ်ပုံကို အနုပညာ လက်ရာအဖြစ် ပြောင်းလဲခြင်း" onBack={onBack} />
      <FirstOutputGuide toolName="Style Transfer" show={showGuide} steps={["ဓာတ်ပုံ တင်ပါ", "Art Style ရွေးပါ", "Art Style ပြောင်းမည် နှိပ်ပါ"]} />

      {/* Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <label className="block text-sm font-medium text-primary font-myanmar">ဓာတ်ပုံ ရွေးပါ</label>
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
        <label className="block text-sm font-medium text-primary font-myanmar">အနုပညာ စတိုင် ({STYLES.length} စတိုင်)</label>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Style ရှာရန်..."
            className="pl-9 h-9 rounded-xl text-xs bg-secondary/30 border-primary/10"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {STYLE_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/40 text-muted-foreground hover:bg-primary/10"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Styles Grid */}
        <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {filteredStyles.map(s => (
            <button
              key={s.value}
              onClick={() => setStyle(s.value)}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-center transition-all ${
                style === s.value
                  ? "bg-primary/20 border-2 border-primary shadow-md"
                  : "bg-secondary/20 border border-transparent hover:border-primary/30 hover:bg-primary/5"
              }`}
            >
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
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ပြောင်းလဲနေသည်...</> : <><Paintbrush className="w-4 h-4 mr-2" />Art Style ပြောင်းမည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <h3 className="text-sm font-semibold text-primary font-myanmar">🎨 Art ရလဒ်</h3>
          <img src={result} alt="Styled" className="w-full rounded-xl" />
          <Button onClick={() => { const a = document.createElement("a"); a.href = result; a.download = `art-${Date.now()}.png`; a.click(); }} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />Download
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
