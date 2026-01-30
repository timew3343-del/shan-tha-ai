import { Mic, Settings, X, AlertTriangle, RefreshCw, Smartphone, Monitor, Chrome, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MicPermissionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export const MicPermissionPopup = ({ isOpen, onClose, onRetry }: MicPermissionPopupProps) => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isChrome = /Chrome/i.test(navigator.userAgent);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-myanmar text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Microphone ခွင့်ပြုချက်မရှိပါ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
              <Mic className="w-8 h-8 text-destructive" />
            </div>
          </div>

          {/* Critical Warning - Overlay Issue */}
          <div className="bg-red-500/15 border-2 border-red-500/40 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-red-600 dark:text-red-400 font-myanmar mb-1">
                  Overlay / Floating App ပြဿနာ
                </h4>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 font-myanmar leading-relaxed">
                  Facebook Messenger Bubble, Screen Recorder, နှင့် Floating Apps များ ဖွင့်ထားလျှင် Mic Permission popup မပေါ်ပါ။ 
                  <strong> အဆိုပါ apps များကို ပိတ်ပြီးမှ ထပ်စမ်းပါ။</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Device-specific Instructions */}
          <div className="bg-secondary rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              {isMobile ? (
                <Smartphone className="w-4 h-4 text-primary" />
              ) : (
                <Monitor className="w-4 h-4 text-primary" />
              )}
              <h4 className="font-semibold text-sm font-myanmar">
                {isMobile ? "Mobile" : "Desktop"} တွင် Mic ခွင့်ပြုရန်
              </h4>
            </div>
            
            <div className="space-y-2 text-sm text-muted-foreground font-myanmar">
              {isMobile ? (
                <>
                  <div className="flex items-start gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>
                    <span>ဖုန်း <strong>Settings → Apps → Browser → Permissions</strong> သို့သွားပါ</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>
                    <span><strong>Microphone</strong> ကို <strong>Allow</strong> လုပ်ပါ</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>
                    <span>Browser ကို ပိတ်ပြီး ပြန်ဖွင့်ပါ</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>
                    <span>Address Bar ဘေးရှိ <Settings className="w-3 h-3 inline" /> Lock Icon ကို နှိပ်ပါ</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>
                    <span>"Site Settings" ထဲတွင် <strong>Microphone → Allow</strong> ရွေးပါ</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>
                    <span>Page ကို Refresh (F5) နှိပ်ပါ</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Fix Tips */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
            <h5 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 font-myanmar">
              💡 အမြန်ဖြေရှင်းနည်း
            </h5>
            <ul className="text-xs text-blue-600/80 dark:text-blue-400/80 font-myanmar space-y-1">
              <li>• Messenger Chat Heads / Bubbles ပိတ်ပါ</li>
              <li>• Screen Overlay apps (AZ Screen Recorder, etc.) ပိတ်ပါ</li>
              <li>• Browser ကို Force Close ပြီး ပြန်ဖွင့်ပါ</li>
              <li>• Private/Incognito Mode ဖြင့် စမ်းကြည့်ပါ</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 font-myanmar"
            >
              <X className="w-4 h-4 mr-1" />
              ပိတ်မည်
            </Button>
            <Button
              onClick={() => {
                window.location.reload();
              }}
              variant="secondary"
              className="font-myanmar"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button
              onClick={onRetry}
              className="flex-1 font-myanmar"
            >
              <Mic className="w-4 h-4 mr-1" />
              ထပ်စမ်းမည်
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
