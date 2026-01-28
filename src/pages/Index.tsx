import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { BottomNavigation } from "@/components/BottomNavigation";
import { PromoBanner } from "@/components/PromoBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreditDisplay } from "@/components/CreditDisplay";
import { AIToolsTab } from "@/components/AIToolsTab";
import { DosDontsTab } from "@/components/DosDontsTab";
import { CourseTab } from "@/components/CourseTab";
import { LogOut, User as UserIcon, Settings, HelpCircle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Index = () => {
  const [activeTab, setActiveTab] = useState("ai-tools");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { credits, isLoading: creditsLoading } = useCredits(user?.id);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      // Check admin status
      if (session?.user) {
        const adminEmails = ["timew3343@gmail.com", "youtrubezarni@gmail.com"];
        setIsAdmin(adminEmails.includes(session.user.email || ""));
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (session?.user) {
        const adminEmails = ["timew3343@gmail.com", "youtrubezarni@gmail.com"];
        setIsAdmin(adminEmails.includes(session.user.email || ""));
      }
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
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 rounded-full gradient-gold flex items-center justify-center shadow-gold hover:shadow-gold-lg transition-all">
                <UserIcon className="w-4 h-4 text-primary-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 gradient-card border-border/50">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? "Admin" : "Member"}
                </p>
              </div>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={() => navigate("/support")} className="cursor-pointer">
                <HelpCircle className="w-4 h-4 mr-2" />
                Help & Support
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer">
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Dashboard
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <CreditDisplay credits={credits} isLoading={creditsLoading} />
        </div>

        <ThemeToggle />
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto">
        {activeTab === "ai-tools" && <AIToolsTab userId={user.id} />}
        {activeTab === "dos-donts" && <DosDontsTab />}
        {activeTab === "course" && <CourseTab />}
      </div>
      
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
