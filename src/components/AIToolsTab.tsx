import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Image, Video, Volume2, Crown, Wallet, Gift, 
  ZoomIn, Eraser, Sparkles, Youtube, FileText, Captions,
  Megaphone, Briefcase, Shield, BookOpen, ListChecks,
  Music, Palette, Zap, Loader2, Wand2, Search, Home,
  Mic, PenTool, Camera, ImagePlus, Type, Shirt, Star,
  GraduationCap, LineChart, Pen, Scale, MessageCircle, Heart,
  Car, Building2, Languages, Stethoscope, Baby, FileCheck,
  Paintbrush, ChefHat, Plane
} from "lucide-react";

// Lazy load all tool components
const ImageTool = lazy(() => import("./tools/ImageTool").then(m => ({ default: m.ImageTool })));
const VideoTool = lazy(() => import("./tools/VideoTool").then(m => ({ default: m.VideoTool })));
const SpeechTool = lazy(() => import("./tools/SpeechTool").then(m => ({ default: m.SpeechTool })));
const FaceSwapTool = lazy(() => import("./tools/FaceSwapTool").then(m => ({ default: m.FaceSwapTool })));
const UpscaleTool = lazy(() => import("./tools/UpscaleTool").then(m => ({ default: m.UpscaleTool })));
const BgRemoveTool = lazy(() => import("./tools/BgRemoveTool").then(m => ({ default: m.BgRemoveTool })));
const BgStudioTool = lazy(() => import("./tools/BgStudioTool").then(m => ({ default: m.BgStudioTool })));
const YouTubeToTextTool = lazy(() => import("./tools/YouTubeToTextTool").then(m => ({ default: m.YouTubeToTextTool })));
const DocSlideTool = lazy(() => import("./tools/DocSlideTool").then(m => ({ default: m.DocSlideTool })));
const CaptionTool = lazy(() => import("./tools/CaptionTool").then(m => ({ default: m.CaptionTool })));
const AdGeneratorTool = lazy(() => import("./tools/AdGeneratorTool").then(m => ({ default: m.AdGeneratorTool })));
const AutoAdTool = lazy(() => import("./tools/AutoAdTool").then(m => ({ default: m.AutoAdTool })));
const SocialMediaManagerTool = lazy(() => import("./tools/SocialMediaManagerTool").then(m => ({ default: m.SocialMediaManagerTool })));
const VideoCopywritingTool = lazy(() => import("./tools/VideoCopywritingTool").then(m => ({ default: m.VideoCopywritingTool })));
const CopyrightCheckerTool = lazy(() => import("./tools/CopyrightCheckerTool").then(m => ({ default: m.CopyrightCheckerTool })));
const StoryVideoTool = lazy(() => import("./tools/StoryVideoTool").then(m => ({ default: m.StoryVideoTool })));
const SceneSummarizerTool = lazy(() => import("./tools/SceneSummarizerTool").then(m => ({ default: m.SceneSummarizerTool })));
const SongMTVTool = lazy(() => import("./tools/SongMTVTool").then(m => ({ default: m.SongMTVTool })));
const VideoRedesignTool = lazy(() => import("./tools/VideoRedesignTool").then(m => ({ default: m.VideoRedesignTool })));
const LogoDesignTool = lazy(() => import("./tools/LogoDesignTool").then(m => ({ default: m.LogoDesignTool })));
const LiveCameraChatTool = lazy(() => import("./tools/LiveCameraChatTool").then(m => ({ default: m.LiveCameraChatTool })));
const PhotoRestoreTool = lazy(() => import("./tools/PhotoRestoreTool").then(m => ({ default: m.PhotoRestoreTool })));
const SpellcheckTool = lazy(() => import("./tools/SpellcheckTool").then(m => ({ default: m.SpellcheckTool })));
const VirtualTryOnTool = lazy(() => import("./tools/VirtualTryOnTool").then(m => ({ default: m.VirtualTryOnTool })));
const AstrologyTool = lazy(() => import("./tools/AstrologyTool").then(m => ({ default: m.AstrologyTool })));
const InteriorDesignTool = lazy(() => import("./tools/InteriorDesignTool").then(m => ({ default: m.InteriorDesignTool })));
const CVBuilderTool = lazy(() => import("./tools/CVBuilderTool").then(m => ({ default: m.CVBuilderTool })));
const BusinessConsultantTool = lazy(() => import("./tools/BusinessConsultantTool").then(m => ({ default: m.BusinessConsultantTool })));
const CreativeWriterTool = lazy(() => import("./tools/CreativeWriterTool").then(m => ({ default: m.CreativeWriterTool })));
const LegalAdvisorTool = lazy(() => import("./tools/LegalAdvisorTool").then(m => ({ default: m.LegalAdvisorTool })));
const MessagePolisherTool = lazy(() => import("./tools/MessagePolisherTool").then(m => ({ default: m.MessagePolisherTool })));
const NutritionPlannerTool = lazy(() => import("./tools/NutritionPlannerTool").then(m => ({ default: m.NutritionPlannerTool })));
// New Tools #32-#40
const CarDealerTool = lazy(() => import("./tools/CarDealerTool").then(m => ({ default: m.CarDealerTool })));
const ExteriorDesignTool = lazy(() => import("./tools/ExteriorDesignTool").then(m => ({ default: m.ExteriorDesignTool })));
const VoiceTranslatorTool = lazy(() => import("./tools/VoiceTranslatorTool").then(m => ({ default: m.VoiceTranslatorTool })));
const HealthCheckerTool = lazy(() => import("./tools/HealthCheckerTool").then(m => ({ default: m.HealthCheckerTool })));
const BabyNamerTool = lazy(() => import("./tools/BabyNamerTool").then(m => ({ default: m.BabyNamerTool })));
const LegalDocTool = lazy(() => import("./tools/LegalDocTool").then(m => ({ default: m.LegalDocTool })));
const StyleTransferTool = lazy(() => import("./tools/StyleTransferTool").then(m => ({ default: m.StyleTransferTool })));
const SmartChefTool = lazy(() => import("./tools/SmartChefTool").then(m => ({ default: m.SmartChefTool })));
const TravelPlannerTool = lazy(() => import("./tools/TravelPlannerTool").then(m => ({ default: m.TravelPlannerTool })));

