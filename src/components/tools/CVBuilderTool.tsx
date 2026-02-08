import { useState } from "react";
import { Loader2, Copy, Check, GraduationCap, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

export const CVBuilderTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [education, setEducation] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [targetJob, setTargetJob] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cost = costs.cv_builder || 5;

  const handleGenerate = async () => {
    if (!name.trim() || !userId) return;
    setIsLoading(true); setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { toolType: "cv_builder", inputs: { name, contact, education, experience, skills, targetJob } },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setResult(data?.result || ""); refetch();
      toast({ title: "CV ဖန်တီးပြီးပါပြီ!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `CV-${name}-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI ကိုယ်ရေးရာဇဝင်နှင့် အလုပ်လျှောက်လွှာ" subtitle="Professional CV နှင့် Cover Letter ဖန်တီးပေးခြင်း" onBack={onBack} />
      <div id="input-area" className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs font-myanmar">အမည်</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="အမည်" className="text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs font-myanmar">ဆက်သွယ်ရန်</Label><Input value={contact} onChange={e => setContact(e.target.value)} placeholder="ဖုန်း/Email" className="text-sm" /></div>
        </div>
        <div className="space-y-1"><Label className="text-xs font-myanmar">ပညာရေး</Label><Textarea value={education} onChange={e => setEducation(e.target.value)} placeholder="ပညာရေး အချက်အလက်များ..." className="min-h-[60px] text-sm" /></div>
        <div className="space-y-1"><Label className="text-xs font-myanmar">အလုပ်အတွေ့အကြုံ</Label><Textarea value={experience} onChange={e => setExperience(e.target.value)} placeholder="အလုပ်အတွေ့အကြုံများ..." className="min-h-[60px] text-sm" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs font-myanmar">ကျွမ်းကျင်မှု</Label><Input value={skills} onChange={e => setSkills(e.target.value)} placeholder="Skills" className="text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs font-myanmar">ရည်မှန်းအလုပ်</Label><Input value={targetJob} onChange={e => setTargetJob(e.target.value)} placeholder="Target Job" className="text-sm" /></div>
        </div>
      </div>
      <Button id="generate-btn" onClick={handleGenerate} disabled={isLoading || !name.trim() || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဖန်တီးနေသည်...</> : <><GraduationCap className="w-4 h-4 mr-2" />CV ဖန်တီးမည် ({cost} Cr)</>}
      </Button>
      {result && (
        <motion.div id="result-display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">CV & Cover Letter</h3>
            <div className="flex gap-2">
              <Button onClick={handleCopy} size="sm" variant="outline" className="text-xs">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</Button>
              <Button onClick={handleDownload} size="sm" variant="outline" className="text-xs"><Download className="w-3 h-3" /></Button>
            </div>
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground font-myanmar leading-relaxed bg-secondary/30 rounded-xl p-3 max-h-[500px] overflow-y-auto">{result}</div>
        </motion.div>
      )}
    </motion.div>
  );
};
