import { useState } from "react";
import { Loader2, Copy, Check, Pen, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

const CONTENT_TYPES = [
  { value: "poem", label: "ကဗျာ" },
  { value: "short_story", label: "ဝတ္ထုတို" },
];

const THEMES = [
  { value: "romance", label: "အချစ်" },
  { value: "sad", label: "ဝမ်းနည်း" },
  { value: "horror", label: "ထိတ်လန့်" },
  { value: "inspirational", label: "စိတ်ဓာတ်မြှင့်" },
  { value: "nature", label: "သဘာဝ" },
  { value: "social", label: "လူမှုရေး" },
  { value: "humorous", label: "ဟာသ" },
];

export const CreativeWriterTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [contentType, setContentType] = useState("poem");
  const [theme, setTheme] = useState("romance");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cost = costs.creative_writer || 5;

  const handleGenerate = async () => {
    if (!topic.trim() || !userId) return;
    setIsLoading(true); setResult("");
    try {
      const typeLabel = CONTENT_TYPES.find(c => c.value === contentType)?.label || contentType;
      const themeLabel = THEMES.find(t => t.value === theme)?.label || theme;
      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { toolType: "creative_writer", inputs: { contentType: typeLabel, theme: themeLabel, topic } },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.result || ""); refetch();
      toast({ title: "ဖန်တီးပြီးပါပြီ!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleShare = () => {
    if (navigator.share) { navigator.share({ title: "Myanmar AI Creative Writing", text: result }).catch(() => {}); }
    else { handleCopy(); toast({ title: "Copied to clipboard!" }); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI ကဗျာနှင့် ဝတ္ထုတို ဖန်တီးသူ" subtitle="အရည်အသွေးမြင့် မြန်မာစာပေ ဖန်တီးပေးခြင်း" onBack={onBack} />
      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div id="settings-panel" className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-sm font-myanmar">အမျိုးအစား</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTENT_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-myanmar">ခံစားချက်</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{THEMES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-myanmar">ခေါင်းစဉ်/အကြောင်းအရာ</Label>
          <Textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="ဥပမာ - ဖခင်ကိုချစ်သော သမီးငယ်..." className="min-h-[80px] text-sm font-myanmar" />
        </div>
      </div>
      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || !topic.trim() || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဖန်တီးနေသည်...</> : <><Pen className="w-4 h-4 mr-2" />စာပေ ဖန်တီးမည် ({cost} Cr)</>}
      </Button>
      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">ဖန်တီးချက်</h3>
            <div className="flex gap-2">
              <Button onClick={handleCopy} size="sm" variant="outline" className="text-xs">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</Button>
              <Button onClick={handleShare} size="sm" variant="outline" className="text-xs"><Share2 className="w-3 h-3" /></Button>
            </div>
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground font-myanmar leading-relaxed bg-secondary/30 rounded-xl p-4 italic">{result}</div>
        </motion.div>
      )}
    </motion.div>
  );
};
