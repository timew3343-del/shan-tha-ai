import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Download, TrendingUp, DollarSign, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ToolStat {
  toolName: string;
  usageCount: number;
  totalRevenue: number;
  estimatedProfit: number;
}

// Map credit_type to friendly tool names
const TOOL_NAME_MAP: Record<string, string> = {
  image_generation: "Image Generation",
  video_generation: "Video Generation",
  video_with_speech: "Video + Speech",
  text_to_speech: "Text-to-Speech",
  speech_to_text: "Speech-to-Text",
  ai_chat: "AI Chatbot",
  face_swap: "Face Swap",
  upscale: "4K Upscaler",
  bg_remove: "BG Remover",
  live_camera: "AI Live Cam",
  video_export: "Video Export",
  youtube_to_text: "YouTube to Text",
  character_animation: "Character Animation",
  doc_slide_gen: "Doc & Slide Generator",
  doc_slide_analyze: "Doc/Slide Analysis",
  purchased: "Credit Purchase",
  ad_watch: "Ad Watch",
  referral: "Referral",
  admin_add: "Admin Credit Add",
  admin_deduct: "Admin Credit Deduct",
};

export const ToolAnalyticsTab = () => {
  const [toolStats, setToolStats] = useState<ToolStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [financialData, setFinancialData] = useState<{ name: string; revenue: number; investment: number }[]>([]);

  useEffect(() => {
    fetchToolAnalytics();
  }, []);

  const fetchToolAnalytics = async () => {
    setIsLoading(true);
    try {
      // Fetch all credit audit logs
      const { data: auditLogs, error } = await supabase
        .from("credit_audit_log")
        .select("credit_type, amount, created_at");

      if (error) {
        console.error("Error fetching audit logs:", error);
        return;
      }

      if (!auditLogs) return;

      // Aggregate by tool type - auto-discovery
      const statsMap: Record<string, { count: number; revenue: number }> = {};

      auditLogs.forEach((log) => {
        const type = log.credit_type;
        // Skip non-tool types
        if (["purchased", "ad_watch", "referral", "admin_add", "admin_deduct"].includes(type)) return;
        
        if (!statsMap[type]) {
          statsMap[type] = { count: 0, revenue: 0 };
        }
        statsMap[type].count += 1;
        statsMap[type].revenue += Math.abs(log.amount);
      });

      const stats: ToolStat[] = Object.entries(statsMap)
        .map(([key, val]) => ({
          toolName: TOOL_NAME_MAP[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          usageCount: val.count,
          totalRevenue: val.revenue,
          estimatedProfit: Math.round(val.revenue * 0.4),
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      setToolStats(stats);

      // Financial overview - last 7 days
      const now = new Date();
      const days: { name: string; revenue: number; investment: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });
        
        const dayLogs = auditLogs.filter((log) => {
          const logDate = new Date(log.created_at).toISOString().split("T")[0];
          return logDate === dateStr && !["purchased", "ad_watch", "referral", "admin_add", "admin_deduct"].includes(log.credit_type);
        });

        const dayRevenue = dayLogs.reduce((sum, log) => sum + Math.abs(log.amount), 0);
        // Investment estimate (60% of revenue goes to API costs)
        const dayInvestment = Math.round(dayRevenue * 0.6);

        days.push({ name: dayLabel, revenue: dayRevenue, investment: dayInvestment });
      }
      setFinancialData(days);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalRevenue = toolStats.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalProfit = toolStats.reduce((sum, s) => sum + s.estimatedProfit, 0);
  const totalUsage = toolStats.reduce((sum, s) => sum + s.usageCount, 0);

  const handleExportCSV = () => {
    const csvContent = [
      ["Tool Name", "Usage Count", "Total Revenue (Credits)", "Estimated Profit (40%)"],
      ...toolStats.map((s) => [s.toolName, s.usageCount, s.totalRevenue, s.estimatedProfit]),
      ["", "", "", ""],
      ["TOTAL", totalUsage, totalRevenue, totalProfit],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tool-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Usage</span>
          </div>
          <p className="text-xl font-bold text-foreground">{totalUsage.toLocaleString()}</p>
        </div>
        <div className="gradient-card rounded-2xl p-4 border border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Revenue</span>
          </div>
          <p className="text-xl font-bold text-foreground">{totalRevenue.toLocaleString()} Cr</p>
        </div>
        <div className="gradient-card rounded-2xl p-4 border border-success/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="text-xs text-muted-foreground">Profit (40%)</span>
          </div>
          <p className="text-xl font-bold text-success">{totalProfit.toLocaleString()} Cr</p>
        </div>
      </div>

      {/* Financial Overview Chart */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <h3 className="text-sm font-semibold text-foreground mb-4">📊 Revenue vs Investment (7 Days)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={financialData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend />
            <Bar dataKey="revenue" name="Revenue (Cr)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="investment" name="Investment (Cr)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tool Performance Table */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">🔧 Tool အလိုက် ဝင်ငွေ</h3>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            CSV
          </Button>
        </div>
        
        {toolStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Tool usage data မရှိသေးပါ
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tool Name</TableHead>
                  <TableHead className="text-xs text-right">Usage</TableHead>
                  <TableHead className="text-xs text-right">Revenue</TableHead>
                  <TableHead className="text-xs text-right">Profit (40%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {toolStats.map((stat) => (
                  <TableRow key={stat.toolName}>
                    <TableCell className="text-sm font-medium">{stat.toolName}</TableCell>
                    <TableCell className="text-sm text-right">{stat.usageCount}</TableCell>
                    <TableCell className="text-sm text-right text-primary">{stat.totalRevenue} Cr</TableCell>
                    <TableCell className="text-sm text-right text-success">{stat.estimatedProfit} Cr</TableCell>
                  </TableRow>
                ))}
                {/* Total row */}
                <TableRow className="border-t-2 border-primary/30">
                  <TableCell className="font-bold">TOTAL</TableCell>
                  <TableCell className="font-bold text-right">{totalUsage}</TableCell>
                  <TableCell className="font-bold text-right text-primary">{totalRevenue} Cr</TableCell>
                  <TableCell className="font-bold text-right text-success">{totalProfit} Cr</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};
