import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Send, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Support = () => {
  const navigate = useNavigate();

  const openTelegram = () => {
    window.open("https://t.me/MyanmarAIStudio", "_blank");
  };

  const openMessenger = () => {
    window.open("https://m.me/MyanmarAIStudio", "_blank");
  };

  return (
    <div className="min-h-screen gradient-navy pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">အကူအညီ နှင့် ဆက်သွယ်ရန်</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Support Info Card */}
        <div className="gradient-card rounded-2xl p-6 border border-primary/20 animate-fade-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">ဆက်သွယ်ရန်</h2>
          </div>
          
          <p className="text-muted-foreground leading-relaxed mb-6">
            ငွေလွှဲပြီး ၁ မိနစ်အတွင်း ခရက်ဒစ် မတိုးပါက သို့မဟုတ် အခက်အခဲရှိပါက 
            ၂၄ နာရီအတွင်း ဆက်သွယ်နိုင်ပါသည်။
          </p>

          <div className="space-y-3">
            <Button
              onClick={openTelegram}
              className="w-full py-6 rounded-2xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold text-base"
            >
              <Send className="w-5 h-5 mr-3" />
              Telegram မှ ဆက်သွယ်ရန်
            </Button>

            <Button
              onClick={openMessenger}
              className="w-full py-6 rounded-2xl bg-gradient-to-r from-[#00B2FF] to-[#006AFF] hover:from-[#0099DD] hover:to-[#0055DD] text-white font-semibold text-base"
            >
              <MessageCircle className="w-5 h-5 mr-3" />
              Messenger မှ ဆက်သွယ်ရန်
            </Button>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="gradient-card rounded-2xl p-6 border border-border/30 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <h3 className="font-semibold text-foreground mb-4">မေးလေ့ရှိသော မေးခွန်းများ</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-secondary/30 rounded-xl">
              <p className="text-sm font-medium text-foreground mb-2">Credits ဘယ်လောက်ကြာ ဝင်မလဲ?</p>
              <p className="text-sm text-muted-foreground">
                ငွေလွှဲပြီး Screenshot တင်ပြီးတာနဲ့ ၁ မိနစ်အတွင်း အလိုအလျောက် ဝင်ပါမည်။
              </p>
            </div>

            <div className="p-4 bg-secondary/30 rounded-xl">
              <p className="text-sm font-medium text-foreground mb-2">Credit ပြန်အမ်းလို့ ရလား?</p>
              <p className="text-sm text-muted-foreground">
                ဝယ်ယူပြီး Credit များကို ပြန်အမ်းပေးခြင်း မရှိပါ။
              </p>
            </div>

            <div className="p-4 bg-secondary/30 rounded-xl">
              <p className="text-sm font-medium text-foreground mb-2">ပထမဆုံးအကြိမ် ဝယ်ရင် Bonus ရလား?</p>
              <p className="text-sm text-muted-foreground">
                ဟုတ်ကဲ့၊ ပထမဆုံးအကြိမ် ဝယ်ယူသူများအတွက် ၂၀% Bonus ထပ်ဆောင်းပေးပါသည်။
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
