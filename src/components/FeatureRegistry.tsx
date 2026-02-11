import { useMemo, useState } from "react";
import { Search, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import inventory from "@/data/system-inventory.json";

/** Auto-synced feature registry — reads from system-inventory.json */
export const FeatureRegistry = () => {
  const [search, setSearch] = useState("");

  const { totalTools, totalFeatures, filteredFeatures } = useMemo(() => {
    const tools = inventory.tools;
    const totalTools = tools.length;
    const allFeatures = tools.flatMap(t => t.features.map(f => ({ tool: t.name, feature: f })));
    const totalFeatures = allFeatures.length;

    let filtered = allFeatures;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = allFeatures.filter(f => f.tool.toLowerCase().includes(q) || f.feature.toLowerCase().includes(q));
    }
    return { totalTools, totalFeatures, filteredFeatures: filtered };
  }, [search]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4"
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2">
          <Crown className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-primary font-myanmar">System Capabilities</h2>
          <Crown className="w-4 h-4 text-primary" />
        </div>
        <div className="flex items-center justify-center gap-3">
          <div className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-1.5">
            <span className="text-lg font-bold text-primary">{totalTools}</span>
            <span className="text-[10px] text-muted-foreground ml-1">AI Tools</span>
          </div>
          <div className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-1.5">
            <span className="text-lg font-bold text-primary">{totalFeatures}</span>
            <span className="text-[10px] text-muted-foreground ml-1">Capabilities</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground font-myanmar">
          All features developed and maintained by <span className="text-primary font-semibold">Ko Ko Phyo</span>
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Feature ရှာရန်..."
          className="pl-9 h-9 rounded-xl text-xs bg-secondary/30 border-primary/10"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {filteredFeatures.map((f, i) => (
          <div key={`${f.tool}-${i}`} className="bg-secondary/20 rounded-lg px-2 py-1.5 border border-transparent hover:border-primary/20 transition-colors">
            <p className="text-[9px] font-medium text-primary truncate">{f.feature}</p>
            <p className="text-[8px] text-muted-foreground truncate">{f.tool}</p>
          </div>
        ))}
      </div>

      {filteredFeatures.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">ရလဒ် မတွေ့ပါ</p>
      )}
    </motion.div>
  );
};
