import { AlertTriangle } from "lucide-react";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

interface MaintenanceBannerProps {
  className?: string;
}

export const MaintenanceBanner = ({ className = "" }: MaintenanceBannerProps) => {
  const { isMaintenanceMode, isLoading } = useMaintenanceMode();

  if (isLoading || !isMaintenanceMode) {
    return null;
  }

  return (
    <div
      className={`bg-warning/20 border border-warning/50 rounded-xl p-4 flex items-start gap-3 ${className}`}
    >
      <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold text-warning text-sm">
          စနစ်ကို ခေတ္တပြုပြင်နေပါသည်
        </p>
        <p className="text-xs text-warning/80 mt-1">
          API Key များ ငွေဖြည့်ရန် လိုအပ်နေသောကြောင့် ခေတ္တစောင့်ဆိုင်းပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။
        </p>
      </div>
    </div>
  );
};
