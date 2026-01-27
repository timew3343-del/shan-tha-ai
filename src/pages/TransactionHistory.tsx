import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Transaction {
  id: string;
  amount_mmk: number;
  credits: number;
  package_name: string;
  status: string;
  bonus_credits: number;
  created_at: string;
}

export const TransactionHistory = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error);
      } else {
        setTransactions(data || []);
      }
      setIsLoading(false);
    };

    fetchTransactions();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("my-MM", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-success" />;
      case "pending":
        return <Clock className="w-5 h-5 text-warning" />;
      default:
        return <AlertCircle className="w-5 h-5 text-destructive" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "success":
        return "အောင်မြင်";
      case "pending":
        return "စောင့်ဆိုင်းဆဲ";
      default:
        return "မအောင်မြင်";
    }
  };

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
        <h1 className="text-lg font-semibold text-foreground">ငွေသွင်းမှတ်တမ်း</h1>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="gradient-card rounded-2xl p-8 border border-border/30 text-center animate-fade-up">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">ငွေသွင်းမှတ်တမ်း မရှိသေးပါ</p>
            <button
              onClick={() => navigate("/top-up")}
              className="mt-4 px-6 py-2 rounded-xl gradient-gold text-primary-foreground font-medium text-sm"
            >
              ငွေဖြည့်သွင်းမည်
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx, index) => (
              <div
                key={tx.id}
                className="gradient-card rounded-2xl p-4 border border-border/30 animate-fade-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-foreground">{tx.package_name}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(tx.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(tx.status)}
                    <span className={`text-sm font-medium ${
                      tx.status === "success" ? "text-success" : 
                      tx.status === "pending" ? "text-warning" : "text-destructive"
                    }`}>
                      {getStatusText(tx.status)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-sm text-muted-foreground">
                    {tx.amount_mmk.toLocaleString()} MMK
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-primary">
                      +{tx.credits.toLocaleString()}
                    </span>
                    {tx.bonus_credits > 0 && (
                      <span className="text-xs text-success">
                        (+{tx.bonus_credits} Bonus)
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">Credits</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;
