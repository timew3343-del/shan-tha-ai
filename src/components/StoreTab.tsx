import { useState } from "react";
import { useOutputStore, StoredOutput } from "@/hooks/useOutputStore";
import { Trash2, Image, Video, FileText, Music, Copy, Download, Package, Search, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";

type FilterType = "all" | "text" | "image" | "video" | "audio" | "document";

const typeIcons: Record<string, any> = {
  text: FileText, image: Image, video: Video, audio: Music, document: FileText,
};

interface StoreTabProps {
  userId?: string;
}

export const StoreTab = ({ userId }: StoreTabProps) => {
  const { outputs, removeOutput, clearAll, isLoading } = useOutputStore(userId);
  const { toast } = useToast();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const typeLabels: Record<string, string> = {
    all: t('store.all'), text: t('store.text'), image: t('store.image'),
    video: t('store.video'), audio: t('store.audio'), document: t('store.document'),
  };

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
    toast({ title: t('store.copied') });
  };

  const handleDownload = (output: StoredOutput) => {
    if (output.type === "image" || output.type === "video" || output.type === "audio") {
      const link = document.createElement("a");
      link.href = output.fileUrl || output.content;
      link.download = `${output.toolName}-${output.id}`;
      link.target = "_blank";
      link.click();
    } else {
      const blob = new Blob([output.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `${output.toolName}-${output.id}.txt`; link.click();
      URL.revokeObjectURL(url);
    }
    toast({ title: t('store.downloadStarted') });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} ${t('store.minutesAgo')}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ${t('store.hoursAgo')}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t('store.daysAgo')}`;
  };

  const getDaysLeft = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const exp = new Date(expiresAt);
    const now = new Date();
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="text-center pt-2">
        <h1 className="text-xl font-bold text-primary font-myanmar flex items-center justify-center gap-2">
          <Package className="w-5 h-5" />
          {t('store.title')}
        </h1>
        <p className="text-muted-foreground text-xs font-myanmar">{t('store.subtitle')}</p>
        <p className="text-muted-foreground text-[10px] font-myanmar mt-1 flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" /> ၁၀ ရက်အတွင်း ဒေါင်းလိုက်ပါ - အလိုအလျောက် ဖျက်သိမ်းပါမည်
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('store.searchPlaceholder')}
          className="pl-9 h-10 rounded-2xl bg-card/40 backdrop-blur-xl border border-white/10 text-sm font-myanmar" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {(["all", "text", "image", "video", "audio", "document"] as FilterType[]).map(type => (
          <button key={type} onClick={() => setFilter(type)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all font-myanmar ${
              filter === type ? "bg-primary text-primary-foreground shadow-md" : "bg-card/40 border border-white/10 text-muted-foreground hover:bg-primary/10"
            }`}>
            {typeLabels[type]}
          </button>
        ))}
      </div>

      {outputs.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm"
            onClick={() => { clearAll(); toast({ title: t('store.cleared') }); }}
            className="text-xs text-muted-foreground">
            <Trash2 className="w-3 h-3 mr-1" />
            {t('store.clearAll')}
          </Button>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-myanmar">
              {outputs.length === 0 ? t('store.noResults') : t('store.noMatch')}
            </p>
            <p className="text-xs text-muted-foreground/60 font-myanmar mt-1">{t('store.useTools')}</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filtered.map((output, idx) => {
              const Icon = typeIcons[output.type] || FileText;
              const daysLeft = getDaysLeft(output.expiresAt);
              return (
                <motion.div key={output.id} layout initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.02 }} className="gradient-card rounded-2xl p-4 border border-primary/10">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-primary font-myanmar">{output.toolName}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(output.createdAt)}</span>
                        {daysLeft !== null && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${daysLeft <= 2 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                            {daysLeft}d left
                          </span>
                        )}
                      </div>
                      {output.type === "image" ? (
                        <img src={output.fileUrl || output.content} alt={output.toolName} className="w-full max-h-48 object-cover rounded-xl mb-2" loading="lazy" />
                      ) : output.type === "video" ? (
                        <video src={output.fileUrl || output.content} controls className="w-full max-h-48 rounded-xl mb-2" />
                      ) : output.type === "audio" ? (
                        <>
                          <audio src={output.fileUrl || output.content} controls className="w-full mb-2 rounded-xl" />
                          {output.content && output.content !== output.fileUrl && output.content !== "Song generated" && (
                            <p className="text-xs text-foreground/80 line-clamp-3 font-myanmar whitespace-pre-wrap mb-2">{output.content}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-foreground/80 line-clamp-4 font-myanmar whitespace-pre-wrap mb-2">{output.content}</p>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(output.content)} className="h-7 text-[10px]">
                          <Copy className="w-3 h-3 mr-1" />{t('action.copy')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(output)} className="h-7 text-[10px]">
                          <Download className="w-3 h-3 mr-1" />{t('action.download')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeOutput(output.id)} className="h-7 text-[10px] text-destructive">
                          <Trash2 className="w-3 h-3 mr-1" />{t('action.delete')}
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
