import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, CreditCard, CheckCircle, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import kbzpayQr from "@/assets/kbzpay-qr.jpg";
import wavepayQr from "@/assets/wavepay-qr.jpg";

export const TopUp = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast({
        title: "Screenshot ထည့်ပေးပါ",
        description: "ငွေလွှဲပြေစာ Screenshot ကို ထည့်သွင်းပေးပါ",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "တင်သွင်းပြီးပါပြီ",
      description: "စစ်ဆေးပြီး Credit ထည့်ပေးပါမည်",
    });
    
    setIsSubmitting(false);
    setSelectedFile(null);
    setPreviewUrl(null);
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
        <h1 className="text-lg font-semibold text-foreground">ငွေဖြည့်သွင်းမည်</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Instructions */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 animate-fade-up">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-primary text-sm">ငွေဖြည့်နည်း</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            အောက်ပါ ဖုန်းနံပါတ်သို့ ငွေလွှဲပြီး Screenshot ကို တင်ပေးပါ။ 
            AI မှ အလိုအလျောက် စစ်ဆေးပြီး Credit ထည့်ပေးပါမည်။
          </p>
        </div>

        {/* KBZPay */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-start gap-4">
            <button 
              onClick={() => setZoomedImage(kbzpayQr)}
              className="relative flex-shrink-0 group"
            >
              <img 
                src={kbzpayQr} 
                alt="KBZPay QR" 
                className="w-24 h-24 rounded-xl object-cover border-2 border-blue-500"
              />
              <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white" />
              </div>
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">KBZ</span>
                </div>
                <span className="font-semibold text-foreground text-sm">KBZPay</span>
              </div>
              <p className="text-sm text-foreground font-medium">Zarni Pyae Phyo Aung</p>
              <p className="text-primary font-semibold text-base">09771048901</p>
            </div>
          </div>
        </div>

        {/* WaveMoney */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-start gap-4">
            <button 
              onClick={() => setZoomedImage(wavepayQr)}
              className="relative flex-shrink-0 group"
            >
              <img 
                src={wavepayQr} 
                alt="WavePay QR" 
                className="w-24 h-24 rounded-xl object-cover border-2 border-yellow-500"
              />
              <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white" />
              </div>
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <span className="text-black text-xs font-bold">W</span>
                </div>
                <span className="font-semibold text-foreground text-sm">WaveMoney</span>
              </div>
              <p className="text-sm text-foreground font-medium">Zarni Pyae Phyo Aung</p>
              <p className="text-primary font-semibold text-base">09771048901</p>
            </div>
          </div>
        </div>

        {/* Thai Bank Coming Soon */}
        <div className="gradient-card rounded-2xl p-4 border border-border/30 opacity-60 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-muted-foreground text-sm">Thai Bank</p>
              <p className="text-xs text-muted-foreground">မကြာမီ လာမည်...</p>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4 animate-fade-up" style={{ animationDelay: "0.25s" }}>
          <h3 className="font-semibold text-foreground text-sm">ငွေလွှဲပြေစာ Screenshot</h3>
          
          {previewUrl ? (
            <div className="relative">
              <img 
                src={previewUrl} 
                alt="Preview" 
                className="w-full h-48 object-cover rounded-xl"
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
            <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
              <Upload className="w-8 h-8 text-primary mb-2" />
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
          disabled={isSubmitting || !selectedFile}
          className="w-full gradient-gold text-primary-foreground font-semibold py-6 rounded-2xl text-base animate-fade-up"
          style={{ animationDelay: "0.3s" }}
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              အတည်ပြုမည်
            </>
          )}
        </Button>
      </div>

      {/* Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/20 rounded-full"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img 
            src={zoomedImage} 
            alt="QR Code" 
            className="max-w-full max-h-[80vh] rounded-2xl"
          />
        </div>
      )}
    </div>
  );
};

export default TopUp;
