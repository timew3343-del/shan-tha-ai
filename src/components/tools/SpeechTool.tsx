import { useState, useRef, useEffect } from "react";
import { Volume2, Mic, Loader2, Play, Pause, Square, Download, X, Circle, Upload, FileAudio } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ToolHeader } from "@/components/ToolHeader";
import { useLiveRecording } from "@/hooks/useLiveRecording";
import { MicPermissionPopup } from "@/components/MicPermissionPopup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { motion, AnimatePresence } from "framer-motion";

interface SpeechToolProps {
  userId?: string;
  onBack: () => void;
}

// Enhanced voice options with gender and style
const VOICES = [
  // Male voices
  { id: "roger", name: "Roger", gender: "male", style: "professional", description: "Professional ကျယ်ကျယ်" },
  { id: "george", name: "George", gender: "male", style: "casual", description: "သဘာဝကျသော အသံ" },
  { id: "brian", name: "Brian", gender: "male", style: "storytelling", description: "ပုံပြင်ပြော အသံ" },
  { id: "daniel", name: "Daniel", gender: "male", style: "professional", description: "News Anchor အသံ" },
  { id: "liam", name: "Liam", gender: "male", style: "casual", description: "ပျော်ရွှင်သော အသံ" },
  // Female voices
  { id: "sarah", name: "Sarah", gender: "female", style: "professional", description: "Professional မိန်းကလေး" },
  { id: "laura", name: "Laura", gender: "female", style: "casual", description: "ချိုမြိန်သော အသံ" },
  { id: "jessica", name: "Jessica", gender: "female", style: "storytelling", description: "ပုံပြင်ပြော အသံ" },
  { id: "lily", name: "Lily", gender: "female", style: "professional", description: "သတင်းပြော အသံ" },
  { id: "alice", name: "Alice", gender: "female", style: "casual", description: "ဖော်ရွေသော အသံ" },
];

