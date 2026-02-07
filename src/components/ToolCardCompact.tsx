import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ToolCardCompactProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  onClick: () => void;
  credits?: number;
  size?: "small" | "default";
  badge?: string;
  badgeTooltip?: string;
}

export const ToolCardCompact = ({ 
  icon: Icon, 
  title, 
  description, 
  gradient, 
  onClick,
  credits,
  size = "default",
  badge,
  badgeTooltip,
}: ToolCardCompactProps) => {
  const isSmall = size === "small";
  
  return (
    <motion.button
      onClick={onClick}
      className={`w-full ${isSmall ? 'p-3' : 'p-4'} rounded-[20px] relative overflow-hidden group
        bg-card/40 backdrop-blur-xl border border-white/10
        hover:border-primary/40 transition-all duration-300
        shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-primary/10`}
      whileHover={{ scale: 1.05, y: -3 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Gradient background overlay */}
      <div className={`absolute inset-0 ${gradient} opacity-80 rounded-[20px]`} />
      
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 rounded-[20px]" />
      
      {/* Gradient border glow on hover */}
      <div className="absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
        }}
      />
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 rounded-[20px]" />
      
      {/* Badge */}
      {badge && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute top-2 right-2 z-20">
                <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full shadow-lg
                  ${badge === 'NEW' 
                    ? 'bg-gradient-to-r from-emerald-400 to-green-500 text-white' 
                    : badge === 'HOT'
                    ? 'bg-gradient-to-r from-red-400 to-orange-500 text-white'
                    : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black'
                  }`}>
                  {badge}
                </span>
              </div>
            </TooltipTrigger>
            {badgeTooltip && (
              <TooltipContent side="top" className="text-xs">
                {badgeTooltip}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}
      
      <div className="flex flex-col items-center gap-2 relative z-10">
        {/* Glowing icon container */}
        <div className={`${isSmall ? 'w-11 h-11' : 'w-13 h-13'} rounded-2xl 
          bg-white/15 backdrop-blur-sm flex items-center justify-center 
          border border-white/20 shadow-lg
          group-hover:shadow-white/20 group-hover:bg-white/20 transition-all duration-300`}
          style={{ width: isSmall ? '2.75rem' : '3.25rem', height: isSmall ? '2.75rem' : '3.25rem' }}
        >
          <Icon className={`${isSmall ? 'w-5 h-5' : 'w-6 h-6'} text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]
            group-hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] transition-all duration-300`} />
        </div>
        
        <div className="text-center">
          <h3 className={`${isSmall ? 'text-xs' : 'text-sm'} font-bold text-white mb-0.5 font-myanmar
            drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]`}>
            {title}
          </h3>
          <p className={`text-white/75 ${isSmall ? 'text-[9px]' : 'text-[10px]'} font-myanmar leading-tight
            drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]`}>
            {description}
          </p>
        </div>

        {credits !== undefined && (
          <div className={`px-2.5 py-0.5 bg-black/25 backdrop-blur-sm rounded-full 
            ${isSmall ? 'text-[9px]' : 'text-[10px]'} text-white/90 font-medium
            border border-white/10`}>
            {credits} Cr
          </div>
        )}
      </div>
    </motion.button>
  );
};
