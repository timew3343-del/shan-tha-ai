import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Coins } from "lucide-react";

interface CreditConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCost: number;
  currentBalance: number;
  toolName: string;
  onConfirm: () => void;
}

export const CreditConfirmDialog = ({
  open, onOpenChange, creditCost, currentBalance, toolName, onConfirm,
}: CreditConfirmDialogProps) => {
  const hasEnough = currentBalance >= creditCost;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-myanmar">
            <Coins className="w-5 h-5 text-primary" />
            Credit အသုံးပြုမှု အတည်ပြုရန်
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p className="font-myanmar">
              <span className="font-semibold">{toolName}</span> အတွက်{" "}
              <span className="font-bold text-primary">{creditCost} Credits</span> ကုန်ကျပါမည်။
            </p>
            <p className="font-myanmar text-xs">
              This action will cost <span className="font-bold">{creditCost} Credits</span>. Proceed?
            </p>
            <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-2 mt-2">
              <span className="text-xs font-myanmar">လက်ကျန် Credit:</span>
              <span className={`text-sm font-bold ${hasEnough ? "text-primary" : "text-destructive"}`}>
                {currentBalance}
              </span>
            </div>
            {!hasEnough && (
              <p className="text-xs text-destructive font-myanmar">
                ⚠️ Credit မလုံလောက်ပါ။ Top-up လုပ်ပါ။
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-myanmar">ပယ်ဖျက်မည်</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={!hasEnough} className="font-myanmar">
            အတည်ပြုမည်
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};