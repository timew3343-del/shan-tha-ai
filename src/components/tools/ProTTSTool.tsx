import { useState, useRef } from "react";
import { Loader2, Play, Pause, Download, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

// 30 ElevenLabs voices with gender
const VOICES = [
  // Male
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", gender: "male", style: "Deep & Confident" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male", style: "Warm & Authoritative" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "male", style: "Professional Narrator" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male", style: "Natural & Engaging" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "male", style: "Young & Energetic" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "male", style: "Casual & Friendly" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", gender: "male", style: "Clear & Articulate" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", gender: "male", style: "Calm & Steady" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris", gender: "male", style: "Upbeat & Warm" },
  { id: "bIHbv24MWmeRgasZH58o", name: "Will", gender: "male", style: "Strong & Bold" },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", gender: "male", style: "Classic & Rich" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", gender: "male", style: "Smooth & Gentle" },
  { id: "MDLAMJ0jxkpYkjXbmG4t", name: "Santa", gender: "male", style: "Jolly & Cheerful" },
  { id: "kPtEHAvRnjUJFv7SK9WI", name: "Glitch", gender: "male", style: "Robotic & Futuristic" },
  { id: "h6u4tPKmcPlxUdZOaVpH", name: "The Reindeer", gender: "male", style: "Playful" },
  // Female
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", style: "Warm & Natural" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "female", style: "Elegant & Smooth" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", gender: "female", style: "Soft & Gentle" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "female", style: "Bright & Clear" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "female", style: "Friendly & Conversational" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", style: "Sweet & Melodic" },
  { id: "SAhdygBsjizE9aIj39dz", name: "Mrs Claus", gender: "female", style: "Warm & Cozy" },
  { id: "e79twtVS2278lVZZQiAD", name: "The Elf", gender: "female", style: "Playful & Light" },
  // Additional for diversity
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "female", style: "American Accent" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", gender: "female", style: "Strong & Bold" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: "female", style: "Soft & Warm" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Emily", gender: "female", style: "Youthful & Fresh" },
  { id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy", gender: "female", style: "British Elegant" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", gender: "male", style: "Deep & Commanding" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "male", style: "American Male" },
];

// 20 languages supported by ElevenLabs Multilingual v2
const LANGUAGES = [
  { value: "Myanmar (Burmese)", label: "🇲🇲 မြန်မာ", code: "my" },
  { value: "English", label: "🇬🇧 English", code: "en" },
  { value: "Thai", label: "🇹🇭 Thai", code: "th" },
  { value: "Chinese", label: "🇨🇳 Chinese", code: "zh" },
  { value: "Japanese", label: "🇯🇵 Japanese", code: "ja" },
  { value: "Korean", label: "🇰🇷 Korean", code: "ko" },
  { value: "Hindi", label: "🇮🇳 Hindi", code: "hi" },
  { value: "Spanish", label: "🇪🇸 Spanish", code: "es" },
  { value: "French", label: "🇫🇷 French", code: "fr" },
  { value: "German", label: "🇩🇪 German", code: "de" },
  { value: "Italian", label: "🇮🇹 Italian", code: "it" },
  { value: "Portuguese", label: "🇵🇹 Portuguese", code: "pt" },
  { value: "Russian", label: "🇷🇺 Russian", code: "ru" },
  { value: "Arabic", label: "🇸🇦 Arabic", code: "ar" },
  { value: "Turkish", label: "🇹🇷 Turkish", code: "tr" },
  { value: "Vietnamese", label: "🇻🇳 Vietnamese", code: "vi" },
  { value: "Indonesian", label: "🇮🇩 Indonesian", code: "id" },
  { value: "Filipino", label: "🇵🇭 Filipino", code: "fil" },
  { value: "Polish", label: "🇵🇱 Polish", code: "pl" },
  { value: "Dutch", label: "🇳🇱 Dutch", code: "nl" },
];

