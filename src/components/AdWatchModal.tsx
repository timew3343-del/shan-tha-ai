import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Gift, Clock, CheckCircle, Play, AlertCircle, ShieldAlert, Loader2 } from "lucide-react";
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
const AD_CONTAINER_ID = "container-bb84edf2d90786d814cdab867f67db1b";
const AD_VERIFY_TIMEOUT = 5000; // 5s to wait for ad to render before retry
const AD_VERIFY_INTERVAL = 500;
const MAX_AD_RETRIES = 1; // retry once before showing blocked

const ALLOWED_AD_DOMAINS = [
  "adsterra.com",
  "www.highperformancedformats.com",
  "www.profitabledisplaynetwork.com",
  "a.magsrv.com",
  "s.magsrv.com",
  "effectivegatecpm.com",
  "pl28696347.effectivegatecpm.com",
];

function isAllowedAdDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_AD_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

/** Remove previously injected ad scripts from document.body */
function cleanupInjectedAdScripts() {
  const bodyScripts = document.body.querySelectorAll('script');
  bodyScripts.forEach(script => {
    const src = script.getAttribute('src');
    if (src && isAllowedAdDomain(src)) {
      script.remove();
    } else if (!src && script.textContent) {
      const content = script.textContent.trim();
      if (/^[\s\S]*?(atOptions|adConfig|options)\s*=\s*\{[\s\S]*?\};?\s*$/.test(content)) {
        script.remove();
      }
    }
  });
}

function sanitizeAndInjectAdScript(container: HTMLDivElement, rawCode: string) {
  // Clean previous container content
  while (container.firstChild) container.removeChild(container.firstChild);
  
  // Also clean up any previously injected scripts from body
  cleanupInjectedAdScripts();

  // Clear the native banner container if it exists in DOM outside our ref
  const existingContainer = document.getElementById(AD_CONTAINER_ID);
  if (existingContainer && existingContainer !== container) {
    while (existingContainer.firstChild) existingContainer.removeChild(existingContainer.firstChild);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawCode, 'text/html');

  const nonScriptElements = doc.body.querySelectorAll(':not(script)');
  nonScriptElements.forEach(el => {
    container.appendChild(el.cloneNode(true) as HTMLElement);
  });

  const scripts = doc.querySelectorAll('script');
  scripts.forEach(originalScript => {
    const src = originalScript.getAttribute('src');
    if (src) {
      if (!isAllowedAdDomain(src)) return;
      const newScript = document.createElement('script');
      // Add cache-busting to force fresh load for second ad
      newScript.src = src + (src.includes('?') ? '&' : '?') + '_t=' + Date.now();
      ['type', 'async', 'defer', 'charset'].forEach(attr => {
        const val = originalScript.getAttribute(attr);
        if (val) newScript.setAttribute(attr, val);
      });
      Array.from(originalScript.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) newScript.setAttribute(attr.name, attr.value);
      });
      document.body.appendChild(newScript);
    } else if (originalScript.textContent) {
      const content = originalScript.textContent.trim();
      const isSafeInline = /^[\s\S]*?(atOptions|adConfig|options)\s*=\s*\{[\s\S]*?\};?\s*$/.test(content);
      if (isSafeInline) {
        const newScript = document.createElement('script');
        newScript.textContent = content;
        document.body.appendChild(newScript);
      }
    }
  });
}

