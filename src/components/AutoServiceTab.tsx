import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import {
  Zap, Globe, Sparkles, Video, Send, MessageCircle,
  ChevronDown, Loader2, Download, Play,
  Type, Image, Film, Subtitles, Shield, Mic,
  Square, RectangleHorizontal, RectangleVertical,
  Upload, HelpCircle, CheckCircle, XCircle, RefreshCw, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AutoServiceTabProps {
  userId?: string;
}

const LANGUAGES = [
  "Myanmar", "English", "Thai", "Chinese (Simplified)", "Chinese (Traditional)",
  "Japanese", "Korean", "Hindi", "Vietnamese", "Indonesian", "Malay",
  "Filipino", "Khmer", "Lao", "Bengali", "Tamil", "Telugu", "Urdu",
  "Arabic", "Persian", "Turkish", "Russian", "Ukrainian", "Polish",
  "German", "French", "Spanish", "Portuguese", "Italian", "Dutch",
  "Swedish", "Norwegian", "Danish", "Finnish", "Greek", "Czech",
  "Romanian", "Hungarian", "Bulgarian", "Croatian", "Serbian",
  "Slovak", "Slovenian", "Estonian", "Latvian", "Lithuanian",
  "Hebrew", "Swahili", "Amharic", "Nepali", "Sinhala", "Georgian",
];

const TEMPLATE_CATEGORIES = [
  { id: "motivational", name: "Motivational Quotes", nameMyanmar: "စိတ်ဓာတ်တက်ကြွစေသော စကားများ", icon: "💪" },
  { id: "buddhist_dhamma", name: "Buddhist Dhamma", nameMyanmar: "ဗုဒ္ဓဓမ္မ တရားတော်များ", icon: "🙏" },
  { id: "daily_news", name: "Daily News Summary", nameMyanmar: "နေ့စဉ် သတင်းအကျဉ်းချုပ်", icon: "📰" },
  { id: "financial_tips", name: "Financial Tips", nameMyanmar: "ငွေကြေးစီမံခန့်ခွဲမှု အကြံပြုချက်", icon: "💰" },
  { id: "health_advice", name: "Health & Wellness", nameMyanmar: "ကျန်းမာရေး အကြံပြုချက်", icon: "🏥" },
  { id: "historical_facts", name: "Historical Facts", nameMyanmar: "သမိုင်းဝင် အချက်အလက်များ", icon: "📚" },
  { id: "science_tech", name: "Science & Technology", nameMyanmar: "သိပ္ပံနှင့် နည်းပညာ", icon: "🔬" },
  { id: "cooking_recipes", name: "Cooking & Recipes", nameMyanmar: "ဟင်းချက်နည်းများ", icon: "🍳" },
  { id: "travel_explore", name: "Travel & Exploration", nameMyanmar: "ခရီးသွား မှတ်တမ်းများ", icon: "✈️" },
  { id: "life_hacks", name: "Life Hacks", nameMyanmar: "ဘဝတွင် အသုံးဝင်သော နည်းလမ်းများ", icon: "💡" },
  { id: "love_relationships", name: "Love & Relationships", nameMyanmar: "အချစ်နှင့် ဆက်ဆံရေး", icon: "❤️" },
  { id: "parenting", name: "Parenting Tips", nameMyanmar: "ကလေးပြုစုပျိုးထောင်ရေး", icon: "👶" },
  { id: "meditation", name: "Meditation & Mindfulness", nameMyanmar: "တရားအားထုတ်ခြင်း", icon: "🧘" },
  { id: "business_startup", name: "Business & Startup", nameMyanmar: "စီးပွားရေးနှင့် Startup", icon: "🚀" },
  { id: "self_improvement", name: "Self Improvement", nameMyanmar: "ကိုယ့်ကိုယ်ကို တိုးတက်အောင်", icon: "📈" },
  { id: "psychology", name: "Psychology Facts", nameMyanmar: "စိတ်ပညာ အချက်အလက်", icon: "🧠" },
  { id: "humor_comedy", name: "Humor & Comedy", nameMyanmar: "ဟာသနှင့် ရယ်စရာများ", icon: "😂" },
  { id: "sports", name: "Sports Updates", nameMyanmar: "အားကစား သတင်းများ", icon: "⚽" },
  { id: "music_culture", name: "Music & Culture", nameMyanmar: "ဂီတနှင့် ယဉ်ကျေးမှု", icon: "🎵" },
  { id: "environment", name: "Environment & Nature", nameMyanmar: "သဘာဝပတ်ဝန်းကျင်", icon: "🌿" },
  { id: "astronomy", name: "Astronomy & Space", nameMyanmar: "နက္ခတ္တဗေဒနှင့် အာကာသ", icon: "🌌" },
  { id: "philosophy", name: "Philosophy", nameMyanmar: "ဒဿနိက", icon: "🤔" },
  { id: "animal_facts", name: "Animal Facts", nameMyanmar: "တိရိစ္ဆာန် အချက်အလက်", icon: "🐾" },
  { id: "art_creativity", name: "Art & Creativity", nameMyanmar: "အနုပညာနှင့် ဖန်တီးမှု", icon: "🎨" },
  { id: "technology_ai", name: "AI & Technology Trends", nameMyanmar: "AI နှင့် နည်းပညာ ခေတ်ရေစီး", icon: "🤖" },
  { id: "education", name: "Education Tips", nameMyanmar: "ပညာရေး အကြံပြုချက်", icon: "🎓" },
  { id: "movie_review", name: "Movie & Series Review", nameMyanmar: "ရုပ်ရှင်နှင့် စီးရီးသုံးသပ်ချက်", icon: "🎬" },
  { id: "crypto_blockchain", name: "Crypto & Blockchain", nameMyanmar: "Crypto နှင့် Blockchain", icon: "₿" },
  { id: "career_advice", name: "Career Advice", nameMyanmar: "အလုပ်အကိုင် အကြံပြုချက်", icon: "👔" },
  { id: "productivity", name: "Productivity Hacks", nameMyanmar: "ထိရောက်မှု မြှင့်တင်ရေး", icon: "⏰" },
  { id: "fashion_beauty", name: "Fashion & Beauty", nameMyanmar: "ဖက်ရှင်နှင့် အလှအပ", icon: "👗" },
  { id: "real_estate", name: "Real Estate Tips", nameMyanmar: "အိမ်ခြံမြေ အကြံပြုချက်", icon: "🏠" },
  { id: "gardening", name: "Gardening & Plants", nameMyanmar: "ဥယျာဉ်စိုက်ပျိုးခြင်း", icon: "🌱" },
  { id: "pet_care", name: "Pet Care", nameMyanmar: "အိမ်မွေးတိရိစ္ဆာန် ပြုစုခြင်း", icon: "🐕" },
  { id: "diy_crafts", name: "DIY & Crafts", nameMyanmar: "ကိုယ်တိုင်ပြုလုပ်ခြင်း", icon: "🔨" },
  { id: "automobile", name: "Automobile & Cars", nameMyanmar: "ကားနှင့် မော်တော်ယာဉ်", icon: "🚗" },
  { id: "gaming", name: "Gaming News", nameMyanmar: "ဂိမ်း သတင်းများ", icon: "🎮" },
  { id: "social_media", name: "Social Media Tips", nameMyanmar: "Social Media အကြံပြုချက်", icon: "📱" },
  { id: "language_learning", name: "Language Learning", nameMyanmar: "ဘာသာစကား သင်ယူခြင်း", icon: "🗣️" },
  { id: "book_summary", name: "Book Summaries", nameMyanmar: "စာအုပ် အကျဉ်းချုပ်", icon: "📖" },
  { id: "sleep_wellness", name: "Sleep & Wellness", nameMyanmar: "အိပ်ရေးနှင့် ကျန်းမာရေး", icon: "😴" },
  { id: "yoga_fitness", name: "Yoga & Fitness", nameMyanmar: "ယောဂနှင့် ကိုယ်ကာယကျန်းမာရေး", icon: "🧘‍♂️" },
  { id: "astrology_zodiac", name: "Astrology & Zodiac", nameMyanmar: "ဟောစာတမ်းနှင့် ရာသီခွင်", icon: "♈" },
  { id: "world_records", name: "World Records", nameMyanmar: "ကမ္ဘာ့စံချိန်များ", icon: "🏆" },
  { id: "mystery_unsolved", name: "Mystery & Unsolved", nameMyanmar: "ပဟေဠိနှင့် မပြေလည်သေးသော ကိစ္စများ", icon: "🔍" },
  { id: "quotes_wisdom", name: "Quotes & Wisdom", nameMyanmar: "အဆိုအမိန့်နှင့် ပညာ", icon: "📝" },
  { id: "economics", name: "Economics Explained", nameMyanmar: "စီးပွားရေးပညာ ရှင်းလင်းချက်", icon: "📊" },
  { id: "festivals_events", name: "Festivals & Events", nameMyanmar: "ပွဲတော်နှင့် အခမ်းအနားများ", icon: "🎉" },
  { id: "photography", name: "Photography Tips", nameMyanmar: "ဓာတ်ပုံ ရိုက်ကူးနည်း", icon: "📸" },
  { id: "volunteer_charity", name: "Volunteer & Charity", nameMyanmar: "စေတနာ့ဝန်ထမ်းနှင့် ပရဟိတ", icon: "🤝" },
];

const VOICE_STYLES = [
  "Professional", "Casual", "Energetic", "Calm", "Dramatic", "Friendly",
  "Authoritative", "Warm", "Inspiring", "Storytelling", "News Anchor",
  "Teacher", "Coach", "Narrator", "Whispery", "Confident", "Empathetic",
  "Humorous", "Serious", "Meditative", "Cheerful", "Mysterious",
  "Documentary", "Promotional", "Conversational", "Formal", "Youthful",
  "Elderly Wise", "Excited", "Soothing", "Robotic", "Natural",
  "Passionate", "Gentle", "Bold", "Poetic", "Rhythmic", "Upbeat",
  "Melancholic", "Adventurous", "Scholarly", "Playful", "Reverent",
  "Cinematic", "Podcast", "Radio DJ", "Audiobook", "ASMR",
  "Motivational Speaker", "Stand-up Comedy",
];

const VOICE_TONES = [
  "Deep Male", "Mid Male", "High Male", "Deep Female", "Mid Female",
  "High Female", "Child Male", "Child Female", "Elderly Male", "Elderly Female",
  "Baritone", "Tenor", "Alto", "Soprano", "Bass", "Contralto",
  "Soft Spoken", "Loud & Clear", "Raspy", "Smooth", "Bright",
  "Dark", "Nasal", "Breathy", "Crisp", "Rich", "Thin",
  "Warm & Deep", "Cool & Clear", "Husky", "Velvety", "Sharp",
  "Mellow", "Resonant", "Silvery", "Gravelly", "Musical",
  "Monotone", "Dynamic Range", "Whispery Low", "Powerful High",
  "Gentle Mid", "Commanding", "Intimate", "Theatrical",
  "Broadcast Quality", "Lo-Fi", "Crystal Clear", "Vintage Radio",
  "Modern Podcast", "Cinema Trailer",
];

const LOGO_POSITIONS = [
  { id: "top-left", label: "Top-Left" },
  { id: "top-right", label: "Top-Right" },
  { id: "bottom-left", label: "Bottom-Left" },
  { id: "bottom-right", label: "Bottom-Right" },
];

export const AutoServiceTab = ({ userId }: AutoServiceTabProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { costs } = useCreditCosts();

  // Mode: template vs custom
  const [mode, setMode] = useState<"template" | "custom">("template");

  // Shared settings
  const [selectedLanguage, setSelectedLanguage] = useState("Myanmar");
  const [durationMinutes, setDurationMinutes] = useState(1);

  // Template mode
  const [selectedTemplate, setSelectedTemplate] = useState("motivational");

  // Custom mode
  const [customPrompt, setCustomPrompt] = useState("");
  const [promptChat, setPromptChat] = useState<{ role: string; content: string }[]>([]);
  const [promptChatInput, setPromptChatInput] = useState("");
  const [isPromptChatting, setIsPromptChatting] = useState(false);
  const [showPromptHelper, setShowPromptHelper] = useState(false);

  // Advanced toggles
  const [showPlatformSize, setShowPlatformSize] = useState(false);
  const [platformSize, setPlatformSize] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState("Professional");
  const [voiceTone, setVoiceTone] = useState("Mid Male");
  const [copyrightEnabled, setCopyrightEnabled] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [logoEnabled, setLogoEnabled] = useState(false);
  const [logoPosition, setLogoPosition] = useState("bottom-right");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [introOutroEnabled, setIntroOutroEnabled] = useState(false);
  const [introFile, setIntroFile] = useState<File | null>(null);
  const [outroFile, setOutroFile] = useState<File | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subtitleLanguage, setSubtitleLanguage] = useState("Myanmar");

  // Output
  const [videos, setVideos] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Support
  const [supportMessage, setSupportMessage] = useState("");
  const [supportChat, setSupportChat] = useState<{ role: string; content: string }[]>([]);
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const introInputRef = useRef<HTMLInputElement>(null);
  const outroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userId) fetchVideos();
  }, [userId]);

  const fetchVideos = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("auto_service_videos")
      .select("*")
      .eq("user_id", userId)
      .order("generated_date", { ascending: false })
      .limit(30);
    if (data) setVideos(data);
  };

  // Dynamic credit calculation
  const calculateCredits = () => {
    const baseCostPerMin = costs.video_generation || 10;
    let total = baseCostPerMin * durationMinutes;
    if (voiceEnabled) total += (costs.text_to_speech || 3) * durationMinutes;
    if (subtitlesEnabled) total += (costs.caption_per_minute || 8) * durationMinutes;
    if (copyrightEnabled) total += costs.copyright_check || 4;
    if (logoEnabled) total += 2;
    if (watermarkEnabled) total += 1;
    if (introOutroEnabled) total += 5;
    // 20% discount for auto-service
    total = Math.ceil(total * 0.8);
    return total;
  };

  const totalCredits = calculateCredits();

  const handleGenerate = async () => {
    if (!userId) return;
    if (mode === "custom" && !customPrompt.trim()) {
      toast({ title: "Prompt ထည့်ပါ", description: "ဗီဒီယို အကြောင်းအရာ ရေးပါ", variant: "destructive" });
      return;
    }
    if (credits < totalCredits) {
      toast({ title: "Credits မလုံလောက်ပါ", description: `${totalCredits} Credits လိုအပ်ပါသည်`, variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      // Deduct credits
      const { data: deductResult, error: deductError } = await supabase.rpc("deduct_user_credits", {
        _user_id: userId, _amount: totalCredits, _action: "auto_service_video",
      });
      if (deductError) throw deductError;
      const result = deductResult as any;
      if (!result?.success) throw new Error(result?.error || "Credit deduction failed");

      // Save video record
      const templateObj = TEMPLATE_CATEGORIES.find(t => t.id === selectedTemplate);
      const title = mode === "template"
        ? `${templateObj?.name || selectedTemplate} - ${new Date().toLocaleDateString()}`
        : `Custom Video - ${new Date().toLocaleDateString()}`;

      await supabase.from("auto_service_videos").insert({
        user_id: userId,
        title,
        template_category: mode === "template" ? selectedTemplate : "custom",
        target_language: selectedLanguage,
        generation_status: "pending",
        description: mode === "custom" ? customPrompt : undefined,
      });

      toast({ title: "🎬 ဗီဒီယို ဖန်တီးနေပါသည်", description: `${totalCredits} Credits သုံးစွဲပါပြီ` });
      refetchCredits();
      fetchVideos();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // Prompt helper chatbot
  const handlePromptChat = async () => {
    if (!promptChatInput.trim() || !userId) return;
    const userMsg = promptChatInput.trim();
    setPromptChat(prev => [...prev, { role: "user", content: userMsg }]);
    setPromptChatInput("");
    setIsPromptChatting(true);

    try {
      const { data, error } = await supabase.functions.invoke("auto-service-preview", {
        body: {
          userId,
          language: selectedLanguage,
          templateCategory: "custom",
          customPrompt: `User wants help writing a video prompt. Their message: "${userMsg}". Help them write a clear, specific video prompt. Explain what kind of video would result. If the prompt is good, say they can copy it. Respond in Myanmar language.`,
        },
      });
      if (error) throw error;
      setPromptChat(prev => [...prev, { role: "assistant", content: data?.preview || "ထပ်ကြိုးစားပါ" }]);
    } catch {
      setPromptChat(prev => [...prev, { role: "assistant", content: "ဆာဗာ ချိတ်ဆက်မှု မအောင်မြင်ပါ" }]);
    } finally {
      setIsPromptChatting(false);
    }
  };

  // Support chat
  const handleSupportChat = async () => {
    if (!supportMessage.trim() || !userId) return;
    const userMsg = supportMessage.trim();
    setSupportChat(prev => [...prev, { role: "user", content: userMsg }]);
    setSupportMessage("");
    setIsSendingSupport(true);

    try {
      const { data, error } = await supabase.functions.invoke("auto-service-support", {
        body: { userId, message: userMsg },
      });
      if (error) throw error;
      setSupportChat(prev => [...prev, { role: "assistant", content: data?.response || "ဆက်သွယ်ပေးပါမည်" }]);
      if (data?.escalated) {
        toast({ title: "📨 Owner ဆီသို့ ပေးပို့ထားပါသည်" });
      }
    } catch {
      setSupportChat(prev => [...prev, { role: "assistant", content: "ချိတ်ဆက်မှု မအောင်မြင်ပါ" }]);
    } finally {
      setIsSendingSupport(false);
    }
  };

  const selectedTemplateObj = TEMPLATE_CATEGORIES.find(t => t.id === selectedTemplate);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-primary animate-pulse" />
          <h1 className="text-xl font-bold text-primary">Auto Daily Video</h1>
        </div>
        <p className="text-xs text-muted-foreground font-myanmar">
          နေ့စဉ် AI ဗီဒီယို အလိုအလျောက် ဖန်တီးပေးခြင်း
        </p>
      </div>

      {/* Language Selection */}
      <Card className="p-3 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Target Language</span>
        </div>
        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-60">
            {LANGUAGES.map(lang => <SelectItem key={lang} value={lang}>{lang}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      {/* Mode Toggle */}
      <Card className="p-3 border-border/50 bg-card/60">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("template")}
            className={`p-3 rounded-xl text-center transition-all border ${
              mode === "template"
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border/30 bg-secondary/20 hover:bg-secondary/40"
            }`}
          >
            <Sparkles className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-bold">Template သုံးမည်</p>
            <p className="text-[9px] text-muted-foreground">Daily Themes</p>
          </button>
          <button
            onClick={() => setMode("custom")}
            className={`p-3 rounded-xl text-center transition-all border ${
              mode === "custom"
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border/30 bg-secondary/20 hover:bg-secondary/40"
            }`}
          >
            <Type className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-bold">ကိုယ်တိုင် Input</p>
            <p className="text-[9px] text-muted-foreground">ထည့်မည်</p>
          </button>
        </div>
      </Card>

      {/* Template Mode */}
      <AnimatePresence mode="wait">
        {mode === "template" && (
          <motion.div key="template" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="p-3 border-border/50 bg-card/60">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">Daily Theme</span>
                <span className="text-[10px] text-muted-foreground font-myanmar">နေ့စဉ် အကြောင်းအရာ</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {TEMPLATE_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedTemplate(cat.id)}
                    className={`flex items-start gap-1.5 p-2 rounded-lg text-left transition-all border ${
                      selectedTemplate === cat.id
                        ? "border-primary bg-primary/10"
                        : "border-border/20 hover:bg-secondary/30"
                    }`}>
                    <span className="text-sm">{cat.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold truncate">{cat.name}</p>
                      <p className="text-[8px] text-muted-foreground font-myanmar truncate">{cat.nameMyanmar}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Custom Input Mode */}
        {mode === "custom" && (
          <motion.div key="custom" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            <Card className="p-3 border-border/50 bg-card/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">Prompt Box</span>
                <Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1" onClick={() => setShowPromptHelper(!showPromptHelper)}>
                  <HelpCircle className="w-3 h-3" />
                  ရေးနည်းမသိလျှင်
                </Button>
              </div>
              <Textarea
                placeholder="ဗီဒီယို အကြောင်းအရာကို ဤနေရာတွင် ရေးပါ..."
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                className="text-xs min-h-[80px] resize-none"
              />
            </Card>

            {/* Prompt Helper Chatbot */}
            <AnimatePresence>
              {showPromptHelper && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <Card className="p-3 border-primary/30 bg-primary/5">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-bold">Smart Prompt Assistant</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 mb-2">
                      {promptChat.length === 0 && (
                        <p className="text-[9px] text-muted-foreground text-center py-3 font-myanmar">
                          ဘယ်လို ဗီဒီယို ဖန်တီးချင်သလဲ ပြောပြပါ။ AI က Prompt ရေးပေးပါမည်။
                        </p>
                      )}
                      {promptChat.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[10px] ${
                            msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                          }`}>
                            <p className="font-myanmar whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      {isPromptChatting && (
                        <div className="flex justify-start">
                          <div className="bg-secondary rounded-lg px-2.5 py-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Input placeholder="ဘယ်လို ဗီဒီယို လိုချင်လဲ..."
                        value={promptChatInput} onChange={e => setPromptChatInput(e.target.value)}
                        className="text-[10px] h-8"
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handlePromptChat(); } }}
                      />
                      <Button size="icon" className="h-8 w-8 shrink-0" onClick={handlePromptChat} disabled={isPromptChatting || !promptChatInput.trim()}>
                        <Send className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duration Slider */}
      <Card className="p-3 border-border/50 bg-card/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">Duration</span>
          </div>
          <Badge variant="secondary" className="text-xs">{durationMinutes} min</Badge>
        </div>
        <Slider
          value={[durationMinutes]}
          onValueChange={v => setDurationMinutes(v[0])}
          min={1} max={30} step={1}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
          <span>1 min</span><span>15 min</span><span>30 min</span>
        </div>
      </Card>

      {/* Advanced Feature Toggles */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground px-1">Advanced Features</p>

        {/* Platform Size */}
        <Collapsible open={showPlatformSize} onOpenChange={setShowPlatformSize}>
          <Card className="border-border/50 bg-card/60 overflow-hidden">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3">
              <div className="flex items-center gap-2">
                <RectangleHorizontal className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold">Platform Size</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px]">{platformSize}</Badge>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPlatformSize ? "rotate-180" : ""}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 flex gap-2">
                {(["16:9", "9:16", "1:1"] as const).map(size => (
                  <button key={size} onClick={() => setPlatformSize(size)}
                    className={`flex-1 p-2 rounded-lg border text-center transition-all ${
                      platformSize === size ? "border-primary bg-primary/10" : "border-border/30 hover:bg-secondary/30"
                    }`}>
                    <div className="flex justify-center mb-1">
                      {size === "16:9" && <RectangleHorizontal className="w-5 h-3 text-primary" />}
                      {size === "9:16" && <RectangleVertical className="w-3 h-5 text-primary" />}
                      {size === "1:1" && <Square className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[10px] font-bold">{size}</p>
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Voice & Style */}
        <Card className="p-3 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold">Voice & Style</span>
              <span className="text-[9px] text-muted-foreground">+{costs.text_to_speech || 3}/min</span>
            </div>
            <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
          </div>
          {voiceEnabled && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-muted-foreground mb-1 block">Voice Style</label>
                <Select value={voiceStyle} onValueChange={setVoiceStyle}>
                  <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-48">
                    {VOICE_STYLES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground mb-1 block">Tone</label>
                <Select value={voiceTone} onValueChange={setVoiceTone}>
                  <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-48">
                    {VOICE_TONES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </Card>

        {/* Copyright Protection */}
        <Card className="p-3 border-border/50 bg-card/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold">Copyright Protection</span>
              <span className="text-[9px] text-muted-foreground">+{costs.copyright_check || 4}</span>
            </div>
            <Switch checked={copyrightEnabled} onCheckedChange={setCopyrightEnabled} />
          </div>
        </Card>

        {/* Watermark Text */}
        <Card className="p-3 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold">Watermark Text</span>
              <span className="text-[9px] text-muted-foreground">+1</span>
            </div>
            <Switch checked={watermarkEnabled} onCheckedChange={setWatermarkEnabled} />
          </div>
          {watermarkEnabled && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Input placeholder="Watermark text ထည့်ပါ..." value={watermarkText}
                onChange={e => setWatermarkText(e.target.value)} className="text-xs h-8" />
            </motion.div>
          )}
        </Card>

        {/* Image Logo */}
        <Card className="p-3 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold">Image Logo</span>
              <span className="text-[9px] text-muted-foreground">+2</span>
            </div>
            <Switch checked={logoEnabled} onCheckedChange={setLogoEnabled} />
          </div>
          {logoEnabled && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => setLogoFile(e.target.files?.[0] || null)} />
              <Button variant="outline" size="sm" className="w-full text-[10px] h-8" onClick={() => logoInputRef.current?.click()}>
                <Upload className="w-3 h-3 mr-1" />
                {logoFile ? logoFile.name : "Logo Upload"}
              </Button>
              <div className="grid grid-cols-4 gap-1">
                {LOGO_POSITIONS.map(pos => (
                  <button key={pos.id} onClick={() => setLogoPosition(pos.id)}
                    className={`py-1.5 rounded text-[9px] border transition-all ${
                      logoPosition === pos.id ? "border-primary bg-primary/10 font-bold" : "border-border/30"
                    }`}>{pos.label}</button>
                ))}
              </div>
            </motion.div>
          )}
        </Card>

        {/* Intro/Outro */}
        <Card className="p-3 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold">Intro / Outro</span>
              <span className="text-[9px] text-muted-foreground">+5</span>
            </div>
            <Switch checked={introOutroEnabled} onCheckedChange={setIntroOutroEnabled} />
          </div>
          {introOutroEnabled && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-2">
              <div>
                <input ref={introInputRef} type="file" accept="video/*" className="hidden"
                  onChange={e => setIntroFile(e.target.files?.[0] || null)} />
                <Button variant="outline" size="sm" className="w-full text-[9px] h-8" onClick={() => introInputRef.current?.click()}>
                  <Upload className="w-3 h-3 mr-1" />
                  {introFile ? "✅ Intro" : "Intro Upload"}
                </Button>
              </div>
              <div>
                <input ref={outroInputRef} type="file" accept="video/*" className="hidden"
                  onChange={e => setOutroFile(e.target.files?.[0] || null)} />
                <Button variant="outline" size="sm" className="w-full text-[9px] h-8" onClick={() => outroInputRef.current?.click()}>
                  <Upload className="w-3 h-3 mr-1" />
                  {outroFile ? "✅ Outro" : "Outro Upload"}
                </Button>
              </div>
            </motion.div>
          )}
        </Card>

        {/* Subtitles */}
        <Card className="p-3 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Subtitles className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold">Subtitles</span>
              <span className="text-[9px] text-muted-foreground">+{costs.caption_per_minute || 8}/min</span>
            </div>
            <Switch checked={subtitlesEnabled} onCheckedChange={setSubtitlesEnabled} />
          </div>
          {subtitlesEnabled && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Select value={subtitleLanguage} onValueChange={setSubtitleLanguage}>
                <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-48">
                  {LANGUAGES.map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[8px] text-muted-foreground mt-1 font-myanmar">
                ⚠️ သတ်ပုံ 100% စစ်ဆေးထားပါသည် (AI Spellcheck)
              </p>
            </motion.div>
          )}
        </Card>
      </div>

      {/* Credit Summary & Generate */}
      <Card className="p-4 border-primary/30 bg-primary/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold">Total Credits</p>
            <p className="text-[9px] text-muted-foreground font-myanmar">20% Auto Service discount ပါဝင်ပါသည်</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-primary">{totalCredits}</p>
            <p className="text-[9px] text-muted-foreground">Your balance: {credits}</p>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="space-y-1 mb-3 text-[9px] text-muted-foreground border-t border-border/30 pt-2">
          <div className="flex justify-between"><span>Base ({durationMinutes}min)</span><span>{(costs.video_generation || 10) * durationMinutes}</span></div>
          {voiceEnabled && <div className="flex justify-between"><span>Voice ({durationMinutes}min)</span><span>+{(costs.text_to_speech || 3) * durationMinutes}</span></div>}
          {subtitlesEnabled && <div className="flex justify-between"><span>Subtitles ({durationMinutes}min)</span><span>+{(costs.caption_per_minute || 8) * durationMinutes}</span></div>}
          {copyrightEnabled && <div className="flex justify-between"><span>Copyright</span><span>+{costs.copyright_check || 4}</span></div>}
          {logoEnabled && <div className="flex justify-between"><span>Logo</span><span>+2</span></div>}
          {watermarkEnabled && <div className="flex justify-between"><span>Watermark</span><span>+1</span></div>}
          {introOutroEnabled && <div className="flex justify-between"><span>Intro/Outro</span><span>+5</span></div>}
          <div className="flex justify-between font-bold text-primary border-t border-border/30 pt-1">
            <span>After 20% discount</span><span>{totalCredits}</span>
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={handleGenerate}
          disabled={isGenerating || credits < totalCredits}>
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
          ) : credits < totalCredits ? (
            "Credits မလုံလောက်ပါ"
          ) : (
            <><Zap className="w-4 h-4 mr-2" /> Generate Video ({totalCredits} Credits)</>
          )}
        </Button>
      </Card>

      {/* Output Gallery */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold font-myanmar">📺 Auto Service Gallery</p>
          <Button variant="ghost" size="sm" onClick={fetchVideos} className="h-7">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>

        {videos.length === 0 ? (
          <Card className="p-6 border-border/50 bg-card/60 text-center">
            <Video className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-xs text-muted-foreground font-myanmar">ဗီဒီယို မရှိသေးပါ</p>
          </Card>
        ) : (
          videos.map(video => (
            <Card key={video.id} className="p-3 border-border/50 bg-card/60">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt="" className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    <Video className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate">{video.title}</p>
                  <p className="text-[9px] text-muted-foreground">{video.generated_date} • {video.target_language}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {video.generation_status === "completed" ? (
                      <Badge variant="secondary" className="text-[8px] bg-green-500/10 text-green-500">
                        <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> Done
                      </Badge>
                    ) : video.generation_status === "failed" ? (
                      <Badge variant="destructive" className="text-[8px]">
                        <XCircle className="w-2.5 h-2.5 mr-0.5" /> Failed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[8px]">
                        <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> Processing
                      </Badge>
                    )}
                  </div>
                </div>
                {video.video_url && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={video.video_url} target="_blank" rel="noopener noreferrer"><Play className="w-3.5 h-3.5" /></a>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={video.video_url} download><Download className="w-3.5 h-3.5" /></a>
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Support Chat */}
      <Card className="p-3 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold">Support Chat</span>
        </div>
        <div className="max-h-40 overflow-y-auto space-y-1.5 mb-2">
          {supportChat.length === 0 && (
            <p className="text-[9px] text-muted-foreground text-center py-3 font-myanmar">
              Auto Service ပြဿနာ ရှိပါက မေးမြန်းနိုင်ပါသည်
            </p>
          )}
          {supportChat.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-[10px] ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}>
                <p className="font-myanmar whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isSendingSupport && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-lg px-2.5 py-1.5"><Loader2 className="w-3 h-3 animate-spin" /></div>
            </div>
          )}
        </div>
        <div className="flex gap-1.5">
          <Textarea placeholder="မေးခွန်းထည့်ပါ..." value={supportMessage}
            onChange={e => setSupportMessage(e.target.value)}
            className="text-[10px] min-h-[36px] max-h-16 resize-none"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSupportChat(); } }}
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSupportChat}
            disabled={isSendingSupport || !supportMessage.trim()}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
};
