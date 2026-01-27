import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PendingTransaction {
  id: string;
  user_id: string;
  amount_mmk: number;
  credits: number;
  package_name: string;
  status: string;
  is_first_purchase: boolean;
  bonus_credits: number;
  screenshot_url: string | null;
  created_at: string;
  user_email?: string;
}

export const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user email is admin
      const adminEmails = ["timew3343@gmail.com", "youtrubezarni@gmail.com"];
      if (!adminEmails.includes(user.email || "")) {
        toast({
          title: "ခွင့်ပြုချက်မရှိပါ",
          description: "Admin အကောင့်သာ ဝင်ရောက်ခွင့်ရှိပါသည်။",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      fetchTransactions();
    };

    checkAdminAccess();
  }, [navigate, toast]);

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching transactions:", error);
    } else {
      setTransactions(data || []);
    }
    setIsLoading(false);
  };

  const handleApprove = async (tx: PendingTransaction) => {
    setProcessingId(tx.id);
    
    try {
      // Update transaction status
      const { error: txError } = await supabase
        .from("transactions")
        .update({ status: "success" })
        .eq("id", tx.id);

      if (txError) throw txError;

      // Calculate total credits (including bonus for first purchase)
      let totalCredits = tx.credits;
      if (tx.is_first_purchase) {
        const bonus = Math.floor(tx.credits * 0.2);
        totalCredits += bonus;
        
        // Update bonus credits
        await supabase
          .from("transactions")
          .update({ bonus_credits: bonus })
          .eq("id", tx.id);
      }

      // Add credits to user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("user_id", tx.user_id)
        .single();

      if (profile) {
        const newBalance = (profile.credit_balance || 0) + totalCredits;
        await supabase
          .from("profiles")
          .update({ credit_balance: newBalance })
          .eq("user_id", tx.user_id);
      }

      toast({
        title: "အတည်ပြုပြီး",
        description: `${totalCredits} Credits ထည့်သွင်းပေးပြီးပါပြီ။`,
      });

      fetchTransactions();
    } catch (error) {
      console.error("Error approving transaction:", error);
      toast({
        title: "အမှား",
        description: "အတည်ပြုရာတွင် ပြဿနာရှိပါသည်။",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (txId: string) => {
    setProcessingId(txId);
    
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "rejected" })
        .eq("id", txId);

      if (error) throw error;

      toast({
        title: "ငြင်းပယ်ပြီး",
        description: "ငွေသွင်းမှုကို ငြင်းပယ်ပြီးပါပြီ။",
      });

      fetchTransactions();
    } catch (error) {
      console.error("Error rejecting transaction:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("my-MM");
  };

  if (!isAdmin || isLoading) {
    return (
      <div className="min-h-screen gradient-navy flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingTransactions = transactions.filter(tx => tx.status === "pending");
  const completedTransactions = transactions.filter(tx => tx.status !== "pending");

  return (
    <div className="min-h-screen gradient-navy pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Admin Dashboard</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="gradient-card rounded-2xl p-4 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-warning" />
              <span className="text-sm text-muted-foreground">စောင့်ဆိုင်းဆဲ</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{pendingTransactions.length}</p>
          </div>
          <div className="gradient-card rounded-2xl p-4 border border-success/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-success" />
              <span className="text-sm text-muted-foreground">အတည်ပြုပြီး</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {completedTransactions.filter(tx => tx.status === "success").length}
            </p>
          </div>
        </div>

        {/* Pending Transactions */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            စောင့်ဆိုင်းဆဲ ငွေသွင်းမှုများ
          </h2>

          {pendingTransactions.length === 0 ? (
            <div className="gradient-card rounded-2xl p-6 border border-border/30 text-center">
              <p className="text-muted-foreground">စောင့်ဆိုင်းဆဲ ငွေသွင်းမှု မရှိပါ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="gradient-card rounded-2xl p-4 border border-warning/30"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{tx.package_name}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(tx.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{tx.credits} Credits</p>
                      <p className="text-sm text-muted-foreground">{tx.amount_mmk.toLocaleString()} MMK</p>
                    </div>
                  </div>

                  {tx.is_first_purchase && (
                    <div className="mb-3 px-3 py-1 bg-success/20 rounded-lg inline-block">
                      <span className="text-xs text-success font-medium">
                        ပထမဆုံးအကြိမ် - 20% Bonus ပါမည်
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(tx)}
                      disabled={processingId === tx.id}
                      className="flex-1 py-2 rounded-xl bg-success hover:bg-success/90 text-white"
                    >
                      {processingId === tx.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          အတည်ပြုမည်
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleReject(tx.id)}
                      disabled={processingId === tx.id}
                      variant="destructive"
                      className="flex-1 py-2 rounded-xl"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      ငြင်းပယ်မည်
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Completed */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            မကြာသေးမီ ငွေသွင်းမှုများ
          </h2>

          <div className="space-y-2">
            {completedTransactions.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="gradient-card rounded-xl p-3 border border-border/30 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.package_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {tx.status === "success" ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {tx.credits + (tx.bonus_credits || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
