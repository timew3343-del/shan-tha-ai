import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { BottomNavigation } from "@/components/BottomNavigation";
import { PromoBanner } from "@/components/PromoBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreditDisplay } from "@/components/CreditDisplay";
import { AIToolsTab } from "@/components/AIToolsTab";
import { AutoServiceTab } from "@/components/AutoServiceTab";
import { DosDontsTab } from "@/components/DosDontsTab";
import { CourseTab } from "@/components/CourseTab";
import { AdminVideoTab } from "@/components/AdminVideoTab";
import { StoreTab } from "@/components/StoreTab";
import { FullScreenChat } from "@/components/FullScreenChat";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { WelcomeOnboarding } from "@/components/WelcomeOnboarding";
import { CreditTransferDialog } from "@/components/CreditTransferDialog";
import { LogOut, User as UserIcon, HelpCircle, Shield, Info, ArrowRightLeft, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Index = () => {
  const [activeTab, setActiveTab] = useState("ai-tools");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedUuid, setCopiedUuid] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { credits, isLoading: creditsLoading, refetch: refetchCredits } = useCredits(user?.id);
  const { isAdmin } = useUserRole(user?.id);

  useEffect(() => {
    let isMounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (event !== 'INITIAL_SESSION') setIsLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });
    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth", { replace: true });
  }, [user, isLoading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: t('status.success'), description: t('logout') });
    navigate("/auth");
  };

  const handleCopyUuid = async () => {
    if (!user) return;
    await navigator.clipboard.writeText(user.id);
    setCopiedUuid(true);
    setTimeout(() => setCopiedUuid(false), 2000);
    toast({ title: t('menu.uuidCopied') });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-navy flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('status.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen gradient-navy">
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <WelcomeOnboarding userId={user.id} />
      <PromoBanner />
      
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-11 h-11 rounded-full gradient-gold flex items-center justify-center shadow-gold hover:shadow-gold-lg transition-all">
                <UserIcon className="w-5 h-5 text-primary-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 gradient-card border-border/50">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground">{isAdmin ? "Admin" : "Member"}</p>
              </div>
              <div className="px-3 py-1.5">
                <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-2 py-1.5">
                  <code className="text-[9px] text-muted-foreground flex-1 truncate font-mono">{user.id}</code>
                  <button onClick={(e) => { e.stopPropagation(); handleCopyUuid(); }}
                    className="p-1 rounded hover:bg-secondary transition-colors flex-shrink-0">
                    {copiedUuid ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                  </button>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-border/50" />
              <CreditTransferDialog userId={user.id} currentBalance={credits} onTransferComplete={refetchCredits}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                    <ArrowRightLeft className="w-4 h-4 mr-2" />{t('credit.transfer')}
                  </DropdownMenuItem>
                } />
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={() => navigate("/support")} className="cursor-pointer">
                <HelpCircle className="w-4 h-4 mr-2" />{t('menu.helpSupport')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/about")} className="cursor-pointer">
                <Info className="w-4 h-4 mr-2" />{t('menu.aboutApp')}
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer">
                  <Shield className="w-4 h-4 mr-2" />{t('menu.adminDashboard')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                <LogOut className="w-4 h-4 mr-2" />{t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <CreditDisplay credits={credits} isLoading={creditsLoading} />
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <main id="main-content" className="max-w-lg mx-auto" role="main">
        <MaintenanceBanner className="mx-4 mt-4" />
        {activeTab === "ai-chat" && <FullScreenChat userId={user.id} />}
        {activeTab === "ai-tools" && <AIToolsTab userId={user.id} />}
        {activeTab === "auto-service" && <AutoServiceTab userId={user.id} />}
        {activeTab === "store" && <StoreTab userId={user.id} />}
        {activeTab === "my-videos" && isAdmin && <AdminVideoTab userId={user.id} />}
        {activeTab === "dos-donts" && <DosDontsTab />}
        {activeTab === "course" && <CourseTab userId={user.id} />}
      </main>
      
      <ScrollToTop />
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} isAdmin={isAdmin} />
    </div>
  );
};

export default Index;
