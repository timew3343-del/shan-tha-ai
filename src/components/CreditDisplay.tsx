import { Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CreditDisplayProps {
  credits: number;
  isLoading?: boolean;
}

export const CreditDisplay = ({ credits, isLoading }: CreditDisplayProps) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/top-up")}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl gradient-gold shadow-gold hover:shadow-gold-lg transition-all duration-300"
    >
      <Coins className="w-4 h-4 text-primary-foreground" />
      <span className="font-semibold text-primary-foreground text-sm">
        {isLoading ? "..." : credits.toLocaleString()}
      </span>
    </button>
  );
};
