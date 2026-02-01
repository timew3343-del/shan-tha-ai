import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Gift, Clock, CheckCircle, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AdWatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim: () => Promise<void>;
  timerDuration: number; // Not used - we use fixed 30s x 2
  rewardAmount: number;
}

const SESSION_DURATION = 30; // 30 seconds per session
const TOTAL_SESSIONS = 2; // 2 sessions required

export const AdWatchModal = ({
  isOpen,
  onClose,
  onClaim,
  rewardAmount,
}: AdWatchModalProps) => {
  const [currentSession, setCurrentSession] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(SESSION_DURATION);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);

  // Load ad script into container
  const loadAdScript = useCallback(() => {
    if (!adContainerRef.current) return;
    
    // Clear existing content
    adContainerRef.current.innerHTML = '';
    
    // Create container div for native banner
    const containerDiv = document.createElement('div');
    containerDiv.id = 'container-303f0f5972332b8fd635da8909294c40';
    adContainerRef.current.appendChild(containerDiv);
    
    // Load native banner script
    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = 'https://pl28623813.effectivegatecpm.com/303f0f5972332b8fd635da8909294c40/invoke.js';
    adContainerRef.current.appendChild(script);
  }, []);

  // Reset all state
  const resetState = useCallback(() => {
    setCurrentSession(1);
    setTimeRemaining(SESSION_DURATION);
    setIsTimerRunning(false);
    setCanClaim(false);
    setClaimed(false);
    setIsClaiming(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      resetState();
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        loadAdScript();
        startTimer();
      }, 100);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, resetState, loadAdScript]);

  const startTimer = () => {
    setIsTimerRunning(true);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Session complete
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsTimerRunning(false);
          
          // Check if all sessions complete
          setCurrentSession((currentSess) => {
            if (currentSess >= TOTAL_SESSIONS) {
              setCanClaim(true);
              return currentSess;
            }
            return currentSess;
          });
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startNextSession = () => {
    setCurrentSession((prev) => prev + 1);
    setTimeRemaining(SESSION_DURATION);
    loadAdScript();
    startTimer();
  };

  const handleClaim = async () => {
    if (!canClaim || isClaiming) return;

    setIsClaiming(true);
    try {
      await onClaim();
      setClaimed(true);
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
    resetState();
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const totalTime = SESSION_DURATION * TOTAL_SESSIONS;
  const elapsedTime = (currentSession - 1) * SESSION_DURATION + (SESSION_DURATION - timeRemaining);
  const progressValue = (elapsedTime / totalTime) * 100;

  const sessionComplete = timeRemaining === 0 && !canClaim;
  const allComplete = canClaim;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary font-myanmar">
            <Gift className="w-5 h-5" />
            ကြော်ငြာကြည့်၍ Credits ရယူပါ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Session Progress Indicator */}
          <div className="flex items-center justify-center gap-3">
            {[1, 2].map((session) => (
              <div
                key={session}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  currentSession > session || (currentSession === session && allComplete)
                    ? "bg-green-500/20 text-green-500"
                    : currentSession === session
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {currentSession > session || (currentSession === session && allComplete) ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                ကြော်ငြာ {session}
              </div>
            ))}
          </div>

          {/* Message */}
          <div className="text-center p-3 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-sm text-foreground font-myanmar leading-relaxed">
              🎬 ကြော်ငြာ {TOTAL_SESSIONS} ခု ကြည့်ပါ (တစ်ခုလျှင် {SESSION_DURATION} စက္ကန့်)
            </p>
          </div>

          {/* Ad Container */}
          <div 
            ref={adContainerRef}
            className="rounded-lg bg-secondary/50 overflow-hidden min-h-[80px] flex items-center justify-center p-2"
          />

          {/* Timer Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground font-myanmar">
                  ကြော်ငြာ {currentSession}/{TOTAL_SESSIONS}
                </span>
              </div>
              <span className="text-lg font-bold text-primary tabular-nums">
                {formatTime(timeRemaining)}
              </span>
            </div>
            <Progress value={progressValue} className="h-3" />
            <p className="text-xs text-center text-muted-foreground">
              စုစုပေါင်း: {Math.floor(elapsedTime)}s / {totalTime}s
            </p>
          </div>

          {/* Reward Info */}
          <div className="text-center text-sm text-muted-foreground font-myanmar">
            🎁 ရရှိမည့် Credits: <span className="text-primary font-bold">{rewardAmount}</span>
          </div>

          {/* Action Buttons */}
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
            ) : sessionComplete && currentSession < TOTAL_SESSIONS ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Button
                  onClick={startNextSession}
                  className="w-full h-12 text-base font-medium bg-primary text-primary-foreground"
                >
                  <span className="flex items-center gap-2 font-myanmar">
                    <Play className="w-5 h-5" />
                    နောက်တစ်ခု ကြည့်မည် ({currentSession + 1}/{TOTAL_SESSIONS})
                  </span>
                </Button>
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
