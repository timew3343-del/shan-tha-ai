import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, CreditCard, CheckCircle, X, ZoomIn, Sparkles, Clock, Package, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import kbzpayQr from "@/assets/kbzpay-qr.jpg";
import wavepayQr from "@/assets/wavepay-qr.jpg";
import { PromoCodeRedeem } from "@/components/PromoCodeRedeem";
import { TopUpSupportChat } from "@/components/TopUpSupportChat";

interface PricingPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  priceDisplay: string;
  currency: "MMK" | "THB";
  isBestValue?: boolean;
}

const mmkPackages: PricingPackage[] = [
  { id: "starter", name: "Starter", credits: 300, price: 20000, priceDisplay: "၂၀,၀၀၀ MMK", currency: "MMK" },
  { id: "professional", name: "Professional", credits: 700, price: 40000, priceDisplay: "၄၀,၀၀၀ MMK", currency: "MMK", isBestValue: true },
  { id: "enterprise", name: "Enterprise", credits: 2000, price: 100000, priceDisplay: "၁၀၀,၀၀၀ MMK", currency: "MMK" },
];

const thbPackages: PricingPackage[] = [
  { id: "starter-thb", name: "Starter", credits: 300, price: 250, priceDisplay: "฿250 THB", currency: "THB" },
  { id: "professional-thb", name: "Professional", credits: 700, price: 500, priceDisplay: "฿500 THB", currency: "THB", isBestValue: true },
  { id: "enterprise-thb", name: "Enterprise", credits: 2000, price: 1200, priceDisplay: "฿1,200 THB", currency: "THB" },
];

type PaymentMethod = "kbzpay" | "wavepay" | "thai_bank" | "stripe";

