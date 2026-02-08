import { useState } from "react";
import { Loader2, Copy, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

const DAYS = [
  { value: "sunday", label: "တနင်္ဂနွေ" },
  { value: "monday", label: "တနင်္လာ" },
  { value: "tuesday", label: "အင်္ဂါ" },
  { value: "wednesday", label: "ဗုဒ္ဓဟူး" },
  { value: "thursday", label: "ကြာသပတေး" },
  { value: "friday", label: "သောကြာ" },
  { value: "saturday", label: "စနေ" },
];

export const AstrologyTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [birthDate, setBirthDate] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cost = costs.myanmar_astrology || 5;

  const handleGenerate = async () => {
    if (!birthDate || !birthDay || !userId) return;
    setIsLoading(true); setResult("");
    try {
      const dayLabel = DAYS.find(d => d.value === birthDay)?.label || birthDay;
      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { toolType: "astrology", inputs: { birthDate, birthDay: dayLabel } },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.result || ""); refetch();
      toast({ title: "ဟောစာတမ်း ရရှိပါပြီ!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI ဟောစာတမ်း" subtitle="မွေးနေ့အလိုက် ကံကြမ္မာ ဟောကြားချက်" onBack={onBack} />
      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-myanmar">မွေးသက္ကရာဇ်</Label>
          <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="text-sm" />
        </div>
        <div id="settings-panel" className="space-y-2">
          <Label className="text-sm font-myanmar">မွေးနေ့</Label>
          <Select value={birthDay} onValueChange={setBirthDay}>
            <SelectTrigger><SelectValue placeholder="မွေးနေ့ ရွေးပါ" /></SelectTrigger>
            <SelectContent>{DAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || !birthDate || !birthDay || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဟောကြားနေသည်...</> : <><Star className="w-4 h-4 mr-2" />ဟောစာတမ်း ကြည့်မည် ({cost} Cr)</>}
      </Button>
      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">ဟောစာတမ်း</h3>
            <Button onClick={handleCopy} size="sm" variant="outline" className="text-xs">
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}{copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground font-myanmar leading-relaxed bg-secondary/30 rounded-xl p-3">{result}</div>
        </motion.div>
      )}
    </motion.div>
  );
};
