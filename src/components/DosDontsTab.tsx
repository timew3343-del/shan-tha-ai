import { Check, X, Lightbulb, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export const DosDontsTab = () => {
  const { t } = useLanguage();

  const dosItems = [
    { title: t('guide.do1'), description: t('guide.do1.desc') },
    { title: t('guide.do2'), description: t('guide.do2.desc') },
    { title: t('guide.do3'), description: t('guide.do3.desc') },
    { title: t('guide.do4'), description: t('guide.do4.desc') },
    { title: t('guide.do5'), description: t('guide.do5.desc') },
    { title: t('guide.do6'), description: t('guide.do6.desc') },
    { title: t('guide.do7'), description: t('guide.do7.desc') },
  ];

  const dontsItems = [
    { title: t('guide.dont1'), description: t('guide.dont1.desc') },
    { title: t('guide.dont2'), description: t('guide.dont2.desc') },
    { title: t('guide.dont3'), description: t('guide.dont3.desc') },
    { title: t('guide.dont4'), description: t('guide.dont4.desc') },
    { title: t('guide.dont5'), description: t('guide.dont5.desc') },
    { title: t('guide.dont6'), description: t('guide.dont6.desc') },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="text-center pt-4">
        <h1 className="text-xl font-bold mb-2 text-primary">{t('guide.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('guide.subtitle')}</p>
      </div>

      <div className="animate-fade-up">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-xl bg-success/20 border border-success/30">
            <Lightbulb className="w-4 h-4 text-success" />
          </div>
          <h2 className="text-base font-semibold text-success">{t('guide.doTitle')}</h2>
        </div>
        <div className="space-y-2">
          {dosItems.map((item, index) => (
            <div key={index} className="gradient-card rounded-xl p-3 border border-success/20 flex gap-3 animate-fade-up"
              style={{ animationDelay: `${index * 0.03}s` }}>
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-success" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-foreground text-sm mb-0.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-xl bg-destructive/20 border border-destructive/30">
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </div>
          <h2 className="text-base font-semibold text-destructive">{t('guide.dontTitle')}</h2>
        </div>
        <div className="space-y-2">
          {dontsItems.map((item, index) => (
            <div key={index} className="gradient-card rounded-xl p-3 border border-destructive/20 flex gap-3 animate-fade-up"
              style={{ animationDelay: `${0.2 + index * 0.03}s` }}>
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-destructive/20 flex items-center justify-center">
                <X className="w-4 h-4 text-destructive" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-foreground text-sm mb-0.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
