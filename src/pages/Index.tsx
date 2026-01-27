import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { BottomNavigation } from "@/components/BottomNavigation";
import { PromoBanner } from "@/components/PromoBanner";
import { AIToolsTab } from "@/components/AIToolsTab";
import { DosDontsTab } from "@/components/DosDontsTab";
import { CourseTab } from "@/components/CourseTab";
import { LogOut, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [activeTab, setActiveTab] = useState("ai-tools");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "အောင်မြင်ပါသည်",
      description: "အကောင့်မှ ထွက်ပြီးပါပြီ",
    });
    navigate("/auth");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-navy flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">ခဏစောင့်ပါ...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen gradient-navy">
      {/* Promo Banner */}
      <PromoBanner />
      
      {/* User Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sm text-muted-foreground truncate max-w-[180px]">
            {user.email}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto">
        {activeTab === "ai-tools" && <AIToolsTab />}
        {activeTab === "dos-donts" && <DosDontsTab />}
        {activeTab === "course" && <CourseTab />}
      </div>
      
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
