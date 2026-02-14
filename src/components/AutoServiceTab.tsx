import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import {
  Play, Crown, Globe, Sparkles, Video, Send, MessageCircle,
  Calendar, CheckCircle, XCircle, Loader2, RefreshCw, Eye,
  Gift, Clock, Zap, AlertTriangle
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

export const AutoServiceTab = ({ userId }: AutoServiceTabProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const [activeTab, setActiveTab] = useState("subscribe");
  const [selectedLanguage, setSelectedLanguage] = useState("Myanmar");
  const [selectedTemplate, setSelectedTemplate] = useState("motivational");
  const [referralCode, setReferralCode] = useState("");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportChat, setSupportChat] = useState<{ role: string; content: string }[]>([]);
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchPlans();
      fetchSubscriptions();
      fetchVideos();
    }
  }, [userId]);

  const fetchPlans = async () => {
    const { data } = await supabase.from("auto_service_plans").select("*").eq("is_active", true).order("price_credits");
    if (data) setPlans(data);
  };

  const fetchSubscriptions = async () => {
    const { data } = await supabase.from("auto_service_subscriptions").select("*").eq("user_id", userId!).order("created_at", { ascending: false });
    if (data) setSubscriptions(data);
  };

  const fetchVideos = async () => {
    const { data } = await supabase.from("auto_service_videos").select("*").eq("user_id", userId!).order("generated_date", { ascending: false }).limit(30);
    if (data) setVideos(data);
  };

  const handleFreePreview = async () => {
    if (!userId) return;
    setIsGeneratingPreview(true);
    setPreviewResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("auto-service-preview", {
        body: { userId, language: selectedLanguage, templateCategory: selectedTemplate },
      });
      if (error) throw error;
      setPreviewResult(data?.preview || "Preview generated successfully!");
      toast({ title: "✅ Preview Generated", description: "10-second preview is ready!" });
    } catch (e: any) {
      toast({ title: "Preview Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!userId) return;
    setIsSubscribing(true);
    setSelectedPlan(planId);
    try {
      const plan = plans.find((p) => p.id === planId);
      if (!plan) throw new Error("Plan not found");

      // Deduct credits
      const { data: deductResult, error: deductError } = await supabase.rpc("deduct_user_credits", {
        _user_id: userId, _amount: plan.price_credits, _action: "auto_service_subscription",
      });
      if (deductError) throw deductError;
      const result = deductResult as any;
      if (!result?.success) throw new Error(result?.error || "Credit deduction failed");

      // Create subscription
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + plan.duration_days);

      const { error: subError } = await supabase.from("auto_service_subscriptions").insert({
        user_id: userId,
        plan_id: planId,
        template_category: selectedTemplate,
        target_language: selectedLanguage,
        status: "active",
        expires_at: expiresAt.toISOString(),
        referral_code_used: referralCode || null,
        credits_paid: plan.price_credits,
      });
      if (subError) throw subError;

      // Process referral if used
      if (referralCode.trim()) {
        try {
          await supabase.functions.invoke("process-referral", {
            body: { referralCode: referralCode.trim(), newUserId: userId },
          });
        } catch { /* referral is bonus, don't block subscription */ }
      }

      toast({ title: "🎉 Subscription Activated!", description: `${plan.name} - ${plan.duration_days} days` });
      refetchCredits();
      fetchSubscriptions();
      setActiveTab("my-videos");
    } catch (e: any) {
      toast({ title: "Subscription Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubscribing(false);
      setSelectedPlan(null);
    }
  };

  const handleSupportChat = async () => {
    if (!supportMessage.trim() || !userId) return;
    const userMsg = supportMessage.trim();
    setSupportChat((prev) => [...prev, { role: "user", content: userMsg }]);
    setSupportMessage("");
    setIsSendingSupport(true);

    try {
      const { data, error } = await supabase.functions.invoke("auto-service-support", {
        body: { userId, message: userMsg },
      });
      if (error) throw error;

      const aiResponse = data?.response || "ကျွန်ုပ်တို့ ဆက်သွယ်ပေးပါမည်။";
      setSupportChat((prev) => [...prev, { role: "assistant", content: aiResponse }]);

      if (data?.escalated) {
        toast({ title: "📨 Owner ဆီသို့ ပေးပို့ထားပါသည်", description: "နည်းပညာဆိုင်ရာ ပြဿနာကို Owner ဆီ ပို့ထားပါပြီ။" });
      }
    } catch {
      setSupportChat((prev) => [...prev, { role: "assistant", content: "ဆာဗာ ချိတ်ဆက်မှု မအောင်မြင်ပါ။ ထပ်ကြိုးစားပေးပါ။" }]);
    } finally {
      setIsSendingSupport(false);
    }
  };

  const activeSubscription = subscriptions.find((s) => s.status === "active" && new Date(s.expires_at) > new Date());
  const selectedTemplateObj = TEMPLATE_CATEGORIES.find((t) => t.id === selectedTemplate);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-primary animate-pulse" />
          <h1 className="text-xl font-bold text-primary">Auto Daily Video Service</h1>
          <Zap className="w-5 h-5 text-primary animate-pulse" />
        </div>
        <p className="text-xs text-muted-foreground font-myanmar">
          နေ့စဉ် AI ဗီဒီယို အလိုအလျောက် ဖန်တီးပေးခြင်း ဝန်ဆောင်မှု
        </p>
      </div>

      {/* Active Subscription Banner */}
      {activeSubscription && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-3 border border-green-500/30 bg-green-500/10">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm font-bold text-green-500">Active Subscription</span>
          </div>
          <p className="text-xs text-muted-foreground font-myanmar">
            Template: {TEMPLATE_CATEGORIES.find(t => t.id === activeSubscription.template_category)?.nameMyanmar} | 
            Language: {activeSubscription.target_language} | 
            Expires: {new Date(activeSubscription.expires_at).toLocaleDateString()}
          </p>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="subscribe" className="text-xs py-2 font-myanmar">
            <Crown className="w-3 h-3 mr-1" />စီမံ
          </TabsTrigger>
          <TabsTrigger value="my-videos" className="text-xs py-2 font-myanmar">
            <Video className="w-3 h-3 mr-1" />ဗီဒီယို
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs py-2 font-myanmar">
            <Eye className="w-3 h-3 mr-1" />Preview
          </TabsTrigger>
          <TabsTrigger value="support" className="text-xs py-2 font-myanmar">
            <MessageCircle className="w-3 h-3 mr-1" />Support
          </TabsTrigger>
        </TabsList>

        {/* Subscribe Tab */}
        <TabsContent value="subscribe" className="space-y-4 mt-4">
          {/* Language Selection */}
          <Card className="p-4 border-border/50 bg-card/60">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Target Language</h3>
              <span className="text-xs text-muted-foreground font-myanmar">ဗီဒီယို ဘာသာစကား</span>
            </div>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-60">
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Template Selection */}
          <Card className="p-4 border-border/50 bg-card/60">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Daily Theme Template</h3>
              <span className="text-xs text-muted-foreground font-myanmar">နေ့စဉ် အကြောင်းအရာ</span>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedTemplate(cat.id)}
                  className={`flex items-start gap-2 p-2 rounded-xl text-left transition-all border ${
                    selectedTemplate === cat.id
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/30 bg-secondary/20 hover:bg-secondary/40"
                  }`}>
                  <span className="text-lg mt-0.5">{cat.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold truncate">{cat.name}</p>
                    <p className="text-[9px] text-muted-foreground font-myanmar truncate">{cat.nameMyanmar}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Referral Code */}
          <Card className="p-4 border-border/50 bg-card/60">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Referral Code</h3>
              <span className="text-xs text-muted-foreground font-myanmar">(optional)</span>
            </div>
            <Input placeholder="Enter referral code..." value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-1 font-myanmar">
              Referral code ထည့်ပါက သင်နှင့် မိတ်ဆွေ နှစ်ဦးစလုံး Bonus Credit ရရှိပါမည်
            </p>
          </Card>

          {/* Plans */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              Subscription Plans
              <span className="text-xs text-muted-foreground font-myanmar">အစီအစဉ်များ</span>
            </h3>
            {plans.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 font-myanmar">
                Plan များ မရှိသေးပါ။ Admin မှ ထည့်သွင်းပေးပါမည်။
              </p>
            )}
            {plans.map((plan) => (
              <Card key={plan.id} className="p-4 border-border/50 bg-card/60">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-bold">{plan.name}</h4>
                    <p className="text-[10px] text-muted-foreground">{plan.description}</p>
                  </div>
                  {plan.discount_percent > 0 && (
                    <Badge variant="secondary" className="text-[10px]">-{plan.discount_percent}%</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">{plan.price_credits}</span>
                    <span className="text-xs text-muted-foreground">Credits</span>
                    <span className="text-[10px] text-muted-foreground">/ {plan.duration_days} days</span>
                  </div>
                  <Button size="sm" onClick={() => handleSubscribe(plan.id)}
                    disabled={isSubscribing || (credits < plan.price_credits)}
                    className="text-xs">
                    {isSubscribing && selectedPlan === plan.id ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Crown className="w-3 h-3 mr-1" />
                    )}
                    {credits < plan.price_credits ? "Credits မလုံလောက်" : "Subscribe"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* My Videos Tab */}
        <TabsContent value="my-videos" className="space-y-3 mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold font-myanmar">နေ့စဉ် ဖန်တီးထားသော ဗီဒီယိုများ</h3>
            <Button variant="ghost" size="sm" onClick={fetchVideos}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
          {videos.length === 0 ? (
            <div className="text-center py-10">
              <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground font-myanmar">ဗီဒီယို မရှိသေးပါ</p>
              <p className="text-xs text-muted-foreground font-myanmar">Subscribe လုပ်ပြီးပါက နေ့စဉ် အလိုအလျောက် ဖန်တီးပေးပါမည်</p>
            </div>
          ) : (
            videos.map((video) => (
              <Card key={video.id} className="p-3 border-border/50 bg-card/60">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt="" className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      <Video className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{video.title}</p>
                    <p className="text-[10px] text-muted-foreground">{video.generated_date} | {video.target_language}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {video.generation_status === "completed" ? (
                        <Badge variant="secondary" className="text-[9px] bg-green-500/10 text-green-500">
                          <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> Completed
                        </Badge>
                      ) : video.generation_status === "failed" ? (
                        <Badge variant="destructive" className="text-[9px]">
                          <XCircle className="w-2.5 h-2.5 mr-0.5" /> Failed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px]">
                          <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> Processing
                        </Badge>
                      )}
                      {video.credits_refunded > 0 && (
                        <Badge variant="secondary" className="text-[9px] bg-yellow-500/10 text-yellow-500">
                          Refunded {video.credits_refunded}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {video.video_url && (
                    <Button variant="ghost" size="icon" asChild className="shrink-0">
                      <a href={video.video_url} target="_blank" rel="noopener noreferrer">
                        <Play className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4 mt-4">
          <Card className="p-4 border-border/50 bg-card/60 text-center">
            <Eye className="w-8 h-8 text-primary mx-auto mb-2 opacity-60" />
            <h3 className="text-sm font-bold mb-1">10-Second Free Preview</h3>
            <p className="text-[10px] text-muted-foreground font-myanmar mb-3">
              Subscribe မလုပ်ခင် သင်ရွေးချယ်ထားသော Template နှင့် ဘာသာစကားဖြင့် 10 စက္ကန့် Preview ကြည့်ပါ
            </p>
            <div className="flex items-center justify-center gap-2 mb-3 text-xs">
              <Badge variant="secondary">{selectedTemplateObj?.icon} {selectedTemplateObj?.name}</Badge>
              <Badge variant="outline">{selectedLanguage}</Badge>
            </div>
            <Button onClick={handleFreePreview} disabled={isGeneratingPreview} className="w-full">
              {isGeneratingPreview ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating Preview...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Generate Free Preview</>
              )}
            </Button>
            <p className="text-[9px] text-muted-foreground mt-1">💰 FREE - No credits required</p>
          </Card>

          {previewResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-4 border-primary/30 bg-primary/5">
                <h4 className="text-xs font-bold mb-2">📺 Preview Result</h4>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap font-myanmar">{previewResult}</p>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-3 mt-4">
          <Card className="p-4 border-border/50 bg-card/60">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Smart Support Chat</h3>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-3">
              {supportChat.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4 font-myanmar">
                  Auto Service နှင့် ပတ်သတ်၍ မေးလိုသည်များ ရှိပါက မေးမြန်းနိုင်ပါသည်
                </p>
              )}
              {supportChat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}>
                    <p className="font-myanmar whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isSendingSupport && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-xl px-3 py-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Textarea placeholder="မေးခွန်းထည့်ပါ..." value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                className="text-xs min-h-[40px] max-h-20 resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSupportChat(); } }}
              />
              <Button size="icon" onClick={handleSupportChat} disabled={isSendingSupport || !supportMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
