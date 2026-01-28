import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Users, CreditCard, CheckCircle, XCircle, Clock, 
  BarChart3, Download, Settings, Activity, Sun, Moon, 
  Bell, TrendingUp, DollarSign, Image, Video, Volume2,
  Save, Key, Building
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";

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

interface PricingPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
}

export const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  
  // Pricing state
  const [packages, setPackages] = useState<PricingPackage[]>([
    { id: "starter", name: "Starter", credits: 300, price: 20000 },
    { id: "professional", name: "Professional", credits: 700, price: 40000 },
    { id: "enterprise", name: "Enterprise", credits: 2000, price: 100000 },
  ]);
  const [isSavingPricing, setIsSavingPricing] = useState(false);

  // API Keys state
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [stabilityApiKey, setStabilityApiKey] = useState("");
  const [isSavingApiKeys, setIsSavingApiKeys] = useState(false);

  // Bank Details state
  const [bankScbAccount, setBankScbAccount] = useState("399-459002-6");
  const [bankScbNameTh, setBankScbNameTh] = useState("เงินฝากออมทรัพย์ (ไม่มีสมุดคู่ฝาก)");
  const [bankScbNameEn, setBankScbNameEn] = useState("ATASIT KANTHA");
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState({
    dailyIncome: 0,
    weeklyIncome: 0,
    monthlyIncome: 0,
    totalTransactions: 0,
    pendingCount: 0,
    successCount: 0,
  });

  // API Health state
  const [apiHealth, setApiHealth] = useState({
    gemini: { status: "checking", lastCheck: new Date() },
    stability: { status: "checking", lastCheck: new Date() },
  });

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

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
      calculateAnalytics();
      checkApiHealth();
      loadSettings();
    };

    checkAdminAccess();
  }, [navigate, toast]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value");
      
      if (error) {
        console.error("Error loading settings:", error);
        return;
      }

      if (data) {
        data.forEach((setting) => {
          switch (setting.key) {
            case "gemini_api_key":
              setGeminiApiKey(setting.value || "");
              break;
            case "stability_api_key":
              setStabilityApiKey(setting.value || "");
              break;
            case "bank_scb_account":
              setBankScbAccount(setting.value || "399-459002-6");
              break;
            case "bank_scb_name_th":
              setBankScbNameTh(setting.value || "เงินฝากออมทรัพย์ (ไม่มีสมุดคู่ฝาก)");
              break;
            case "bank_scb_name_en":
              setBankScbNameEn(setting.value || "ATASIT KANTHA");
              break;
          }
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

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

  const calculateAnalytics = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("status", "success");

    if (data) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailyIncome = data
        .filter(t => new Date(t.created_at) >= today)
        .reduce((sum, t) => sum + t.amount_mmk, 0);

      const weeklyIncome = data
        .filter(t => new Date(t.created_at) >= weekAgo)
        .reduce((sum, t) => sum + t.amount_mmk, 0);

      const monthlyIncome = data
        .filter(t => new Date(t.created_at) >= monthAgo)
        .reduce((sum, t) => sum + t.amount_mmk, 0);

      setAnalytics({
        dailyIncome,
        weeklyIncome,
        monthlyIncome,
        totalTransactions: data.length,
        pendingCount: transactions.filter(t => t.status === "pending").length,
        successCount: data.length,
      });
    }
  };

  const checkApiHealth = async () => {
    // Check Gemini API from stored settings
    const geminiKey = geminiApiKey || localStorage.getItem("gemini_api_key");
    if (geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`
        );
        setApiHealth(prev => ({
          ...prev,
          gemini: { status: response.ok ? "active" : "error", lastCheck: new Date() }
        }));
      } catch {
        setApiHealth(prev => ({
          ...prev,
          gemini: { status: "error", lastCheck: new Date() }
        }));
      }
    } else {
      setApiHealth(prev => ({
        ...prev,
        gemini: { status: "no_key", lastCheck: new Date() }
      }));
    }

    // Check Stability API
    const stabilityKey = stabilityApiKey || localStorage.getItem("stability_api_key");
    if (stabilityKey) {
      setApiHealth(prev => ({
        ...prev,
        stability: { status: "configured", lastCheck: new Date() }
      }));
    } else {
      setApiHealth(prev => ({
        ...prev,
        stability: { status: "no_key", lastCheck: new Date() }
      }));
    }
  };

  const saveApiKeys = async () => {
    setIsSavingApiKeys(true);
    try {
      // Save to database
      const updates = [
        { key: "gemini_api_key", value: geminiApiKey },
        { key: "stability_api_key", value: stabilityApiKey },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: update.key, value: update.value }, { onConflict: "key" });
        
        if (error) throw error;
      }

      // Also save to localStorage for immediate use
      localStorage.setItem("gemini_api_key", geminiApiKey);
      localStorage.setItem("stability_api_key", stabilityApiKey);

      toast({
        title: "သိမ်းဆည်းပြီးပါပြီ",
        description: "API Keys များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ",
      });

      checkApiHealth();
    } catch (error) {
      console.error("Error saving API keys:", error);
      toast({
        title: "အမှား",
        description: "API Keys သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်။",
        variant: "destructive",
      });
    } finally {
      setIsSavingApiKeys(false);
    }
  };

  const saveBankDetails = async () => {
    setIsSavingBank(true);
    try {
      const updates = [
        { key: "bank_scb_account", value: bankScbAccount },
        { key: "bank_scb_name_th", value: bankScbNameTh },
        { key: "bank_scb_name_en", value: bankScbNameEn },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: update.key, value: update.value }, { onConflict: "key" });
        
        if (error) throw error;
      }

      toast({
        title: "သိမ်းဆည်းပြီးပါပြီ",
        description: "Bank Details များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ",
      });
    } catch (error) {
      console.error("Error saving bank details:", error);
      toast({
        title: "အမှား",
        description: "Bank Details သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်။",
        variant: "destructive",
      });
    } finally {
      setIsSavingBank(false);
    }
  };

  const savePricingChanges = async () => {
    setIsSavingPricing(true);
    try {
      // Save pricing to localStorage for now (can be migrated to DB later)
      localStorage.setItem("pricing_packages", JSON.stringify(packages));
      
      toast({
        title: "သိမ်းဆည်းပြီးပါပြီ",
        description: "စျေးနှုန်းများကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ",
      });
    } catch (error) {
      console.error("Error saving pricing:", error);
      toast({
        title: "အမှား",
        description: "စျေးနှုန်းများ သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်။",
        variant: "destructive",
      });
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleApprove = async (tx: PendingTransaction) => {
    setProcessingId(tx.id);
    
    try {
      const { error: txError } = await supabase
        .from("transactions")
        .update({ status: "success" })
        .eq("id", tx.id);

      if (txError) throw txError;

      let totalCredits = tx.credits;
      if (tx.is_first_purchase) {
        const bonus = Math.floor(tx.credits * 0.2);
        totalCredits += bonus;
        
        await supabase
          .from("transactions")
          .update({ bonus_credits: bonus })
          .eq("id", tx.id);
      }

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
        title: "အတည်ပြုပြီး ✓",
        description: `${totalCredits} Credits ထည့်သွင်းပေးပြီးပါပြီ။ User အား အကြောင်းကြားပြီးပါပြီ။`,
      });

      fetchTransactions();
      calculateAnalytics();
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
        description: rejectReason ? `အကြောင်းပြချက်: ${rejectReason}` : "ငွေသွင်းမှုကို ငြင်းပယ်ပြီးပါပြီ။",
      });

      setShowRejectModal(null);
      setRejectReason("");
      fetchTransactions();
    } catch (error) {
      console.error("Error rejecting transaction:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleExportCSV = () => {
    const successTx = transactions.filter(t => t.status === "success");
    const csvContent = [
      ["Date", "Package", "Credits", "Amount (MMK)", "Status"],
      ...successTx.map(t => [
        new Date(t.created_at).toLocaleDateString(),
        t.package_name,
        t.credits + (t.bonus_credits || 0),
        t.amount_mmk,
        t.status,
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast({
      title: "Export အောင်မြင်ပါသည်",
      description: "CSV ဖိုင်ကို download လုပ်ပြီးပါပြီ။",
    });
  };

  const updatePackagePrice = (id: string, field: "credits" | "price", value: number) => {
    setPackages(prev => prev.map(pkg => 
      pkg.id === id ? { ...pkg, [field]: value } : pkg
    ));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("my-MM");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("my-MM").format(amount) + " MMK";
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
      <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Admin Dashboard</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="transactions" className="text-xs">
              <CreditCard className="w-4 h-4 mr-1" />
              ငွေသွင်း
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">
              <BarChart3 className="w-4 h-4 mr-1" />
              စာရင်း
            </TabsTrigger>
            <TabsTrigger value="pricing" className="text-xs">
              <DollarSign className="w-4 h-4 mr-1" />
              စျေးနှုန်း
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs">
              <Activity className="w-4 h-4 mr-1" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
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
                <p className="text-2xl font-bold text-foreground">{analytics.successCount}</p>
              </div>
            </div>

            {/* Pending Transactions */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
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
                          <p className="text-sm text-muted-foreground">{formatCurrency(tx.amount_mmk)}</p>
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
                          onClick={() => setShowRejectModal(tx.id)}
                          disabled={processingId === tx.id}
                          variant="destructive"
                          className="flex-1 py-2 rounded-xl"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          ငြင်းပယ်မည်
                        </Button>
                      </div>

                      {/* Reject Modal */}
                      {showRejectModal === tx.id && (
                        <div className="mt-3 p-3 bg-destructive/10 rounded-xl border border-destructive/30">
                          <label className="block text-xs font-medium text-destructive mb-2">
                            ငြင်းပယ်ရသည့် အကြောင်းပြချက်
                          </label>
                          <Input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="ဥပမာ: ပြေစာအမှားဖြစ်နေပါသည်"
                            className="mb-2 text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleReject(tx.id)}
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                            >
                              အတည်ပြု ငြင်းပယ်မည်
                            </Button>
                            <Button
                              onClick={() => setShowRejectModal(null)}
                              size="sm"
                              variant="outline"
                              className="flex-1"
                            >
                              ပယ်ဖျက်မည်
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed Transactions */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">မှတ်တမ်းများ</h2>
              {completedTransactions.length === 0 ? (
                <div className="gradient-card rounded-2xl p-6 border border-border/30 text-center">
                  <p className="text-muted-foreground">မှတ်တမ်း မရှိသေးပါ</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {completedTransactions.slice(0, 10).map((tx) => (
                    <div
                      key={tx.id}
                      className={`gradient-card rounded-xl p-3 border ${
                        tx.status === "success" ? "border-success/30" : "border-destructive/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground text-sm">{tx.package_name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${
                            tx.status === "success" ? "text-success" : "text-destructive"
                          }`}>
                            {tx.status === "success" ? "အတည်ပြုပြီး" : "ငြင်းပယ်ပြီး"}
                          </p>
                          <p className="text-xs text-muted-foreground">{tx.credits} Credits</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">ယနေ့ဝင်ငွေ</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(analytics.dailyIncome)}</p>
              </div>
              
              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">ဤအပတ်ဝင်ငွေ</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(analytics.weeklyIncome)}</p>
              </div>
              
              <div className="gradient-card rounded-2xl p-4 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">ဤလဝင်ငွေ</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(analytics.monthlyIncome)}</p>
              </div>
            </div>

            <Button onClick={handleExportCSV} className="w-full" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              CSV Export
            </Button>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4">
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                စျေးနှုန်း ပြင်ဆင်ခြင်း
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                မှတ်ချက်: API costs များသည် USD ဖြင့် ဖြစ်သည်။ အမြတ်ရရန် သင့်လျော်သော စျေးနှုန်းများ သတ်မှတ်ပါ။
              </p>

              <div className="space-y-4">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="p-3 bg-secondary/30 rounded-xl">
                    <p className="font-medium text-foreground mb-2">{pkg.name}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Credits</label>
                        <Input
                          type="number"
                          value={pkg.credits}
                          onChange={(e) => updatePackagePrice(pkg.id, "credits", parseInt(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Price (MMK)</label>
                        <Input
                          type="number"
                          value={pkg.price}
                          onChange={(e) => updatePackagePrice(pkg.id, "price", parseInt(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button 
                onClick={savePricingChanges} 
                disabled={isSavingPricing}
                className="w-full mt-4 gradient-gold text-primary-foreground"
              >
                {isSavingPricing ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-4">
            {/* API Health */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                API Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                  <span className="text-sm text-foreground">Google Gemini</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    apiHealth.gemini.status === "active" ? "bg-success/20 text-success" :
                    apiHealth.gemini.status === "configured" ? "bg-warning/20 text-warning" :
                    "bg-destructive/20 text-destructive"
                  }`}>
                    {apiHealth.gemini.status === "active" ? "Active" :
                     apiHealth.gemini.status === "configured" ? "Configured" :
                     apiHealth.gemini.status === "no_key" ? "No Key" : "Error"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                  <span className="text-sm text-foreground">Stability AI</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    apiHealth.stability.status === "configured" ? "bg-success/20 text-success" :
                    "bg-destructive/20 text-destructive"
                  }`}>
                    {apiHealth.stability.status === "configured" ? "Configured" : "No Key"}
                  </span>
                </div>
              </div>
            </div>

            {/* API Keys Settings */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                API Keys
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Google Gemini API Key</label>
                  <Input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">အသံပြောင်းခြင်းအတွက် အသုံးပြုပါသည်</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Stability AI API Key</label>
                  <Input
                    type="password"
                    value={stabilityApiKey}
                    onChange={(e) => setStabilityApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">ပုံထုတ်ခြင်းအတွက် အသုံးပြုပါသည်</p>
                </div>
                <Button 
                  onClick={saveApiKeys} 
                  disabled={isSavingApiKeys}
                  className="w-full gradient-gold text-primary-foreground"
                >
                  {isSavingApiKeys ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save API Keys
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Bank Details Settings */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" />
                SCB Bank Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Account Number</label>
                  <Input
                    value={bankScbAccount}
                    onChange={(e) => setBankScbAccount(e.target.value)}
                    placeholder="399-459002-6"
                    className="bg-background/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Account Name (TH)</label>
                  <Input
                    value={bankScbNameTh}
                    onChange={(e) => setBankScbNameTh(e.target.value)}
                    placeholder="เงินฝากออมทรัพย์"
                    className="bg-background/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Account Name (EN)</label>
                  <Input
                    value={bankScbNameEn}
                    onChange={(e) => setBankScbNameEn(e.target.value)}
                    placeholder="ATASIT KANTHA"
                    className="bg-background/50"
                  />
                </div>
                <Button 
                  onClick={saveBankDetails} 
                  disabled={isSavingBank}
                  className="w-full gradient-gold text-primary-foreground"
                >
                  {isSavingBank ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Bank Details
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
