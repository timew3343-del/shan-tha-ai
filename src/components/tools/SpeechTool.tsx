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

export const SpeechTool = ({ userId, onBack }: SpeechToolProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { refetch: refetchCredits } = useCredits(userId);
  
  // Mode toggle - side by side buttons
  const [activeMode, setActiveMode] = useState<"tts" | "stt">("tts");
  
  // Text-to-Speech state
  const [ttsText, setTtsText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [ttsLanguage, setTtsLanguage] = useState("my");
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Speech-to-Text state
  const [sttLanguage, setSttLanguage] = useState("my");
  const [transcribedText, setTranscribedText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttProgress, setSttProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Live recording hook
  const { 
    isRecording, 
    recordingTime, 
    audioBlob, 
    startRecording, 
    stopRecording,
    resetRecording,
    audioLevel 
  } = useLiveRecording();

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Simulate STT progress
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

  // Web Speech API for TTS with my-MM locale
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
      };
      
      utterance.lang = langMap[ttsLanguage] || 'my-MM';
      utterance.rate = 1;
      utterance.pitch = 1;
      
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find(v => v.lang.startsWith(langMap[ttsLanguage]?.split('-')[0] || 'my'));
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
        setGeneratedAudio("generated");
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

  // Handle file upload
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

  // Mic permission state
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
        // Show instructional popup instead of just a toast
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

      {/* Mode Toggle - Side by Side */}
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
            {/* TTS Content */}
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
                    {VOICES.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex flex-col">
                          <span>{voice.name}</span>
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
                  <h3 className="text-sm font-semibold text-primary font-myanmar">အသံဖိုင်</h3>
                  <span className="text-xs text-muted-foreground">Web Speech API</span>
                </div>
                
                <div className="flex items-center gap-3 bg-background/50 rounded-xl p-4">
                  <Button
                    onClick={handlePlayPause}
                    size="sm"
                    className="rounded-full w-12 h-12 p-0"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium font-myanmar">
                      {isPlaying ? "အသံဖတ်နေသည်..." : "ပြန်ဖတ်ရန် Play နှိပ်ပါ"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px] font-myanmar">
                      {ttsText.substring(0, 50)}...
                    </p>
                  </div>
                  {isPlaying && (
                    <Button onClick={handleStopSpeech} size="sm" variant="outline" className="text-xs font-myanmar">
                      <Square className="w-3 h-3 mr-1" />
                      ရပ်မည်
                    </Button>
                  )}
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
            {/* STT Content with Live Recording AND File Upload */}
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <label className="block text-sm font-medium text-primary mb-3 font-myanmar">
                အသံရယူရန်
              </label>
              
              {/* Recording and Upload buttons side by side */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Record Button */}
                <motion.button
                  onClick={handleRecordClick}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed transition-all ${
                    isRecording 
                      ? 'border-destructive bg-destructive/10' 
                      : audioBlob && !uploadedFile
                        ? 'border-success bg-success/10'
                        : 'border-primary/30 hover:border-primary/50 hover:bg-primary/5'
                  }`}
                  animate={{
                    scale: isRecording ? [1, 1.02, 1] : 1,
                  }}
                  transition={{
                    duration: 1,
                    repeat: isRecording ? Infinity : 0,
                  }}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isRecording ? 'bg-destructive' : 'bg-primary'
                  }`}>
                    {isRecording ? (
                      <Square className="w-5 h-5 text-white" />
                    ) : (
                      <Mic className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground font-myanmar">
                      {isRecording ? "ရပ်မည်" : "အသံဖမ်းမည်"}
                    </p>
                    {isRecording && (
                      <p className="text-lg font-mono font-bold text-destructive">
                        {formatTime(recordingTime)}
                      </p>
                    )}
                    {audioBlob && !isRecording && !uploadedFile && (
                      <p className="text-xs text-success font-myanmar">ဖမ်းပြီး ✓</p>
                    )}
                  </div>
                </motion.button>

                {/* File Upload Button */}
                <label className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  uploadedFile 
                    ? 'border-success bg-success/10'
                    : 'border-primary/30 hover:border-primary/50 hover:bg-primary/5'
                }`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-secondary">
                    <Upload className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground font-myanmar">ဖိုင်ရွေးရန်</p>
                    {uploadedFile ? (
                      <p className="text-xs text-success font-myanmar truncate max-w-[80px]">
                        {uploadedFile.name}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">MP3, WAV, etc.</p>
                    )}
                  </div>
                </label>
              </div>

              {/* Audio Level Visualizer */}
              {isRecording && (
                <div className="flex items-center justify-center gap-1 h-8 mb-3">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-primary rounded-full"
                      animate={{
                        height: Math.max(4, audioLevel * 32 * (1 + Math.sin(i * 0.5 + Date.now() * 0.01) * 0.3)),
                      }}
                      transition={{ duration: 0.1 }}
                    />
                  ))}
                </div>
              )}

              {/* Source Preview */}
              {hasAudioSource && !isRecording && (
                <div className="flex items-center gap-2 bg-background/50 rounded-xl p-3">
                  <FileAudio className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground flex-1 font-myanmar truncate">
                    {uploadedFile ? uploadedFile.name : "အသံဖမ်းထားပြီး"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      resetRecording();
                      removeUploadedFile();
                    }}
                    className="text-destructive h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="gradient-card rounded-xl p-3 border border-primary/20">
              <label className="block text-xs font-medium text-primary mb-2 font-myanmar">
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

            {/* Progress Bar */}
            {isTranscribing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-myanmar">စာသားပြောင်းနေသည်...</span>
                  <span>{Math.round(sttProgress)}%</span>
                </div>
                <Progress value={sttProgress} className="h-2" />
              </div>
            )}

            <Button
              onClick={handleTranscribe}
              disabled={isTranscribing || !hasAudioSource}
              className="w-full btn-gradient-green py-4 rounded-2xl font-semibold font-myanmar"
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
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="gradient-card rounded-2xl p-4 border border-success/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-primary font-myanmar">ရလဒ်</h3>
                  <Button onClick={copyToClipboard} size="sm" variant="outline" className="text-xs font-myanmar">
                    <Download className="w-3 h-3 mr-1" />
                    ကူးယူမည်
                  </Button>
                </div>
                <div className="bg-background/50 rounded-xl p-3 border border-border">
                  <p className="text-sm text-foreground whitespace-pre-wrap font-myanmar leading-relaxed">
                    {transcribedText}
                  </p>
                </div>
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
