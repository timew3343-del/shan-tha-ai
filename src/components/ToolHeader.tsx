import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToolHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

export const ToolHeader = ({ title, subtitle, onBack }: ToolHeaderProps) => {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="shrink-0 w-10 h-10 rounded-xl bg-secondary/50 hover:bg-secondary"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <div>
        <h2 className="text-lg font-bold text-primary font-myanmar">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground font-myanmar">{subtitle}</p>
        )}
      </div>
    </div>
  );
};
