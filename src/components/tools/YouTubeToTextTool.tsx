import { useState } from "react";
import { Youtube, Loader2, Copy, Download, Link } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ToolHeader } from "@/components/ToolHeader";
import { supabase } from "@/integrations/supabase/client";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface YouTubeToTextToolProps {
  userId?: string;
  onBack: () => void;
}

const LANGUAGES = [
  { code: "my", name: "မြန်မာ" },
  { code: "en", name: "English" },
  { code: "th", name: "ไทย" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
];

export const YouTubeToTextTool = ({ userId, onBack }: YouTubeToTextToolProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { refetch: refetchCredits } = useCredits(userId);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [language, setLanguage] = useState("my");
  const [transcribedText, setTranscribedText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  // Credit cost is 2x the speech_to_text cost
  const creditCost = (costs.youtube_to_text || 10);

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleTranscribe = async () => {
    if (!youtubeUrl.trim()) {
      toast({
        title: "YouTube Link ထည့်ပါ",
        description: "YouTube URL ထည့်သွင်းပါ",
        variant: "destructive",
      });
      return;
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      toast({
        title: "Link မမှန်ပါ",
        description: "YouTube Video Link မှန်ကန်စွာ ထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "လော့ဂ်အင်လုပ်ပါ",
        description: "စာသားပြောင်းရန် အကောင့်ဝင်ပါ",
        variant: "destructive",
      });
      return;
    }

    setIsTranscribing(true);
    setTranscribedText("");
    setProgress(0);

    const statuses = [
      "YouTube မှ အသံထုတ်ယူနေသည်...",
      "AI ဖြင့် ခွဲခြမ်းစိတ်ဖြာနေသည်...",
      "စာသားပြောင်းလဲနေသည်...",
      "အပြီးသတ်နေသည်...",
    ];
    let statusIndex = 0;
    setStatusText(statuses[0]);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        const newProgress = prev + Math.random() * 15;
        const newIndex = Math.min(Math.floor(newProgress / 25), statuses.length - 1);
        if (newIndex !== statusIndex) {
          statusIndex = newIndex;
          setStatusText(statuses[statusIndex]);
        }
        return newProgress;
      });
    }, 800);

    try {
      const { data, error } = await supabase.functions.invoke("youtube-to-text", {
        body: {
          videoId,
          language,
        },
      });

      clearInterval(progressInterval);

      if (error) throw new Error(error.message);

      if (data?.error) {
        if (data.error === "Insufficient credits") {
          toast({
            title: "ခရက်ဒစ် မလုံလောက်ပါ",
            description: `YouTube စာသားပြောင်းရန် ${data.required} Credits လိုအပ်ပါသည်`,
            variant: "destructive",
          });
        } else {
          toast({ title: "အမှားရှိပါသည်", description: data.error, variant: "destructive" });
        }
        return;
      }

      if (data?.text) {
        setProgress(100);
        setTranscribedText(data.text);
        refetchCredits();
        toast({
          title: "အောင်မြင်ပါသည်",
          description: `စာသားပြောင်းပြီးပါပြီ (${data.creditsUsed} Credits)`,
        });
      }
    } catch (error: any) {
      console.error("YouTube to text error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "စာသားပြောင်းရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      clearInterval(progressInterval);
      setIsTranscribing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcribedText);
    toast({
      title: "ကူးယူပြီးပါပြီ",
      description: "စာသားကို clipboard သို့ ကူးယူပြီးပါပြီ",
    });
  };

  const downloadText = () => {
    const blob = new Blob([transcribedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `youtube-transcript-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-4 pb-24"
    >
      <ToolHeader 
        title="YouTube → စာ" 
        subtitle="YouTube ဗီဒီယိုမှ စာသားထုတ်ယူခြင်း"
        onBack={onBack} 
      />

      {/* YouTube URL Input */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/20">
        <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
          <Link className="w-4 h-4 inline mr-1" />
          YouTube Link
        </label>
        <Input
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          className="bg-background/50 border-primary/30 rounded-xl"
        />
        <p className="text-xs text-muted-foreground mt-2 font-myanmar">
          YouTube, YouTube Shorts Link များ ထည့်သွင်းနိုင်ပါသည်
        </p>
      </div>

      {/* Language Selection */}
      <div className="gradient-card rounded-xl p-3 border border-primary/20">
        <label className="block text-xs font-medium text-primary mb-2 font-myanmar">
          ဘာသာစကား ရွေးပါ
        </label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="bg-background/50 border-primary/30 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Progress */}
      {isTranscribing && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-myanmar">{statusText}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Transcribe Button */}
      <Button
        onClick={handleTranscribe}
        disabled={isTranscribing || !youtubeUrl.trim()}
        className="w-full btn-gradient-red py-4 rounded-2xl font-semibold font-myanmar"
      >
        {isTranscribing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            စာသားထုတ်နေသည်...
          </>
        ) : (
          <>
            <Youtube className="w-5 h-5 mr-2" />
            စာသားထုတ်မည် ({creditCost} Credits)
          </>
        )}
      </Button>

      {/* Result */}
      {transcribedText && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="gradient-card rounded-2xl p-4 border border-primary/30"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary font-myanmar">ရလဒ်</h3>
            <div className="flex gap-2">
              <Button
                onClick={copyToClipboard}
                size="sm"
                variant="outline"
                className="text-xs font-myanmar"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
              <Button
                onClick={downloadText}
                size="sm"
                variant="outline"
                className="text-xs font-myanmar"
              >
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            </div>
          </div>
          <Textarea
            value={transcribedText}
            readOnly
            className="min-h-[150px] bg-background/50 border-primary/30 rounded-xl font-myanmar"
          />
        </motion.div>
      )}
    </motion.div>
  );
};
