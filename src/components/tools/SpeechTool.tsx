import { useState, useRef } from "react";
import { Volume2, Mic, Upload, Loader2, Play, Pause } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCreditCosts } from "@/hooks/useCreditCosts";

interface SpeechToolProps {
  userId?: string;
}

const VOICES = [
  { id: "alloy", name: "Alloy", description: "ကြည်လင်သော အသံ" },
  { id: "echo", name: "Echo", description: "တည်ငြိမ်သော အသံ" },
  { id: "fable", name: "Fable", description: "ပျော်ရွှင်သော အသံ" },
  { id: "onyx", name: "Onyx", description: "နက်ရှိုင်းသော အသံ" },
  { id: "nova", name: "Nova", description: "သဘာဝကျသော အသံ" },
  { id: "shimmer", name: "Shimmer", description: "ချိုမြိန်သော အသံ" },
];

const LANGUAGES = [
  { code: "my", name: "မြန်မာ" },
  { code: "en", name: "English" },
  { code: "th", name: "ไทย" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
];

export const SpeechTool = ({ userId }: SpeechToolProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  
  // Text-to-Speech state
  const [ttsText, setTtsText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [ttsLanguage, setTtsLanguage] = useState("my");
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Speech-to-Text state
  const [sttLanguage, setSttLanguage] = useState("my");
  const [transcribedText, setTranscribedText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Web Speech API for TTS
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      
      const langMap: Record<string, string> = {
        'my': 'my-MM',
        'en': 'en-US',
        'th': 'th-TH',
        'zh': 'zh-CN',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
      };
      
      utterance.lang = langMap[ttsLanguage] || 'en-US';
      utterance.rate = 1;
      utterance.pitch = 1;
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) {
      toast({
        title: "စာသားထည့်ပါ",
        description: "အသံပြောင်းရန် စာသားထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "လော့ဂ်အင်လုပ်ပါ",
        description: "အသံပြောင်းရန် အကောင့်ဝင်ပါ",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingTTS(true);
    setGeneratedAudio(null);

    try {
      // Call the secure Edge Function - no API key passed
      const { data, error } = await supabase.functions.invoke("text-to-speech", {
        body: {
          text: ttsText,
          voice: selectedVoice,
          language: ttsLanguage,
        },
      });

      if (error) {
        throw new Error(error.message || "အသံပြောင်းရာတွင် အမှားရှိပါသည်");
      }

      if (data?.error) {
        if (data.error === "Insufficient credits") {
          toast({
            title: "ခရက်ဒစ် မလုံလောက်ပါ",
            description: `အသံပြောင်းရန် ${data.required} Credits လိုအပ်ပါသည်`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "အမှားရှိပါသည်",
            description: data.error,
            variant: "destructive",
          });
        }
        return;
      }

      if (data?.useWebSpeech) {
        // Use Web Speech API for immediate audio playback
        speakText(ttsText);
        setGeneratedAudio("generated");
        toast({
          title: "အောင်မြင်ပါသည်",
          description: `အသံဖတ်ပြနေပါသည်။ ကျန် Credits: ${data.newBalance}`,
        });
      }
    } catch (error: any) {
      console.error("TTS error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "အသံပြောင်းရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const handlePlayPause = () => {
    if (generatedAudio === "generated") {
      speakText(ttsText);
      setIsPlaying(true);
      const checkSpeaking = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          setIsPlaying(false);
          clearInterval(checkSpeaking);
        }
      }, 100);
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleStopSpeech = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleTranscribe = async () => {
    if (!audioFile) {
      toast({
        title: "အသံဖိုင်ထည့်ပါ",
        description: "စာသားပြောင်းရန် အသံဖိုင်ထည့်ပါ",
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

    try {
      // Convert audio to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Audio = (event.target?.result as string).split(",")[1];

        // Call the secure Edge Function - no API key passed
        const { data, error } = await supabase.functions.invoke("speech-to-text", {
          body: {
            audioBase64: base64Audio,
            language: sttLanguage,
          },
        });

        if (error) {
          throw new Error(error.message || "စာသားပြောင်းရာတွင် အမှားရှိပါသည်");
        }

        if (data?.error) {
          if (data.error === "Insufficient credits") {
            toast({
              title: "ခရက်ဒစ် မလုံလောက်ပါ",
              description: `စာသားပြောင်းရန် ${data.required} Credits လိုအပ်ပါသည်`,
              variant: "destructive",
            });
          } else if (data.error === "Speech service not configured") {
            toast({
              title: "ဝန်ဆောင်မှု မပြင်ဆင်ရသေးပါ",
              description: "Admin မှ API Key ထည့်သွင်းရန် လိုအပ်ပါသည်",
              variant: "destructive",
            });
          } else {
            toast({
              title: "အမှားရှိပါသည်",
              description: data.error,
              variant: "destructive",
            });
          }
          setIsTranscribing(false);
          return;
        }

        if (data?.text) {
          setTranscribedText(data.text);
          toast({
            title: "အောင်မြင်ပါသည်",
            description: `စာသားပြောင်းပြီးပါပြီ။ ကျန် Credits: ${data.newBalance}`,
          });
        }
        setIsTranscribing(false);
      };
      reader.readAsDataURL(audioFile);
    } catch (error: any) {
      console.error("STT error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "စာသားပြောင်းရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
      setIsTranscribing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="tts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="tts" className="text-xs sm:text-sm">
            <Volume2 className="w-4 h-4 mr-1" />
            စာ → အသံ
          </TabsTrigger>
          <TabsTrigger value="stt" className="text-xs sm:text-sm">
            <Mic className="w-4 h-4 mr-1" />
            အသံ → စာ
          </TabsTrigger>
        </TabsList>

        {/* Text-to-Speech Tab */}
        <TabsContent value="tts" className="space-y-4">
          <div className="gradient-card rounded-2xl p-4 border border-primary/20">
            <label className="block text-sm font-medium text-primary mb-2">
              စာသားထည့်ပါ
            </label>
            <Textarea
              placeholder="အသံပြောင်းလိုသော စာသားကို ရိုက်ထည့်ပါ..."
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              className="min-h-[100px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="gradient-card rounded-xl p-3 border border-primary/20">
              <label className="block text-xs font-medium text-primary mb-2">
                အသံရွေးပါ
              </label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="bg-background/50 border-primary/30 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICES.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div className="flex flex-col">
                        <span>{voice.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {voice.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="gradient-card rounded-xl p-3 border border-primary/20">
              <label className="block text-xs font-medium text-primary mb-2">
                ဘာသာစကား
              </label>
              <Select value={ttsLanguage} onValueChange={setTtsLanguage}>
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
          </div>

          <Button
            onClick={handleGenerateTTS}
            disabled={isGeneratingTTS || !ttsText.trim()}
            className="w-full btn-gradient-green py-4 rounded-2xl font-semibold"
          >
            {isGeneratingTTS ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                အသံထုတ်နေသည်...
              </>
            ) : (
              <>
                <Volume2 className="w-5 h-5 mr-2" />
                အသံထုတ်မည် ({costs.text_to_speech} Credits)
              </>
            )}
          </Button>

          {generatedAudio && (
            <div className="gradient-card rounded-2xl p-4 border border-success/30 animate-scale-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-primary">အသံဖိုင်</h3>
                <span className="text-xs text-muted-foreground">Web Speech API</span>
              </div>
              
              <div className="flex items-center gap-3 bg-background/50 rounded-xl p-4">
                <Button
                  onClick={handlePlayPause}
                  size="sm"
                  className="rounded-full w-12 h-12 p-0"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </Button>
                <div className="flex-1">
                  <p className="text-sm text-foreground font-medium">
                    {isPlaying ? "အသံဖတ်နေသည်..." : "ပြန်ဖတ်ရန် Play နှိပ်ပါ"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {ttsText.substring(0, 50)}...
                  </p>
                </div>
                {isPlaying && (
                  <Button
                    onClick={handleStopSpeech}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    ရပ်မည်
                  </Button>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Speech-to-Text Tab */}
        <TabsContent value="stt" className="space-y-4">
          <div className="gradient-card rounded-2xl p-4 border border-primary/20">
            <label className="block text-sm font-medium text-primary mb-3">
              အသံဖိုင်ထည့်ပါ
            </label>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
            >
              <Upload className="w-6 h-6 text-primary" />
              <span className="text-sm text-muted-foreground">
                {audioFile ? audioFile.name : "အသံဖိုင်ရွေးရန် နှိပ်ပါ"}
              </span>
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              className="hidden"
            />
          </div>

          <div className="gradient-card rounded-xl p-3 border border-primary/20">
            <label className="block text-xs font-medium text-primary mb-2">
              အသံဘာသာစကား
            </label>
            <Select value={sttLanguage} onValueChange={setSttLanguage}>
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

          <Button
            onClick={handleTranscribe}
            disabled={isTranscribing || !audioFile}
            className="w-full btn-gradient-green py-4 rounded-2xl font-semibold"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                စာသားပြောင်းနေသည်...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                စာသားပြောင်းမည် ({costs.speech_to_text} Credits)
              </>
            )}
          </Button>

          {transcribedText && (
            <div className="gradient-card rounded-2xl p-4 border border-success/30 animate-scale-in">
              <h3 className="text-sm font-semibold text-primary mb-2">ရလဒ်</h3>
              <div className="bg-background/50 rounded-xl p-3 border border-border">
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {transcribedText}
                </p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
