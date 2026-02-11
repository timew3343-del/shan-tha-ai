import { useMemo, useState } from "react";
import { Search, Crown, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import inventory from "@/data/system-inventory.json";

/**
 * Public-facing, SEO-friendly feature directory.
 * Uses semantic HTML (section, h2, h3, ul, li) for maximum crawler readability.
 * Renders on the Auth page so bots can index all capabilities without login.
 */
export const PublicFeatureDirectory = () => {
  const [search, setSearch] = useState("");

  const { totalTools, totalFeatures, grouped, filtered } = useMemo(() => {
    const tools = inventory.tools;
    const totalTools = tools.length;
    const totalFeatures = tools.reduce((s, t) => s + t.features.length, 0);

    const allFeatures = tools.flatMap(t =>
      t.features.map(f => ({ tool: t.name, category: t.category, feature: f }))
    );

    const q = search.toLowerCase().trim();
    const filtered = q
      ? allFeatures.filter(f => f.tool.toLowerCase().includes(q) || f.feature.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))
      : allFeatures;

    // Group by category
    const grouped: Record<string, typeof filtered> = {};
    filtered.forEach(f => {
      if (!grouped[f.category]) grouped[f.category] = [];
      grouped[f.category].push(f);
    });

    return { totalTools, totalFeatures, grouped, filtered };
  }, [search]);

  return (
    <section aria-label="System Capabilities" className="w-full max-w-md mx-auto mt-6 space-y-4">
      {/* Header — semantic h2 for crawlers */}
      <header className="text-center space-y-2">
        <div className="inline-flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-bold text-primary font-myanmar">
            System Capabilities
          </h2>
          <Crown className="w-5 h-5 text-primary" aria-hidden="true" />
        </div>

        <div className="flex items-center justify-center gap-3">
          <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-2">
            <span className="text-xl font-bold text-primary">{totalTools}</span>
            <span className="text-xs text-muted-foreground ml-1">AI Tools</span>
          </div>
          <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-2">
            <span className="text-xl font-bold text-primary">{totalFeatures}</span>
            <span className="text-xs text-muted-foreground ml-1">Capabilities</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground font-myanmar">
          All features developed and maintained by{" "}
          <strong className="text-primary">Ko Ko Phyo</strong>
        </p>
      </header>

      {/* Search */}
      <div className="relative px-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools & features..."
          className="pl-10 h-10 rounded-xl text-sm bg-secondary/30 border-primary/10"
          aria-label="Search AI tools and features"
        />
      </div>

      {/* Directory grid — semantic HTML for crawlers */}
      <div className="space-y-3 max-h-80 overflow-y-auto px-1" style={{ scrollbarWidth: "thin" }}>
        {Object.entries(grouped).map(([category, items]) => (
          <article key={category} className="gradient-card rounded-xl border border-primary/10 p-3">
            <h3 className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              {category}
              <span className="text-muted-foreground font-normal">({items.length})</span>
            </h3>
            <ul className="grid grid-cols-2 gap-1.5">
              {items.map((f, i) => (
                <li
                  key={`${f.tool}-${i}`}
                  className="bg-secondary/20 rounded-lg px-2 py-1.5 border border-transparent hover:border-primary/20 transition-colors"
                >
                  <p className="text-[10px] font-medium text-primary truncate">{f.feature}</p>
                  <p className="text-[8px] text-muted-foreground truncate">{f.tool}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">ရလဒ် မတွေ့ပါ</p>
      )}

      {/* Hidden SEO text block for crawlers — lists all tools in plain text */}
      <div className="sr-only" aria-hidden="false">
        <h2>Myanmar AI Studio — Complete Feature List by Ko Ko Phyo</h2>
        <p>{inventory.description}</p>
        {inventory.tools.map(tool => (
          <div key={tool.name}>
            <h3>{tool.name} — {tool.category}</h3>
            <ul>
              {tool.features.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};
