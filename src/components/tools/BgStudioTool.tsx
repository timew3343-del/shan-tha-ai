import { useState, useRef } from "react";
import { Upload, Sparkles, Download, Loader2, X, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { Watermark, addWatermarkToImage } from "@/components/Watermark";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BgStudioToolProps {
  userId?: string;
  onBack: () => void;
}

const BG_CATEGORIES = [
  { id: "studio", label: "📷 Studio & Minimal" },
  { id: "luxury", label: "💎 Luxury & Premium" },
  { id: "nature", label: "🌿 Nature & Organic" },
  { id: "tech", label: "💻 Tech & Futuristic" },
  { id: "lifestyle", label: "🏠 Lifestyle & Interior" },
  { id: "seasonal", label: "🎄 Seasonal & Holiday" },
  { id: "abstract", label: "🎨 Abstract & Artistic" },
  { id: "food", label: "🍽️ Food & Beverage" },
  { id: "fashion", label: "👗 Fashion & Beauty" },
  { id: "outdoor", label: "🏔️ Outdoor & Adventure" },
];

const BG_TEMPLATES: Record<string, { id: string; label: string; prompt: string }[]> = {
  studio: [
    { id: "clean_white", label: "⬜ Clean White Studio", prompt: "Pure clean white studio background with professional soft box lighting, minimalist product photography, no shadows, high-end commercial look" },
    { id: "soft_grey", label: "🔘 Soft Grey Gradient", prompt: "Smooth soft grey gradient studio background, professional product photography lighting, clean and modern" },
    { id: "warm_beige", label: "🟤 Warm Beige Studio", prompt: "Warm beige cream studio background with soft warm lighting, elegant product photography" },
    { id: "black_studio", label: "⬛ Black Studio", prompt: "Pure black studio background with dramatic key lighting, high contrast product photography" },
    { id: "pastel_blue", label: "💙 Pastel Blue", prompt: "Soft pastel blue studio background with gentle shadows, airy product photography" },
    { id: "soft_pink", label: "🌸 Soft Pink", prompt: "Delicate soft pink studio background, beauty product aesthetic, gentle lighting" },
    { id: "mint_green", label: "🟢 Mint Green", prompt: "Fresh mint green studio background, clean and modern product display" },
    { id: "lavender", label: "💜 Lavender", prompt: "Soft lavender purple studio background, elegant feminine product photography" },
    { id: "peach", label: "🍑 Peach Tone", prompt: "Warm peach tone studio background with golden hour lighting effect" },
    { id: "ivory", label: "🤍 Ivory Elegance", prompt: "Rich ivory cream background with subtle texture, luxurious product staging" },
  ],
  luxury: [
    { id: "luxury_marble", label: "💎 Luxury Marble", prompt: "Elegant luxury white and grey marble surface with soft studio lighting, high-end product photography background, clean and premium" },
    { id: "black_marble", label: "🖤 Black Marble", prompt: "Luxurious black marble with gold veins, dramatic lighting, ultra-premium product display" },
    { id: "gold_silk", label: "✨ Gold Silk", prompt: "Flowing gold silk fabric background with elegant draping, luxury product showcase, warm lighting" },
    { id: "rose_gold", label: "🌹 Rose Gold", prompt: "Rose gold metallic surface with soft reflections, premium beauty product staging" },
    { id: "crystal_clear", label: "💠 Crystal Display", prompt: "Crystal clear glass display with prismatic light effects, luxury jewelry photography" },
    { id: "velvet_red", label: "❤️ Velvet Red", prompt: "Rich deep red velvet background with soft folds, luxury fashion product staging" },
    { id: "champagne", label: "🥂 Champagne Gold", prompt: "Champagne gold glitter background with bokeh lights, celebration luxury product display" },
    { id: "pearl_white", label: "🦪 Pearl White", prompt: "Iridescent pearl white surface with subtle rainbow reflections, premium product photography" },
    { id: "dark_leather", label: "🎩 Dark Leather", prompt: "Rich dark leather texture background, masculine luxury product staging" },
    { id: "platinum", label: "⚪ Platinum Surface", prompt: "Brushed platinum metallic surface, high-tech luxury product display" },
  ],
  nature: [
    { id: "nature_green", label: "🌿 Lush Greenery", prompt: "Fresh green nature background with soft bokeh, leaves and natural light, organic product photography" },
    { id: "wooden_table", label: "🪵 Natural Wood", prompt: "Beautiful warm wooden table surface with soft natural lighting, rustic elegant product photography background" },
    { id: "tropical_beach", label: "🏖️ Tropical Beach", prompt: "Tropical beach with turquoise water and white sand, summer product photography" },
    { id: "flower_garden", label: "🌺 Flower Garden", prompt: "Beautiful flower garden with colorful blooms, spring product photography background" },
    { id: "bamboo_forest", label: "🎋 Bamboo Forest", prompt: "Serene bamboo forest background with filtered sunlight, zen product photography" },
    { id: "stone_surface", label: "🪨 Natural Stone", prompt: "Natural stone surface with moss accents, organic artisan product photography" },
    { id: "autumn_leaves", label: "🍂 Autumn Leaves", prompt: "Golden autumn leaves scattered on warm surface, fall season product staging" },
    { id: "ocean_waves", label: "🌊 Ocean Waves", prompt: "Calm ocean waves in background with wet sand surface, coastal product photography" },
    { id: "succulent", label: "🌵 Desert Succulent", prompt: "Desert scene with succulents and sand, minimalist natural product backdrop" },
    { id: "rainforest", label: "🌴 Rainforest", prompt: "Lush rainforest canopy with mist, exotic tropical product photography" },
  ],
  tech: [
    { id: "tech_blue", label: "💙 Tech Blue", prompt: "Modern tech blue gradient background with subtle geometric patterns, futuristic product display" },
    { id: "neon_cyber", label: "🟣 Neon Cyberpunk", prompt: "Cyberpunk neon purple and blue lighting, futuristic tech product photography with glowing edges" },
    { id: "holographic", label: "🌈 Holographic", prompt: "Holographic iridescent background with rainbow light effects, futuristic tech product display" },
    { id: "dark_grid", label: "⬛ Dark Grid", prompt: "Dark background with subtle glowing grid lines, sci-fi tech product photography" },
    { id: "digital_matrix", label: "💚 Digital Matrix", prompt: "Digital matrix code falling in background, green tech product photography" },
    { id: "led_panel", label: "💡 LED Panel", prompt: "RGB LED light panel background with color gradients, gaming tech product photography" },
    { id: "circuit_board", label: "🔌 Circuit Board", prompt: "Close-up circuit board texture background with golden traces, tech hardware product photography" },
    { id: "glass_surface", label: "🔲 Glass Surface", prompt: "Clean glass surface with reflections and tech ambience, modern product display" },
    { id: "space_nebula", label: "🌌 Space Nebula", prompt: "Deep space nebula with stars, cosmic product photography with ethereal glow" },
    { id: "ar_overlay", label: "📱 AR Interface", prompt: "Augmented reality interface overlay, floating tech elements, futuristic product showcase" },
  ],
  lifestyle: [
    { id: "cozy_cafe", label: "☕ Cozy Café", prompt: "Warm cozy café interior with bokeh lights, lifestyle product photography" },
    { id: "modern_kitchen", label: "🍳 Modern Kitchen", prompt: "Clean modern kitchen countertop with natural light, food product photography" },
    { id: "bathroom_spa", label: "🛁 Spa Bathroom", prompt: "Luxurious spa bathroom setting with candles and towels, beauty product staging" },
    { id: "bedroom_cozy", label: "🛏️ Cozy Bedroom", prompt: "Cozy bedroom with soft linens and warm lighting, lifestyle product photography" },
    { id: "office_desk", label: "🖥️ Office Desk", prompt: "Clean modern office desk setup with minimal accessories, workspace product photography" },
    { id: "living_room", label: "🛋️ Living Room", prompt: "Stylish modern living room with natural light, home product photography" },
    { id: "bookshelf", label: "📚 Library Shelf", prompt: "Elegant bookshelf background with warm library ambience, intellectual product staging" },
    { id: "yoga_studio", label: "🧘 Yoga Studio", prompt: "Serene yoga studio with natural light and bamboo, wellness product photography" },
    { id: "outdoor_patio", label: "🏡 Garden Patio", prompt: "Beautiful garden patio with string lights, outdoor lifestyle product staging" },
    { id: "wine_cellar", label: "🍷 Wine Cellar", prompt: "Rustic wine cellar with brick walls and warm lighting, premium food product photography" },
  ],
  seasonal: [
    { id: "christmas", label: "🎄 Christmas", prompt: "Christmas decorated background with ornaments and warm lights, holiday product photography" },
    { id: "new_year", label: "🎆 New Year", prompt: "New Year celebration with gold confetti and champagne, festive product photography" },
    { id: "valentines", label: "❤️ Valentine's", prompt: "Valentine's Day romantic setting with roses and hearts, love-themed product photography" },
    { id: "spring_bloom", label: "🌸 Spring Bloom", prompt: "Cherry blossom spring background with soft petals falling, seasonal product photography" },
    { id: "summer_vibes", label: "☀️ Summer Vibes", prompt: "Bright summer poolside setting with tropical drinks, summer product photography" },
    { id: "halloween", label: "🎃 Halloween", prompt: "Spooky Halloween setting with pumpkins and candles, seasonal product photography" },
    { id: "diwali", label: "🪔 Diwali/Festival", prompt: "Festive Diwali/festival background with golden diyas and rangoli, celebration product photography" },
    { id: "thingyan", label: "💧 Thingyan", prompt: "Myanmar Thingyan water festival background with jasmine flowers and golden pagodas, festive product photography" },
    { id: "easter", label: "🐣 Easter Spring", prompt: "Easter spring setting with pastel eggs and fresh flowers, spring product photography" },
    { id: "winter_snow", label: "❄️ Winter Snow", prompt: "Winter wonderland with snowflakes and frost, cold season product photography" },
  ],
  abstract: [
    { id: "gradient_purple", label: "💜 Purple Gradient", prompt: "Smooth gradient background from deep purple to soft pink, modern tech aesthetic, professional studio lighting" },
    { id: "smoke_art", label: "💨 Smoke Art", prompt: "Colorful smoke art swirling in dark background, artistic product photography" },
    { id: "paint_splash", label: "🎨 Paint Splash", prompt: "Dynamic paint splash background with vibrant colors, creative product photography" },
    { id: "geometric_shapes", label: "🔷 Geometric", prompt: "Abstract geometric shapes in muted tones, modern design product photography" },
    { id: "watercolor_wash", label: "🖌️ Watercolor Wash", prompt: "Soft watercolor wash background in pastel colors, artistic product photography" },
    { id: "bokeh_lights", label: "✨ Bokeh Lights", prompt: "Beautiful bokeh light circles on dark background, dreamy product photography" },
    { id: "marble_fluid", label: "🌊 Fluid Marble", prompt: "Fluid marble art with swirling colors, luxury abstract product photography" },
    { id: "paper_texture", label: "📜 Paper Texture", prompt: "Vintage paper texture background with subtle aging, artisan product photography" },
    { id: "linen_fabric", label: "🧵 Linen Fabric", prompt: "Natural linen fabric texture background, organic minimalist product photography" },
    { id: "sand_dune", label: "🏜️ Sand Dune", prompt: "Smooth sand dune curves with warm golden light, artistic product photography" },
  ],
  food: [
    { id: "rustic_board", label: "🪵 Cutting Board", prompt: "Rustic wooden cutting board with herbs scattered, food product photography" },
    { id: "marble_counter", label: "🍳 Marble Counter", prompt: "Clean white marble kitchen counter with fresh ingredients, food product staging" },
    { id: "dark_moody", label: "🌑 Dark & Moody", prompt: "Dark moody food photography background with dramatic side lighting" },
    { id: "bright_airy", label: "☀️ Bright & Airy", prompt: "Bright airy white table setting with natural window light, food product photography" },
    { id: "picnic", label: "🧺 Picnic Setting", prompt: "Outdoor picnic blanket with wicker basket, casual food product photography" },
    { id: "restaurant", label: "🍽️ Fine Dining", prompt: "Elegant restaurant table setting with linen and silverware, fine dining product photography" },
    { id: "bakery", label: "🥖 Bakery Counter", prompt: "Warm bakery counter with flour dusted surface, artisan bread product photography" },
    { id: "farm_table", label: "🌾 Farm Table", prompt: "Rustic farmhouse table with fresh harvest vegetables, farm-to-table product photography" },
    { id: "tea_ceremony", label: "🍵 Tea Setting", prompt: "Elegant tea ceremony setting with ceramics and dried flowers, beverage product photography" },
    { id: "street_food", label: "🍜 Street Food", prompt: "Vibrant street food stall setting with warm lights, casual food product photography" },
  ],
  fashion: [
    { id: "runway", label: "👠 Runway Stage", prompt: "Fashion runway stage with dramatic spotlight, high fashion product photography" },
    { id: "boutique", label: "🛍️ Boutique Display", prompt: "Elegant boutique store display with soft lighting, luxury fashion product photography" },
    { id: "mirror_vanity", label: "💄 Vanity Mirror", prompt: "Hollywood vanity mirror with warm bulb lights, beauty product photography" },
    { id: "silk_drape", label: "🧣 Silk Drape", prompt: "Flowing silk fabric draped elegantly, fashion accessory product photography" },
    { id: "concrete_urban", label: "🏙️ Urban Concrete", prompt: "Raw concrete urban wall with graffiti hints, streetwear product photography" },
    { id: "dressing_room", label: "👗 Dressing Room", prompt: "Elegant dressing room with clothing rack and mirror, fashion product staging" },
    { id: "jewelry_display", label: "💍 Jewelry Display", prompt: "Luxurious jewelry display with velvet cushion and soft spotlighting" },
    { id: "perfume_shelf", label: "🌹 Perfume Shelf", prompt: "Elegant glass shelf with flowers and soft diffused light, perfume product photography" },
    { id: "cosmetics", label: "💅 Cosmetics Counter", prompt: "Clean white cosmetics counter with mirror reflections, beauty product photography" },
    { id: "hat_display", label: "🎩 Hat Display", prompt: "Minimalist hat display on elegant stand, accessory product photography" },
  ],
  outdoor: [
    { id: "mountain_peak", label: "🏔️ Mountain Peak", prompt: "Majestic mountain peak with clouds, adventure product photography" },
    { id: "forest_path", label: "🌲 Forest Path", prompt: "Enchanted forest path with dappled sunlight, outdoor product photography" },
    { id: "sunset_field", label: "🌅 Sunset Field", prompt: "Golden sunset over open field with warm light, outdoor lifestyle product photography" },
    { id: "lake_reflection", label: "🏞️ Lake Mirror", prompt: "Calm lake with perfect mirror reflection, serene outdoor product photography" },
    { id: "desert_landscape", label: "🏜️ Desert", prompt: "Dramatic desert landscape with warm tones, adventure product photography" },
    { id: "waterfall", label: "💧 Waterfall", prompt: "Tropical waterfall with mist and lush greenery, nature product photography" },
    { id: "rooftop_city", label: "🌃 City Rooftop", prompt: "Urban rooftop with city skyline at dusk, modern lifestyle product photography" },
    { id: "garden_path", label: "🌻 Garden Path", prompt: "Beautiful garden path with blooming flowers, outdoor product photography" },
    { id: "campfire", label: "🔥 Campfire", prompt: "Cozy campfire setting in forest clearing, outdoor adventure product photography" },
    { id: "floating_clouds", label: "☁️ Cloud Float", prompt: "Product floating in soft white clouds with blue sky, dreamy surreal product photography" },
  ],
};

export const BgStudioTool = ({ userId, onBack }: BgStudioToolProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("bg_studio", "Background Studio");
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("studio");
  const [selectedBg, setSelectedBg] = useState("clean_white");
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const creditCost = costs.bg_studio || 3;
  const currentTemplates = BG_TEMPLATES[selectedCategory] || [];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "ဖိုင်ကြီးလွန်းပါသည်", description: "10MB အောက် ပုံရွေးပါ", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceImage(event.target?.result as string);
        setResultImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSourceImage(null);
    setResultImage(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!sourceImage || !userId) return;

    if ((credits || 0) < creditCost) {
      toast({ title: "ခရက်ဒစ် မလုံလောက်ပါ", description: `${creditCost} Credit လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setResultImage(null);
    setProgress(0);

    const statuses = ["Background ဖယ်ရှားနေသည်...", "Professional နောက်ခံတွင် ပစ္စည်းထည့်နေသည်...", "အရိပ်နှင့် အလင်းညှိနေသည်...", "အပြီးသတ်နေသည်..."];
    let statusIdx = 0;
    setStatusText(statuses[0]);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95;
        const next = prev + Math.random() * 5;
        const newIdx = Math.min(Math.floor(next / 25), statuses.length - 1);
        if (newIdx !== statusIdx) {
          statusIdx = newIdx;
          setStatusText(statuses[statusIdx]);
        }
        return next;
      });
    }, 500);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "အကောင့်ဝင်ရန်လိုအပ်သည်", variant: "destructive" });
        return;
      }

      const allTemplates = Object.values(BG_TEMPLATES).flat();
      const selectedTemplate = allTemplates.find(t => t.id === selectedBg);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bg-studio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            imageBase64: sourceImage.split(",")[1],
            backgroundPrompt: selectedTemplate?.prompt || "Clean white studio background with professional lighting",
            backgroundId: selectedBg,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Background studio failed");

      setResultImage(result.image);
      setProgress(100);
      refetchCredits();
      saveOutput("image", result.image);

      toast({ title: "အောင်မြင်ပါသည် ✨", description: `နောက်ခံပြောင်းပြီးပါပြီ (${result.creditsUsed} Credit)` });
    } catch (error: any) {
      console.error("BG Studio error:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI Background Studio" subtitle="ပစ္စည်းပုံကို Professional နောက်ခံတွင် ထားပေးခြင်း" onBack={onBack} />
      <FirstOutputGuide toolName="Background Studio" show={showGuide} steps={["ပစ္စည်းပုံ တင်ပါ", "နောက်ခံ ရွေးပါ", "နောက်ခံပြောင်း နှိပ်ပါ"]} />

      {/* Image Upload */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-3 font-myanmar">📸 ပစ္စည်းပုံထည့်ပါ</label>
        {sourceImage ? (
          <div className="relative">
            <img src={sourceImage} alt="Source" className="w-full max-h-48 object-contain rounded-xl border border-primary/30" />
            <button onClick={removeImage} className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-destructive-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={() => imageInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground font-myanmar">ပစ္စည်းပုံထည့်ရန် နှိပ်ပါ</span>
          </button>
        )}
        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </div>

      {/* Background Category Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="flex items-center gap-2 text-sm font-medium text-primary mb-3 font-myanmar">
          <Palette className="w-4 h-4" />
          နောက်ခံ Category ရွေးချယ်ပါ (100+ Styles)
        </label>
        <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setSelectedBg(BG_TEMPLATES[v]?.[0]?.id || ""); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {BG_CATEGORIES.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Background Style Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="text-sm font-medium text-primary mb-3 block font-myanmar">
          🎨 Style ရွေးချယ်ပါ ({currentTemplates.length} ရွေးချယ်စရာ)
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {currentTemplates.map((bg) => (
            <button
              key={bg.id}
              onClick={() => setSelectedBg(bg.id)}
              className={`p-3 rounded-xl text-left transition-all border ${
                selectedBg === bg.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-background/30 hover:bg-primary/5"
              }`}
            >
              <span className="text-sm font-medium block">{bg.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">{statusText}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isLoading || !sourceImage} className="w-full btn-gradient-green py-4 rounded-2xl font-semibold font-myanmar">
        {isLoading ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Professional နောက်ခံ ထည့်နေသည်...</>
        ) : (
          <><Sparkles className="w-5 h-5 mr-2" />နောက်ခံပြောင်းမည် ({creditCost} Credit)</>
        )}
      </Button>

      {/* Result */}
      {resultImage && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="gradient-card rounded-2xl p-4 border border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary font-myanmar">ရလဒ်</h3>
            </div>
            <Button
              onClick={async () => {
                try {
                  const watermarked = await addWatermarkToImage(resultImage, userId || 'unknown');
                  const link = document.createElement("a");
                  link.href = watermarked;
                  link.download = `bg-studio-${Date.now()}.png`;
                  link.click();
                } catch {
                  const link = document.createElement("a");
                  link.href = resultImage;
                  link.download = `bg-studio-${Date.now()}.png`;
                  link.click();
                }
              }}
              size="sm" variant="outline" className="text-xs font-myanmar"
            >
              <Download className="w-3 h-3 mr-1" />Download
            </Button>
          </div>
          <Watermark userId={userId}>
            <img src={resultImage} alt="Result" className="w-full rounded-xl" />
          </Watermark>
        </motion.div>
      )}
    </motion.div>
  );
};
