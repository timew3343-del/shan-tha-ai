import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, X, CheckCircle } from "lucide-react";
import { useState } from "react";

interface FirstOutputGuideProps {
  toolName: string;
  steps: string[];
  show: boolean;
  onDismiss?: () => void;
}

export const FirstOutputGuide = ({ toolName, steps, show, onDismiss }: FirstOutputGuideProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-sm p-4 relative"
      >
        <button
          onClick={() => { setDismissed(true); onDismiss?.(); }}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-secondary/50 transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-primary font-myanmar">
              📖 {toolName} အသုံးပြုနည်း
            </h4>
            <p className="text-[10px] text-muted-foreground font-myanmar">
              ပထမဆုံးအကြိမ် ရလဒ်ထုတ်ပြီးရင် ဒီ Guide ပျောက်သွားပါမယ်
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-foreground/80 font-myanmar leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <CheckCircle className="w-3 h-3" />
          <span className="font-myanmar">ရလဒ်ထုတ်ပြီးရင် ဒီ Tool ကို "Learned" အဖြစ် မှတ်သားပါမယ်</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