export const ProTTSTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("pro_tts", "Pro Text to Speech");

  const [text, setText] = useState("");
  const [language, setLanguage] = useState("Myanmar (Burmese)");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [voiceId, setVoiceId] = useState("EXAVITQu4vr4xnSDxMaL");
  const [speed, setSpeed] = useState(1.0);
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cost = costs.pro_tts || 7;
  const filteredVoices = VOICES.filter(v => v.gender === gender);

  const handleGenerate = async () => {
    if (!userId || !text.trim()) return;
    setIsLoading(true);
    setAudioUrl(null);
    setTranslatedText(null);

    try {
      const { data, error } = await supabase.functions.invoke("pro-tts", {
        body: { text: text.trim(), voiceId, language, speed, stability, similarityBoost },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const audioDataUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
      setAudioUrl(audioDataUrl);
      if (data.translatedText) setTranslatedText(data.translatedText);
      refetch();
      // Save with translated text for history
      const contentForHistory = data.translatedText 
        ? `[${language}] ${data.translatedText}` 
        : text.substring(0, 200);
      saveOutput("audio", contentForHistory);
      toast({ title: "အသံထွက်ပြီးပါပြီ!", description: `${data.creditsUsed} Cr သုံးခဲ့သည်` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `pro-tts-${Date.now()}.mp3`;
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="Pro Text to Speech" subtitle="ElevenLabs Multilingual v2 | 30 အသံ | 20 ဘာသာစကား" onBack={onBack} />
      {showGuide && <FirstOutputGuide toolName="Pro Text to Speech" steps={["စာသားရိုက်ထည့်ပါ", "ဘာသာစကားနှင့် အသံရွေးပါ", "အသံထွက်မည် ခလုတ်နှိပ်ပါ"]} show={showGuide} />}

      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4">
        {/* Text Input */}
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">စာသားရိုက်ထည့်ပါ (အများဆုံး 5000 လုံး)</label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="ဒီနေရာမှာ စာရိုက်ထည့်ပါ..." className="mt-1 min-h-[100px] font-myanmar" maxLength={5000} />
          <p className="text-[10px] text-muted-foreground text-right mt-1">{text.length}/5000</p>
        </div>

        {/* Language */}
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">Target ဘာသာစကား</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(l => <SelectItem key={l.code} value={l.value}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Auto Translate Info */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <span className="text-[10px]">✨</span>
          <p className="text-[10px] text-muted-foreground font-myanmar">Gemini ဖြင့် ရွေးထားသော ဘာသာစကားသို့ အလိုအလျောက် ဘာသာပြန်ပေးပါမည်</p>
        </div>

        {/* Gender */}
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">အသံ အမျိုးအစား</label>
          <div className="flex gap-2 mt-1">
            <Button variant={gender === "male" ? "default" : "outline"} size="sm" onClick={() => { setGender("male"); setVoiceId(VOICES.find(v => v.gender === "male")?.id || ""); }} className="flex-1">👨 အမျိုးသား</Button>
            <Button variant={gender === "female" ? "default" : "outline"} size="sm" onClick={() => { setGender("female"); setVoiceId("EXAVITQu4vr4xnSDxMaL"); }} className="flex-1">👩 အမျိုးသမီး</Button>
          </div>
        </div>

        {/* Voice Selection */}
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">အသံရွေးချယ်ပါ ({filteredVoices.length} မျိုး)</label>
          <Select value={voiceId} onValueChange={setVoiceId}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {filteredVoices.map(v => (
                <SelectItem key={v.id + v.name} value={v.id}>
                  {v.name} — <span className="text-muted-foreground text-xs">{v.style}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Speed Slider */}
        <div>
          <div className="flex justify-between items-center">
            <label className="text-xs text-muted-foreground font-myanmar">အသံနှုန်း (Speed)</label>
            <span className="text-xs font-medium text-primary">{speed.toFixed(1)}x</span>
          </div>
          <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={0.5} max={2.0} step={0.1} className="mt-2" />
        </div>

        {/* Stability */}
        <div>
          <div className="flex justify-between items-center">
            <label className="text-xs text-muted-foreground font-myanmar">Stability (တည်ငြိမ်မှု)</label>
            <span className="text-xs font-medium text-primary">{(stability * 100).toFixed(0)}%</span>
          </div>
          <Slider value={[stability]} onValueChange={([v]) => setStability(v)} min={0} max={1} step={0.05} className="mt-2" />
        </div>

        {/* Similarity Boost */}
        <div>
          <div className="flex justify-between items-center">
            <label className="text-xs text-muted-foreground font-myanmar">Clarity (ကြည်လင်မှု)</label>
            <span className="text-xs font-medium text-primary">{(similarityBoost * 100).toFixed(0)}%</span>
          </div>
          <Slider value={[similarityBoost]} onValueChange={([v]) => setSimilarityBoost(v)} min={0} max={1} step={0.05} className="mt-2" />
        </div>
      </div>

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isLoading || !text.trim() || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />အသံထွက်နေသည်...</> : <><Volume2 className="w-4 h-4 mr-2" />အသံထွက်မည် ({cost} Cr)</>}
      </Button>

      {/* Output */}
      {audioUrl && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          {translatedText && (
            <div className="p-3 rounded-xl bg-secondary/50">
              <p className="text-[10px] text-muted-foreground font-myanmar mb-1">ဘာသာပြန်ထားသော စာသား</p>
              <p className="text-sm">{translatedText}</p>
            </div>
          )}

          <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} />

          <div className="flex gap-2">
            <Button onClick={togglePlayback} variant="outline" className="flex-1">
              {isPlaying ? <><Pause className="w-4 h-4 mr-2" />ခဏရပ်</> : <><Play className="w-4 h-4 mr-2" />နားထောင်မည်</>}
            </Button>
            <Button onClick={handleDownload} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />Download
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
