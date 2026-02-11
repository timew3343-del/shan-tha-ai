import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Users, CreditCard, CheckCircle, XCircle, Clock, 
  BarChart3, Download, Settings, Activity, Sun, Moon,
  Bell, TrendingUp, DollarSign, Building, Brain,
  Save, Key, Plus, Trash2, Wallet, CreditCard as CardIcon, Image, X, Loader2,
  Gift, ExternalLink, AlertTriangle, Power, Eye, EyeOff, Play, Settings2, Tag, MessageSquare, Film, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "next-themes";
import { CampaignSubmissionsTab } from "@/components/admin/CampaignSubmissionsTab";
import { CreditAuditTab } from "@/components/admin/CreditAuditTab";
import { AppSettingsTab } from "@/components/admin/AppSettingsTab";
import { ToolAnalyticsTab } from "@/components/admin/ToolAnalyticsTab";
import { GlobalMarginTab } from "@/components/admin/GlobalMarginTab"; // kept for reference but removed from UI
import { HybridProfitTab } from "@/components/admin/HybridProfitTab";
import { PromoCodesTab } from "@/components/admin/PromoCodesTab";
import { UserFeedbackTab } from "@/components/admin/UserFeedbackTab";
import { ContentFactoryTab } from "@/components/admin/ContentFactoryTab";
import { AdminUserTable } from "@/components/admin/AdminUserTable";
import { ApiSwitchingTab } from "@/components/admin/ApiSwitchingTab";
import { AdsterraConfigTab } from "@/components/admin/AdsterraConfigTab";
import { KnowledgeBaseTab } from "@/components/admin/KnowledgeBaseTab";
import { ApiBalanceTab } from "@/components/admin/ApiBalanceTab";
import { CollaboratorManagementTab } from "@/components/admin/CollaboratorManagementTab";

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

interface PaymentMethod {
  id: string;
  type: "pay" | "bank";
  name: string;
  number: string;
  holder: string;
  country?: string;
}

