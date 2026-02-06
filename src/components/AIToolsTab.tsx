import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Image, Video, Volume2, Crown, Wallet, Users, Gift, 
  ZoomIn, Eraser, Sparkles, Youtube, FileText
} from "lucide-react";
import { ImageTool } from "./tools/ImageTool";
import { VideoTool } from "./tools/VideoTool";
import { SpeechTool } from "./tools/SpeechTool";
import { FaceSwapTool } from "./tools/FaceSwapTool";
import { UpscaleTool } from "./tools/UpscaleTool";
import { BgRemoveTool } from "./tools/BgRemoveTool";
import { YouTubeToTextTool } from "./tools/YouTubeToTextTool";
import { DocSlideTool } from "./tools/DocSlideTool";
import { ToolCardCompact } from "./ToolCardCompact";
import { AIChatbot } from "./AIChatbot";
import { ReferralSection } from "./ReferralSection";
import { LowCreditAlert } from "./LowCreditAlert";
import { CreditDisplay } from "./CreditDisplay";
import { VideoEditor } from "./VideoEditor";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { useUserRole } from "@/hooks/useUserRole";
import { AnimatePresence, motion } from "framer-motion";

interface AIToolsTabProps {
  userId?: string;
}

type ActiveTool = "home" | "image" | "video" | "speech" | "faceswap" | "upscale" | "bgremove" | "youtube" | "docslide";