import { ToolCardCompact } from "./ToolCardCompact";
import { AIChatbot } from "./AIChatbot";
import { ReferralSection } from "./ReferralSection";
import { LowCreditAlert } from "./LowCreditAlert";
import { UserFeedback } from "./UserFeedback";
import { TutorialManager, DASHBOARD_TOUR_STEPS } from "./TutorialManager";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AIToolsTabProps {
  userId?: string;
}

type ActiveTool = "home" | "image" | "video" | "speech" | "faceswap" | "upscale" | "bgremove" | "bgstudio" | "youtube" | "docslide" | "caption" | "adgenerator" | "autoad" | "socialmedia" | "videocopywriting" | "copyrightchecker" | "storyvideo" | "scenesummarizer" | "songmtv" | "videoredesign" | "logodesign" | "livecamera" | "photorestore" | "spellcheck" | "virtualtryon" | "astrology" | "interiordesign" | "cvbuilder" | "bizconsultant" | "creativewriter" | "legaladvisor" | "messagepolisher" | "nutritionplanner" | "cardealer" | "exteriordesign" | "voicetranslator" | "healthchecker" | "babynamer" | "legaldoc" | "styletransfer" | "smartchef" | "travelplanner";

type ToolCategory = "all" | "image" | "video" | "audio" | "premium";

interface ToolDef {
  id: ActiveTool;
  icon: any;
  titleKey: string;
  fallbackTitle: string;
  descKey: string;
  fallbackDesc: string;
  gradient: string;
  credits: number;
  category: ToolCategory[];
  badge?: string;
  badgeTooltip?: string;
  size?: "small" | "default";
}

const CATEGORIES: { key: ToolCategory; label: string; icon: any }[] = [
  { key: "all", label: "အားလုံး", icon: Home },
  { key: "image", label: "ပုံရိပ် Tools", icon: Image },
  { key: "video", label: "ဗီဒီယို Tools", icon: Video },
  { key: "audio", label: "အသံနှင့်စာ", icon: Mic },
  { key: "premium", label: "Premium", icon: Crown },
];

const ToolLoadingFallback = () => (
  <div className="flex items-center justify-center py-20">
    <div className="text-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
      <p className="text-xs text-muted-foreground">Loading tool...</p>
    </div>
  </div>
);

