import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRightLeft, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CreditTransferDialogProps {
  userId: string;
  currentBalance: number;
  onTransferComplete?: () => void;
  trigger: React.ReactNode;
}

export const CreditTransferDialog = ({
  userId,
  currentBalance,
  onTransferComplete,
  trigger,
}: CreditTransferDialogProps) => {
  const [open, setOpen] = useState(false);
  const [receiverId, setReceiverId] = useState("");
  const [amount, setAmount] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const parsedAmount = parseInt(amount, 10);
  const isInsufficientBalance = !isNaN(parsedAmount) && parsedAmount > currentBalance;
  const isSelfTransfer = receiverId.trim() === userId;
  const isValid = receiverId.trim().length === 36 && !isNaN(parsedAmount) && parsedAmount > 0 && !isInsufficientBalance && !isSelfTransfer;

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTransfer = async () => {
    if (!isValid) return;
    setIsTransferring(true);

    try {
      const { data, error } = await supabase.rpc("transfer_credits", {
        _sender_id: userId,
        _receiver_id: receiverId.trim(),
        _amount: parsedAmount,
      });

      const result = data as { success?: boolean; error?: string; receiver_name?: string; new_balance?: number } | null;

      if (error || !result?.success) {
        throw new Error(result?.error || error?.message || "Transfer failed");
      }

      toast({
        title: "လွှဲပြောင်းမှု အောင်မြင်ပါသည် ✅",
        description: `${result.receiver_name} သို့ ${parsedAmount} Credits လွှဲပြောင်းပြီးပါပြီ`,
      });

      setReceiverId("");
      setAmount("");
      setOpen(false);
      onTransferComplete?.();
    } catch (error: any) {
      toast({
        title: "လွှဲပြောင်းမှု မအောင်မြင်ပါ",
        description: error.message || "တစ်ခုခု မှားယွင်းနေပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="gradient-card border-border/50 max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Credit လွှဲပြောင်းခြင်း
          </DialogTitle>
          <DialogDescription>
            အခြား User တစ်ဦးသို့ Credit လွှဲပြောင်းပေးပါ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* My UUID */}
          <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">My Transfer ID (UUID)</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-foreground flex-1 truncate">{userId}</code>
              <button
                onClick={handleCopyId}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Current Balance */}
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground">လက်ကျန် Credit</p>
            <p className="text-lg font-bold text-primary">{currentBalance} Credits</p>
          </div>

          {/* Receiver UUID */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">လက်ခံမည့်သူ UUID</label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="bg-background/50 border-border/50 rounded-xl h-11 text-sm font-mono"
            />
            {isSelfTransfer && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                သင့်ကိုယ်သင် လွှဲပြောင်း၍ မရပါ
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">ပမာဏ</label>
            <Input
              type="number"
              placeholder="100"
              min={1}
              max={currentBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-background/50 border-border/50 rounded-xl h-11"
            />
            {isInsufficientBalance && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                ခရက်ဒစ် မလုံလောက်ပါ။
              </p>
            )}
          </div>

          {/* Transfer Button */}
          <Button
            onClick={handleTransfer}
            disabled={!isValid || isTransferring}
            className="w-full h-11 gradient-gold text-primary-foreground font-semibold rounded-xl"
          >
            {isTransferring ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Credit လွှဲပြောင်းမည်
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
