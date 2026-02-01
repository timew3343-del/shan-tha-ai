import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Gift, Clock, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AdWatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim: () => Promise<void>;
  timerDuration: number; // in seconds
  rewardAmount: number;
}

const ADSTERRA_SCRIPT_URL = "https://pl28616430.effectivegatecpm.com/06/29/39/062939b223e8f27a05744b8dd71c0c5c.js";

export const AdWatchModal = ({
  isOpen,
  onClose,
  onClaim,
  timerDuration,
  rewardAmount,
}: AdWatchModalProps) => {
  const [timeRemaining, setTimeRemaining] = useState(timerDuration);
  const [canClaim, setCanClaim] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const adIframeRef = useRef<HTMLIFrameElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset all state
      setTimeRemaining(timerDuration);
      setCanClaim(false);
      setClaimed(false);
      setIsClaiming(false);

      // Open ad in new tab
      window.open(ADSTERRA_SCRIPT_URL, "_blank", "noopener,noreferrer");

      // Start countdown
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            setCanClaim(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, timerDuration]);

  const handleClaim = async () => {
    if (!canClaim || isClaiming) return;

    setIsClaiming(true);
    try {
      await onClaim();
      setClaimed(true);
      // Close modal after short delay
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error("Claim error:", error);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClose = () => {
    // Reset everything on close
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeRemaining(timerDuration);
    setCanClaim(false);
    setClaimed(false);
    setIsClaiming(false);
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressValue = ((timerDuration - timeRemaining) / timerDuration) * 100;

  // Create HTML content for the ad iframe
  const adIframeContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          margin: 0; 
          padding: 10px; 
          background: transparent; 
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100px;
          font-family: sans-serif;
          color: #888;
        }
      </style>
    </head>
    <body>
      <script async type="text/javascript" src="${ADSTERRA_SCRIPT_URL}"></script>
      <noscript>Ad loading...</noscript>
    </body>
    </html>
  `;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary font-myanmar">
            <Gift className="w-5 h-5" />
            ကြော်ငြာကြည့်၍ Credits ရယူပါ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Message */}
          <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-sm text-foreground font-myanmar leading-relaxed">
              🎬 ကြော်ငြာ ၂ ခု ကြည့်နေပါသည် ({Math.ceil(timerDuration / 60)} မိနစ်)
              <br />
              <span className="text-muted-foreground">
                Credits ရရှိရန် ကြော်ငြာ tab ကို မပိတ်ပါနှင့်!
              </span>
            </p>
          </div>

          {/* Ad Container - iframe for better script isolation */}
          <div className="rounded-lg bg-secondary/50 overflow-hidden min-h-[100px]">
            <iframe
              ref={adIframeRef}
              srcDoc={adIframeContent}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className="w-full h-[120px] border-0"
              title="Ad Content"
            />
          </div>

          {/* Timer Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground font-myanmar">
                  ကျန်ချိန်
                </span>
              </div>
              <span className="text-lg font-bold text-primary tabular-nums">
                {formatTime(timeRemaining)}
              </span>
            </div>
            <Progress value={progressValue} className="h-3" />
          </div>

          {/* Reward Info */}
          <div className="text-center text-sm text-muted-foreground font-myanmar">
            🎁 ရရှိမည့် Credits: <span className="text-primary font-bold">{rewardAmount}</span>
          </div>

          {/* Claim Button */}
          <AnimatePresence mode="wait">
            {claimed ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 py-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-semibold text-green-600 font-myanmar">
                  {rewardAmount} Credits ရရှိပါပြီ!
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Button
                  onClick={handleClaim}
                  disabled={!canClaim || isClaiming}
                  className="w-full h-12 text-base font-medium gradient-gold text-primary-foreground"
                >
                  {isClaiming ? (
                    <span className="font-myanmar">Credits ထည့်နေသည်...</span>
                  ) : canClaim ? (
                    <span className="flex items-center gap-2 font-myanmar">
                      <Gift className="w-5 h-5" />
                      {rewardAmount} Credits ရယူမည်
                    </span>
                  ) : (
                    <span className="font-myanmar">
                      ကျေးဇူးပြု၍ စောင့်ပါ... ({formatTime(timeRemaining)})
                    </span>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};
