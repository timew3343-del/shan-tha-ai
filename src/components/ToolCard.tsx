import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface ToolCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  onClick: () => void;
  credits?: number;
}

export const ToolCard = ({ 
  icon: Icon, 
  title, 
  description, 
  gradient, 
  onClick,
  credits 
}: ToolCardProps) => {
  return (
    <motion.button
      onClick={onClick}
      className={`w-full p-6 rounded-2xl border border-primary/20 ${gradient} relative overflow-hidden group`}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      
      <div className="flex flex-col items-center gap-3 relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-background/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
          <Icon className="w-8 h-8 text-white" />
        </div>
        
        <div className="text-center">
          <h3 className="text-lg font-bold text-white mb-1 font-myanmar">
            {title}
          </h3>
          <p className="text-white/80 text-xs font-myanmar">
            {description}
          </p>
        </div>

        {credits !== undefined && (
          <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white font-medium">
            {credits} Credits
          </div>
        )}
      </div>
    </motion.button>
  );
};
