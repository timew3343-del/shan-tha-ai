import { useState } from "react";
import { useOutputStore, StoredOutput } from "@/hooks/useOutputStore";
import { Trash2, Image, Video, FileText, Music, Copy, Download, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

type FilterType = "all" | "text" | "image" | "video" | "audio" | "document";

const typeIcons: Record<string, any> = {
  text: FileText,
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
};

const typeLabels: Record<string, string> = {
  all: "အားလုံး",
  text: "စာသား",
  image: "ပုံရိပ်",
  video: "ဗီဒီယို",
  audio: "အသံ",
  document: "စာရွက်",
};

export const StoreTab = () => {
  const { outputs, removeOutput, clearAll } = useOutputStore();
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = outputs.filter(o => {
    if (filter !== "all" && o.type !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return o.toolName.toLowerCase().includes(q) || o.content.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    toast({ title: "ကူးယူပြီး" });
  };

  const handleDownload = (output: StoredOutput) => {
    if (output.type === "image" || output.type === "video") {
      const link = document.createElement("a");
      link.href = output.content;
      link.download = `${output.toolName}-${output.id}`;
      link.target = "_blank";
      link.click();
    } else {
      const blob = new Blob([output.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${output.toolName}-${output.id}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
    toast({ title: "ဒေါင်းလုဒ် စတင်ပြီး" });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} မိနစ်အရင်`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} နာရီအရင်`;
    const days = Math.floor(hours / 24);
    return `${days} ရက်အရင်`;
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-2">
        <h1 className="text-xl font-bold text-primary font-myanmar flex items-center justify-center gap-2">
          <Package className="w-5 h-5" />
          My Store
        </h1>
        <p className="text-muted-foreground text-xs font-myanmar">သင့်ရလဒ်များ အားလုံး ဒီမှာ ရှိပါတယ်</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="ရှာရန်..."
          className="pl-9 h-10 rounded-2xl bg-card/40 backdrop-blur-xl border border-white/10 text-sm font-myanmar"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {(["all", "text", "image", "video", "audio", "document"] as FilterType[]).map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all font-myanmar ${
              filter === type
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-card/40 border border-white/10 text-muted-foreground hover:bg-primary/10"
            }`}
          >
            {typeLabels[type]}
          </button>
        ))}
      </div>

      {/* Clear All */}
      {outputs.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { clearAll(); toast({ title: "Store ရှင်းလင်းပြီး" }); }}
            className="text-xs text-muted-foreground"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            အားလုံးဖျက်မည်
          </Button>
        </div>
      )}

      {/* Items */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-myanmar">
              {outputs.length === 0 ? "ရလဒ်များ မရှိသေးပါ" : "ရှာဖွေမှုနှင့် ကိုက်ညီသော ရလဒ်မရှိပါ"}
            </p>
            <p className="text-xs text-muted-foreground/60 font-myanmar mt-1">
              AI Tool များ အသုံးပြုပြီး ရလဒ်ထုတ်ပါ
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filtered.map((output, idx) => {
              const Icon = typeIcons[output.type] || FileText;
              return (
                <motion.div
                  key={output.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.02 }}
                  className="gradient-card rounded-2xl p-4 border border-primary/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-primary font-myanmar">{output.toolName}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(output.createdAt)}</span>
                      </div>

                      {output.type === "image" ? (
                        <img
                          src={output.content}
                          alt={output.toolName}
                          className="w-full max-h-48 object-cover rounded-xl mb-2"
                          loading="lazy"
                        />
                      ) : output.type === "video" ? (
                        <video
                          src={output.content}
                          controls
                          className="w-full max-h-48 rounded-xl mb-2"
                        />
                      ) : (
                        <p className="text-xs text-foreground/80 line-clamp-4 font-myanmar whitespace-pre-wrap mb-2">
                          {output.content}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(output.content)}
                          className="h-7 text-[10px]"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          ကူးယူ
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(output)}
                          className="h-7 text-[10px]"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          ဒေါင်းလုဒ်
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOutput(output.id)}
                          className="h-7 text-[10px] text-destructive"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          ဖျက်
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
