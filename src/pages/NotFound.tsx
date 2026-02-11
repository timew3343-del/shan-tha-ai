import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen gradient-navy flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md space-y-6"
      >
        <div className="relative">
          <span className="text-8xl font-black text-primary/20">404</span>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="w-12 h-12 text-primary animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground font-myanmar">
            ဤစာမျက်နှာ မတွေ့ပါ
          </h1>
          <p className="text-sm text-muted-foreground font-myanmar">
            သင်ရှာဖွေနေသော စာမျက်နှာသည် ဖျက်လိုက်ခြင်း၊ နာမည်ပြောင်းခြင်း သို့မဟုတ် မရှိခြင်း ဖြစ်နိုင်ပါသည်။
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-myanmar">နောက်သို့ ပြန်သွားမည်</span>
          </Button>
          <Button onClick={() => navigate("/")} className="gap-2 gradient-gold text-primary-foreground">
            <Home className="w-4 h-4" />
            <span className="font-myanmar">ပင်မစာမျက်နှာ</span>
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
