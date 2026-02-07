import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Globe, Users, Zap, Shield, Heart } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const About = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const milestones = [
    { icon: Sparkles, title: "AI-Powered Tools", desc: "မြန်မာနိုင်ငံအတွက် ပထမဆုံး AI Video & Content Platform" },
    { icon: Globe, title: "Multi-Language", desc: "မြန်မာ၊ English၊ Thai၊ Chinese အပါအဝင် ဘာသာ ၉ မျိုး support" },
    { icon: Users, title: "Creator Community", desc: "Content Creators များအတွက် Professional Tools များ" },
    { icon: Zap, title: "Fast & Reliable", desc: "Cloud-based infrastructure ဖြင့် မြန်ဆန်သော processing" },
    { icon: Shield, title: "Secure Platform", desc: "End-to-end encryption နှင့် secure data storage" },
    { icon: Heart, title: "Made with Love", desc: "မြန်မာ developers များ ဖန်တီးထားသော platform" },
  ];

  return (
    <div className="min-h-screen gradient-navy">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">About Myanmar AI</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8 pb-24">
        {/* Hero Section */}
        <div className="text-center space-y-4 animate-fade-up">
          <div className="w-24 h-24 mx-auto rounded-2xl gradient-gold flex items-center justify-center shadow-gold-lg">
            <Sparkles className="w-12 h-12 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Myanmar AI Studio</h2>
            <p className="text-primary font-semibold text-sm mt-1">Next-Gen Video Creator</p>
          </div>
        </div>

        {/* Founder Section */}
        <div className="gradient-card rounded-2xl border border-border/50 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Founder</h3>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center shadow-gold shrink-0">
              <span className="text-2xl font-bold text-primary-foreground">K</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Ko Ko Phyo</h3>
              <p className="text-sm text-muted-foreground">Founder & CEO</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Ko Ko Phyo သည် မြန်မာနိုင်ငံတွင် AI Technology ကို လူတိုင်းလက်လှမ်းမီစေရန် ရည်ရွယ်ချက်ဖြင့် 
            Myanmar AI Studio ကို တည်ထောင်ခဲ့ပါသည်။ Content Creators များ၊ စီးပွားရေးလုပ်ငန်းများနှင့် 
            ပညာရေးနယ်ပယ်အတွက် ခေတ်မီ AI Tools များကို တတ်နိုင်သော ဈေးနှုန်းဖြင့် ပေးအပ်နေပါသည်။
          </p>

          <div className="flex gap-3 pt-2">
            <div className="flex-1 bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-primary">15+</p>
              <p className="text-xs text-muted-foreground">AI Tools</p>
            </div>
            <div className="flex-1 bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-primary">9</p>
              <p className="text-xs text-muted-foreground">Languages</p>
            </div>
            <div className="flex-1 bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-primary">24/7</p>
              <p className="text-xs text-muted-foreground">Support</p>
            </div>
          </div>
        </div>

        {/* Mission */}
        <div className="gradient-card rounded-2xl border border-border/50 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Our Mission</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            မြန်မာနိုင်ငံရဲ့ Digital Content Creator Community ကို AI Technology ဖြင့် တိုးတက်စေရန်၊ 
            ကမ္ဘာ့အဆင့်မီ Video Editing နှင့် Content Creation Tools များကို မြန်မာဘာသာဖြင့် 
            အသုံးပြုနိုင်စေရန် ကျွန်ုပ်တို့ ကြိုးပမ်းနေပါသည်။
          </p>
        </div>

        {/* Features Grid */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Platform Features</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {milestones.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="gradient-card rounded-xl border border-border/50 p-4 space-y-2 hover:border-primary/30 transition-colors"
                >
                  <Icon className="w-6 h-6 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2 pt-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Myanmar AI Studio. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Founded by <span className="text-primary font-semibold">Ko Ko Phyo</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
