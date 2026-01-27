import { Gift, X, Sparkles, ArrowRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const slides = [
  {
    id: 1,
    text: "ပထမဆုံးအကြိမ် ငွေဖြည့်သူများအတွက် Bonus Credit ၂၀% ပိုပေးမည်",
    highlight: "၂၀%",
  },
  {
    id: 2,
    text: "AI ပုံဆွဲခြင်း၊ Video နှင့် Speech ပြောင်းခြင်း အားလုံး တစ်နေရာတည်းမှာ",
    highlight: "AI",
  },
  {
    id: 3,
    text: "မြန်မာငွေဖြင့် လွယ်ကူစွာ Credit ဝယ်ယူနိုင်ပါပြီ",
    highlight: "Credit",
  },
];

export const PromoBanner = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, []);

  useEffect(() => {
    const interval = setInterval(nextSlide, 3000);
    return () => clearInterval(interval);
  }, [nextSlide]);

  if (!isVisible) return null;

  const slide = slides[currentSlide];

  return (
    <div 
      onClick={() => navigate("/top-up")}
      className="relative overflow-hidden cursor-pointer group"
    >
      {/* Luxury Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy-dark via-navy to-navy-dark" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20" />
      
      {/* Animated shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer" />
      
      {/* Abstract AI pattern - decorative circles */}
      <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-primary/10 blur-xl" />
      <div className="absolute -left-4 -bottom-4 w-16 h-16 rounded-full bg-primary/15 blur-lg" />

      <div className="relative py-3 px-4">
        <div className="flex items-center justify-center gap-3 max-w-lg mx-auto">
          <div className="flex-shrink-0 w-8 h-8 rounded-full gradient-gold flex items-center justify-center shadow-glow-gold animate-pulse-soft">
            <Gift className="w-4 h-4 text-primary-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground text-center leading-tight">
              {slide.text.split(slide.highlight).map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className="text-primary text-glow-gold font-bold">
                      {slide.highlight}
                    </span>
                  )}
                </span>
              ))}
            </p>
          </div>

          <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full gradient-gold shadow-gold group-hover:shadow-gold-lg transition-all duration-300">
            <Sparkles className="w-3 h-3 text-primary-foreground" />
            <span className="text-xs font-bold text-primary-foreground whitespace-nowrap">
              Top Up
            </span>
            <ArrowRight className="w-3 h-3 text-primary-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Slide indicators */}
        <div className="flex justify-center gap-1.5 mt-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSlide(index);
              }}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? "bg-primary w-4" 
                  : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(false);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-foreground/10 transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
};