/** Check if the ad container has visible ad content */
function isAdVisible(): boolean {
  const el = document.getElementById(AD_CONTAINER_ID);
  if (!el) return false;
  // Check if ad container has child elements (ad rendered something)
  if (el.children.length === 0) return false;
  // Check dimensions
  const rect = el.getBoundingClientRect();
  if (rect.height < 10 || rect.width < 10) return false;
  // Check not hidden
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  return true;
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
  const [adVerified, setAdVerified] = useState(false);
  const [adBlocked, setAdBlocked] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const currentSessionRef = useRef(1);
  const retryCountRef = useRef(0);

  // Load ad script code from DB
  useEffect(() => {
    const loadAdConfig = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["adsterra_script_code"]);
      if (data) {
        data.forEach(s => {
          if (s.key === "adsterra_script_code") setAdScriptCode(s.value || "");
        });
      }
    };
    loadAdConfig();
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const clearAdCheck = useCallback(() => {
    if (adCheckRef.current) { clearInterval(adCheckRef.current); adCheckRef.current = null; }
  }, []);

  const resetState = useCallback(() => {
    setCurrentSession(1);
    currentSessionRef.current = 1;
    retryCountRef.current = 0;
    setTimeRemaining(sessionDuration);
    setIsTimerRunning(false);
    setSessionTimerDone(false);
    setCanClaim(false);
    setClaimed(false);
    setIsClaiming(false);
    setClaimError(null);
    setAdVerified(false);
    setAdBlocked(false);
    setAdLoading(false);
    cleanupInjectedAdScripts();
    clearTimer();
    clearAdCheck();
  }, [sessionDuration, clearTimer, clearAdCheck]);

  const startTimer = useCallback(() => {
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
  }, [clearTimer]);

  /** Inject ad and poll for visibility, with auto-retry for second ad */
  const loadAdAndVerify = useCallback(() => {
    if (!adContainerRef.current) return;

    setAdLoading(true);
    setAdVerified(false);
    setAdBlocked(false);

    // Fully clean container and old scripts
    while (adContainerRef.current.firstChild) {
      adContainerRef.current.removeChild(adContainerRef.current.firstChild);
    }
    cleanupInjectedAdScripts();

    if (!adScriptCode) {
      const placeholder = document.createElement('div');
      placeholder.className = 'text-center text-xs p-4';
      placeholder.style.color = 'rgba(255,255,255,0.5)';
      placeholder.textContent = 'ကြော်ငြာ ကုတ် မထည့်ရသေးပါ (Admin > Adsterra)';
      adContainerRef.current.appendChild(placeholder);
      setAdLoading(false);
      setAdBlocked(true);
      return;
    }

    // Small delay to let DOM settle after cleanup (important for 2nd ad)
    setTimeout(() => {
      if (!adContainerRef.current) return;
      sanitizeAndInjectAdScript(adContainerRef.current, adScriptCode);

      // Poll for ad visibility
      clearAdCheck();
      const startTime = Date.now();
      adCheckRef.current = setInterval(() => {
        if (isAdVisible()) {
          clearAdCheck();
          retryCountRef.current = 0;
          setAdVerified(true);
          setAdLoading(false);
          setAdBlocked(false);
          startTimer();
        } else if (Date.now() - startTime > AD_VERIFY_TIMEOUT) {
          clearAdCheck();
          // Auto-retry once before showing blocked
          if (retryCountRef.current < MAX_AD_RETRIES) {
            retryCountRef.current += 1;
            console.log(`Ad failed to load, auto-retrying (${retryCountRef.current}/${MAX_AD_RETRIES})...`);
            // Recursive retry after cleanup
            loadAdAndVerify();
          } else {
            setAdVerified(false);
            setAdLoading(false);
            setAdBlocked(true);
          }
        }
      }, AD_VERIFY_INTERVAL);
    }, 150);
  }, [adScriptCode, clearAdCheck, startTimer]);

  // When modal opens, inject ad and wait for verification
  useEffect(() => {
    if (isOpen) {
      resetState();
      setTimeout(() => loadAdAndVerify(), 300);
    }
    return () => { clearTimer(); clearAdCheck(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, adScriptCode]);

  const startNextSession = () => {
    const nextSession = currentSessionRef.current + 1;
    currentSessionRef.current = nextSession;
    retryCountRef.current = 0; // Reset retry count for new session
    setCurrentSession(nextSession);
    setTimeRemaining(sessionDuration);
    setSessionTimerDone(false);
    setAdVerified(false);
    setAdBlocked(false);
    setAdLoading(true);
    // Clean up old scripts first, then load with delay for smooth transition
    cleanupInjectedAdScripts();
    setTimeout(() => loadAdAndVerify(), 400);
  };

  const handleClaim = async () => {
    if (!canClaim || isClaiming || !adVerified) return;
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
            className="rounded-lg bg-secondary/50 overflow-hidden flex items-center justify-center p-2 border border-border"
            style={{ minWidth: '300px', minHeight: '250px', height: '250px' }}>
            <p className="text-xs text-muted-foreground font-myanmar animate-pulse">ကြော်ငြာ ဖွင့်နေသည်...</p>
          </div>

          {/* Ad Loading State */}
          {adLoading && !adBlocked && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="font-myanmar">ကြော်ငြာ စစ်ဆေးနေသည်...</span>
            </div>
          )}

          {/* Ad Blocked Warning */}
          <AnimatePresence>
            {adBlocked && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-destructive flex-shrink-0" />
                  <p className="text-sm font-semibold text-destructive font-myanmar">
                    ကြော်ငြာမပေါ်သဖြင့် Credit မရယူနိုင်ပါ။
                  </p>
                </div>
                <p className="text-xs text-muted-foreground font-myanmar">
                  ကျေးဇူးပြု၍ AdBlocker ပိတ်ပြီး Refresh လုပ်ပါ။ အခမဲ့ Credit ရယူရန်အတွက် AdBlocker ကို ပိတ်ပေးမှသာ ကြော်ငြာကြည့်လို့ရပါမည်။
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timer — only meaningful when ad is verified */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground font-myanmar">ကြော်ငြာ {currentSession}/{TOTAL_SESSIONS}</span>
              </div>
              <span className="text-lg font-bold text-primary tabular-nums">{formatTime(timeRemaining)}</span>
            </div>
            <Progress value={progressValue} className="h-3" />
            <p className="text-xs text-center text-muted-foreground">
              {adVerified
                ? `စုစုပေါင်း: ${Math.floor(elapsedTime)}s / ${totalTime}s`
                : adBlocked
                  ? "ကြော်ငြာ ပိတ်ထားသဖြင့် Timer မစတင်နိုင်ပါ"
                  : "ကြော်ငြာ ပေါ်လာပါက Timer အလိုအလျောက် စတင်ပါမည်"
              }
            </p>
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
                <Button onClick={handleClaim} disabled={!canClaim || isClaiming || adBlocked}
                  className="w-full h-12 text-base font-medium gradient-gold text-primary-foreground">
                  {adBlocked ? (
                    <span className="flex items-center gap-2 font-myanmar">
                      <ShieldAlert className="w-4 h-4" />
                      AdBlocker ပိတ်ပြီးမှ ကြည့်နိုင်ပါမည်
                    </span>
                  ) : isClaiming ? (
                    <span className="font-myanmar">Credits ထည့်နေသည်...</span>
                  ) : canClaim ? (
                    <span className="flex items-center gap-2 font-myanmar"><Gift className="w-5 h-5" />{rewardAmount} Credits ရယူမည်</span>
                  ) : (
                    <span className="font-myanmar">ကျေးဇူးပြု၍ စောင့်ပါ... ({formatTime(timeRemaining)})</span>
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
