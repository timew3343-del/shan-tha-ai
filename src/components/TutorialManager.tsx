import { useState, useEffect, useCallback } from "react";
import Joyride, { CallBackProps, STATUS, Step, Styles } from "react-joyride";

interface TutorialManagerProps {
  tourKey: string;
  steps: Step[];
  run?: boolean;
}

const TOUR_STORAGE_PREFIX = "myanmar-ai-tour-";

const joyrideStyles: Partial<Styles> = {
  options: {
    arrowColor: "hsl(var(--card))",
    backgroundColor: "hsl(var(--card))",
    overlayColor: "rgba(0, 0, 0, 0.6)",
    primaryColor: "hsl(var(--primary))",
    textColor: "hsl(var(--foreground))",
    zIndex: 10000,
    spotlightShadow: "0 0 30px rgba(0, 0, 0, 0.5)",
  },
  spotlight: {
    borderRadius: 16,
  },
  tooltip: {
    borderRadius: 16,
    padding: "16px 20px",
    fontSize: 14,
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px hsl(var(--border))",
  },
  tooltipContainer: {
    textAlign: "left" as const,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
    color: "hsl(var(--primary))",
  },
  tooltipContent: {
    padding: "8px 0",
    fontSize: 13,
    lineHeight: 1.7,
  },
  buttonNext: {
    backgroundColor: "hsl(var(--primary))",
    color: "hsl(var(--primary-foreground))",
    borderRadius: 12,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 600,
    outline: "none",
    border: "none",
  },
  buttonBack: {
    color: "hsl(var(--muted-foreground))",
    fontSize: 13,
    marginRight: 8,
  },
  buttonSkip: {
    color: "hsl(var(--muted-foreground))",
    fontSize: 12,
  },
  buttonClose: {
    color: "hsl(var(--muted-foreground))",
  },
  beacon: {
    display: "none",
  },
  beaconInner: {
    backgroundColor: "hsl(var(--primary))",
  },
  beaconOuter: {
    borderColor: "hsl(var(--primary))",
    backgroundColor: "hsl(var(--primary) / 0.2)",
  },
};

const locale = {
  back: "အရင်တစ်ခု",
  close: "ပိတ်ရန်",
  last: "ပြီးပြီ",
  next: "နောက်တစ်ခု",
  open: "ဖွင့်ရန်",
  skip: "ကျော်ရန်",
};

export const TutorialManager = ({ tourKey, steps, run: externalRun }: TutorialManagerProps) => {
  const [run, setRun] = useState(false);
  const [validSteps, setValidSteps] = useState<Step[]>([]);

  useEffect(() => {
    const storageKey = TOUR_STORAGE_PREFIX + tourKey;
    const isCompleted = localStorage.getItem(storageKey) === "completed";
    
    if (isCompleted && externalRun === undefined) {
      return;
    }

    // Filter steps to only those whose target elements exist
    const checkSteps = () => {
      const available = steps.filter((step) => {
        if (typeof step.target === "string") {
          return document.querySelector(step.target) !== null;
        }
        return true;
      });
      
      if (available.length > 0) {
        setValidSteps(available);
        setRun(externalRun ?? true);
      }
    };

    // Delay to let DOM render
    const timer = setTimeout(checkSteps, 1200);
    return () => clearTimeout(timer);
  }, [tourKey, steps, externalRun]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      setRun(false);
      const storageKey = TOUR_STORAGE_PREFIX + tourKey;
      localStorage.setItem(storageKey, "completed");
    }
  }, [tourKey]);

  if (validSteps.length === 0 || !run) return null;

  return (
    <Joyride
      steps={validSteps}
      run={run}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableOverlayClose
      spotlightClicks={false}
      locale={locale}
      styles={joyrideStyles}
      callback={handleCallback}
      floaterProps={{
        disableAnimation: false,
        styles: {
          floater: {
            filter: "none",
          },
        },
      }}
    />
  );
};

// Pre-defined tour configurations
export const DASHBOARD_TOUR_STEPS: Step[] = [
  {
    target: "#credit-display",
    title: "💰 Credit လက်ကျန်",
    content: "ဒီနေရာမှာ သင့်ရဲ့ Credit လက်ကျန်ကို မြင်ရပါမယ်။ AI Tool တိုင်းအတွက် Credit လိုအပ်ပါတယ်။",
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: "#search-bar",
    title: "🔍 Tool ရှာရန်",
    content: "ဒီနေရာမှာ သင်လိုချင်တဲ့ AI Tool ကို အမည်ဖြင့် ရှာဖွေနိုင်ပါတယ်။ ဥပမာ - 'Face', 'Video', 'Logo'",
    placement: "bottom",
  },
  {
    target: "#category-tabs",
    title: "📂 Tool အမျိုးအစား",
    content: "ဒီနေရာမှာတော့ Tool များကို အမျိုးအစားအလိုက် ခွဲကြည့်နိုင်ပါတယ် - ပုံရိပ်၊ ဗီဒီယို၊ အသံ",
    placement: "bottom",
  },
  {
    target: "#tools-grid",
    title: "🎨 AI Tools များ",
    content: "ဒီနေရာမှာ AI Tool အားလုံးကို မြင်ရပါမယ်။ နှိပ်ပြီး စတင်အသုံးပြုနိုင်ပါပြီ။",
    placement: "top",
  },
  {
    target: "#topup-btn",
    title: "💳 ငွေဖြည့်ရန်",
    content: "Credit ကုန်ရင် ဒီခလုတ်ကို နှိပ်ပြီး ငွေဖြည့်နိုင်ပါတယ်။ KBZPay, WavePay, SCB Bank တို့ဖြင့် ဖြည့်နိုင်ပါတယ်။",
    placement: "bottom",
  },
];

export const TOOL_TOUR_STEPS: Step[] = [
  {
    target: "#input-area",
    title: "📝 Input နေရာ",
    content: "ဒီနေရာမှာ သင်သိလိုတဲ့အကြောင်းအရာ ဒါမှမဟုတ် ခိုင်းစေလိုတာကို မြန်မာလို ရေးထည့်ပါ",
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: "#settings-panel",
    title: "⚙️ ပုံစံရွေးချယ်ရန်",
    content: "ဒီနေရာမှာတော့ AI ရဲ့ ပုံစံ ဒါမှမဟုတ် Tool အမျိုးအစားကို ရွေးချယ်နိုင်ပါတယ်",
    placement: "bottom",
  },
  {
    target: "#generate-btn",
    title: "🚀 ရလဒ်ထုတ်ယူရန်",
    content: "အားလုံးပြီးရင်တော့ ဒီခလုတ်ကို နှိပ်ပြီး ရလဒ်ထုတ်ယူနိုင်ပါပြီ",
    placement: "top",
  },
  {
    target: "#result-display",
    title: "✨ ရလဒ်",
    content: "သင့်ရဲ့ ရလဒ်တွေကို ဒီနေရာမှာ မြင်တွေ့ရမှာ ဖြစ်ပါတယ်။",
    placement: "top",
  },
];

// Helper to reset a tour (for testing or re-showing)
export const resetTour = (tourKey: string) => {
  localStorage.removeItem(TOUR_STORAGE_PREFIX + tourKey);
};

export const isTourCompleted = (tourKey: string): boolean => {
  return localStorage.getItem(TOUR_STORAGE_PREFIX + tourKey) === "completed";
};
