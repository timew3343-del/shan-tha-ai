import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface ToolCardCompactProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  onClick: () => void;
  credits?: number;
}

export const ToolCardCompact = ({ 
  icon: Icon, 
  title, 
  description, 
  gradient, 
  onClick,
  credits 
}: ToolCardCompactProps) => {
  return (
    <motion.button
      onClick={onClick}
      className={`w-full p-4 rounded-2xl border border-primary/20 ${gradient} relative overflow-hidden group`}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      
      <div className="flex flex-col items-center gap-2 relative z-10">
        <div className="w-12 h-12 rounded-xl bg-background/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
          <Icon className="w-6 h-6 text-white" />
        </div>
        
        <div className="text-center">
          <h3 className="text-sm font-bold text-white mb-0.5 font-myanmar">
            {title}
          </h3>
          <p className="text-white/70 text-[10px] font-myanmar leading-tight">
            {description}
          </p>
        </div>

        {credits !== undefined && (
          <div className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-[10px] text-white font-medium">
            {credits} Credits
          </div>
        )}
      </div>
    </motion.button>
  );
};