export const TopUp = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<PricingPackage | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isFirstPurchase, setIsFirstPurchase] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("kbzpay");
  const [stripeAvailable, setStripeAvailable] = useState(false);
  const [isStripeLoading, setIsStripeLoading] = useState(false);

  // SCB Bank details from settings
  const [scbAccount, setScbAccount] = useState("399-459002-6");
  const [scbNameTh, setScbNameTh] = useState("เงินฝากออมทรัพย์ (ไม่มีสมุดคู่ฝาก)");
  const [scbNameEn, setScbNameEn] = useState("ATASIT KANTHA");

  // Show Thai packages for Thai Bank, USD-like for Stripe
  const packages = paymentMethod === "thai_bank" ? thbPackages : mmkPackages;

  // Check if Stripe is configured
   useEffect(() => {
    const checkStripe = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "stripe_enabled")
          .maybeSingle();
        setStripeAvailable(data?.value === "true");
      } catch { setStripeAvailable(false); }
    };
    checkStripe();
  }, []);

  useEffect(() => {
    // Load SCB bank settings
    const loadBankSettings = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("key, value")
          .in("key", ["bank_scb_account", "bank_scb_name_th", "bank_scb_name_en"]);

        if (data) {
          data.forEach((setting) => {
            switch (setting.key) {
              case "bank_scb_account":
                setScbAccount(setting.value || "399-459002-6");
                break;
              case "bank_scb_name_th":
                setScbNameTh(setting.value || "เงินฝากออมทรัพย์ (ไม่มีสมุดคู่ฝาก)");
                break;
              case "bank_scb_name_en":
                setScbNameEn(setting.value || "ATASIT KANTHA");
                break;
            }
          });
        }
      } catch (error) {
        console.error("Error loading bank settings:", error);
      }
    };

    loadBankSettings();
  }, []);

  useEffect(() => {
    // Check if user has any completed transactions
    const checkFirstPurchase = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "success")
        .limit(1);

      setIsFirstPurchase(!data || data.length === 0);
    };

    checkFirstPurchase();
  }, []);

  // Handle Stripe redirect result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "success") {
      setShowSuccess(true);
      toast({ title: "ငွေပေးချေမှု အောင်မြင်ပါပြီ!", description: "Credits ကို ထည့်သွင်းပေးပြီးပါပြီ" });
      window.history.replaceState({}, "", "/top-up");
    } else if (params.get("stripe") === "cancel") {
      toast({ title: "ငွေပေးချေမှု ပယ်ဖျက်ပြီး", variant: "destructive" });
      window.history.replaceState({}, "", "/top-up");
    }
  }, []);

  // Reset selected package when payment method changes
  useEffect(() => {
    setSelectedPackage(null);
  }, [paymentMethod]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!selectedPackage) {
      toast({
        title: "Package ရွေးချယ်ပါ",
        description: "ကျေးဇူးပြု၍ Package တစ်ခုကို ရွေးချယ်ပါ",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile) {
      toast({
        title: "Screenshot ထည့်ပေးပါ",
        description: "ငွေလွှဲပြေစာ Screenshot ကို ထည့်သွင်းပေးပါ",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Calculate bonus for first purchase
      const bonusCredits = isFirstPurchase ? Math.floor(selectedPackage.credits * 0.2) : 0;

      // Create transaction record
      const { error } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          amount_mmk: selectedPackage.currency === "MMK" ? selectedPackage.price : 0,
          credits: selectedPackage.credits,
          package_name: `${selectedPackage.name} (${selectedPackage.currency})`,
          status: "pending",
          is_first_purchase: isFirstPurchase,
          bonus_credits: bonusCredits,
        });

      if (error) throw error;

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setShowSuccess(true);
      
      toast({
        title: "တင်သွင်းပြီးပါပြီ",
        description: "စစ်ဆေးပြီး Credit ထည့်ပေးပါမည်။",
      });

    } catch (error) {
      console.error("Error submitting payment:", error);
      toast({
        title: "အမှား",
        description: "တင်သွင်းရာတွင် ပြဿနာရှိပါသည်။",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedPackage(null);
    setShowSuccess(false);
  };

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

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
        <h1 className="text-lg font-semibold text-foreground">ငွေဖြည့်သွင်းမည်</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* First Purchase Bonus Banner */}
        {isFirstPurchase && (
          <div className="relative overflow-hidden rounded-2xl p-4 border border-primary/30 animate-fade-up">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20" />
            <div className="relative flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary animate-pulse-soft" />
              <div>
                <p className="font-semibold text-primary text-sm">ပထမဆုံးအကြိမ် ဝယ်ယူသူ Bonus!</p>
                <p className="text-xs text-muted-foreground">
                  ယခု ဝယ်ယူပါက 20% Bonus Credit ထပ်ဆောင်းရယူပါ
                </p>
              </div>
            </div>
          </div>
        )}


        {/* Payment Methods */}
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <h3 className="font-semibold text-foreground text-sm">ငွေပေးချေနည်း ရွေးချယ်ပါ</h3>

          <div className={`grid ${stripeAvailable ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
            {/* Stripe Visa/Mastercard */}
            {stripeAvailable && (
              <button
                onClick={() => setPaymentMethod("stripe")}
                className={`gradient-card rounded-xl p-3 border transition-all ${
                  paymentMethod === "stripe"
                    ? "border-primary shadow-gold"
                    : "border-border/30 hover:border-primary/30"
                }`}
              >
                <div className="text-lg mb-1">💳</div>
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-1">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-foreground text-center">Visa/MC</p>
              </button>
            )}

            {/* KBZPay */}
            <button
              onClick={() => setPaymentMethod("kbzpay")}
              className={`gradient-card rounded-xl p-3 border transition-all ${
                paymentMethod === "kbzpay"
                  ? "border-primary shadow-gold"
                  : "border-border/30 hover:border-primary/30"
              }`}
            >
              <div className="text-lg mb-1">🇲🇲</div>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-1">
                <span className="text-white text-xs font-bold">K</span>
              </div>
              <p className="text-xs text-foreground text-center">KBZPay</p>
            </button>

            {/* WaveMoney */}
            <button
              onClick={() => setPaymentMethod("wavepay")}
              className={`gradient-card rounded-xl p-3 border transition-all ${
                paymentMethod === "wavepay"
                  ? "border-primary shadow-gold"
                  : "border-border/30 hover:border-primary/30"
              }`}
            >
              <div className="text-lg mb-1">🇲🇲</div>
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center mx-auto mb-1">
                <span className="text-black text-xs font-bold">W</span>
              </div>
              <p className="text-xs text-foreground text-center">WaveMoney</p>
            </button>

            {/* Thai Bank */}
            <button
              onClick={() => setPaymentMethod("thai_bank")}
              className={`gradient-card rounded-xl p-3 border transition-all ${
                paymentMethod === "thai_bank"
                  ? "border-primary shadow-gold"
                  : "border-border/30 hover:border-primary/30"
              }`}
            >
              <div className="text-lg mb-1">🇹🇭</div>
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-1">
                <Building className="w-4 h-4 text-white" />
              </div>
              <p className="text-xs text-foreground text-center">Thai Bank</p>
            </button>
          </div>

          {/* Payment Details Based on Selected Method */}
          {paymentMethod === "kbzpay" && (
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <div className="flex items-start gap-4">
                <button 
                  onClick={() => setZoomedImage(kbzpayQr)}
                  className="relative flex-shrink-0 group"
                >
                  <img 
                    src={kbzpayQr} 
                    alt="KBZPay QR" 
                    className="w-20 h-20 rounded-xl object-cover border-2 border-blue-500"
                  />
                  <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="w-5 h-5 text-white" />
                  </div>
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs font-bold">K</span>
                    </div>
                    <span className="font-semibold text-foreground text-sm">KBZPay</span>
                  </div>
                  <p className="text-sm text-foreground">Zarni Pyae Phyo Aung</p>
                  <p className="text-primary font-semibold">09771048901</p>
                </div>
              </div>
            </div>
          )}

          {paymentMethod === "wavepay" && (
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <div className="flex items-start gap-4">
                <button 
                  onClick={() => setZoomedImage(wavepayQr)}
                  className="relative flex-shrink-0 group"
                >
                  <img 
                    src={wavepayQr} 
                    alt="WavePay QR" 
                    className="w-20 h-20 rounded-xl object-cover border-2 border-yellow-500"
                  />
                  <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="w-5 h-5 text-white" />
                  </div>
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-yellow-500 rounded-lg flex items-center justify-center">
                      <span className="text-black text-xs font-bold">W</span>
                    </div>
                    <span className="font-semibold text-foreground text-sm">WaveMoney</span>
                  </div>
                  <p className="text-sm text-foreground">Zarni Pyae Phyo Aung</p>
                  <p className="text-primary font-semibold">09771048901</p>
                </div>
              </div>
            </div>
          )}

          {paymentMethod === "thai_bank" && (
            <div className="gradient-card rounded-2xl p-4 border border-purple-500/30">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-foreground text-sm">SCB Bank (Thailand)</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Account: <span className="text-foreground font-medium">{scbAccount}</span></p>
                    <p className="text-sm text-muted-foreground">Name (TH): <span className="text-foreground font-medium">{scbNameTh}</span></p>
                    <p className="text-sm text-muted-foreground">Name (EN): <span className="text-foreground font-medium">{scbNameEn}</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {paymentMethod === "stripe" && (
            <div className="gradient-card rounded-2xl p-4 border border-indigo-500/30">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-foreground text-sm">Visa / Mastercard</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Package ရွေးချယ်ပြီး "Stripe ဖြင့် ငွေပေးချေမည်" ကို နှိပ်ပါ။ Stripe Secure Checkout သို့ ရောက်ပါမည်။
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pricing Packages */}
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            ဈေးနှုန်းများ {paymentMethod === "thai_bank" && "(Thai Baht)"}
          </h3>
          
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg)}
              className={`w-full text-left gradient-card rounded-2xl p-4 border transition-all ${
                selectedPackage?.id === pkg.id
                  ? "border-primary shadow-gold"
                  : "border-border/30 hover:border-primary/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{pkg.name}</p>
                    {pkg.isBestValue && (
                      <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-medium">
                        Best Value
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{pkg.priceDisplay}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">{pkg.credits.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Credits</p>
                  {isFirstPurchase && (
                    <p className="text-xs text-success">+{Math.floor(pkg.credits * 0.2)} Bonus</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Promo Code Section */}
        {currentUserId && (
          <div className="animate-fade-up" style={{ animationDelay: "0.12s" }}>
            <PromoCodeRedeem userId={currentUserId} />
          </div>
        )}

        {/* Stripe Payment Button */}
        {paymentMethod === "stripe" && (
          <Button
            onClick={async () => {
              if (!selectedPackage) {
                toast({ title: "Package ရွေးချယ်ပါ", variant: "destructive" });
                return;
              }
              setIsStripeLoading(true);
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Not authenticated");
                const { data, error } = await supabase.functions.invoke("stripe-checkout", {
                  body: {
                    packageName: selectedPackage.name,
                    credits: selectedPackage.credits,
                    amountInCents: selectedPackage.price * 100,
                    currency: "usd",
                    successUrl: `${window.location.origin}/top-up?stripe=success`,
                    cancelUrl: `${window.location.origin}/top-up?stripe=cancel`,
                  },
                });
                if (error || !data?.success) {
                  throw new Error(data?.error || "Stripe checkout failed");
                }
                window.location.href = data.url;
              } catch (error: any) {
                toast({ title: "ငွေပေးချေမှု မအောင်မြင်ပါ", description: error.message, variant: "destructive" });
              } finally {
                setIsStripeLoading(false);
              }
            }}
            disabled={isStripeLoading || !selectedPackage}
            className="w-full gradient-gold text-primary-foreground font-semibold py-6 rounded-2xl text-base shadow-gold hover:shadow-gold-lg transition-all animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            {isStripeLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                <span>Stripe သို့ ချိတ်ဆက်နေသည်...</span>
              </div>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Stripe ဖြင့် ငွေပေးချေမည်
              </>
            )}
          </Button>
        )}

        {/* Manual Upload Section (for non-Stripe methods) */}
        {paymentMethod !== "stripe" && (
          <>
            <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4 animate-fade-up" style={{ animationDelay: "0.15s" }}>
              <h3 className="font-semibold text-foreground text-sm">ငွေလွှဲပြေစာ Screenshot</h3>
              
              {previewUrl ? (
                <div className="relative">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-40 object-cover rounded-xl"
                  />
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-destructive rounded-full"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                  <Upload className="w-6 h-6 text-primary mb-2" />
                  <span className="text-sm text-muted-foreground">Screenshot ထည့်ရန် နှိပ်ပါ</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Confirm Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedFile || !selectedPackage}
              className="w-full gradient-gold text-primary-foreground font-semibold py-6 rounded-2xl text-base shadow-gold hover:shadow-gold-lg transition-all animate-fade-up"
              style={{ animationDelay: "0.2s" }}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>စစ်ဆေးနေသည်...</span>
                </div>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  အတည်ပြုမည်
                </>
              )}
            </Button>
          </>
        )}

        {/* Support Chatbot Section */}
        {currentUserId && <TopUpSupportChat userId={currentUserId} />}

        {/* Transaction History Link */}
        <button
          onClick={() => navigate("/transactions")}
          className="w-full py-3 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all text-sm"
        >
          ငွေသွင်းမှတ်တမ်း ကြည့်ရှုရန်
        </button>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="gradient-card rounded-3xl p-8 max-w-sm w-full text-center animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">တင်သွင်းပြီးပါပြီ!</h3>
            <p className="text-muted-foreground mb-6">
              Admin မှ စစ်ဆေးပြီး Credit များကို ထည့်သွင်းပေးပါမည်။
            </p>
            <Button
              onClick={resetForm}
              className="w-full gradient-gold text-primary-foreground font-semibold py-3 rounded-xl"
            >
              အိုကေ
            </Button>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-md w-full">
            <img 
              src={zoomedImage} 
              alt="QR Code" 
              className="w-full rounded-2xl"
            />
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopUp;
