import { useState, useEffect } from "react";
import { BarChart3, DollarSign, Gift, Play, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AuditLog {
  id: string;
  user_id: string;
  amount: number;
  credit_type: string;
  description: string | null;
  created_at: string;
}

interface CreditStats {
  purchased: number;
  ad_reward: number;
  campaign_reward: number;
  referral: number;
  admin_manual: number;
}

export const CreditAuditTab = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<CreditStats>({
    purchased: 0,
    ad_reward: 0,
    campaign_reward: 0,
    referral: 0,
    admin_manual: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "all">("week");

  useEffect(() => {
    fetchAuditLogs();
  }, [timeRange]);

  const getTimeFilter = () => {
    const now = new Date();
    switch (timeRange) {
      case "today":
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return today.toISOString();
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo.toISOString();
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return monthAgo.toISOString();
      default:
        return null;
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("credit_audit_log")
        .select("*")
        .order("created_at", { ascending: false });

      const timeFilter = getTimeFilter();
      if (timeFilter) {
        query = query.gte("created_at", timeFilter);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      setLogs(data || []);

      // Calculate stats
      const newStats: CreditStats = {
        purchased: 0,
        ad_reward: 0,
        campaign_reward: 0,
        referral: 0,
        admin_manual: 0,
      };

      (data || []).forEach((log) => {
        if (log.credit_type in newStats) {
          newStats[log.credit_type as keyof CreditStats] += log.amount;
        }
      });

      setStats(newStats);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("my-MM", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCreditTypeIcon = (type: string) => {
    switch (type) {
      case "purchased":
        return <DollarSign className="w-4 h-4 text-green-500" />;
      case "ad_reward":
        return <Play className="w-4 h-4 text-blue-500" />;
      case "campaign_reward":
        return <Gift className="w-4 h-4 text-purple-500" />;
      case "referral":
        return <Users className="w-4 h-4 text-orange-500" />;
      case "admin_manual":
        return <BarChart3 className="w-4 h-4 text-gray-500" />;
      default:
        return <BarChart3 className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getCreditTypeName = (type: string) => {
    switch (type) {
      case "purchased":
        return "ဝယ်ယူပြီး";
      case "ad_reward":
        return "ကြော်ငြာ";
      case "campaign_reward":
        return "Campaign";
      case "referral":
        return "Referral";
      case "admin_manual":
        return "Admin";
      default:
        return type;
    }
  };

  const totalFree = stats.ad_reward + stats.campaign_reward + stats.referral;
  const totalPaid = stats.purchased;
  const profitMargin = totalPaid > 0 ? ((totalPaid - totalFree) / totalPaid * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time Range Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { value: "today", label: "ယနေ့" },
          { value: "week", label: "ဤအပတ်" },
          { value: "month", label: "ဤလ" },
          { value: "all", label: "အားလုံး" },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setTimeRange(option.value as any)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
              timeRange === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Stats Overview */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Credit အရင်းအမြစ် ခွဲခြမ်းစိတ်ဖြာ
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">ဝယ်ယူပြီး</span>
            </div>
            <p className="text-xl font-bold text-green-500">{stats.purchased.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">အခမဲ့ (စုစုပေါင်း)</span>
            </div>
            <p className="text-xl font-bold text-blue-500">{totalFree.toLocaleString()}</p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-400" />
              <span className="text-sm">ကြော်ငြာ Credits</span>
            </div>
            <span className="text-sm font-medium">{stats.ad_reward.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-400" />
              <span className="text-sm">Campaign Credits</span>
            </div>
            <span className="text-sm font-medium">{stats.campaign_reward.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-400" />
              <span className="text-sm">Referral Credits</span>
            </div>
            <span className="text-sm font-medium">{stats.referral.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Admin Manual</span>
            </div>
            <span className="text-sm font-medium">{stats.admin_manual.toLocaleString()}</span>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Paid vs Free Ratio</span>
            <span className={`text-lg font-bold ${profitMargin >= 0 ? "text-green-500" : "text-red-500"}`}>
              {profitMargin.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ဝယ်ယူသူများထံမှ {stats.purchased.toLocaleString()} | အခမဲ့ပေးထားသည် {totalFree.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <h3 className="font-semibold text-foreground mb-4">လတ်တလော Credit မှတ်တမ်းများ</h3>
        
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">မှတ်တမ်း မရှိသေးပါ</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
              >
                <div className="flex items-center gap-3">
                  {getCreditTypeIcon(log.credit_type)}
                  <div>
                    <p className="text-sm font-medium">
                      +{log.amount} Credits ({getCreditTypeName(log.credit_type)})
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {log.user_id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
