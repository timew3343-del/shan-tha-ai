import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Gift, Clock, CheckCircle, Play, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AdWatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim: () => Promise<void>;
  timerDuration: number;
  rewardAmount: number;
}

const TOTAL_SESSIONS = 2;

export const AdWatchModal = ({
  isOpen,
  onClose,
  onClaim,
  timerDuration,
  rewardAmount,
}: AdWatchModalProps) => {
  const sessionDuration = Math.max(10, Math.floor((timerDuration || 60) / TOTAL_SESSIONS));

  const [currentSession, setCurrentSession] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(sessionDuration);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [sessionTimerDone, setSessionTimerDone] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const currentSessionRef = useRef(1);

  const loadAdScript = useCallback(() => {
    if (!adContainerRef.current) return;

    adContainerRef.current.innerHTML = '';

    const containerDiv = document.createElement('div');
    containerDiv.id = 'container-303f0f5972332b8fd635da8909294c40';
    adContainerRef.current.appendChild(containerDiv);

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = 'https://pl28623813.effectivegatecpm.com/303f0f5972332b8fd635da8909294c40/invoke.js';
    adContainerRef.current.appendChild(script);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setCurrentSession(1);
    currentSessionRef.current = 1;
    setTimeRemaining(sessionDuration);
    setIsTimerRunning(false);
    setSessionTimerDone(false);
    setCanClaim(false);
    setClaimed(false);
    setIsClaiming(false);
    setClaimError(null);
    clearTimer();
  }, [sessionDuration, clearTimer]);

  useEffect(() => {
    if (isOpen) {
      resetState();
      setTimeout(() => {
        loadAdScript();
        startTimer();
      }, 100);
    }
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startTimer = () => {
    clearTimer();
    setIsTimerRunning(true);
    setSessionTimerDone(false);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsTimerRunning(false);
          setSessionTimerDone(true);

          // Use ref for current session to avoid nested state issues
          if (currentSessionRef.current >= TOTAL_SESSIONS) {
            setCanClaim(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startNextSession = () => {
    const nextSession = currentSessionRef.current + 1;
    currentSessionRef.current = nextSession;
    setCurrentSession(nextSession);
    setTimeRemaining(sessionDuration);
    setSessionTimerDone(false);
    loadAdScript();
    startTimer();
  };

  const handleClaim = async () => {
    if (!canClaim || isClaiming) return;

    setIsClaiming(true);
    setClaimError(null);
    try {
      await onClaim();
      setClaimed(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error: any) {
      console.error("Claim error:", error);
      setClaimError(error?.message || "Credits ရယူရာတွင် ပြဿနာရှိပါသည်။ ထပ်ကြိုးစားကြည့်ပါ။");
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

  const totalTime = sessionDuration * TOTAL_SESSIONS;
  const elapsedTime = (currentSession - 1) * sessionDuration + (sessionDuration - timeRemaining);
  const progressValue = (elapsedTime / totalTime) * 100;

  const showNextButton = sessionTimerDone && !canClaim && currentSession < TOTAL_SESSIONS;

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
            {Array.from({ length: TOTAL_SESSIONS }, (_, i) => i + 1).map((session) => (
              <div
                key={session}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  currentSession > session || (currentSession === session && canClaim)
                    ? "bg-green-500/20 text-green-500"
                    : currentSession === session
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {currentSession > session || (currentSession === session && canClaim) ? (
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
              🎬 ကြော်ငြာ {TOTAL_SESSIONS} ခု ကြည့်ပါ (တစ်ခုလျှင် {sessionDuration} စက္ကန့်)
            </p>
          </div>

          {/* Ad Container */}
          <div
            ref={adContainerRef}
            className="rounded-lg bg-secondary/50 overflow-hidden min-h-[150px] flex items-center justify-center p-2"
          >
            <p className="text-xs text-muted-foreground font-myanmar animate-pulse">
              ကြော်ငြာ ဖွင့်နေသည်...
            </p>
          </div>

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

          {/* Error Message */}
          {claimError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="font-myanmar">{claimError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <AnimatePresence mode="wait">
            {claimed ? (
              <motion.div
                key="claimed"
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
            ) : showNextButton ? (
              <motion.div
                key="next"
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
                key="claim"
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
                {canClaim && claimError && (
                  <Button
                    onClick={handleClaim}
                    variant="outline"
                    className="w-full mt-2 font-myanmar"
                  >
                    ထပ်ကြိုးစားမည်
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};