export const AIToolsTab = ({ userId }: AIToolsTabProps) => {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ActiveTool>("home");
  const [showLowCreditAlert, setShowLowCreditAlert] = useState(false);
  const { costs } = useCreditCosts();
  const { credits, isLoading: creditsLoading } = useCredits(userId);
  const { isAdmin } = useUserRole(userId);

  // Show low credit alert when credits fall below 5
  useEffect(() => {
    if (!creditsLoading && credits <= 5 && credits > 0) {
      setShowLowCreditAlert(true);
    }
  }, [credits, creditsLoading]);

  const handleBack = () => {
    setActiveTool("home");
  };

  // Doc/Slide estimated cost
  const docSlideCost = Math.ceil((2 + 3 * 5) * 1.4); // base estimate

  return (
    <div className="min-h-screen">
      {/* Low Credit Alert */}
      <LowCreditAlert 
        credits={credits} 
        show={showLowCreditAlert} 
        onClose={() => setShowLowCreditAlert(false)} 
      />

      <AnimatePresence mode="wait">
        {activeTool === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-4 p-4 pb-24"
          >
            {/* === TOP SECTION: Header & Credits === */}
            <div className="text-center pt-2">
              <div className="inline-flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-primary animate-pulse" />
                <h1 className="text-xl font-bold text-primary font-myanmar">Myanmar AI Studio</h1>
                <Crown className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <p className="text-muted-foreground text-xs font-myanmar">
                သင့်စိတ်ကူးကို AI ဖြင့် အကောင်အထည်ဖော်ပါ
              </p>
            </div>

            {/* Top-up and Campaign Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex gap-2"
            >
              <button
                onClick={() => navigate("/top-up")}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all"
              >
                <Wallet className="w-5 h-5 text-primary" />
                <span className="text-sm text-primary font-medium font-myanmar">ငွေဖြည့်မည်</span>
              </button>
              <button
                onClick={() => navigate("/earn-credits")}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-success/10 border border-success/30 hover:bg-success/20 transition-all"
              >
                <Gift className="w-5 h-5 text-success" />
                <span className="text-sm text-success font-medium font-myanmar">Earn Credits</span>
              </button>
            </motion.div>

            {/* === MIDDLE SECTION: AI Chatbot === */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <AIChatbot userId={userId} />
            </motion.div>

            {/* === BOTTOM SECTION: Tool Categories === */}
            {/* Image Tools Category */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Image className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-myanmar">ပုံ Tools</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ToolCardCompact
                  icon={Image}
                  title="ပုံထုတ်ရန်"
                  description="AI ပုံဆွဲ"
                  gradient="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700"
                  onClick={() => setActiveTool("image")}
                  credits={costs.image_generation}
                  size="small"
                />
                <ToolCardCompact
                  icon={ZoomIn}
                  title="4K Upscale"
                  description="Resolution မြှင့်"
                  gradient="bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-700"
                  onClick={() => setActiveTool("upscale")}
                  credits={costs.upscale}
                  size="small"
                />
                <ToolCardCompact
                  icon={Eraser}
                  title="BG Remove"
                  description="Background ဖယ်"
                  gradient="bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700"
                  onClick={() => setActiveTool("bgremove")}
                  credits={costs.bg_remove}
                  size="small"
                />
              </div>
            </motion.div>

            {/* Video Tools Category */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-myanmar">ဗီဒီယို Tools</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ToolCardCompact
                  icon={Video}
                  title="ဗီဒီယိုထုတ်ရန်"
                  description="ပုံမှ ဗီဒီယို"
                  gradient="bg-gradient-to-br from-red-500 via-rose-600 to-pink-700"
                  onClick={() => setActiveTool("video")}
                  credits={costs.video_generation}
                />
                <ToolCardCompact
                  icon={Users}
                  title="Face Swap"
                  description="မျက်နှာပြောင်း"
                  gradient="bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700"
                  onClick={() => setActiveTool("faceswap")}
                  credits={costs.face_swap}
                />
              </div>
            </motion.div>

            {/* Speech/Text Category */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-myanmar">အသံ/စာ Tools</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ToolCardCompact
                  icon={Volume2}
                  title="အသံ ↔ စာ"
                  description="Text-to-Speech & STT"
                  gradient="bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700"
                  onClick={() => setActiveTool("speech")}
                  credits={costs.text_to_speech}
                />
                <ToolCardCompact
                  icon={Youtube}
                  title="YouTube → စာ"
                  description="ဗီဒီယိုမှ စာထုတ်"
                  gradient="bg-gradient-to-br from-red-500 via-red-600 to-rose-700"
                  onClick={() => setActiveTool("youtube")}
                  credits={costs.youtube_to_text}
                />
              </div>
            </motion.div>

            {/* Doc & Slide Generator - NEW */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground font-myanmar">Document Tools</h2>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <ToolCardCompact
                  icon={FileText}
                  title="AI Doc & Slide"
                  description="PDF, PPTX, DOCX ဖန်တီးမည်"
                  gradient="bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700"
                  onClick={() => setActiveTool("docslide")}
                  credits={docSlideCost}
                />
              </div>
            </motion.div>

            {/* Referral Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <ReferralSection userId={userId} />
            </motion.div>

            {/* Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="gradient-card rounded-2xl p-4 border border-primary/20"
            >
              <h3 className="text-sm font-semibold text-primary mb-1 font-myanmar">💡 အကြံပြုချက်</h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-myanmar">
                အကောင်းဆုံး ရလဒ်ရရှိရန် အသေးစိတ် ဖော်ပြချက်များ ထည့်သွင်းပါ။ ဥပမာ - အရောင်၊ ပုံစံ၊ ခံစားချက် စသည်တို့ ပါဝင်စေပါ။
              </p>
            </motion.div>
          </motion.div>
        )}

        {activeTool === "image" && (
          <ImageTool key="image" userId={userId} onBack={handleBack} />
        )}

        {activeTool === "video" && (
          <VideoTool key="video" userId={userId} onBack={handleBack} />
        )}

        {activeTool === "speech" && (
          <SpeechTool key="speech" userId={userId} onBack={handleBack} />
        )}

        {activeTool === "faceswap" && (
          <FaceSwapTool key="faceswap" userId={userId} onBack={handleBack} />
        )}

        {activeTool === "upscale" && (
          <UpscaleTool key="upscale" userId={userId} onBack={handleBack} />
        )}

        {activeTool === "bgremove" && (
          <BgRemoveTool key="bgremove" userId={userId} onBack={handleBack} />
        )}

        {activeTool === "youtube" && (
          <YouTubeToTextTool key="youtube" userId={userId} onBack={handleBack} />
        )}

        {activeTool === "docslide" && (
          <DocSlideTool key="docslide" userId={userId} onBack={handleBack} />
        )}
      </AnimatePresence>
    </div>
  );
};