export const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { isAdmin, isTrainer, isLoading: roleLoading } = useUserRole(userId);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState<string | null>(null);
  
  // Pricing state
  const [packages, setPackages] = useState<PricingPackage[]>([
    { id: "starter", name: "Starter", credits: 300, price: 20000 },
    { id: "professional", name: "Professional", credits: 700, price: 40000 },
    { id: "enterprise", name: "Enterprise", credits: 2000, price: 120000 },
  ]);
  const [isSavingPricing, setIsSavingPricing] = useState(false);

  // Credit Costs state removed - now uses Global Profit Margin

  // Manual credit management state
  const [manualCreditEmail, setManualCreditEmail] = useState("");
  const [manualCreditAmount, setManualCreditAmount] = useState("");
  const [manualCreditAction, setManualCreditAction] = useState<"add" | "subtract">("add");
  const [isProcessingManualCredit, setIsProcessingManualCredit] = useState(false);

  // Users state
  const [users, setUsers] = useState<{ user_id: string; email: string; credit_balance: number; created_at: string }[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  // isSavingCosts removed - now uses Global Profit Margin

  // Campaigns state
  const [campaigns, setCampaigns] = useState<{ id: string; user_id: string; link: string; platform: string; status: string; created_at: string; user_email?: string }[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  
  // Face swap enabled state
  const [faceSwapEnabled, setFaceSwapEnabled] = useState(true);

   // API Keys state - stores masked values for display, raw values only on save
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [stabilityApiKey, setStabilityApiKey] = useState("");
  const [replicateApiToken, setReplicateApiToken] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [shotstackApiKey, setShotstackApiKey] = useState("");
  const [acrcloudAccessKey, setAcrcloudAccessKey] = useState("");
  const [acrcloudAccessSecret, setAcrcloudAccessSecret] = useState("");
  // Track which keys have been loaded vs modified
  const [apiKeyStatus, setApiKeyStatus] = useState<Record<string, boolean>>({});
  const [isSavingApiKeys, setIsSavingApiKeys] = useState(false);
  
  // Password visibility for API keys
  const [showReplicateKey, setShowReplicateKey] = useState(false);
  const [showStripePublishable, setShowStripePublishable] = useState(false);
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showShotstackKey, setShowShotstackKey] = useState(false);
  const [showAcrcloudKey, setShowAcrcloudKey] = useState(false);
  const [showAcrcloudSecret, setShowAcrcloudSecret] = useState(false);
  
  // Maintenance mode state
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);

  // Payment Methods state
  const [activePaymentTab, setActivePaymentTab] = useState("scb");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: "scb", type: "bank", name: "SCB Bank", number: "399-459002-6", holder: "ATASIT KANTHA", country: "🇹🇭 Thailand" },
    { id: "kpay", type: "pay", name: "KBZPay", number: "09771048901", holder: "Zarni Pyae Phyo Aung", country: "🇲🇲 Myanmar" },
    { id: "wavepay", type: "pay", name: "WavePay", number: "09771048901", holder: "Zarni Pyae Phyo Aung", country: "🇲🇲 Myanmar" },
  ]);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [showAddForm, setShowAddForm] = useState<"pay" | "bank" | null>(null);
  const [newPayment, setNewPayment] = useState({ name: "", number: "", holder: "", country: "🇲🇲 Myanmar" });

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
    replicate: { status: "checking", lastCheck: new Date() },
  });

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);
    };

    checkAdminAccess();
  }, [navigate]);

  // Check admin/trainer access once role is loaded
  useEffect(() => {
    if (!roleLoading && userId) {
      if (!isAdmin && !isTrainer) {
        toast({
          title: "ခွင့်ပြုချက်မရှိပါ",
          description: "Admin သို့မဟုတ် Trainer အကောင့်သာ ဝင်ရောက်ခွင့်ရှိပါသည်။",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      if (isAdmin) {
        fetchTransactions();
        calculateAnalytics();
        loadSettings();
        loadUsers();
        loadCampaigns();
      }
      setIsLoading(false);
    }
  }, [roleLoading, isAdmin, isTrainer, userId, navigate, toast]);

  // Reactively update API health whenever key state changes
  useEffect(() => {
    setApiHealth({
      gemini: { 
        status: apiKeyStatus["gemini_api_key"] || geminiApiKey.length > 0 ? "configured" : "no_key", 
        lastCheck: new Date() 
      },
      stability: { 
        status: apiKeyStatus["stability_api_key"] || stabilityApiKey.length > 0 ? "configured" : "no_key", 
        lastCheck: new Date() 
      },
      replicate: { 
        status: apiKeyStatus["replicate_api_token"] || replicateApiToken.length > 0 ? "configured" : "no_key", 
        lastCheck: new Date() 
      },
    });
  }, [apiKeyStatus, geminiApiKey, stabilityApiKey, replicateApiToken]);

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
        const loadedPayments: PaymentMethod[] = [];
        const keyConfigured: Record<string, boolean> = {};
        
        // Helper to mask an API key for display (show only last 4 chars)
        const maskKey = (key: string): string => {
          if (!key || key.length < 8) return key ? "••••••••" : "";
          return "••••••••" + key.slice(-4);
        };
        
        data.forEach((setting) => {
          switch (setting.key) {
            case "gemini_api_key":
              setGeminiApiKey(maskKey(setting.value || ""));
              keyConfigured["gemini_api_key"] = !!(setting.value);
              break;
            case "stability_api_key":
              setStabilityApiKey(maskKey(setting.value || ""));
              keyConfigured["stability_api_key"] = !!(setting.value);
              break;
            case "replicate_api_token":
              setReplicateApiToken(maskKey(setting.value || ""));
              keyConfigured["replicate_api_token"] = !!(setting.value);
              break;
            case "stripe_publishable_key":
              setStripePublishableKey(maskKey(setting.value || ""));
              keyConfigured["stripe_publishable_key"] = !!(setting.value);
              break;
            case "stripe_secret_key":
              setStripeSecretKey(maskKey(setting.value || ""));
              keyConfigured["stripe_secret_key"] = !!(setting.value);
              break;
            case "shotstack_api_key":
              setShotstackApiKey(maskKey(setting.value || ""));
              keyConfigured["shotstack_api_key"] = !!(setting.value);
              break;
            case "acrcloud_access_key":
              setAcrcloudAccessKey(maskKey(setting.value || ""));
              keyConfigured["acrcloud_access_key"] = !!(setting.value);
              break;
            case "acrcloud_access_secret":
              setAcrcloudAccessSecret(maskKey(setting.value || ""));
              keyConfigured["acrcloud_access_secret"] = !!(setting.value);
              break;
            case "is_maintenance_mode":
              setIsMaintenanceMode(setting.value === "true");
              break;
          }
          
          // Load payment methods
          if (setting.key.startsWith("payment_")) {
            try {
              const parsed = JSON.parse(setting.value || "{}");
              if (parsed.id) {
                loadedPayments.push(parsed);
              }
            } catch {}
          }
        });
        
        setApiKeyStatus(keyConfigured);
        
        if (loadedPayments.length > 0) {
          setPaymentMethods(loadedPayments);
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data } = await supabase.from("profiles").select("user_id, credit_balance, created_at").order("created_at", { ascending: false });
      setUsers(data?.map(u => ({ ...u, email: "" })) || []);
    } finally { setIsLoadingUsers(false); }
  };

  const loadCampaigns = async () => {
    setIsLoadingCampaigns(true);
    try {
      const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      setCampaigns(data || []);
    } finally { setIsLoadingCampaigns(false); }
  };

  const approveCampaign = async (campaignId: string, campaignUserId: string) => {
    await supabase.from("campaigns").update({ status: "approved", credits_awarded: 20 }).eq("id", campaignId);
    await supabase.rpc("add_user_credits", { _user_id: campaignUserId, _amount: 20 });
    toast({ title: "Campaign အတည်ပြုပြီး", description: "20 Credits ထည့်သွင်းပေးပြီးပါပြီ" });
    loadCampaigns();
  };

  const rejectCampaign = async (campaignId: string) => {
    await supabase.from("campaigns").update({ status: "rejected" }).eq("id", campaignId);
    toast({ title: "Campaign ငြင်းပယ်ပြီး" });
    loadCampaigns();
  };

  // Manual credit management
  const handleManualCredit = async () => {
    if (!manualCreditEmail || !manualCreditAmount) {
      toast({
        title: "အချက်အလက်မပြည့်စုံပါ",
        description: "Email နှင့် Credit ပမာဏ ထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    const amount = parseInt(manualCreditAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Credit ပမာဏ မှားယွင်းနေပါသည်",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingManualCredit(true);
    try {
      // Find user by email - search in profiles with a more direct approach
      // Since we can't use admin.listUsers from client, we'll search profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id");
      
      // We need to match by looking up user emails through a service function
      // For now, let's use the email the admin provides and trust it
      // In production, you'd want a secure lookup function
      
      // Try to find user_id from users list that we already loaded
      const matchedUser = users.find(u => u.email === manualCreditEmail);
      let targetUserId = matchedUser?.user_id;
      
      // If not found in loaded users, we can't proceed without admin API
      if (!targetUserId) {
        // Fallback: search by partial user_id if it looks like UUID
        if (manualCreditEmail.includes("-") && manualCreditEmail.length === 36) {
          targetUserId = manualCreditEmail;
        } else {
          toast({
            title: "User မတွေ့ပါ",
            description: `${manualCreditEmail} ဖြင့် အကောင့်မတွေ့ပါ။ User ID ကို တိုက်ရိုက်ထည့်ကြည့်ပါ။`,
            variant: "destructive",
          });
          return;
        }
      }

      if (manualCreditAction === "add") {
        const { data: result, error } = await supabase.rpc("add_user_credits", { 
          _user_id: targetUserId, 
          _amount: amount 
        });
        
        const resultObj = result as { success?: boolean; error?: string } | null;
        if (error || !resultObj?.success) {
          throw new Error(resultObj?.error || "Failed to add credits");
        }
        
        toast({
          title: "အောင်မြင်ပါသည်",
          description: `${manualCreditEmail} သို့ ${amount} Credits ထည့်သွင်းပြီးပါပြီ`,
        });
      } else {
        const { data: result, error } = await supabase.rpc("deduct_user_credits", { 
          _user_id: targetUserId, 
          _amount: amount,
          _action: "admin_deduct"
        });
        
        const resultObj = result as { success?: boolean; error?: string } | null;
        if (error || !resultObj?.success) {
          throw new Error(resultObj?.error || "Failed to deduct credits");
        }
        
        toast({
          title: "အောင်မြင်ပါသည်",
          description: `${manualCreditEmail} မှ ${amount} Credits နုတ်ယူပြီးပါပြီ`,
        });
      }

      setManualCreditEmail("");
      setManualCreditAmount("");
      loadUsers();
    } catch (error: any) {
      console.error("Manual credit error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "Credit ပြောင်းလဲရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsProcessingManualCredit(false);
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

  // checkApiHealth is now handled reactively via useEffect above
  
  const toggleMaintenanceMode = async () => {
    setIsTogglingMaintenance(true);
    try {
      const newValue = !isMaintenanceMode;
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "is_maintenance_mode", value: newValue.toString() }, { onConflict: "key" });
      
      if (error) throw error;
      
      setIsMaintenanceMode(newValue);
      toast({
        title: newValue ? "Maintenance Mode ဖွင့်လိုက်ပါပြီ" : "Maintenance Mode ပိတ်လိုက်ပါပြီ",
        description: newValue 
          ? "Users များအား AI tools အသုံးပြုခွင့် ခေတ္တပိတ်ထားပါသည်" 
          : "Users များအား AI tools အသုံးပြုခွင့် ပြန်ဖွင့်ပေးပါပြီ",
      });
    } catch (error) {
      console.error("Error toggling maintenance mode:", error);
      toast({
        title: "အမှား",
        description: "Maintenance mode ပြောင်းလဲရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  const saveApiKeys = async () => {
    setIsSavingApiKeys(true);
    try {
      const updates = [
        { key: "gemini_api_key", value: geminiApiKey },
        { key: "stability_api_key", value: stabilityApiKey },
        { key: "replicate_api_token", value: replicateApiToken },
        { key: "stripe_publishable_key", value: stripePublishableKey },
        { key: "stripe_secret_key", value: stripeSecretKey },
        { key: "shotstack_api_key", value: shotstackApiKey },
        { key: "acrcloud_access_key", value: acrcloudAccessKey },
        { key: "acrcloud_access_secret", value: acrcloudAccessSecret },
      ];

      for (const update of updates) {
        // Skip saving masked values - only save if admin entered a new key
        if (update.value.startsWith("••••")) continue;
        
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: update.key, value: update.value }, { onConflict: "key" });
        
        if (error) throw error;
      }

      // DO NOT store in localStorage - keys stay server-side only

      toast({
        title: "သိမ်းဆည်းပြီးပါပြီ",
        description: "API Keys များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ",
      });

      // API health updates reactively via useEffect
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

  const savePaymentMethod = async (payment: PaymentMethod) => {
    setIsSavingPayment(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ 
          key: `payment_${payment.id}`, 
          value: JSON.stringify(payment) 
        }, { onConflict: "key" });
      
      if (error) throw error;

      toast({
        title: "သိမ်းဆည်းပြီးပါပြီ",
        description: `${payment.name} အချက်အလက်များကို သိမ်းဆည်းပြီးပါပြီ`,
      });
    } catch (error) {
      console.error("Error saving payment:", error);
      toast({
        title: "အမှား",
        description: "သိမ်းဆည်းရာတွင် ပြဿနာရှိပါသည်။",
        variant: "destructive",
      });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const addNewPayment = async () => {
    if (!newPayment.name || !newPayment.number || !newPayment.holder) {
      toast({
        title: "အချက်အလက်မပြည့်စုံပါ",
        description: "အားလုံးဖြည့်စွက်ပါ",
        variant: "destructive",
      });
      return;
    }

    const newId = `${showAddForm}_${Date.now()}`;
    const newMethod: PaymentMethod = {
      id: newId,
      type: showAddForm!,
      name: newPayment.name,
      number: newPayment.number,
      holder: newPayment.holder,
      country: newPayment.country,
    };

    setPaymentMethods(prev => [...prev, newMethod]);
    await savePaymentMethod(newMethod);
    setNewPayment({ name: "", number: "", holder: "", country: "🇲🇲 Myanmar" });
    setShowAddForm(null);
  };

  const updatePaymentField = (id: string, field: keyof PaymentMethod, value: string) => {
    setPaymentMethods(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const deletePayment = async (id: string) => {
    try {
      await supabase
        .from("app_settings")
        .delete()
        .eq("key", `payment_${id}`);
      
      setPaymentMethods(prev => prev.filter(p => p.id !== id));
      
      toast({
        title: "ဖျက်သိမ်းပြီးပါပြီ",
        description: "Payment method ကို ဖျက်သိမ်းပြီးပါပြီ",
      });
    } catch (error) {
      console.error("Error deleting payment:", error);
    }
  };

  // saveCreditCosts removed - now uses Global Profit Margin

  const savePricingChanges = async () => {
    setIsSavingPricing(true);
    try {
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

      // Use secure RPC with row locking to add credits
      const { data: result, error: creditError } = await supabase.rpc("add_user_credits", {
        _user_id: tx.user_id,
        _amount: totalCredits
      });

      const resultObj = result as { success?: boolean; error?: string; new_balance?: number } | null;
      if (creditError || !resultObj?.success) {
        throw new Error(resultObj?.error || "Failed to add credits");
      }
          
      // Add to credit audit log for tracking purchased credits
      await supabase.from("credit_audit_log").insert({
        user_id: tx.user_id,
        amount: totalCredits,
        credit_type: "purchased",
        description: `${tx.package_name} - ${tx.amount_mmk} MMK`,
      });

      toast({
        title: "အတည်ပြုပြီး ✓",
        description: `${totalCredits} Credits ထည့်သွင်းပေးပြီးပါပြီ။`,
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

  const handleViewScreenshot = async (screenshotPath: string | null, txId: string) => {
    if (!screenshotPath) {
      toast({
        title: "ပြေစာမရှိပါ",
        description: "ဤငွေသွင်းမှုတွင် ပြေစာမပါဝင်ပါ",
        variant: "destructive",
      });
      return;
    }

    setLoadingScreenshot(txId);
    try {
      // Extract the path from the full URL if it's a full URL
      let path = screenshotPath;
      if (screenshotPath.includes('/storage/v1/object/public/payment-screenshots/')) {
        path = screenshotPath.split('/payment-screenshots/')[1];
      }

      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { path },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to get screenshot");
      }

      setScreenshotUrl(data.signedUrl);
    } catch (error: any) {
      console.error("Screenshot error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: "ပြေစာကြည့်ရှုရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setLoadingScreenshot(null);
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

  if ((!isAdmin && !isTrainer) || isLoading) {
    return (
      <div className="min-h-screen gradient-navy flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingTransactions = transactions.filter(tx => tx.status === "pending");
  const completedTransactions = transactions.filter(tx => tx.status !== "pending");

  const currentPayment = paymentMethods.find(p => p.id === activePaymentTab);

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
          <h1 className="text-lg font-semibold text-foreground">
            {isTrainer ? "AI Brain Editor" : "Admin Dashboard"}
          </h1>
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
        {/* Trainer-only view: just Knowledge Base */}
        {isTrainer && !isAdmin ? (
          <KnowledgeBaseTab />
        ) : (
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-2">
            <TabsTrigger value="transactions" className="text-xs">
              <CreditCard className="w-4 h-4 mr-1" />
              ငွေသွင်း
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="text-xs">
              <Gift className="w-4 h-4 mr-1" />
              Campaign
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs">
              <Play className="w-4 h-4 mr-1" />
              Audit
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">
              <BarChart3 className="w-4 h-4 mr-1" />
              စာရင်း
            </TabsTrigger>
          </TabsList>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="pricing" className="text-xs">
              <DollarSign className="w-4 h-4 mr-1" />
              စျေးနှုန်း
            </TabsTrigger>
            <TabsTrigger value="promo" className="text-xs">
              <Tag className="w-4 h-4 mr-1" />
              Promo
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs">
              <MessageSquare className="w-4 h-4 mr-1" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="appsettings" className="text-xs">
              <Settings2 className="w-4 h-4 mr-1" />
              App
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs">
              <Activity className="w-4 h-4 mr-1" />
              System
            </TabsTrigger>
          </TabsList>
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="content-factory" className="text-xs">
              <Film className="w-4 h-4 mr-1" />
              Content
            </TabsTrigger>
            <TabsTrigger value="users-table" className="text-xs">
              <Users className="w-4 h-4 mr-1" />
              Users
            </TabsTrigger>
            <TabsTrigger value="api-switching" className="text-xs">
              <Zap className="w-4 h-4 mr-1" />
              API Switch
            </TabsTrigger>
          </TabsList>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="adsterra" className="text-xs">
              <DollarSign className="w-4 h-4 mr-1" />
              Ads
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="text-xs">
              <Brain className="w-4 h-4 mr-1" />
              AI Brain
            </TabsTrigger>
            <TabsTrigger value="api-balance" className="text-xs">
              <Wallet className="w-4 h-4 mr-1" />
              API $
            </TabsTrigger>
            <TabsTrigger value="collaborators" className="text-xs">
              <Users className="w-4 h-4 mr-1" />
              Team
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
                    <div key={tx.id} className="gradient-card rounded-2xl p-4 border border-warning/30">
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

          {/* Campaign Submissions Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            <CampaignSubmissionsTab />
          </TabsContent>

          {/* Credit Audit Tab */}
          <TabsContent value="audit" className="space-y-4">
            <CreditAuditTab />
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

            {/* Tool Performance Analytics */}
            <ToolAnalyticsTab />
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
            {/* Hybrid Profit Manager */}
            <HybridProfitTab />
          </TabsContent>

          {/* Promo Codes Tab */}
          <TabsContent value="promo" className="space-y-4">
            <PromoCodesTab />
          </TabsContent>

          {/* User Feedback Tab */}
          <TabsContent value="feedback" className="space-y-4">
            <UserFeedbackTab />
          </TabsContent>

          {/* App Settings Tab */}
          <TabsContent value="appsettings" className="space-y-4">
            <AppSettingsTab />
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-4">
            {/* Global Profit Margin removed - consolidated into Pricing tab's HybridProfitTab */}
            {/* Manual Credit Management */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Manual Credit Management
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                User ID (UUID) ထည့်၍ Credit များ တိုက်ရိုက် ထည့်/နုတ်ယူနိုင်ပါသည်
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">User ID (UUID)</label>
                  <Input
                    type="text"
                    value={manualCreditEmail}
                    onChange={(e) => setManualCreditEmail(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="bg-background/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Credits ပမာဏ</label>
                    <Input
                      type="number"
                      value={manualCreditAmount}
                      onChange={(e) => setManualCreditAmount(e.target.value)}
                      placeholder="100"
                      className="bg-background/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Action</label>
                    <select
                      value={manualCreditAction}
                      onChange={(e) => setManualCreditAction(e.target.value as "add" | "subtract")}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="add">ထည့်မည် (+)</option>
                      <option value="subtract">နုတ်မည် (-)</option>
                    </select>
                  </div>
                </div>

                <Button
                  onClick={handleManualCredit}
                  disabled={isProcessingManualCredit || !manualCreditEmail || !manualCreditAmount}
                  className={`w-full ${manualCreditAction === "add" ? "btn-gradient-green" : "btn-gradient-red"}`}
                >
                  {isProcessingManualCredit ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {manualCreditAction === "add" ? <Plus className="w-4 h-4 mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      {manualCreditAction === "add" ? "Credits ထည့်မည်" : "Credits နုတ်မည်"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Maintenance Mode Toggle */}
            <div className={`gradient-card rounded-2xl p-4 border ${isMaintenanceMode ? 'border-warning/50 bg-warning/5' : 'border-primary/20'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isMaintenanceMode ? 'bg-warning/20' : 'bg-primary/20'}`}>
                    <Power className={`w-5 h-5 ${isMaintenanceMode ? 'text-warning' : 'text-primary'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Maintenance Mode</h3>
                    <p className="text-xs text-muted-foreground">
                      {isMaintenanceMode 
                        ? "API tools များ ခေတ္တပိတ်ထားပါသည်" 
                        : "System အလုပ်လုပ်နေပါသည်"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isTogglingMaintenance ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={isMaintenanceMode}
                      onCheckedChange={toggleMaintenanceMode}
                    />
                  )}
                </div>
              </div>
              {isMaintenanceMode && (
                <div className="mt-3 p-3 bg-warning/10 rounded-lg border border-warning/30">
                  <p className="text-xs text-warning flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Users များအား AI generation tools များ သုံးခွင့် ခေတ္တပိတ်ထားပါသည်။
                  </p>
                </div>
              )}
            </div>

            {/* API Keys - Managed via Cloud Secrets */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                API Keys Status
              </h3>
              <p className="text-xs text-muted-foreground mb-4 font-myanmar">
                API Keys များသည် Cloud Secrets တွင် လုံခြုံစွာ သိမ်းဆည်းထားပါသည်။ Edge Functions များမှ တိုက်ရိုက် အသုံးပြုပါသည်။
              </p>
              <div className="space-y-2">
                {[
                  { name: "Lovable AI (LOVABLE_API_KEY)", status: true },
                  { name: "Google Gemini (GEMINI_API_KEY)", status: true },
                  { name: "Stability AI (STABILITY_API_KEY)", status: true },
                  { name: "Replicate (REPLICATE_API_KEY)", status: true },
                ].map(key => (
                  <div key={key.name} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                    <span className="text-sm text-foreground">{key.name}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-500">
                      ✓ Configured
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Methods Settings */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Payment Methods
              </h3>

              {/* Payment Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {paymentMethods.map((payment) => (
                  <button
                    key={payment.id}
                    onClick={() => setActivePaymentTab(payment.id)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      activePaymentTab === payment.id
                        ? "gradient-gold text-primary-foreground"
                        : "bg-secondary/50 text-foreground hover:bg-secondary"
                    }`}
                  >
                    {payment.country?.split(" ")[0]} {payment.name}
                  </button>
                ))}
              </div>

              {/* Active Payment Form */}
              {currentPayment && (
                <div className="p-4 bg-secondary/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
                      {currentPayment.type === "bank" ? <Building className="w-4 h-4" /> : <CardIcon className="w-4 h-4" />}
                      {currentPayment.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{currentPayment.country}</span>
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {currentPayment.type === "bank" ? "Bank Name" : "Pay Name"}
                    </label>
                    <Input
                      value={currentPayment.name}
                      onChange={(e) => updatePaymentField(currentPayment.id, "name", e.target.value)}
                      className="mt-1 bg-background/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {currentPayment.type === "bank" ? "Account Number" : "Phone Number"}
                    </label>
                    <Input
                      value={currentPayment.number}
                      onChange={(e) => updatePaymentField(currentPayment.id, "number", e.target.value)}
                      className="mt-1 bg-background/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Holder Name</label>
                    <Input
                      value={currentPayment.holder}
                      onChange={(e) => updatePaymentField(currentPayment.id, "holder", e.target.value)}
                      className="mt-1 bg-background/50"
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={() => savePaymentMethod(currentPayment)} 
                      disabled={isSavingPayment}
                      className="flex-1 gradient-gold text-primary-foreground"
                    >
                      {isSavingPayment ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                    {!["scb", "kpay", "wavepay"].includes(currentPayment.id) && (
                      <Button 
                        onClick={() => deletePayment(currentPayment.id)}
                        variant="destructive"
                        size="icon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Add Payment Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => setShowAddForm("pay")}
                  variant="outline"
                  className="flex-1"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pay
                </Button>
                <Button
                  onClick={() => setShowAddForm("bank")}
                  variant="outline"
                  className="flex-1"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Bank
                </Button>
              </div>

              {/* Add New Form */}
              {showAddForm && (
                <div className="mt-4 p-4 border border-primary/30 rounded-xl bg-secondary/20">
                  <h4 className="font-medium text-foreground mb-3">
                    {showAddForm === "pay" ? "Add New Payment" : "Add New Bank"}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {showAddForm === "pay" ? "Pay Name" : "Bank Name"}
                      </label>
                      <Input
                        value={newPayment.name}
                        onChange={(e) => setNewPayment(p => ({ ...p, name: e.target.value }))}
                        placeholder={showAddForm === "pay" ? "e.g. AYAPay" : "e.g. KBZ Bank"}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {showAddForm === "pay" ? "Phone Number" : "Account Number"}
                      </label>
                      <Input
                        value={newPayment.number}
                        onChange={(e) => setNewPayment(p => ({ ...p, number: e.target.value }))}
                        placeholder="09xxxxxxxxx"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Holder Name</label>
                      <Input
                        value={newPayment.holder}
                        onChange={(e) => setNewPayment(p => ({ ...p, holder: e.target.value }))}
                        placeholder="Account holder name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Country</label>
                      <select
                        value={newPayment.country}
                        onChange={(e) => setNewPayment(p => ({ ...p, country: e.target.value }))}
                        className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="🇲🇲 Myanmar">🇲🇲 Myanmar</option>
                        <option value="🇹🇭 Thailand">🇹🇭 Thailand</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addNewPayment} className="flex-1 gradient-gold text-primary-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Add
                      </Button>
                      <Button onClick={() => setShowAddForm(null)} variant="outline" className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Content Factory Tab */}
          <TabsContent value="content-factory" className="space-y-4">
            <ContentFactoryTab />
          </TabsContent>

          {/* Users Table Tab */}
          <TabsContent value="users-table" className="space-y-4">
            <AdminUserTable />
          </TabsContent>

          {/* API Switching Tab */}
          <TabsContent value="api-switching" className="space-y-4">
            <ApiSwitchingTab />
          </TabsContent>

          {/* Adsterra & API Balance Tab */}
          <TabsContent value="adsterra" className="space-y-4">
            <AdsterraConfigTab />
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge" className="space-y-4">
            <KnowledgeBaseTab />
          </TabsContent>

          {/* API Balance Tab */}
          <TabsContent value="api-balance" className="space-y-4">
            <ApiBalanceTab />
          </TabsContent>

          {/* Collaborator Management Tab */}
          <TabsContent value="collaborators" className="space-y-4">
            <CollaboratorManagementTab />
          </TabsContent>
        </Tabs>
        )}
      </div>
    </div>
  );
};

export default Admin;