export const AIToolsTab = ({ userId }: AIToolsTabProps) => {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ActiveTool>("home");
  const [showLowCreditAlert, setShowLowCreditAlert] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { costs } = useCreditCosts();
  const { credits, isLoading: creditsLoading } = useCredits(userId);
  const { isAdmin } = useUserRole(userId);
  const { t } = useLanguage();

  useEffect(() => {
    if (!creditsLoading && credits <= 5 && credits > 0) {
      setShowLowCreditAlert(true);
    }
  }, [credits, creditsLoading]);

  const handleBack = () => setActiveTool("home");

  const docSlideCost = Math.ceil((2 + 3 * 5) * 1.4);

  const tools: ToolDef[] = useMemo(() => [
    // Premium
    { id: "songmtv", icon: Music, titleKey: "tool.songMtv", fallbackTitle: "သီချင်းထုတ်မယ်/MTV ထုတ်မယ်", descKey: "tool.songMtv.desc", fallbackDesc: "AI အသုံးပြု၍ သီချင်းနှင့် MTV များ ဖန်တီးပေးခြင်း", gradient: "bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700", credits: costs.song_mtv, category: ["premium", "audio"], badge: "PREMIUM", badgeTooltip: "AI Song & MTV Creator" },
    { id: "autoad", icon: Zap, titleKey: "tool.autoAd", fallbackTitle: "AI ကို ကြော်ငြာ အပ်ခြင်း", descKey: "tool.autoAd.desc", fallbackDesc: "AI မှ သင်အပ်သောကြော်ငြာကို ဖန်တီးပေးပါလိမ့်မည်", gradient: "bg-gradient-to-br from-orange-500 via-amber-600 to-yellow-700", credits: costs.auto_ad, category: ["premium", "video"], badge: "PREMIUM", badgeTooltip: "Full Auto Ad Generator" },
    { id: "livecamera", icon: Camera, titleKey: "", fallbackTitle: "Live AI Vision & Voice", descKey: "", fallbackDesc: "ကင်မရာ+အသံ+AI", gradient: "bg-gradient-to-br from-red-500 via-rose-500 to-pink-600", credits: costs.live_camera_chat, category: ["premium", "video"], badge: "LIVE", badgeTooltip: "Real-time AI Vision + Voice" },
    // Image
    { id: "image", icon: Image, titleKey: "tool.imageGen", fallbackTitle: "ပုံထုတ်ရန်", descKey: "tool.imageGen.desc", fallbackDesc: "AI ပုံဆွဲ", gradient: "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700", credits: costs.image_generation, category: ["image"], size: "small" },
    { id: "upscale", icon: ZoomIn, titleKey: "tool.upscale", fallbackTitle: "4K Upscale", descKey: "tool.upscale.desc", fallbackDesc: "Resolution မြှင့်", gradient: "bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-700", credits: costs.upscale, category: ["image"], size: "small" },
    { id: "bgremove", icon: Eraser, titleKey: "tool.bgRemove", fallbackTitle: "BG Remove", descKey: "tool.bgRemove.desc", fallbackDesc: "Background ဖယ်", gradient: "bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700", credits: costs.bg_remove, category: ["image"], size: "small" },
    { id: "bgstudio", icon: Palette, titleKey: "tool.bgStudio", fallbackTitle: "ပစ္စည်းပုံထည့်/အော်တို ဘတ်ဂရောင်းချိန်း", descKey: "tool.bgStudio.desc", fallbackDesc: "ကုန်ပစ္စည်းပုံရိပ်များကို နောက်ခံအလှများ အလိုအလျောက် ပြောင်းလဲပေးခြင်း", gradient: "bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-700", credits: costs.bg_studio, category: ["image"], size: "small", badge: "NEW" },
    { id: "logodesign", icon: PenTool, titleKey: "", fallbackTitle: "Logo & Graphic Design", descKey: "", fallbackDesc: "Logo၊ FB Cover ဒီဇိုင်း", gradient: "bg-gradient-to-br from-pink-500 via-rose-600 to-red-700", credits: costs.logo_design, category: ["image"], size: "small", badge: "NEW" },
    { id: "faceswap", icon: Users, titleKey: "tool.faceSwap", fallbackTitle: "မျက်နှာပြောင်း", descKey: "tool.faceSwap.desc", fallbackDesc: "Face Swap", gradient: "bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700", credits: costs.face_swap, category: ["image", "video"] },
    { id: "photorestore", icon: ImagePlus, titleKey: "", fallbackTitle: "AI ဓာတ်ပုံဟောင်း ပြုပြင်သူ", descKey: "", fallbackDesc: "ပုံဟောင်းများ ပြုပြင်ခြင်း", gradient: "bg-gradient-to-br from-amber-500 via-orange-600 to-red-700", credits: costs.photo_restoration, category: ["image"], badge: "NEW" },
    { id: "virtualtryon", icon: Shirt, titleKey: "", fallbackTitle: "AI အင်္ကျီလဲဝတ်ကြည့်", descKey: "", fallbackDesc: "အဝတ်အစား စမ်းဝတ်ကြည့်", gradient: "bg-gradient-to-br from-pink-500 via-rose-600 to-red-700", credits: costs.virtual_tryon, category: ["image", "premium"], badge: "NEW" },
    { id: "styletransfer", icon: Paintbrush, titleKey: "", fallbackTitle: "AI Art Style Transfer", descKey: "", fallbackDesc: "ဓာတ်ပုံ → အနုပညာ", gradient: "bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-700", credits: (costs as any).style_transfer || 3, category: ["image"], badge: "NEW" },
    { id: "exteriordesign", icon: Building2, titleKey: "", fallbackTitle: "AI အိမ်ပြင်ပ ဒီဇိုင်နာ", descKey: "", fallbackDesc: "အိမ်ပြင်ပ 3D ဒီဇိုင်း", gradient: "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700", credits: (costs as any).exterior_design || 5, category: ["image", "premium"], badge: "NEW" },
    { id: "interiordesign", icon: Home, titleKey: "", fallbackTitle: "AI အိမ်တွင်း ဒီဇိုင်နာ", descKey: "", fallbackDesc: "အခန်း ပြန်လည်ဒီဇိုင်းဆွဲ", gradient: "bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-700", credits: costs.interior_design, category: ["image", "premium"], badge: "NEW" },
    // Video
    { id: "video", icon: Video, titleKey: "tool.videoGen", fallbackTitle: "ဗီဒီယိုထုတ်ရန်", descKey: "tool.videoGen.desc", fallbackDesc: "ပုံမှ ဗီဒီယို", gradient: "bg-gradient-to-br from-red-500 via-rose-600 to-pink-700", credits: costs.video_generation, category: ["video"] },
    { id: "videoredesign", icon: Wand2, titleKey: "", fallbackTitle: "AI Video Redesign", descKey: "", fallbackDesc: "ဗီဒီယို Style ပြောင်း", gradient: "bg-gradient-to-br from-violet-500 via-fuchsia-600 to-pink-700", credits: costs.video_redesign, category: ["video"], badge: "NEW" },
    { id: "caption", icon: Captions, titleKey: "tool.caption", fallbackTitle: "AI Caption", descKey: "tool.caption.desc", fallbackDesc: "စာတန်းထိုး", gradient: "bg-gradient-to-br from-amber-500 via-orange-600 to-red-700", credits: costs.caption_per_minute, category: ["video"] },
    { id: "adgenerator", icon: Megaphone, titleKey: "tool.adGen", fallbackTitle: "AI Ad", descKey: "tool.adGen.desc", fallbackDesc: "ကြော်ငြာ ဖန်တီး", gradient: "bg-gradient-to-br from-pink-500 via-fuchsia-600 to-purple-700", credits: costs.ad_generator, category: ["video"] },
    { id: "videocopywriting", icon: Crown, titleKey: "tool.videoCopy", fallbackTitle: "Video Copywriting", descKey: "tool.videoCopy.desc", fallbackDesc: "AI ကြော်ငြာ ဖန်တီး", gradient: "bg-gradient-to-br from-amber-500 via-yellow-600 to-orange-700", credits: costs.ai_chat * 3, category: ["video"], badge: "PRO" },
    { id: "copyrightchecker", icon: Shield, titleKey: "tool.copyright", fallbackTitle: "Copyright Check", descKey: "tool.copyright.desc", fallbackDesc: "မူပိုင်ခွင့် စစ်ဆေးခြင်း", gradient: "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700", credits: costs.copyright_check, category: ["video"], badge: "NEW" },
    { id: "storyvideo", icon: BookOpen, titleKey: "tool.storyVideo", fallbackTitle: "Story → Video", descKey: "tool.storyVideo.desc", fallbackDesc: "ပုံပြင်မှ ဗီဒီယို", gradient: "bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700", credits: costs.story_video, category: ["video"], badge: "NEW" },
    { id: "scenesummarizer", icon: ListChecks, titleKey: "tool.sceneSumm", fallbackTitle: "Video Recap", descKey: "tool.sceneSumm.desc", fallbackDesc: "ဗီဒီယို အကျဥ်းချုပ်", gradient: "bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700", credits: costs.scene_summarizer, category: ["video"] },
    // Audio/Text
    { id: "speech", icon: Volume2, titleKey: "tool.tts", fallbackTitle: "အသံ ↔ စာ", descKey: "tool.tts.desc", fallbackDesc: "Text-to-Speech & STT", gradient: "bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700", credits: costs.text_to_speech, category: ["audio"] },
    { id: "youtube", icon: Youtube, titleKey: "tool.youtubeText", fallbackTitle: "YouTube → စာ", descKey: "tool.youtubeText.desc", fallbackDesc: "ဗီဒီယိုမှ စာထုတ်", gradient: "bg-gradient-to-br from-red-500 via-red-600 to-rose-700", credits: costs.youtube_to_text, category: ["audio"] },
    { id: "voicetranslator", icon: Languages, titleKey: "", fallbackTitle: "AI အသံ ဘာသာပြန်စက်", descKey: "", fallbackDesc: "မြန်မာ → နိုင်ငံခြား ဘာသာပြန်", gradient: "bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-700", credits: (costs as any).voice_translator || 3, category: ["audio", "premium"], badge: "NEW" },
    { id: "spellcheck", icon: Type, titleKey: "", fallbackTitle: "AI မြန်မာစာ သတ်ပုံစစ်", descKey: "", fallbackDesc: "သတ်ပုံနှင့် သဒ္ဒါ စစ်ဆေး", gradient: "bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700", credits: costs.myanmar_spellcheck, category: ["audio"], badge: "NEW" },
    { id: "creativewriter", icon: Pen, titleKey: "", fallbackTitle: "AI ကဗျာ/ဝတ္ထုတို", descKey: "", fallbackDesc: "မြန်မာ စာပေ ဖန်တီး", gradient: "bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700", credits: costs.creative_writer, category: ["audio"], badge: "NEW" },
    { id: "messagepolisher", icon: MessageCircle, titleKey: "", fallbackTitle: "AI စာ ပြေပြစ်အောင်ပြင်", descKey: "", fallbackDesc: "စာတို ယဉ်ကျေးစွာ ပြင်ဆင်", gradient: "bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700", credits: costs.message_polisher, category: ["audio"], badge: "NEW" },
    // Social/Doc
    { id: "socialmedia", icon: Briefcase, titleKey: "tool.socialMedia", fallbackTitle: "AI Studio Management", descKey: "tool.socialMedia.desc", fallbackDesc: "စိတ်ကြိုက် မီဒီယာမှာလုပ်ရန် ပလန်ဆွဲခိုင်းခြင်း", gradient: "bg-gradient-to-br from-fuchsia-500 via-pink-600 to-rose-700", credits: costs.social_media_agent, category: ["premium"] },
    { id: "docslide", icon: FileText, titleKey: "tool.docSlide", fallbackTitle: "AI Doc & Slide", descKey: "tool.docSlide.desc", fallbackDesc: "PDF, PPTX, DOCX ဖန်တီးမည်", gradient: "bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700", credits: docSlideCost, category: ["audio"] },
    { id: "cvbuilder", icon: GraduationCap, titleKey: "", fallbackTitle: "AI CV & Cover Letter", descKey: "", fallbackDesc: "ကိုယ်ရေးရာဇဝင် ဖန်တီး", gradient: "bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700", credits: costs.cv_builder, category: ["audio"], badge: "NEW" },
    { id: "legaldoc", icon: FileCheck, titleKey: "", fallbackTitle: "AI ဥပဒေ စာချုပ်", descKey: "", fallbackDesc: "ပရော်ဖက်ရှင်နယ် စာချုပ် ဖန်တီး", gradient: "bg-gradient-to-br from-slate-500 via-zinc-600 to-neutral-700", credits: (costs as any).legal_doc || 3, category: ["audio", "premium"], badge: "NEW" },
    // Premium specialty
    { id: "bizconsultant", icon: LineChart, titleKey: "", fallbackTitle: "AI စီးပွားရေး အကြံပေး", descKey: "", fallbackDesc: "ရင်းနှီးမြှုပ်နှံမှု ခွဲခြမ်းစိတ်ဖြာ", gradient: "bg-gradient-to-br from-emerald-500 via-green-600 to-lime-700", credits: costs.business_consultant, category: ["premium"], badge: "NEW" },
    { id: "legaladvisor", icon: Scale, titleKey: "", fallbackTitle: "AI ဥပဒေ အကြံပေး", descKey: "", fallbackDesc: "ဥပဒေ ခွဲခြမ်းစိတ်ဖြာ", gradient: "bg-gradient-to-br from-slate-500 via-gray-600 to-zinc-700", credits: costs.legal_advisor, category: ["premium"], badge: "NEW" },
    { id: "astrology", icon: Star, titleKey: "", fallbackTitle: "AI ဟောစာတမ်း", descKey: "", fallbackDesc: "ကံကြမ္မာ ဟောကြားချက်", gradient: "bg-gradient-to-br from-indigo-500 via-purple-600 to-violet-700", credits: costs.myanmar_astrology, category: ["premium"], badge: "NEW" },
    { id: "babynamer", icon: Baby, titleKey: "", fallbackTitle: "AI နာမည်ပေး ကင်္ကုဗေဒ", descKey: "", fallbackDesc: "ကံကောင်းသော နာမည်များ", gradient: "bg-gradient-to-br from-pink-400 via-rose-500 to-fuchsia-600", credits: (costs as any).baby_namer || 2, category: ["premium"], badge: "NEW" },
    { id: "cardealer", icon: Car, titleKey: "", fallbackTitle: "AI ကားဈေးနှုန်း ခန့်မှန်းသူ", descKey: "", fallbackDesc: "ကား ဈေးကွက် ခွဲခြမ်းစိတ်ဖြာ", gradient: "bg-gradient-to-br from-blue-500 via-sky-600 to-cyan-700", credits: (costs as any).car_dealer || 3, category: ["premium"], badge: "NEW" },
    { id: "healthchecker", icon: Stethoscope, titleKey: "", fallbackTitle: "AI ရောဂါလက္ခဏာစစ်", descKey: "", fallbackDesc: "ကျန်းမာရေး အကြံပြုချက်", gradient: "bg-gradient-to-br from-red-400 via-rose-500 to-pink-600", credits: (costs as any).health_checker || 2, category: ["premium"], badge: "NEW" },
    { id: "nutritionplanner", icon: Heart, titleKey: "", fallbackTitle: "AI ကယ်လိုရီ တွက်သူ", descKey: "", fallbackDesc: "အစားအစာ အာဟာရ ခွဲခြမ်း", gradient: "bg-gradient-to-br from-red-500 via-rose-600 to-pink-700", credits: costs.nutrition_planner, category: ["premium"], badge: "NEW" },
    { id: "smartchef", icon: ChefHat, titleKey: "", fallbackTitle: "AI ဟင်းချက်နည်း", descKey: "", fallbackDesc: "ဟင်းချက်နည်းနှင့် ဈေးဖိုးတွက်", gradient: "bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-600", credits: (costs as any).smart_chef || 2, category: ["premium"], badge: "NEW" },
    { id: "travelplanner", icon: Plane, titleKey: "", fallbackTitle: "AI ခရီးသွား လမ်းညွှန်", descKey: "", fallbackDesc: "ကမ္ဘာပတ် ခရီးစဉ် ပလန်", gradient: "bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600", credits: (costs as any).travel_planner || 3, category: ["premium"], badge: "NEW" },
  ], [costs, docSlideCost]);

  const filteredTools = useMemo(() => {
    let filtered = tools;
    if (activeCategory !== "all") {
      filtered = filtered.filter(tool => tool.category.includes(activeCategory));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(tool => {
        const title = (tool.titleKey ? t(tool.titleKey) : "") || tool.fallbackTitle;
        const desc = (tool.descKey ? t(tool.descKey) : "") || tool.fallbackDesc;
        return title.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || tool.id.toLowerCase().includes(q);
      });
    }
    return filtered;
  }, [tools, activeCategory, searchQuery, t]);

  const renderActiveTool = () => {
    switch (activeTool) {
      case "image": return <ImageTool key="image" userId={userId} onBack={handleBack} />;
      case "video": return <VideoTool key="video" userId={userId} onBack={handleBack} />;
      case "speech": return <SpeechTool key="speech" userId={userId} onBack={handleBack} />;
      case "faceswap": return <FaceSwapTool key="faceswap" userId={userId} onBack={handleBack} />;
      case "upscale": return <UpscaleTool key="upscale" userId={userId} onBack={handleBack} />;
      case "bgremove": return <BgRemoveTool key="bgremove" userId={userId} onBack={handleBack} />;
      case "bgstudio": return <BgStudioTool key="bgstudio" userId={userId} onBack={handleBack} />;
      case "youtube": return <YouTubeToTextTool key="youtube" userId={userId} onBack={handleBack} />;
      case "docslide": return <DocSlideTool key="docslide" userId={userId} onBack={handleBack} />;
      case "caption": return <CaptionTool key="caption" userId={userId} onBack={handleBack} />;
      case "adgenerator": return <AdGeneratorTool key="adgenerator" userId={userId} onBack={handleBack} />;
      case "autoad": return <AutoAdTool key="autoad" userId={userId} onBack={handleBack} />;
      case "socialmedia": return <SocialMediaManagerTool key="socialmedia" userId={userId} onBack={handleBack} />;
      case "videocopywriting": return <VideoCopywritingTool key="videocopywriting" userId={userId} onBack={handleBack} />;
      case "copyrightchecker": return <CopyrightCheckerTool key="copyrightchecker" userId={userId} onBack={handleBack} />;
      case "storyvideo": return <StoryVideoTool key="storyvideo" userId={userId} onBack={handleBack} />;
      case "scenesummarizer": return <SceneSummarizerTool key="scenesummarizer" userId={userId} onBack={handleBack} />;
      case "songmtv": return <SongMTVTool key="songmtv" userId={userId} onBack={handleBack} />;
      case "videoredesign": return <VideoRedesignTool key="videoredesign" userId={userId} onBack={handleBack} />;
      case "logodesign": return <LogoDesignTool key="logodesign" userId={userId} onBack={handleBack} />;
      case "livecamera": return <LiveCameraChatTool key="livecamera" userId={userId} onBack={handleBack} />;
      case "photorestore": return <PhotoRestoreTool key="photorestore" userId={userId} onBack={handleBack} />;
      case "spellcheck": return <SpellcheckTool key="spellcheck" userId={userId} onBack={handleBack} />;
      case "virtualtryon": return <VirtualTryOnTool key="virtualtryon" userId={userId} onBack={handleBack} />;
      case "astrology": return <AstrologyTool key="astrology" userId={userId} onBack={handleBack} />;
      case "interiordesign": return <InteriorDesignTool key="interiordesign" userId={userId} onBack={handleBack} />;
      case "cvbuilder": return <CVBuilderTool key="cvbuilder" userId={userId} onBack={handleBack} />;
      case "bizconsultant": return <BusinessConsultantTool key="bizconsultant" userId={userId} onBack={handleBack} />;
      case "creativewriter": return <CreativeWriterTool key="creativewriter" userId={userId} onBack={handleBack} />;
      case "legaladvisor": return <LegalAdvisorTool key="legaladvisor" userId={userId} onBack={handleBack} />;
      case "messagepolisher": return <MessagePolisherTool key="messagepolisher" userId={userId} onBack={handleBack} />;
      case "nutritionplanner": return <NutritionPlannerTool key="nutritionplanner" userId={userId} onBack={handleBack} />;
      // New tools
      case "cardealer": return <CarDealerTool key="cardealer" userId={userId} onBack={handleBack} />;
      case "exteriordesign": return <ExteriorDesignTool key="exteriordesign" userId={userId} onBack={handleBack} />;
      case "voicetranslator": return <VoiceTranslatorTool key="voicetranslator" userId={userId} onBack={handleBack} />;
      case "healthchecker": return <HealthCheckerTool key="healthchecker" userId={userId} onBack={handleBack} />;
      case "babynamer": return <BabyNamerTool key="babynamer" userId={userId} onBack={handleBack} />;
      case "legaldoc": return <LegalDocTool key="legaldoc" userId={userId} onBack={handleBack} />;
      case "styletransfer": return <StyleTransferTool key="styletransfer" userId={userId} onBack={handleBack} />;
      case "smartchef": return <SmartChefTool key="smartchef" userId={userId} onBack={handleBack} />;
      case "travelplanner": return <TravelPlannerTool key="travelplanner" userId={userId} onBack={handleBack} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen">
      <LowCreditAlert credits={credits} show={showLowCreditAlert} onClose={() => setShowLowCreditAlert(false)} />
      {activeTool === "home" && <TutorialManager tourKey="dashboard" steps={DASHBOARD_TOUR_STEPS} />}

      <AnimatePresence mode="wait">
        {activeTool === "home" ? (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 p-4 pb-24">
            {/* Header */}
            <div className="text-center pt-2">
              <div className="inline-flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-primary animate-pulse" />
                <h1 className="text-xl font-bold text-primary font-myanmar">{t('dashboard.title')}</h1>
                <Crown className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <p className="text-muted-foreground text-xs font-myanmar">{t('dashboard.subtitle')}</p>
            </div>

            {/* Top-up Buttons */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2">
              <button id="topup-btn" onClick={() => navigate("/top-up")} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all">
                <Wallet className="w-5 h-5 text-primary" />
                <span className="text-sm text-primary font-medium font-myanmar">{t('dashboard.topupBtn')}</span>
              </button>
              <button onClick={() => navigate("/earn-credits")} className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-all">
                <Gift className="w-5 h-5 text-green-500" />
                <span className="text-sm text-green-500 font-medium font-myanmar">{t('dashboard.earnCredits')}</span>
              </button>
            </motion.div>

            {/* AI Chatbot */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <AIChatbot userId={userId} />
            </motion.div>

            {/* Search Bar - with gap from chatbot */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }} className="mt-1">
              <div id="search-bar" className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tool ရှာရန်... (e.g. Face, Video, Logo)"
                  className="pl-9 h-10 rounded-2xl bg-card/40 backdrop-blur-xl border border-white/10 text-sm font-myanmar placeholder:text-muted-foreground/60"
                />
              </div>
            </motion.div>

            {/* Category Tabs - Compact */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }}>
              <div id="category-tabs" className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const isActive = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setActiveCategory(cat.key)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all duration-300 font-myanmar ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                          : "bg-card/40 backdrop-blur-xl border border-white/10 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      }`}
                    >
                      <CatIcon className="w-3 h-3" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Tools Grid */}
            <LayoutGroup>
              <motion.div id="tools-grid" layout className="grid grid-cols-2 gap-2">
                <AnimatePresence mode="popLayout">
                  {filteredTools.map((tool, idx) => (
                    <motion.div
                      key={tool.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: idx * 0.03, type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <ToolCardCompact
                        icon={tool.icon}
                        title={(tool.titleKey ? t(tool.titleKey) : "") || tool.fallbackTitle}
                        description={(tool.descKey ? t(tool.descKey) : "") || tool.fallbackDesc}
                        gradient={tool.gradient}
                        onClick={() => setActiveTool(tool.id)}
                        credits={tool.credits}
                        size={tool.size}
                        badge={tool.badge}
                        badgeTooltip={tool.badgeTooltip}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>

            {filteredTools.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-myanmar">"{searchQuery}" နှင့် ကိုက်ညီသော tool မရှိပါ</p>
              </div>
            )}

            {/* Referral */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <ReferralSection userId={userId} />
            </motion.div>

            {/* Feedback */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
              <UserFeedback userId={userId} />
            </motion.div>

            {/* Info */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="gradient-card rounded-2xl p-4 border border-primary/20">
              <h3 className="text-sm font-semibold text-primary mb-1 font-myanmar">{t('dashboard.tip')}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-myanmar">{t('dashboard.tipText')}</p>
            </motion.div>

            {/* Footer */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <div className="border-t border-border/30 pt-4 mt-2">
                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground font-myanmar">© 2025 Myanmar AI Studio</p>
                  <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                    <a href="/about" className="hover:text-primary transition-colors">Terms of Service</a>
                    <span>•</span>
                    <a href="/about" className="hover:text-primary transition-colors">Privacy Policy</a>
                    <span>•</span>
                    <a href="/support" className="hover:text-primary transition-colors">Contact</a>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <Suspense fallback={<ToolLoadingFallback />}>
            {renderActiveTool()}
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};
