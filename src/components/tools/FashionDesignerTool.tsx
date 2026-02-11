import { useState } from "react";
import { ArrowLeft, Loader2, Sparkles, Ruler, Palette, Download, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToolHeader } from "@/components/ToolHeader";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useToolOutput } from "@/hooks/useToolOutput";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";

interface FashionDesignerToolProps {
  userId?: string;
  onBack: () => void;
}

const DESIGN_CATEGORIES = [
  { value: "wedding", label: "မင်္ဂလာဆောင်ဝတ်စုံ" },
  { value: "traditional", label: "မြန်မာ့ရိုးရာ/ပါတိတ်" },
  { value: "suit", label: "ကုတ်အင်္ကျီ/Suit" },
  { value: "gown", label: "ညနေခင်းဝတ်စုံ/Gown" },
  { value: "set", label: "ဝမ်းဆက်/Set" },
  { value: "sportswear", label: "အားကစားဝတ်စုံ" },
];

const WEDDING_STYLES = ["Ball Gown", "Mermaid", "A-Line", "Princess", "Sheath"];
const TRADITIONAL_TOPS = ["ရင်ဖုံး", "ရင်စေ့", "ရင်လွဲ"];
const TRADITIONAL_COLLARS = ["Mandarin Collar", "No Collar", "Round Collar"];
const TRADITIONAL_BOTTOMS = ["ပတ်ထဘီ", "အတွင်းစာ", "အနားဂိုက်"];
const SUIT_TYPES = ["Single Breasted", "Double Breasted"];
const LAPEL_TYPES = ["Notch Lapel", "Peak Lapel", "Shawl Lapel"];
const FIT_TYPES = ["Slim Fit", "Regular Fit", "Relaxed Fit"];

const FABRICS = [
  "Silk", "Satin", "Chiffon", "Linen", "Denim", "Tweed", "Leather", "Velvet",
  "Cotton", "Wool", "Cashmere", "Organza", "Tulle", "Lace", "Brocade",
  "Taffeta", "Georgette", "Crepe", "Jersey", "Polyester", "Rayon",
  "Myanmar Acheik Silk", "Myanmar Luntaya", "Myanmar Cotton Longyi",
];

const LIGHTING = ["Golden Hour", "High-Fashion Studio", "Grand Ballroom", "Daylight", "Dramatic Shadow"];
const ETHNICITIES = ["Myanmar", "East Asian", "South Asian", "European", "African", "Latin American"];

