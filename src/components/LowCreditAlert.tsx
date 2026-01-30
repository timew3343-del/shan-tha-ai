import { AlertTriangle, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface LowCreditAlertProps {
  credits: number;
  threshold?: number;
  show: boolean;
  onClose: () => void;
}

export const LowCreditAlert = ({ credits, threshold = 5, show, onClose }: LowCreditAlertProps) => {
  const navigate = useNavigate();

  if (credits > threshold) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-16 left-4 right-4 z-50"
        >
          <div className="bg-destructive/95 backdrop-blur-sm text-destructive-foreground rounded-xl p-4 shadow-lg border border-destructive/50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm font-myanmar">ခရက်ဒစ် နည်းနေပါပြီ!</h4>
                <p className="text-xs opacity-90 mt-1 font-myanmar">
                  သင့်ခရက်ဒစ် {credits} ခုသာ ကျန်ပါတော့သည်။ AI Tools များ ဆက်လက်အသုံးပြုရန် ထပ်မံဖြည့်သွင်းပါ။
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => navigate("/top-up")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Wallet className="w-3 h-3" />
                    ငွေဖြည့်ရန်
                  </button>
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-colors"
                  >
                    နောက်မှ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
