import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image, Video, Volume2, Crown, Settings, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageTool } from "./tools/ImageTool";
import { VideoTool } from "./tools/VideoTool";
import { SpeechTool } from "./tools/SpeechTool";

interface AIToolsTabProps {
  userId?: string;
}

export const AIToolsTab = ({ userId }: AIToolsTabProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("image");

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 mb-1">
          <Crown className="w-5 h-5 text-primary animate-pulse-soft" />
          <h1 className="text-xl font-bold text-glow-gold text-primary">Myanmar AI</h1>
          <Crown className="w-5 h-5 text-primary animate-pulse-soft" />
        </div>
        <p className="text-muted-foreground text-xs">
          သင့်စိတ်ကူးကို AI ဖြင့် အကောင်အထည်ဖော်ပါ
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 animate-fade-up">
        <button
          onClick={() => navigate("/api-settings")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-secondary/50 border border-border hover:bg-secondary transition-colors"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">API ဆက်တင်</span>
        </button>
        <button
          onClick={() => navigate("/top-up")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors"
        >
          <Wallet className="w-4 h-4 text-primary" />
          <span className="text-xs text-primary font-medium">ငွေဖြည့်မည်</span>
        </button>
      </div>

      {/* Tool Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full animate-fade-up">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-secondary/50 rounded-xl">
          <TabsTrigger 
            value="image" 
            className="flex flex-col items-center gap-1 py-3 px-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
          >
            <Image className="w-5 h-5" />
            <span className="text-[10px] font-medium">ပုံထုတ်ရန်</span>
          </TabsTrigger>
          <TabsTrigger 
            value="video" 
            className="flex flex-col items-center gap-1 py-3 px-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
          >
            <Video className="w-5 h-5" />
            <span className="text-[10px] font-medium">ဗီဒီယိုထုတ်ရန်</span>
          </TabsTrigger>
          <TabsTrigger 
            value="speech" 
            className="flex flex-col items-center gap-1 py-3 px-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
          >
            <Volume2 className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight">အသံ/စာ</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="image" className="mt-0">
            <ImageTool userId={userId} />
          </TabsContent>

          <TabsContent value="video" className="mt-0">
            <VideoTool userId={userId} />
          </TabsContent>

          <TabsContent value="speech" className="mt-0">
            <SpeechTool userId={userId} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Info Card */}
      <div className="gradient-card rounded-2xl p-3 border border-primary/20 animate-fade-up mt-2">
        <h3 className="text-sm font-semibold text-primary mb-1">💡 အကြံပြုချက်</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          အကောင်းဆုံး ရလဒ်ရရှိရန် အသေးစိတ် ဖော်ပြချက်များ ထည့်သွင်းပါ။ ဥပမာ - အရောင်၊ ပုံစံ၊ ခံစားချက် စသည်တို့ ပါဝင်စေပါ။
        </p>
      </div>
    </div>
  );
};
