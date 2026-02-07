import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Image, Video, Volume2, Crown, Wallet, Gift, 
  ZoomIn, Eraser, Sparkles, Youtube, FileText, Captions,
  Megaphone, Briefcase, Shield, BookOpen, ListChecks,
  Music, Palette, Zap, Loader2
} from "lucide-react";

// Lazy load all tool components for code splitting
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

import { ToolCardCompact } from "./ToolCardCompact";
import { AIChatbot } from "./AIChatbot";
import { ReferralSection } from "./ReferralSection";
import { LowCreditAlert } from "./LowCreditAlert";
import { UserFeedback } from "./UserFeedback";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
import { AnimatePresence, motion } from "framer-motion";
import { Users } from "lucide-react";

interface AIToolsTabProps {
  userId?: string;
}

type ActiveTool = "home" | "image" | "video" | "speech" | "faceswap" | "upscale" | "bgremove" | "bgstudio" | "youtube" | "docslide" | "caption" | "adgenerator" | "autoad" | "socialmedia" | "videocopywriting" | "copyrightchecker" | "storyvideo" | "scenesummarizer" | "songmtv";

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
      default: return null;
    }
  };

  return (
    <div className="min-h-screen">
      <LowCreditAlert 
        credits={credits} 
        show={showLowCreditAlert} 
        onClose={() => setShowLowCreditAlert(false)} 
      />

      <AnimatePresence mode="wait">
        {activeTool === "home" ? (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-4 p-4 pb-24"
          >
            {/* Header */}
            <div className="text-center pt-2">
              <div className="inline-flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-primary animate-pulse" />
                <h1 className="text-xl font-bold text-primary font-myanmar">{t('dashboard.title')}</h1>
                <Crown className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <p className="text-muted-foreground text-xs font-myanmar">
                {t('dashboard.subtitle')}
              </p>
            </div>

            {/* Top-up Buttons */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2">
              <button onClick={() => navigate("/top-up")} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all">
                <Wallet className="w-5 h-5 text-primary" />
                <span className="text-sm text-primary font-medium font-myanmar">{t('dashboard.topupBtn')}</span>
              </button>
              <button onClick={() => navigate("/earn-credits")} className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-success/10 border border-success/30 hover:bg-success/20 transition-all">
                <Gift className="w-5 h-5 text-success" />
                <span className="text-sm text-success font-medium font-myanmar">{t('dashboard.earnCredits')}</span>
              </button>
            </motion.div>

            {/* AI Chatbot */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <AIChatbot userId={userId} />
            </motion.div>

            {/* 🔥 Premium Tools */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-myanmar">Premium Tools</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ToolCardCompact icon={Music} title={t('tool.songMtv') || 'AI သီချင်း & MTV'} description={t('tool.songMtv.desc') || 'သီချင်းနှင့် MTV ဖန်တီး'} gradient="bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700" onClick={() => setActiveTool("songmtv")} credits={costs.song_mtv} badge="PREMIUM" badgeTooltip="AI Song & MTV Creator" />
                <ToolCardCompact icon={Zap} title={t('tool.autoAd') || 'Auto ကြော်ငြာ'} description={t('tool.autoAd.desc') || 'AI အော်တိုကြော်ငြာ'} gradient="bg-gradient-to-br from-orange-500 via-amber-600 to-yellow-700" onClick={() => setActiveTool("autoad")} credits={costs.auto_ad} badge="PREMIUM" badgeTooltip="Full Auto Ad Generator" />
              </div>
            </motion.div>

            {/* Image Tools */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center gap-2 mb-2">
                <Image className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-myanmar">{t('tools.image')}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ToolCardCompact icon={Image} title={t('tool.imageGen')} description={t('tool.imageGen.desc')} gradient="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700" onClick={() => setActiveTool("image")} credits={costs.image_generation} size="small" />
                <ToolCardCompact icon={ZoomIn} title={t('tool.upscale')} description={t('tool.upscale.desc')} gradient="bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-700" onClick={() => setActiveTool("upscale")} credits={costs.upscale} size="small" />
                <ToolCardCompact icon={Eraser} title={t('tool.bgRemove')} description={t('tool.bgRemove.desc')} gradient="bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700" onClick={() => setActiveTool("bgremove")} credits={costs.bg_remove} size="small" />
                <ToolCardCompact icon={Palette} title={t('tool.bgStudio') || 'BG Studio'} description={t('tool.bgStudio.desc') || 'နောက်ခံပြောင်း'} gradient="bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-700" onClick={() => setActiveTool("bgstudio")} credits={costs.bg_studio} size="small" badge="NEW" badgeTooltip="AI Background Studio" />
              </div>
            </motion.div>

            {/* Video Tools */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-myanmar">{t('tools.video')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ToolCardCompact icon={Video} title={t('tool.videoGen')} description={t('tool.videoGen.desc')} gradient="bg-gradient-to-br from-red-500 via-rose-600 to-pink-700" onClick={() => setActiveTool("video")} credits={costs.video_generation} />
                <ToolCardCompact icon={Users} title={t('tool.faceSwap')} description={t('tool.faceSwap.desc')} gradient="bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700" onClick={() => setActiveTool("faceswap")} credits={costs.face_swap} />
                <ToolCardCompact icon={Captions} title={t('tool.caption')} description={t('tool.caption.desc')} gradient="bg-gradient-to-br from-amber-500 via-orange-600 to-red-700" onClick={() => setActiveTool("caption")} credits={costs.caption_per_minute} />
                <ToolCardCompact icon={Megaphone} title={t('tool.adGen')} description={t('tool.adGen.desc')} gradient="bg-gradient-to-br from-pink-500 via-fuchsia-600 to-purple-700" onClick={() => setActiveTool("adgenerator")} credits={costs.ad_generator} />
                <ToolCardCompact icon={Crown} title={t('tool.videoCopy')} description={t('tool.videoCopy.desc')} gradient="bg-gradient-to-br from-amber-500 via-yellow-600 to-orange-700" onClick={() => setActiveTool("videocopywriting")} credits={costs.ai_chat * 3} badge="PRO" badgeTooltip="Our most powerful AI video tool" />
                <ToolCardCompact icon={Shield} title={t('tool.copyright')} description={t('tool.copyright.desc')} gradient="bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700" onClick={() => setActiveTool("copyrightchecker")} credits={costs.copyright_check} badge="NEW" badgeTooltip="AI Copyright Safety Analysis" />
                <ToolCardCompact icon={BookOpen} title={t('tool.storyVideo')} description={t('tool.storyVideo.desc')} gradient="bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700" onClick={() => setActiveTool("storyvideo")} credits={costs.story_video} badge="NEW" badgeTooltip="AI Story-to-Video with Character Lock" />
                <ToolCardCompact icon={ListChecks} title={t('tool.sceneSumm')} description={t('tool.sceneSumm.desc')} gradient="bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700" onClick={() => setActiveTool("scenesummarizer")} credits={costs.scene_summarizer} />
              </div>
            </motion.div>

            {/* Speech/Text */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-myanmar">{t('tools.speech')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ToolCardCompact icon={Volume2} title={t('tool.tts')} description={t('tool.tts.desc')} gradient="bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700" onClick={() => setActiveTool("speech")} credits={costs.text_to_speech} />
                <ToolCardCompact icon={Youtube} title={t('tool.youtubeText')} description={t('tool.youtubeText.desc')} gradient="bg-gradient-to-br from-red-500 via-red-600 to-rose-700" onClick={() => setActiveTool("youtube")} credits={costs.youtube_to_text} />
              </div>
            </motion.div>

            {/* Social Media */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33 }}>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-myanmar">{t('tools.social')}</h2>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <ToolCardCompact icon={Briefcase} title={t('tool.socialMedia')} description={t('tool.socialMedia.desc')} gradient="bg-gradient-to-br from-fuchsia-500 via-pink-600 to-rose-700" onClick={() => setActiveTool("socialmedia")} credits={costs.social_media_agent} />
              </div>
            </motion.div>

            {/* Document Tools */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-myanmar">{t('tools.document')}</h2>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <ToolCardCompact icon={FileText} title={t('tool.docSlide')} description={t('tool.docSlide.desc')} gradient="bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700" onClick={() => setActiveTool("docslide")} credits={docSlideCost} />
              </div>
            </motion.div>

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
              <p className="text-xs text-muted-foreground leading-relaxed font-myanmar">
                {t('dashboard.tipText')}
              </p>
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
