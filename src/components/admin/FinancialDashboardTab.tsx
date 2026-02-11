import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Wallet, Calendar, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type TimeFrame = "15d" | "1m" | "all";

interface FinancialData {
  adProfit: number;
  trainingIncome: number;
  apiCosts: number;
  bankTransfer: number;
  stripeUSD: number;
  stripeMmk: number;
}

const MMK_PER_USD = 2100;

export const FinancialDashboardTab = () => {
  const { toast } = useToast();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("15d");
  const [data, setData] = useState<FinancialData>({ adProfit: 0, trainingIncome: 0, apiCosts: 0, bankTransfer: 0, stripeUSD: 0, stripeMmk: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [historyOffset, setHistoryOffset] = useState(0); // 0 = current period

  const getDateRange = useCallback((): { from: Date | null; to: Date } => {
    const to = new Date();
    if (timeFrame === "all") return { from: null, to };
    const days = timeFrame === "15d" ? 15 : 30;
    const from = new Date();
    from.setDate(from.getDate() - days * (historyOffset + 1));
    const periodTo = new Date();
    periodTo.setDate(periodTo.getDate() - days * historyOffset);
    return { from, to: periodTo };
  }, [timeFrame, historyOffset]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { from, to } = getDateRange();
      const toISO = to.toISOString();

      // 1. Training income from tutorial_purchases
      let trainingQuery = supabase.from("tutorial_purchases").select("credits_paid").lte("purchased_at", toISO);
      if (from) trainingQuery = trainingQuery.gte("purchased_at", from.toISOString());
      const { data: trainingData } = await trainingQuery;
      const trainingIncome = trainingData?.reduce((sum, t) => sum + (t.credits_paid || 0), 0) || 0;

      // 2. Bank transfers (approved transactions)
      let bankQuery = supabase.from("transactions").select("amount_mmk").eq("status", "approved").lte("created_at", toISO);
      if (from) bankQuery = bankQuery.gte("created_at", from.toISOString());
      const { data: bankData } = await bankQuery;
      const bankTransfer = bankData?.reduce((sum, t) => sum + (t.amount_mmk || 0), 0) || 0;

      // 3. Stripe (check for stripe transactions via package_name or a stripe indicator)
      let stripeQuery = supabase.from("credit_audit_log").select("amount, description").eq("credit_type", "stripe").lte("created_at", toISO);
      if (from) stripeQuery = stripeQuery.gte("created_at", from.toISOString());
      const { data: stripeData } = await stripeQuery;
      // Parse USD from descriptions if available, otherwise estimate
      let stripeUSD = 0;
      stripeData?.forEach(s => {
        const match = s.description?.match(/\$(\d+(?:\.\d+)?)/);
        if (match) stripeUSD += parseFloat(match[1]);
        else stripeUSD += Math.abs(s.amount || 0) / 100; // rough estimate
      });
      const stripeMmk = Math.round(stripeUSD * MMK_PER_USD);

      // 4. API costs (from daily_content_videos investment)
      let apiQuery = supabase.from("daily_content_videos").select("api_cost_credits").lte("created_at", toISO);
      if (from) apiQuery = apiQuery.gte("created_at", from.toISOString());
      const { data: apiData } = await apiQuery;
      const apiCosts = apiData?.reduce((sum, v) => sum + Number(v.api_cost_credits || 0), 0) || 0;

      // 5. Ad profit (from ad_credit_logs - admin's perspective)
      let adQuery = supabase.from("ad_credit_logs").select("credits_earned").lte("created_at", toISO);
      if (from) adQuery = adQuery.gte("created_at", from.toISOString());
      const { data: adData } = await adQuery;
      const adCreditsTotal = adData?.reduce((sum, a) => sum + (a.credits_earned || 0), 0) || 0;
      // Admin keeps 70% of ad revenue (30/70 split)
      const adProfit = Math.round(adCreditsTotal * 0.7);

      setData({ adProfit, trainingIncome, apiCosts, bankTransfer, stripeUSD, stripeMmk });
    } catch (err) {
      console.error("Financial data error:", err);
      toast({ title: "Data loading error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [getDateRange, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Subscribe to realtime transaction updates
  useEffect(() => {
    const channel = supabase
      .channel("financial-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const totalNetProfit = data.adProfit + data.trainingIncome - data.apiCosts;
  const totalRevenue = data.bankTransfer + data.stripeMmk;
  const periodLabel = historyOffset === 0 ? "ယခုလက်ရှိ" : `${historyOffset} ကာလ အရင်`;

  const TIME_OPTIONS: { key: TimeFrame; label: string }[] = [
    { key: "15d", label: "၁၅ ရက်" },
    { key: "1m", label: "၁ လ" },
    { key: "all", label: "အားလုံး" },
  ];

  return (
    <div className="space-y-4">
      {/* Timeframe Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-secondary/50 rounded-xl p-1">
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => { setTimeFrame(opt.key); setHistoryOffset(0); }}
              className={`px-3 py-1.5 text-xs rounded-lg font-myanmar transition-all ${timeFrame === opt.key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* History Navigation */}
      {timeFrame !== "all" && (
        <div className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2">
          <Button variant="ghost" size="sm" onClick={() => setHistoryOffset(h => h + 1)} className="h-7 px-2">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground font-myanmar flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {periodLabel}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setHistoryOffset(h => Math.max(0, h - 1))} disabled={historyOffset === 0} className="h-7 px-2">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* SECTION 1: KOKOPHYO */}
          <div className="gradient-card rounded-2xl p-4 border border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-foreground font-myanmar text-sm">Kokophyo</h3>
                <p className="text-[10px] text-muted-foreground font-myanmar">အမြတ်ငွေ ခြုံငုံသုံးသပ်ချက်</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Ad Profit */}
              <div className="flex items-center justify-between p-3 bg-secondary/40 rounded-xl">
                <div>
                  <p className="text-xs text-muted-foreground font-myanmar">📢 ကြော်ငြာမှရသော အမြတ်</p>
                  <p className="text-[10px] text-muted-foreground">Adsterra / HilltopAds (70%)</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-500">{data.adProfit.toLocaleString()} Cr</p>
                </div>
              </div>

              {/* Training Income */}
              <div className="flex items-center justify-between p-3 bg-secondary/40 rounded-xl">
                <div>
                  <p className="text-xs text-muted-foreground font-myanmar">🎓 သင်တန်းမှရသောဝင်ငွေ</p>
                  <p className="text-[10px] text-muted-foreground">Course enrollments</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-500">{data.trainingIncome.toLocaleString()} Cr</p>
                </div>
              </div>

              {/* API Costs */}
              <div className="flex items-center justify-between p-3 bg-destructive/5 rounded-xl border border-destructive/20">
                <div>
                  <p className="text-xs text-muted-foreground font-myanmar">⚙️ API ကုန်ကျစရိတ်</p>
                  <p className="text-[10px] text-muted-foreground">Content Factory + Tools</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-destructive">-{data.apiCosts.toLocaleString()} Cr</p>
                </div>
              </div>

              {/* Net Profit */}
              <div className={`flex items-center justify-between p-3 rounded-xl border-2 ${totalNetProfit >= 0 ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"}`}>
                <p className="text-sm font-bold text-foreground font-myanmar">💰 စုစုပေါင်း အသားတင်အမြတ်</p>
                <p className={`text-lg font-bold ${totalNetProfit >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {totalNetProfit >= 0 ? "+" : ""}{totalNetProfit.toLocaleString()} Cr
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: စာရင်းချုပ် */}
          <div className="gradient-card rounded-2xl p-4 border border-blue-500/30 bg-blue-500/5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h3 className="font-bold text-foreground font-myanmar text-sm">စာရင်းချုပ်</h3>
                <p className="text-[10px] text-muted-foreground font-myanmar">ငွေပေးချေမှု အမျိုးအစားအလိုက်</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Bank Transfer */}
              <div className="flex items-center justify-between p-3 bg-secondary/40 rounded-xl">
                <div>
                  <p className="text-xs text-muted-foreground font-myanmar">🏦 Bank Transfer</p>
                  <p className="text-[10px] text-muted-foreground">KBZ, CB, AYA, Manual Banks</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{data.bankTransfer.toLocaleString()} MMK</p>
                </div>
              </div>

              {/* Stripe */}
              <div className="flex items-center justify-between p-3 bg-secondary/40 rounded-xl">
                <div>
                  <p className="text-xs text-muted-foreground font-myanmar">💳 Stripe (Visa/Master)</p>
                  <p className="text-[10px] text-muted-foreground">International payments</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">${data.stripeUSD.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">~ {data.stripeMmk.toLocaleString()} MMK</p>
                </div>
              </div>

              {/* Total Revenue */}
              <div className="flex items-center justify-between p-3 rounded-xl border-2 border-blue-500/40 bg-blue-500/10">
                <p className="text-sm font-bold text-foreground font-myanmar">📊 စုစုပေါင်း ဝင်ငွေ</p>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-500">{totalRevenue.toLocaleString()} MMK</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
