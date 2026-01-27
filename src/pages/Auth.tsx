import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, Eye, EyeOff, Loader2, Crown, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("မှန်ကန်သော အီးမေးလ် ထည့်ပါ"),
  password: z.string().min(6, "စကားဝှက်သည် အနည်းဆုံး ၆ လုံး ရှိရမည်"),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate("/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === "email") fieldErrors.email = err.message;
          if (err.path[0] === "password") fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "အကောင့်ဝင်ရောက်မှု မအောင်မြင်ပါ",
              description: "အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်",
              variant: "destructive",
            });
          } else {
            toast({
              title: "အမှား",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }

        toast({
          title: "အောင်မြင်ပါသည်",
          description: "အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်",
        });
      } else {
        const redirectUrl = `${window.location.origin}/`;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "အကောင့်ရှိပြီးသား",
              description: "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်ပါသည်။ အကောင့်ဝင်ပါ",
              variant: "destructive",
            });
          } else {
            toast({
              title: "အမှား",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }

        toast({
          title: "အောင်မြင်ပါသည်",
          description: "အကောင့်ဖွင့်မှု အောင်မြင်ပါသည်",
        });
      }
    } catch (error) {
      toast({
        title: "အမှား",
        description: "တစ်ခုခု မှားယွင်းနေပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-navy flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-up">
        <div className="inline-flex items-center gap-2 mb-3">
          <Crown className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-glow-gold text-primary">Myanmar AI</h1>
        </div>
        <p className="text-muted-foreground">
          {isLogin ? "သင့်အကောင့်သို့ ဝင်ရောက်ပါ" : "အကောင့်အသစ် ဖန်တီးပါ"}
        </p>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-md gradient-card rounded-2xl p-6 border border-primary/30 shadow-gold animate-scale-in">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary">အီးမေးလ်</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-background/50 border-primary/30 focus:border-primary focus:ring-primary/50 rounded-xl h-12"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary">စကားဝှက်</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 bg-background/50 border-primary/30 focus:border-primary focus:ring-primary/50 rounded-xl h-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 gradient-gold text-primary-foreground font-semibold rounded-xl shadow-gold hover:opacity-90 transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isLogin ? "အကောင့်ဝင်မည်" : "အကောင့်ဖွင့်မည်"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {isLogin ? "အကောင့်မရှိသေးဘူးလား?" : "အကောင့်ရှိပြီးသားလား?"}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-primary font-semibold hover:underline"
            >
              {isLogin ? "အကောင့်ဖွင့်မည်" : "အကောင့်ဝင်မည်"}
            </button>
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-muted-foreground text-center animate-fade-up" style={{ animationDelay: "0.2s" }}>
        ဝန်ဆောင်မှုစည်းမျဉ်းများကို လက်ခံပြီး ဆက်လက်ဆောင်ရွက်ပါ
      </p>
    </div>
  );
};

export default Auth;