const LANGUAGES = [
  { code: "my", name: "မြန်မာ" },
  { code: "en", name: "English" },
  { code: "th", name: "ไทย" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "hi", name: "हिन्दी" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "tl", name: "Filipino" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
  { code: "ar", name: "العربية" },
];

export const SpeechTool = ({ userId, onBack }: SpeechToolProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { refetch: refetchCredits } = useCredits(userId);
  
  const [activeMode, setActiveMode] = useState<"tts" | "stt">("tts");
  
  // TTS state
  const [ttsText, setTtsText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("sarah");
  const [ttsLanguage, setTtsLanguage] = useState("my");
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // STT state
  const [sttLanguage, setSttLanguage] = useState("my");
  const [transcribedText, setTranscribedText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttProgress, setSttProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  
  const { 
    isRecording, 
    recordingTime, 
    audioBlob, 
    startRecording, 
    stopRecording,
    resetRecording,
    audioLevel 
  } = useLiveRecording();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTranscribing) {
      setSttProgress(0);
      interval = setInterval(() => {
        setSttProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 20;
        });
      }, 500);
    } else {
      setSttProgress(100);
      const timeout = setTimeout(() => setSttProgress(0), 500);
      return () => clearTimeout(timeout);
    }
    return () => clearInterval(interval);
  }, [isTranscribing]);

  // Web Speech API for TTS
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      const langMap: Record<string, string> = {
        'my': 'my-MM',
        'en': 'en-US',
        'th': 'th-TH',
        'zh': 'zh-CN',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'hi': 'hi-IN',
        'vi': 'vi-VN',
        'id': 'id-ID',
        'tl': 'fil-PH',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'pt': 'pt-BR',
        'ru': 'ru-RU',
        'ar': 'ar-SA',
      };
      
      utterance.lang = langMap[ttsLanguage] || 'my-MM';
      utterance.rate = 1;
      utterance.pitch = 1;
      
      const voices = window.speechSynthesis.getVoices();
      const selectedVoiceData = VOICES.find(v => v.id === selectedVoice);
      
      // Try to find a matching voice by gender and language
      const matchingVoice = voices.find(v => {
        const langMatch = v.lang.startsWith(langMap[ttsLanguage]?.split('-')[0] || 'my');
        if (!langMatch) return false;
        
        // Try to match gender by voice name (heuristic)
        if (selectedVoiceData?.gender === 'female') {
          return v.name.toLowerCase().includes('female') || 
                 v.name.toLowerCase().includes('woman') ||
                 !v.name.toLowerCase().includes('male');
        }
        return true;
      }) || voices.find(v => v.lang.startsWith(langMap[ttsLanguage]?.split('-')[0] || 'my'));
      
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }
      
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      
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
      const { data, error } = await supabase.functions.invoke("text-to-speech", {
        body: {
          text: ttsText,
          voice: selectedVoice,
          language: ttsLanguage,
        },
      });

      if (error) throw new Error(error.message);

      if (data?.error) {
        if (data.error === "Insufficient credits") {
          toast({
            title: "ခရက်ဒစ် မလုံလောက်ပါ",
            description: `အသံပြောင်းရန် ${data.required} Credits လိုအပ်ပါသည်`,
            variant: "destructive",
          });
        } else {
          toast({ title: "အမှားရှိပါသည်", description: data.error, variant: "destructive" });
        }
        return;
      }

      if (data?.useWebSpeech) {
        speakText(ttsText);
        setGeneratedAudio("web-speech");
        refetchCredits();
        toast({
          title: "အောင်မြင်ပါသည်",
          description: `အသံထုတ်ပြီးပါပြီ (${data.creditsUsed} Credits)`,
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
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else {
        speakText(ttsText);
      }
    }
  };

  const handleStopSpeech = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/m4a'];
    if (!validTypes.some(type => file.type.includes(type.split('/')[1]))) {
      toast({
        title: "ဖိုင်အမျိုးအစား မမှန်ပါ",
        description: "MP3, WAV, WebM, OGG, M4A ဖိုင်များသာ ရွေးပါ",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "ဖိုင်ကြီးလွန်းပါသည်",
        description: "25MB အောက် ဖိုင်ရွေးပါ",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);
    resetRecording();
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTranscribe = async () => {
    const audioSource = uploadedFile || audioBlob;
    
    if (!audioSource) {
      toast({
        title: "အသံဖိုင်ထည့်ပါ",
        description: "ဦးစွာ အသံဖမ်းပါ သို့မဟုတ် ဖိုင်ထည့်ပါ",
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
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Audio = (event.target?.result as string).split(",")[1];

        const { data, error } = await supabase.functions.invoke("speech-to-text", {
          body: {
            audioBase64: base64Audio,
            language: sttLanguage,
          },
        });

        if (error) throw new Error(error.message);

        if (data?.error) {
          if (data.error === "Insufficient credits") {
            toast({
              title: "ခရက်ဒစ် မလုံလောက်ပါ",
              description: `စာသားပြောင်းရန် ${data.required} Credits လိုအပ်ပါသည်`,
              variant: "destructive",
            });
          } else {
            toast({ title: "အမှားရှိပါသည်", description: data.error, variant: "destructive" });
          }
          setIsTranscribing(false);
          return;
        }

        if (data?.text) {
          setTranscribedText(data.text);
          refetchCredits();
          toast({
            title: "အောင်မြင်ပါသည်",
            description: `စာသားပြောင်းပြီးပါပြီ (${data.creditsUsed} Credits)`,
          });
        }
        setIsTranscribing(false);
      };
      
      if (uploadedFile) {
        reader.readAsDataURL(uploadedFile);
      } else if (audioBlob) {
        reader.readAsDataURL(audioBlob);
      }
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

  const [showMicPermission, setShowMicPermission] = useState(false);

  const handleRecordClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      try {
        resetRecording();
        removeUploadedFile();
        await startRecording();
      } catch (error) {
        setShowMicPermission(true);
      }
    }
  };

  const handleRetryMic = () => {
    setShowMicPermission(false);
    handleRecordClick();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcribedText);
    toast({
      title: "ကူးယူပြီးပါပြီ",
      description: "စာသားကို clipboard သို့ ကူးယူပြီးပါပြီ",
    });
  };

  const hasAudioSource = audioBlob || uploadedFile;
  const filteredVoices = genderFilter === "all" ? VOICES : VOICES.filter(v => v.gender === genderFilter);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-4 pb-24"
    >
      <ToolHeader 
        title="အသံနှင့် စာ" 
        subtitle="Text ↔ Speech ပြောင်းလဲခြင်း"
        onBack={onBack} 
      />

      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={activeMode === "tts" ? "default" : "outline"}
          onClick={() => setActiveMode("tts")}
          className="h-12 rounded-xl font-myanmar"
        >
          <Volume2 className="w-4 h-4 mr-2" />
          စာ → အသံ
        </Button>
        <Button
          variant={activeMode === "stt" ? "default" : "outline"}
          onClick={() => setActiveMode("stt")}
          className="h-12 rounded-xl font-myanmar"
        >
          <Mic className="w-4 h-4 mr-2" />
          အသံ → စာ
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {activeMode === "tts" ? (
          <motion.div
            key="tts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* TTS Text Input */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <label className="block text-sm font-medium text-primary mb-2 font-myanmar">
                စာသားထည့်ပါ
              </label>
              <Textarea
                placeholder="အသံပြောင်းလိုသော စာသားကို ရိုက်ထည့်ပါ..."
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                className="min-h-[100px] bg-background/50 border-primary/30 rounded-xl resize-none text-sm font-myanmar"
              />
            </div>

            {/* Gender Filter */}
            <div className="flex gap-2">
              {(["all", "male", "female"] as const).map((g) => (
                <Button
                  key={g}
                  variant={genderFilter === g ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGenderFilter(g)}
                  className="flex-1 text-xs font-myanmar"
                >
                  {g === "all" ? "အားလုံး" : g === "male" ? "အမျိုးသား" : "အမျိုးသမီး"}
                </Button>
              ))}
            </div>

            {/* Voice & Language Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="gradient-card rounded-xl p-3 border border-primary/20">
                <label className="block text-xs font-medium text-primary mb-2 font-myanmar">
                  အသံရွေးပါ
                </label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger className="bg-background/50 border-primary/30 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex flex-col">
                          <span>{voice.name} ({voice.style})</span>
                          <span className="text-xs text-muted-foreground font-myanmar">
                            {voice.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="gradient-card rounded-xl p-3 border border-primary/20">
                <label className="block text-xs font-medium text-primary mb-2 font-myanmar">
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
              className="w-full btn-gradient-green py-4 rounded-2xl font-semibold font-myanmar"
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
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="gradient-card rounded-2xl p-4 border border-success/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary font-myanmar">အသံထိန်းချုပ်</h3>
                </div>
                
                <div className="flex items-center gap-3 bg-background/50 rounded-xl p-4">
                  <Button
                    onClick={handlePlayPause}
                    size="icon"
                    className="h-12 w-12 rounded-full"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  
                  <div className="flex-1">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full bg-primary transition-all ${isPlaying ? 'animate-pulse' : ''}`} style={{ width: isPlaying ? '50%' : '0%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-myanmar">
                      {isPlaying ? 'ဖွင့်နေသည်...' : 'Play နှိပ်ပါ'}
                    </p>
                  </div>
                  
                  <Button
                    onClick={handleStopSpeech}
                    size="icon"
                    variant="outline"
                    className="h-10 w-10 rounded-full"
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="stt"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Recording Section */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
                အသံဖမ်းရန်
              </label>
              
              <div className="flex flex-col items-center gap-4">
                {/* Audio Visualizer */}
                <div className="flex items-end justify-center gap-1 h-16 w-full bg-background/30 rounded-xl p-2">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 rounded-full transition-all duration-100 ${
                        isRecording ? 'bg-red-500' : 'bg-primary/30'
                      }`}
                      style={{
                        height: isRecording
                          ? `${Math.max(10, Math.random() * audioLevel * 100)}%`
                          : '10%',
                      }}
                    />
                  ))}
                </div>

                {/* Recording Time */}
                <span className="text-2xl font-mono text-primary">
                  {formatTime(recordingTime)}
                </span>

                {/* Record Button */}
                <Button
                  onClick={handleRecordClick}
                  className={`h-16 w-16 rounded-full ${
                    isRecording ? 'bg-red-500 hover:bg-red-600' : 'btn-gradient-red'
                  }`}
                >
                  {isRecording ? (
                    <Square className="w-6 h-6" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </Button>

                <p className="text-xs text-muted-foreground font-myanmar">
                  {isRecording ? 'ရပ်ရန် နှိပ်ပါ' : 'အသံဖမ်းရန် နှိပ်ပါ'}
                </p>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
                <FileAudio className="w-4 h-4 inline mr-1" />
                ဖိုင်ရွေးရန်
              </label>
              
              {uploadedFile ? (
                <div className="flex items-center gap-3 bg-background/50 rounded-xl p-3">
                  <FileAudio className="w-5 h-5 text-primary" />
                  <span className="flex-1 text-sm truncate">{uploadedFile.name}</span>
                  <Button
                    onClick={removeUploadedFile}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-20 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-primary/5 transition-colors"
                >
                  <Upload className="w-6 h-6 text-primary" />
                  <span className="text-xs text-muted-foreground font-myanmar">
                    MP3, WAV, WebM, M4A ဖိုင်ထည့်ပါ
                  </span>
                </button>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Language Selection */}
            <div className="gradient-card rounded-xl p-3 border border-primary/20">
              <label className="block text-xs font-medium text-primary mb-2 font-myanmar">
                ဘာသာစကား
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

            {/* Progress */}
            {isTranscribing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-myanmar">စာသားပြောင်းနေသည်...</span>
                  <span>{Math.round(sttProgress)}%</span>
                </div>
                <Progress value={sttProgress} className="h-2" />
              </motion.div>
            )}

            <Button
              onClick={handleTranscribe}
              disabled={isTranscribing || !hasAudioSource}
              className="w-full btn-gradient-blue py-4 rounded-2xl font-semibold font-myanmar"
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

            {/* Result */}
            {transcribedText && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="gradient-card rounded-2xl p-4 border border-primary/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary font-myanmar">ရလဒ်</h3>
                  <Button
                    onClick={copyToClipboard}
                    size="sm"
                    variant="outline"
                    className="text-xs font-myanmar"
                  >
                    Copy
                  </Button>
                </div>
                <Textarea
                  value={transcribedText}
                  readOnly
                  className="min-h-[100px] bg-background/50 border-primary/30 rounded-xl font-myanmar"
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mic Permission Popup */}
      <MicPermissionPopup
        isOpen={showMicPermission}
        onClose={() => setShowMicPermission(false)}
        onRetry={handleRetryMic}
      />
    </motion.div>
  );
};
