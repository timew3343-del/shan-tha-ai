import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image, Video, Volume2, Crown, Wallet, Users, Gift } from "lucide-react";
import { ImageTool } from "./tools/ImageTool";
import { VideoTool } from "./tools/VideoTool";
import { SpeechTool } from "./tools/SpeechTool";
import { FaceSwapTool } from "./tools/FaceSwapTool";
import { ToolCardCompact } from "./ToolCardCompact";
import { AIChatbot } from "./AIChatbot";
import { CampaignModal } from "./CampaignModal";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { AnimatePresence, motion } from "framer-motion";

interface AIToolsTabProps {
  userId?: string;
}

type ActiveTool = "home" | "image" | "video" | "speech" | "faceswap";

export const AIToolsTab = ({ userId }: AIToolsTabProps) => {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ActiveTool>("home");
  const [showCampaign, setShowCampaign] = useState(false);
  const { costs } = useCreditCosts();

  const handleBack = () => {
    setActiveTool("home");
  };

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {activeTool === "home" && (
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
                <h1 className="text-xl font-bold text-primary font-myanmar">Myanmar AI</h1>
                <Crown className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <p className="text-muted-foreground text-xs font-myanmar">
                သင့်စိတ်ကူးကို AI ဖြင့် အကောင်အထည်ဖော်ပါ
              </p>
            </div>

            {/* Quick Actions */}
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
                onClick={() => setShowCampaign(true)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-all"
              >
                <Gift className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-600 font-medium font-myanmar">Campaign</span>
              </button>
            </motion.div>

            {/* Premium Tool Cards - Horizontal Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="grid grid-cols-2 gap-2">
                <ToolCardCompact
                  icon={Image}
                  title="ပုံထုတ်ရန်"
                  description="AI ဖြင့် ပုံဆွဲခြင်း"
                  gradient="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700"
                  onClick={() => setActiveTool("image")}
                  credits={costs.image_generation}
                />

                <ToolCardCompact
                  icon={Video}
                  title="ဗီဒီယိုထုတ်ရန်"
                  description="ပုံမှ ဗီဒီယို"
                  gradient="bg-gradient-to-br from-red-500 via-rose-600 to-pink-700"
                  onClick={() => setActiveTool("video")}
                  credits={costs.video_generation}
                />

                <ToolCardCompact
                  icon={Volume2}
                  title="အသံ/စာ"
                  description="Text ↔ Speech"
                  gradient="bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700"
                  onClick={() => setActiveTool("speech")}
                  credits={costs.text_to_speech}
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

            {/* AI Chatbot Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <AIChatbot userId={userId} />
            </motion.div>

            {/* Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
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
      </AnimatePresence>

      {/* Campaign Modal */}
      <CampaignModal
        isOpen={showCampaign}
        onClose={() => setShowCampaign(false)}
        userId={userId}
      />
    </div>
  );
};
