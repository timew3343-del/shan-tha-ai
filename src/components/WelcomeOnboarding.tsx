import { useState, useEffect } from "react";
import { Sparkles, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface WelcomeOnboardingProps {
  userId?: string;
}

export const WelcomeOnboarding = ({ userId }: WelcomeOnboardingProps) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!userId) return;
    // Show only for FIRST-TIME users, never again (localStorage persists)
    const storageKey = `welcome_dismissed_${userId}`;
    if (!localStorage.getItem(storageKey)) {
      setShowWelcome(true);
    }
  }, [userId]);

  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem(`welcome_dismissed_${userId}`, "true");
  };

  const STEPS = [
    {
      icon: "👋",
      title: "Myanmar AI Studio မှ ကြိုဆိုပါတယ်!",
      description: "AI Tools 50+ ခုကို အသုံးပြုနိုင်ပါပြီ။ ပုံထုပ်ခြင်း၊ ဗီဒီယိုထုပ်ခြင်း၊ သီချင်းဖန်တီးခြင်း စသဖြင့် အားလုံးကို AI ဖြင့် လုပ်ဆောင်နိုင်ပါသည်။",
    },
    {
      icon: "💰",
      title: "Credit Balance ကြည့်နည်း",
      description: "သင့် Credit Balance ကို အပေါ်ဘက် ညာဘက်ထောင့်တွင် မြင်ရပါမည်။ Tool တစ်ခုချင်းစီ Credit ကုန်ကျစရိတ် ကွာခြားပါသည်။",
    },
    {
      icon: "🛒",
      title: "Credit ဝယ်နည်း",
      description: "Credit ထပ်ဝယ်ရန် 'ငွေဖြည့်ရန်' ကို နှိပ်ပါ။ KBZ Pay, Wave Pay, Bank Transfer နှင့် Stripe (Visa/Master) ဖြင့် ဝယ်နိုင်ပါသည်။",
    },
  ];

  if (!showWelcome) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="w-full max-w-sm gradient-card rounded-3xl p-6 border border-primary/30 shadow-2xl relative"
        >
          <button onClick={dismissWelcome} className="absolute top-3 right-3 p-1.5 rounded-full bg-secondary/50 hover:bg-secondary">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="text-center mb-6">
            <div className="text-5xl mb-3">{STEPS[step].icon}</div>
            <h2 className="text-lg font-bold text-foreground font-myanmar mb-2">{STEPS[step].title}</h2>
            <p className="text-sm text-muted-foreground font-myanmar leading-relaxed">{STEPS[step].description}</p>
          </div>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-4">
            {STEPS.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? "bg-primary w-6" : "bg-muted"}`} />
            ))}
          </div>

          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <>
                <Button variant="ghost" onClick={dismissWelcome} className="flex-1 text-xs font-myanmar">ကျော်မည်</Button>
                <Button onClick={() => setStep(s => s + 1)} className="flex-1 text-xs font-myanmar">
                  ရှေ့ဆက်မည် <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </>
            ) : (
              <Button onClick={dismissWelcome} className="w-full font-myanmar">
                <Sparkles className="w-4 h-4 mr-2" /> စတင်အသုံးပြုမည်
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
