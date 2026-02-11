import { forwardRef } from "react";
import { Wand2, BookCheck, GraduationCap, Package } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNavigation = forwardRef<HTMLElement, BottomNavigationProps>(
  ({ activeTab, onTabChange }, ref) => {
    const { t } = useLanguage();

    const tabs = [
      { id: "ai-tools", label: t('nav.aiTools'), icon: Wand2 },
      { id: "store", label: t('nav.store'), icon: Package },
      { id: "dos-donts", label: t('nav.guide'), icon: BookCheck },
      { id: "course", label: t('nav.course'), icon: GraduationCap },
    ];

    return (
      <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-50 glass-effect border-t border-border">
        <div className="flex items-center justify-around px-2 py-3 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? "text-primary bg-primary/10 shadow-glow-gold" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? "scale-110" : ""}`} />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }
);

BottomNavigation.displayName = "BottomNavigation";
