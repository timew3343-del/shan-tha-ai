import { Mic, Settings, X, AlertTriangle } from "lucide-react";
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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-myanmar text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Microphone ခွင့်ပြုချက်မရှိပါ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <Mic className="w-10 h-10 text-destructive" />
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-secondary rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-sm font-myanmar">Mic ခွင့်ပြုချက်ရရန်</h4>
            
            <div className="space-y-2 text-sm text-muted-foreground font-myanmar">
              <div className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>
                <span>Browser ၏ Address Bar ဘေးရှိ <Settings className="w-3 h-3 inline" /> Lock/Settings Icon ကို နှိပ်ပါ</span>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>
                <span>"Microphone" ကို "Allow" သို့ ပြောင်းပါ</span>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>
                <span>Page ကို Refresh လုပ်ပြီး ထပ်စမ်းပါ</span>
              </div>
            </div>
          </div>

          {/* Important Note */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-myanmar">
              <strong>အရေးကြီး:</strong> Overlay bubbles, floating windows များ ဖွင့်ထားလျှင် Mic ခွင့်ပြုချက် popup မပေါ်နိုင်ပါ။ ၎င်းတို့ကို ပိတ်ပြီး ထပ်စမ်းပါ။
            </p>
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
