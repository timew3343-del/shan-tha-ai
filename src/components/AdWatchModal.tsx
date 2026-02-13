import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Gift, Clock, CheckCircle, Play, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface AdWatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim: () => Promise<void>;
  timerDuration: number;
  rewardAmount: number;
}

const TOTAL_SESSIONS = 2;

// Whitelist of allowed ad script domains
const ALLOWED_AD_DOMAINS = [
  "adsterra.com",
  "www.highperformancedformats.com",
  "www.profitabledisplaynetwork.com",
  "a.magsrv.com",
  "s.magsrv.com",
];

function isAllowedAdDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_AD_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

function sanitizeAndInjectAdScript(container: HTMLDivElement, rawCode: string) {
  // Clear existing content safely
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Show loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;gap:12px;';
  const p1 = document.createElement('p');
  p1.style.cssText = 'font-size:13px;color:#ffc107;font-weight:600;';
  p1.textContent = '📺 ကြော်ငြာ ပြသနေသည်';
  const p2 = document.createElement('p');
  p2.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.5);';
  p2.textContent = 'ကြော်ငြာကြည့်နေစဉ် Timer ဆက်သွားပါမည်';
  loadingDiv.appendChild(p1);
  loadingDiv.appendChild(p2);
  container.appendChild(loadingDiv);

  // Remove loading after 3s
  setTimeout(() => {
    if (container.childNodes.length > 1 && loadingDiv.parentNode) {
      loadingDiv.remove();
    }
  }, 3000);

  // Parse the ad code safely using DOMParser (no innerHTML on live DOM)
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawCode, 'text/html');

  // Extract and append non-script elements safely
  const nonScriptElements = doc.body.querySelectorAll(':not(script)');
  nonScriptElements.forEach(el => {
    // Clone element without event handlers
    const clone = el.cloneNode(true) as HTMLElement;
    container.appendChild(clone);
  });

  // Only inject scripts from whitelisted domains
  const scripts = doc.querySelectorAll('script');
  scripts.forEach(originalScript => {
    const src = originalScript.getAttribute('src');

    // If script has src, only allow whitelisted domains
    if (src) {
      if (!isAllowedAdDomain(src)) {
        console.warn(`Blocked ad script from non-whitelisted domain: ${src}`);
        return;
      }
      const newScript = document.createElement('script');
      newScript.src = src;
      // Copy safe attributes
      ['type', 'async', 'defer', 'charset'].forEach(attr => {
        const val = originalScript.getAttribute(attr);
        if (val) newScript.setAttribute(attr, val);
      });
      // Copy data attributes
      Array.from(originalScript.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          newScript.setAttribute(attr.name, attr.value);
        }
      });
      document.body.appendChild(newScript);
    } else if (originalScript.textContent) {
      // Inline scripts - only allow simple variable assignments for ad config
      const content = originalScript.textContent.trim();
      // Basic safety check: only allow if it looks like ad config (variable assignments)
      const isSafeInline = /^[\s\S]*?(atOptions|adConfig|options)\s*=\s*\{[\s\S]*?\};?\s*$/.test(content);
      if (isSafeInline) {
        const newScript = document.createElement('script');
        newScript.textContent = content;
        document.body.appendChild(newScript);
      } else {
        console.warn("Blocked potentially unsafe inline ad script");
      }
    }
  });
}

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
  const [adScriptCode, setAdScriptCode] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const currentSessionRef = useRef(1);

  // Load ad script code and ad unit ID from DB
  useEffect(() => {
    const loadAdConfig = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["adsterra_script_code", "adsterra_ad_unit_id"]);
      if (data) {
        data.forEach(s => {
          if (s.key === "adsterra_script_code") setAdScriptCode(s.value || "");
        });
      }
    };
    loadAdConfig();
  }, []);

  const loadAdScript = useCallback(() => {
    if (!adContainerRef.current) return;

    if (!adScriptCode) {
      while (adContainerRef.current.firstChild) {
        adContainerRef.current.removeChild(adContainerRef.current.firstChild);
      }
      const placeholder = document.createElement('div');
      placeholder.className = 'text-center text-xs text-muted-foreground p-4';
      placeholder.textContent = 'ကြော်ငြာ ကုတ် မထည့်ရသေးပါ (Admin > Adsterra)';
      adContainerRef.current.appendChild(placeholder);
      return;
    }

    sanitizeAndInjectAdScript(adContainerRef.current, adScriptCode);
  }, [adScriptCode]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
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
      setTimeout(() => { loadAdScript(); startTimer(); }, 300);
    }
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, adScriptCode]);

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
          if (currentSessionRef.current >= TOTAL_SESSIONS) setCanClaim(true);
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
      setTimeout(() => handleClose(), 1500);
    } catch (error: any) {
      console.error("Claim error:", error);
      setClaimError(error?.message || "Credits ရယူရာတွင် ပြဿနာရှိပါသည်။");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClose = () => { resetState(); onClose(); };

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
          <DialogDescription className="text-xs text-muted-foreground font-myanmar">
            ကြော်ငြာ {TOTAL_SESSIONS} ခု ကြည့်ပြီး Credits ရယူပါ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Session Progress */}
          <div className="flex items-center justify-center gap-3">
            {Array.from({ length: TOTAL_SESSIONS }, (_, i) => i + 1).map((session) => (
              <div key={session}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  currentSession > session || (currentSession === session && canClaim)
                    ? "bg-green-500/20 text-green-500"
                    : currentSession === session ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                }`}>
                {currentSession > session || (currentSession === session && canClaim) ? <CheckCircle className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                ကြော်ငြာ {session}
              </div>
            ))}
          </div>

          <div className="text-center p-3 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-sm text-foreground font-myanmar leading-relaxed">
              🎬 ကြော်ငြာ {TOTAL_SESSIONS} ခု ကြည့်ပါ (တစ်ခုလျှင် {sessionDuration} စက္ကန့်)
            </p>
          </div>

          {/* Ad Container */}
          <div ref={adContainerRef}
            className="rounded-lg bg-secondary/50 overflow-hidden min-h-[250px] flex items-center justify-center p-2 border border-border"
            style={{ minWidth: '300px' }}>
            <p className="text-xs text-muted-foreground font-myanmar animate-pulse">ကြော်ငြာ ဖွင့်နေသည်...</p>
          </div>

          {/* Timer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground font-myanmar">ကြော်ငြာ {currentSession}/{TOTAL_SESSIONS}</span>
              </div>
              <span className="text-lg font-bold text-primary tabular-nums">{formatTime(timeRemaining)}</span>
            </div>
            <Progress value={progressValue} className="h-3" />
            <p className="text-xs text-center text-muted-foreground">စုစုပေါင်း: {Math.floor(elapsedTime)}s / {totalTime}s</p>
          </div>

          <div className="text-center text-sm text-muted-foreground font-myanmar">
            🎁 ရရှိမည့် Credits: <span className="text-primary font-bold">{rewardAmount}</span>
          </div>

          {claimError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="font-myanmar">{claimError}</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {claimed ? (
              <motion.div key="claimed" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-semibold text-green-600 font-myanmar">{rewardAmount} Credits ရရှိပါပြီ!</p>
              </motion.div>
            ) : showNextButton ? (
              <motion.div key="next" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button onClick={startNextSession} className="w-full h-12 text-base font-medium bg-primary text-primary-foreground">
                  <span className="flex items-center gap-2 font-myanmar">
                    <Play className="w-5 h-5" /> နောက်တစ်ခု ကြည့်မည် ({currentSession + 1}/{TOTAL_SESSIONS})
                  </span>
                </Button>
              </motion.div>
            ) : (
              <motion.div key="claim" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button onClick={handleClaim} disabled={!canClaim || isClaiming}
                  className="w-full h-12 text-base font-medium gradient-gold text-primary-foreground">
                  {isClaiming ? (
                    <span className="font-myanmar">Credits ထည့်နေသည်...</span>
                  ) : canClaim ? (
                    <span className="flex items-center gap-2 font-myanmar"><Gift className="w-5 h-5" />{rewardAmount} Credits ရယူမည်</span>
                  ) : (
                    <span className="font-myanmar">ကျေးဇူးပြု၍ စောင့်ပါ... ({formatTime(timeRemaining)})</span>
                  )}
                </Button>
                {canClaim && claimError && (
                  <Button onClick={handleClaim} variant="outline" className="w-full mt-2 font-myanmar">ထပ်ကြိုးစားမည်</Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};
