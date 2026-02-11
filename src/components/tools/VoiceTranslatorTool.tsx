import { useState } from "react";
import { Loader2, Play, Languages, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useLiveRecording } from "@/hooks/useLiveRecording";
import { supabase } from "@/integrations/supabase/client";
import { ToolHeader } from "@/components/ToolHeader";
import { FirstOutputGuide } from "@/components/FirstOutputGuide";
import { useToolOutput } from "@/hooks/useToolOutput";
import { motion } from "framer-motion";

interface Props { userId?: string; onBack: () => void; }

const LANGUAGES = [
  { value: "English", label: "🇬🇧 English" },
  { value: "Thai", label: "🇹🇭 Thai" },
  { value: "Chinese", label: "🇨🇳 Chinese" },
  { value: "Korean", label: "🇰🇷 Korean" },
  { value: "Japanese", label: "🇯🇵 Japanese" },
];

export const VoiceTranslatorTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { credits, refetch } = useCredits(userId);
  const { costs } = useCreditCosts();
  const { showGuide, saveOutput } = useToolOutput("voice_translator", "Voice Translator");
  const { isRecording, recordingTime, audioBlob, startRecording, stopRecording, resetRecording, audioLevel } = useLiveRecording();
  const [targetLang, setTargetLang] = useState("English");
  const [manualText, setManualText] = useState("");
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cost = (costs as any).voice_translator || 3;

  const handleTranslate = async () => {
    if (!userId) return;
    setIsLoading(true);
    setTranslatedText(null);
    setOriginalText(null);

    try {
      let textToTranslate = manualText.trim();

      // If audio recorded, first transcribe it
      if (audioBlob && !textToTranslate) {
        const reader = new FileReader();
        const audioBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(audioBlob);
        });

        const { data: sttData, error: sttError } = await supabase.functions.invoke("speech-to-text", {
          body: { audioData: audioBase64, mimeType: audioBlob.type || "audio/webm" },
        });
        if (sttError) throw sttError;
        textToTranslate = sttData?.text || "";
        if (!textToTranslate) throw new Error("အသံကို စာသားအဖြစ် ပြောင်း၍မရပါ");
      }

      if (!textToTranslate) {
        toast({ title: "စာသား သို့မဟုတ် အသံ ထည့်ပါ", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      setOriginalText(textToTranslate);

      // Translate using Gemini
      const prompt = `Translate the following Burmese text to ${targetLang}. Only return the translation, nothing else.

Text: ${textToTranslate}`;

      const { data, error } = await supabase.functions.invoke("ai-tool", {
        body: { userId, toolType: "voice_translator", prompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTranslatedText(data?.result);
      refetch();
      if (data?.result) saveOutput("text", data.result);
      toast({ title: "ဘာသာပြန်ပြီးပါပြီ!", description: `${data.creditsUsed} Cr သုံးခဲ့သည်` });
    } catch (e: any) {
      toast({ title: "အမှားရှိပါသည်", description: e.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const speakTranslation = () => {
    if (!translatedText || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(translatedText);
    utterance.rate = 0.9;
    const langMap: Record<string, string> = { English: "en-US", Thai: "th-TH", Chinese: "zh-CN", Korean: "ko-KR", Japanese: "ja-JP" };
    utterance.lang = langMap[targetLang] || "en-US";
    setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 p-4 pb-24">
      <ToolHeader title="AI အသံဖြင့် ဘာသာပြန်စက်" subtitle="မြန်မာစကား → နိုင်ငံခြားဘာသာ ဘာသာပြန်" onBack={onBack} />

      <div className="gradient-card rounded-2xl p-4 border border-primary/20 space-y-4">
        {/* Voice Recording */}
        <div className="text-center space-y-3">
          <p className="text-xs text-muted-foreground font-myanmar">မြန်မာလို ပြောပါ (သို့) အောက်မှာ ရိုက်ထည့်ပါ</p>
          <div className="flex justify-center items-center gap-4">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              className="rounded-full w-16 h-16"
            >
              {isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
          </div>
          {isRecording && (
            <div className="space-y-1">
              <p className="text-xs text-destructive font-medium animate-pulse">🔴 {formatTime(recordingTime)}</p>
              <div className="w-24 mx-auto h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${audioLevel * 100}%` }} />
              </div>
            </div>
          )}
          {audioBlob && !isRecording && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-green-500 font-myanmar">✓ {formatTime(recordingTime)} အသံဖမ်းပြီး</span>
              <Button size="sm" variant="ghost" onClick={resetRecording} className="text-xs">ဖျက်မည်</Button>
            </div>
          )}
        </div>

        {/* Manual Text Input */}
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">သို့မဟုတ် စာရိုက်ထည့်ပါ</label>
          <Textarea value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder="မြန်မာလို ရိုက်ထည့်ပါ..." className="mt-1 min-h-[80px] font-myanmar" />
        </div>

        {/* Target Language */}
        <div>
          <label className="text-xs text-muted-foreground font-myanmar">ဘာသာပြန်မည့် ဘာသာစကား</label>
          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleTranslate} disabled={isLoading || (!audioBlob && !manualText.trim()) || credits < cost} className="w-full bg-primary text-primary-foreground rounded-2xl py-4">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ဘာသာပြန်နေသည်...</> : <><Languages className="w-4 h-4 mr-2" />ဘာသာပြန်မည် ({cost} Cr)</>}
      </Button>

      {translatedText && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="gradient-card rounded-2xl p-4 border border-primary/30 space-y-3">
          {originalText && (
            <div className="p-3 rounded-xl bg-secondary/50">
              <p className="text-[10px] text-muted-foreground font-myanmar mb-1">မူရင်း (Burmese)</p>
              <p className="text-sm font-myanmar">{originalText}</p>
            </div>
          )}
          <div className="p-3 rounded-xl bg-primary/10">
            <p className="text-[10px] text-primary font-myanmar mb-1">{targetLang} Translation</p>
            <p className="text-sm font-medium">{translatedText}</p>
          </div>
          <Button onClick={speakTranslation} disabled={isSpeaking} variant="outline" className="w-full">
            <Play className="w-4 h-4 mr-2" />{isSpeaking ? "ပြောနေသည်..." : "အသံဖြင့် နားထောင်မည်"}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