export const FashionDesignerTool = ({ userId, onBack }: FashionDesignerToolProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("fashiondesigner", "AI Fashion Designer");

  const [category, setCategory] = useState("");
  const [weddingStyle, setWeddingStyle] = useState("");
  const [traditionalTop, setTraditionalTop] = useState("");
  const [traditionalCollar, setTraditionalCollar] = useState("");
  const [traditionalBottom, setTraditionalBottom] = useState("");
  const [suitType, setSuitType] = useState("");
  const [lapelType, setLapelType] = useState("");
  const [fitType, setFitType] = useState("");
  
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [measurements, setMeasurements] = useState({
    shoulder: "", bust: "", waist: "", hip: "", sleeveLength: "", fullLength: "",
  });
  const [measureUnit, setMeasureUnit] = useState<"inches" | "cm">("inches");

  const [fabric, setFabric] = useState("");
  const [pattern, setPattern] = useState("");
  const [accessories, setAccessories] = useState("");
  const [lighting, setLighting] = useState("High-Fashion Studio");
  const [ethnicity, setEthnicity] = useState("Myanmar");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [marketingImage, setMarketingImage] = useState<string | null>(null);
  const [technicalSketch, setTechnicalSketch] = useState<string | null>(null);

  const creditCost = (costs as any).fashion_designer || 8;

  const isFormValid = () => {
    if (!category || !fabric) return false;
    if (category === "wedding" && !weddingStyle) return false;
    if (category === "traditional" && (!traditionalTop || !traditionalBottom)) return false;
    if (category === "suit" && (!suitType || !fitType)) return false;
    return true;
  };

  const buildPrompt = () => {
    let prompt = `Design Category: ${DESIGN_CATEGORIES.find(c => c.value === category)?.label || category}\n`;
    
    if (category === "wedding") {
      prompt += `Style: ${weddingStyle}\n`;
    } else if (category === "traditional") {
      prompt += `Top Style: ${traditionalTop}\nCollar: ${traditionalCollar}\nBottom: ${traditionalBottom}\n`;
    } else if (category === "suit") {
      prompt += `Type: ${suitType}\nLapel: ${lapelType}\nFit: ${fitType}\n`;
    }

    prompt += `Fabric: ${fabric}\n`;
    if (pattern) prompt += `Pattern/Print: ${pattern}\n`;
    if (accessories) prompt += `Accessories: ${accessories}\n`;
    prompt += `Lighting: ${lighting}\nModel Ethnicity: ${ethnicity}\n`;

    if (showMeasurements) {
      const m = measurements;
      const unit = measureUnit;
      prompt += `\nMeasurements (${unit}):\n`;
      if (m.shoulder) prompt += `Shoulder: ${m.shoulder}${unit}\n`;
      if (m.bust) prompt += `Bust/Chest: ${m.bust}${unit}\n`;
      if (m.waist) prompt += `Waist: ${m.waist}${unit}\n`;
      if (m.hip) prompt += `Hip: ${m.hip}${unit}\n`;
      if (m.sleeveLength) prompt += `Sleeve Length: ${m.sleeveLength}${unit}\n`;
      if (m.fullLength) prompt += `Full Length: ${m.fullLength}${unit}\n`;
    }

    if (additionalNotes) prompt += `\nAdditional Notes: ${additionalNotes}\n`;
    return prompt;
  };

  const handleGenerate = async () => {
    if (!isFormValid()) {
      toast({ title: "အချက်အလက် မပြည့်စုံပါ", description: "လိုအပ်သော field များ ဖြည့်ပါ", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setMarketingImage(null);
    setTechnicalSketch(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Please log in");

      const designPrompt = buildPrompt();

      // Generate marketing image (Output A)
      const marketingPrompt = `Generate a high-resolution 4K photorealistic fashion photography image. A ${ethnicity} model wearing the following outfit:\n${designPrompt}\nThe image should look like a professional fashion magazine photoshoot with ${lighting} lighting. Ultra detailed fabric textures, realistic draping and fit.`;

      const imgRes = await supabase.functions.invoke("generate-image", {
        body: { prompt: marketingPrompt },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (imgRes.error || !imgRes.data?.image) {
        throw new Error(imgRes.data?.error || "Marketing image generation failed");
      }
      setMarketingImage(imgRes.data.image);

      // Generate technical sketch (Output B)  
      const sketchPrompt = `Create a detailed 2D technical flat sketch (front and back view) of this garment design:\n${designPrompt}\nThe sketch should be a clean black and white technical drawing showing construction lines, seams, darts, and stitching details. Professional fashion design flat sketch style suitable for a tailor to follow. Include both FRONT VIEW and BACK VIEW side by side.`;

      const sketchRes = await supabase.functions.invoke("generate-image", {
        body: { prompt: sketchPrompt },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (sketchRes.data?.image) {
        setTechnicalSketch(sketchRes.data.image);
      }

      saveOutput("image", imgRes.data.image);
      toast({ title: "Fashion Pack ဖန်တီးပြီးပါပြီ! 👗", description: "Marketing Image + Technical Sketch" });
    } catch (err: any) {
      console.error("Fashion Designer error:", err);
      toast({ title: "အမှားရှိပါသည်", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <ToolHeader
        title="AI Fashion Designer PRO"
        subtitle="ဖက်ရှင်ဒီဇိုင်း Marketing Image + Technical Sketch"
        onBack={onBack}
      />

      <FirstOutputGuide
        toolName="Fashion Designer"
        show={showGuide}
        steps={[
          "ဒီဇိုင်း အမျိုးအစား ရွေးချယ်ပါ",
          "အထည် အမျိုးအစားနှင့် အသေးစိတ် ဖြည့်ပါ",
          "Generate နှိပ်ပြီး Fashion Pack ရယူပါ",
        ]}
      />

      {/* Category Selection */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <h3 className="text-sm font-semibold text-foreground font-myanmar">📐 ဒီဇိုင်း အမျိုးအစား</h3>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="အမျိုးအစား ရွေးပါ" /></SelectTrigger>
          <SelectContent>
            {DESIGN_CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Conditional Fields */}
        {category === "wedding" && (
          <Select value={weddingStyle} onValueChange={setWeddingStyle}>
            <SelectTrigger><SelectValue placeholder="Wedding Style" /></SelectTrigger>
            <SelectContent>
              {WEDDING_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {category === "traditional" && (
          <div className="space-y-2">
            <Select value={traditionalTop} onValueChange={setTraditionalTop}>
              <SelectTrigger><SelectValue placeholder="အပေါ်ဝတ်စုံ" /></SelectTrigger>
              <SelectContent>
                {TRADITIONAL_TOPS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={traditionalCollar} onValueChange={setTraditionalCollar}>
              <SelectTrigger><SelectValue placeholder="Collar Type" /></SelectTrigger>
              <SelectContent>
                {TRADITIONAL_COLLARS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={traditionalBottom} onValueChange={setTraditionalBottom}>
              <SelectTrigger><SelectValue placeholder="အောက်ပိုင်း" /></SelectTrigger>
              <SelectContent>
                {TRADITIONAL_BOTTOMS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {category === "suit" && (
          <div className="space-y-2">
            <Select value={suitType} onValueChange={setSuitType}>
              <SelectTrigger><SelectValue placeholder="Suit Type" /></SelectTrigger>
              <SelectContent>
                {SUIT_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={lapelType} onValueChange={setLapelType}>
              <SelectTrigger><SelectValue placeholder="Lapel Type" /></SelectTrigger>
              <SelectContent>
                {LAPEL_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fitType} onValueChange={setFitType}>
              <SelectTrigger><SelectValue placeholder="Fit Type" /></SelectTrigger>
              <SelectContent>
                {FIT_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Measurements */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground font-myanmar flex items-center gap-2">
            <Ruler className="w-4 h-4" /> တိုင်းတာချက် ထည့်ရန်
          </h3>
          <Switch checked={showMeasurements} onCheckedChange={setShowMeasurements} />
        </div>

        {showMeasurements && (
          <div className="space-y-2">
            <div className="flex gap-2 mb-2">
              <Button size="sm" variant={measureUnit === "inches" ? "default" : "outline"} onClick={() => setMeasureUnit("inches")}>Inches</Button>
              <Button size="sm" variant={measureUnit === "cm" ? "default" : "outline"} onClick={() => setMeasureUnit("cm")}>CM</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "shoulder", label: "Shoulder" },
                { key: "bust", label: "Bust/Chest" },
                { key: "waist", label: "Waist" },
                { key: "hip", label: "Hip" },
                { key: "sleeveLength", label: "Sleeve Length" },
                { key: "fullLength", label: "Full Length" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] text-muted-foreground">{f.label}</label>
                  <Input
                    type="number"
                    value={measurements[f.key as keyof typeof measurements]}
                    onChange={e => setMeasurements(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={measureUnit}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Texture & Accessories */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <h3 className="text-sm font-semibold text-foreground font-myanmar flex items-center gap-2">
          <Palette className="w-4 h-4" /> အထည်နှင့် အပိုပစ္စည်း
        </h3>
        <Select value={fabric} onValueChange={setFabric}>
          <SelectTrigger><SelectValue placeholder="Fabric Type ရွေးပါ" /></SelectTrigger>
          <SelectContent>
            {FABRICS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          placeholder="Print/Pattern (e.g. Traditional Myanmar Acheik Pattern)"
          className="text-sm"
        />
        <Input
          value={accessories}
          onChange={e => setAccessories(e.target.value)}
          placeholder="Accessories (e.g. Gold Buttons, ကျောက်စီပန်းထိုး)"
          className="text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select value={lighting} onValueChange={setLighting}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIGHTING.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ethnicity} onValueChange={setEthnicity}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ETHNICITIES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={additionalNotes}
          onChange={e => setAdditionalNotes(e.target.value)}
          placeholder="အထူး မှတ်ချက် (optional)"
          rows={2}
          className="text-sm"
        />
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !isFormValid()}
        className="w-full py-6 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-600 to-fuchsia-700 text-white font-semibold text-base"
      >
        {isGenerating ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Fashion Pack ဖန်တီးနေသည်...</>
        ) : (
          <><Sparkles className="w-5 h-5 mr-2" /> Fashion Pack ဖန်တီးမည် ({creditCost} Credits)</>
        )}
      </Button>

      {/* Results */}
      {marketingImage && (
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">🎨 Output A: Marketing Image</h3>
          <img src={marketingImage} alt="Fashion Marketing" className="w-full rounded-xl" />
          <a href={marketingImage} download="fashion-marketing.png" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" /> Download Marketing Image</Button>
          </a>
        </div>
      )}

      {technicalSketch && (
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">📐 Output B: Technical Sketch</h3>
          <img src={technicalSketch} alt="Technical Sketch" className="w-full rounded-xl" />
          <a href={technicalSketch} download="fashion-sketch.png" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" /> Download Technical Sketch</Button>
          </a>
        </div>
      )}
    </div>
  );
};
