import { Gift, X } from "lucide-react";
import { useState } from "react";

export const PromoBanner = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="gradient-banner py-3 px-4 relative animate-fade-up">
      <div className="flex items-center justify-center gap-2 max-w-lg mx-auto">
        <Gift className="w-5 h-5 text-primary-foreground animate-pulse-soft" />
        <p className="text-sm font-semibold text-primary-foreground text-center">
          ပထမဆုံးအကြိမ် ငွေဖြည့်သူများအတွက် Bonus ၂၀% ထပ်ဆောင်းရယူပါ
        </p>
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-primary-foreground/10 transition-colors"
      >
        <X className="w-4 h-4 text-primary-foreground" />
      </button>
    </div>
  );
};
