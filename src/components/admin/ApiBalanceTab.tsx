import { useState, useEffect } from "react";
import { DollarSign, Save, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ApiBalance {
  id: string;
  api_name: string;
  initial_balance: number;
  current_balance: number;
  low_balance_threshold: number;
  last_updated: string;
}

export const ApiBalanceTab = () => {
  const { toast } = useToast();
  const [balances, setBalances] = useState<ApiBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBalances();

    const channel = supabase
      .channel("api-balance-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "api_balance_tracking" }, () => {
        fetchBalances();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchBalances = async () => {
    try {
      const { data, error } = await supabase
        .from("api_balance_tracking")
        .select("*")
        .order("api_name");

      if (error) throw error;
      setBalances(data || []);
    } catch (error) {
      console.error("Error fetching API balances:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBalance = async (id: string, field: string, value: number) => {
    setBalances(prev => prev.map(b => 
      b.id === id ? { ...b, [field]: value } : b
    ));
  };

  const saveBalance = async (balance: ApiBalance) => {
    setSavingId(balance.id);
    try {
      const { error } = await supabase
        .from("api_balance_tracking")
        .update({
          initial_balance: balance.initial_balance,
          current_balance: balance.current_balance,
          low_balance_threshold: balance.low_balance_threshold,
          last_updated: new Date().toISOString(),
        })
        .eq("id", balance.id);

      if (error) throw error;
      toast({ title: `${balance.api_name} balance updated` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const lowBalanceApis = balances.filter(b => b.current_balance > 0 && b.current_balance <= b.low_balance_threshold);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">API Balance Tracking</h3>
          <p className="text-xs text-muted-foreground">
            API Key ငွေလက်ကျန် စစ်ဆေးရန် • $5 Alert System
          </p>
        </div>
      </div>

      {/* Low Balance Alert */}
      {lowBalanceApis.length > 0 && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h4 className="font-semibold text-destructive text-sm">⚠️ Low Balance Alert!</h4>
          </div>
          {lowBalanceApis.map(api => (
            <p key={api.id} className="text-xs text-destructive/80 ml-7">
              {api.api_name}: ${api.current_balance.toFixed(2)} remaining (threshold: ${api.low_balance_threshold.toFixed(2)})
            </p>
          ))}
        </div>
      )}

      {/* Balance Cards */}
      <div className="space-y-3">
        {balances.map(balance => {
          const isLow = balance.current_balance > 0 && balance.current_balance <= balance.low_balance_threshold;
          const usagePercent = balance.initial_balance > 0 
            ? ((balance.initial_balance - balance.current_balance) / balance.initial_balance * 100)
            : 0;

          return (
            <div
              key={balance.id}
              className={`gradient-card rounded-xl p-4 border transition-all ${
                isLow ? "border-destructive/50 bg-destructive/5" : "border-border/30"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isLow && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  <h4 className="font-semibold text-sm text-foreground">{balance.api_name}</h4>
                </div>
                <span className={`text-lg font-bold ${isLow ? "text-destructive" : "text-primary"}`}>
                  ${balance.current_balance.toFixed(2)}
                </span>
              </div>

              {/* Usage Bar */}
              {balance.initial_balance > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Used: {usagePercent.toFixed(1)}%</span>
                    <span>Initial: ${balance.initial_balance.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isLow ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Initial ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={balance.initial_balance}
                    onChange={e => updateBalance(balance.id, "initial_balance", parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Current ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={balance.current_balance}
                    onChange={e => updateBalance(balance.id, "current_balance", parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Alert ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={balance.low_balance_threshold}
                    onChange={e => updateBalance(balance.id, "low_balance_threshold", parseFloat(e.target.value) || 5)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <Button
                onClick={() => saveBalance(balance)}
                disabled={savingId === balance.id}
                size="sm"
                className="w-full mt-3 gradient-gold text-primary-foreground"
              >
                {savingId === balance.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <><Save className="w-3 h-3 mr-1" /> Save</>
                )}
              </Button>

              <p className="text-[10px] text-muted-foreground/60 mt-2">
                Updated: {new Date(balance.last_updated).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
