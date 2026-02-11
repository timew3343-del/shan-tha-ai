import { useState } from "react";
import { Loader2, FileText, Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";

interface Props { userId?: string; onBack: () => void; }

const DOC_TYPES = [
  { value: "rental", label: "🏠 အိမ်ငှားစာချုပ်" },
  { value: "sales", label: "🤝 အရောင်းအဝယ်စာချုပ်" },
  { value: "service", label: "📋 ဝန်ဆောင်မှုစာချုပ်" },
  { value: "employment", label: "💼 အလုပ်ခန့်အပ်စာချုပ်" },
  { value: "nda", label: "🔒 လျှို့ဝှက်ချက် စာချုပ်" },
];

export const LegalDocTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("legal_doc", "Legal Doc");
  const [docType, setDocType] = useState("rental");
  const [party1, setParty1] = useState("");
  const [party2, setParty2] = useState("");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cost = (costs as any).legal_doc || 3;

  const handleGenerate = async () => {
    if (!userId || !party1.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const typeLabel = DOC_TYPES.find(d => d.value === docType)?.label || docType;
      const prompt = `You are a Myanmar legal document expert. Generate a professional legal contract in Burmese.

Document Type: ${typeLabel}
Party 1 (ပထမ ပါတီ): ${party1}
Party 2 (ဒုတိယ ပါတီ): ${party2 || "N/A"}
Additional Details: ${details || "N/A"}

Generate a complete, professional legal document in Burmese including:
1. **စာချုပ်ခေါင်းစဉ်** (Title)
2. **ရက်စွဲ** (Date)
3. **ပါတီများ** (Parties involved)
4. **စာချုပ်အချက်အလက်များ** (Terms & Conditions - at least 8 clauses)
5. **တာဝန်နှင့် ရပိုင်ခွင့်များ** (Rights & Obligations)
6. **ပျက်ကွက်ပါက** (Breach conditions)
7. **လက်မှတ်ထိုးရန်** (Signature section)

Use formal Myanmar legal language.`;

      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { userId, toolType: "legal_doc", prompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.result);
      refetch();
      if (data?.result) saveOutput("text", data.result);
      toast({ title: "အောင်မြင်ပါသည်!", description: `စာချုပ် ဖန်တီးပြီးပါပြီ (${data.creditsUsed} Cr)` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const handleCopy = () => {
    if (result) { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(result.replace(/[#*_`]/g, ""), 180);
    doc.setFontSize(11);
    let y = 20;
    lines.forEach((line: string) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(line, 15, y);
      y += 7;
    });
    doc.save(`legal-doc-${Date.now()}.pdf`);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI ဥပဒေရေးရာ စာချုပ်ရေးသားသူ" subtitle="ပရော်ဖက်ရှင်နယ် ဥပဒေစာချုပ်များ ဖန်တီးခြင်း" onBack={onBack} />

      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">စာချုပ် အမျိုးအစား</label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground font-myanmar">ပထမ ပါတီ</label>
            <Input value={party1} onChange={(e) => setParty1(e.target.value)} placeholder="အမည်..." className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-myanmar">ဒုတိယ ပါတီ</label>
            <Input value={party2} onChange={(e) => setParty2(e.target.value)} placeholder="အမည်..." className="mt-1" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">အပိုအချက်အလက်</label>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="ငှားရမ်းခ၊ ကာလ၊ အထူးစည်းကမ်း..." className="mt-1 min-h-[80px] font-myanmar" />
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading || !party1.trim() || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဖန်တီးနေသည်...</> : <><FileText className="w-4 h-4 mr-2" />စာချုပ် ဖန်တီးမည် ({cost} Cr)</>}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary font-myanmar">📄 ဥပဒေစာချုပ်</h3>
            <Button size="sm" variant="ghost" onClick={handleCopy}>{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none font-myanmar text-sm max-h-[400px] overflow-y-auto">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
          <Button onClick={handleDownloadPDF} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />PDF Download
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
