import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Video, Upload, Play, Pause, Scissors, 
  Clock, Gauge, Download, X, 
  Loader2, ZoomIn, ZoomOut, RotateCw, FlipHorizontal,
  Type, Film, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useToolOutput } from "@/hooks/useToolOutput";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VideoEditorProps {
  userId?: string;
}

interface VideoClip {
  id: string;
  file: File;
  url: string;
  duration: number;
  startTime: number;
  endTime: number;
  speed: number;
  track: number;
  rotation: number;
  flipH: boolean;
  filter: string;
  textOverlay?: string;
}

const FILTERS = [
  { id: "none", name: "Original", css: "" },
  { id: "cinema", name: "Cinema", css: "sepia(30%) contrast(110%) saturate(120%)" },
  { id: "vintage", name: "Vintage", css: "sepia(50%) contrast(90%) brightness(90%)" },
  { id: "bw", name: "B&W", css: "grayscale(100%)" },
  { id: "vivid", name: "Vivid", css: "saturate(150%) contrast(110%)" },
  { id: "natural", name: "Natural", css: "saturate(90%) brightness(105%)" },
];

export const VideoEditor = ({ userId }: VideoEditorProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const { saveOutput } = useToolOutput("video-editor", "Video Editor");
  
  const [isOpen, setIsOpen] = useState(false);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (clips.length === 0) {
      setTotalDuration(0);
      return;
    }
    const maxEnd = Math.max(...clips.map(c => c.endTime));
    setTotalDuration(maxEnd);
  }, [clips]);

  useEffect(() => {
    if (videoRef.current && clips.length > 0) {
      const activeClip = clips.find(c => 
        currentTime >= c.startTime && currentTime < c.endTime
      );
      if (activeClip) {
        if (videoRef.current.src !== activeClip.url) {
          videoRef.current.src = activeClip.url;
        }
        videoRef.current.playbackRate = activeClip.speed;
        videoRef.current.style.filter = activeClip.filter;
        videoRef.current.style.transform = `rotate(${activeClip.rotation}deg) scaleX(${activeClip.flipH ? -1 : 1})`;
      }
    }
  }, [currentTime, clips, selectedClip]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      video.onloadedmetadata = () => {
        const newClip: VideoClip = {
          id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          url,
          duration: video.duration,
          startTime: totalDuration,
          endTime: totalDuration + video.duration,
          speed: 1,
          track: 0,
          rotation: 0,
          flipH: false,
          filter: "",
        };
        setClips(prev => [...prev, newClip]);
      };
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveClip = (clipId: string) => {
    setClips(prev => {
      const filtered = prev.filter(c => c.id !== clipId);
      let currentStart = 0;
      return filtered.map(clip => {
        const duration = clip.endTime - clip.startTime;
        const updated = {
          ...clip,
          startTime: currentStart,
          endTime: currentStart + duration,
        };
        currentStart += duration;
        return updated;
      });
    });
    if (selectedClip === clipId) setSelectedClip(null);
  };

  const handleSplitClip = () => {
    if (!selectedClip) {
      toast({
        title: "ဗီဒီယိုရွေးပါ",
        description: "ဖြတ်ရန် ဗီဒီယိုတစ်ခုကို ရွေးပါ",
        variant: "destructive",
      });
      return;
    }

    const clip = clips.find(c => c.id === selectedClip);
    if (!clip) return;

    const splitPoint = clip.startTime + (clip.endTime - clip.startTime) / 2;
    
    const firstHalf: VideoClip = { ...clip, id: `${clip.id}-a`, endTime: splitPoint };
    const secondHalf: VideoClip = { ...clip, id: `${clip.id}-b`, startTime: splitPoint };

    setClips(prev => {
      const index = prev.findIndex(c => c.id === selectedClip);
      const newClips = [...prev];
      newClips.splice(index, 1, firstHalf, secondHalf);
      return newClips;
    });

    toast({ title: "ဖြတ်ပြီးပါပြီ", description: "ဗီဒီယိုကို ၂ ပိုင်း ဖြတ်ပြီးပါပြီ" });
  };

  const updateClip = (updates: Partial<VideoClip>) => {
    if (!selectedClip) return;
    setClips(prev => prev.map(clip => 
      clip.id === selectedClip ? { ...clip, ...updates } : clip
    ));
  };

  const handleRotate = () => {
    if (!selectedClip) return;
    const clip = clips.find(c => c.id === selectedClip);
    if (clip) {
      updateClip({ rotation: (clip.rotation + 90) % 360 });
    }
  };

  const handleFlip = () => {
    if (!selectedClip) return;
    const clip = clips.find(c => c.id === selectedClip);
    if (clip) {
      updateClip({ flipH: !clip.flipH });
    }
  };

  const handleAddText = () => {
    if (!selectedClip || !textInput.trim()) return;
    updateClip({ textOverlay: textInput });
    setTextInput("");
    setShowTextInput(false);
    toast({ title: "စာသားထည့်ပြီး", description: "Text overlay ထည့်ပြီးပါပြီ" });
  };

  const handleFilterChange = (filterId: string) => {
    const filter = FILTERS.find(f => f.id === filterId);
    if (filter) {
      updateClip({ filter: filter.css });
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleExport = async () => {
    if (clips.length === 0) {
      toast({
        title: "ဗီဒီယိုမရှိပါ",
        description: "Export လုပ်ရန် ဗီဒီယိုထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    const exportCost = costs.video_export || 3;
    
    if (!userId) {
      toast({
        title: "အကောင့်ဝင်ပါ",
        description: "Export လုပ်ရန် အကောင့်ဝင်ပါ",
        variant: "destructive",
      });
      return;
    }

    if (credits < exportCost) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `Export လုပ်ရန် ${exportCost} Credits လိုအပ်ပါသည်`,
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setExportProgress(i);
      }

      const { error } = await supabase.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: exportCost,
        _action: "Video Editor Export"
      });

      if (error) throw error;

      if (clips[0]) {
        const link = document.createElement("a");
        link.href = clips[0].url;
        link.download = `edited-video-${Date.now()}.mp4`;
        link.click();
        // Save output to Store
        saveOutput("video", clips[0].url);
      }

      refetchCredits();
      toast({
        title: "Export အောင်မြင်ပါပြီ",
        description: `ဗီဒီယိုကို Export လုပ်ပြီးပါပြီ (${exportCost} Credits)`,
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: "Export မအောင်မြင်ပါ",
        description: error.message || "ထပ်ကြိုးစားပါ",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const selectedClipData = clips.find(c => c.id === selectedClip);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* Compact Card Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full gradient-card rounded-2xl p-4 border border-primary/20 flex items-center justify-between hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground font-myanmar">ဗီဒီယို တည်းဖြတ်မည်</h3>
            <p className="text-xs text-muted-foreground font-myanmar">Trim, Speed, Filter, Text</p>
          </div>
        </div>
        <div className="text-xs text-primary font-medium">
          Export: {costs.video_export || 3} Credits
        </div>
      </button>

      {/* Full Screen Editor Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-full h-[95vh] p-0 gap-0">
          <DialogHeader className="p-3 border-b border-border/50 flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 font-myanmar">
              <Film className="w-5 h-5 text-primary" />
              ဗီဒီယို တည်းဖြတ်မည်
            </DialogTitle>
            <Button
              onClick={handleExport}
              disabled={isExporting || clips.length === 0}
              size="sm"
              className="btn-gradient-blue font-myanmar"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  {exportProgress}%
                </>
              ) : (
                <>
                  <Download className="w-3 h-3 mr-1" />
                  Export ({costs.video_export || 3})
                </>
              )}
            </Button>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Preview Area */}
            <div className="relative bg-black/95 flex-1 flex items-center justify-center min-h-[200px]">
              {clips.length > 0 ? (
                <>
                  <video
                    ref={videoRef}
                    className="max-h-full max-w-full transition-transform"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onEnded={() => setIsPlaying(false)}
                  />
                  {selectedClipData?.textOverlay && (
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <span className="bg-black/70 text-white px-4 py-2 rounded-lg font-myanmar text-lg">
                        {selectedClipData.textOverlay}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-12 h-12 text-white/80" />
                    ) : (
                      <Play className="w-12 h-12 text-white/80" />
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Upload className="w-12 h-12" />
                  <span className="text-sm font-myanmar">ဗီဒီယိုထည့်ရန် နှိပ်ပါ</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Tool Bar */}
            <div className="flex items-center justify-between p-2 border-t border-b border-border/50 bg-background/50 gap-1 flex-wrap">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSplitClip} disabled={!selectedClip}>
                  <Scissors className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRotate} disabled={!selectedClip}>
                  <RotateCw className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFlip} disabled={!selectedClip}>
                  <FlipHorizontal className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTextInput(true)} disabled={!selectedClip}>
                  <Type className="w-4 h-4" />
                </Button>
              </div>
              
              <span className="text-xs text-muted-foreground font-mono">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(3, z + 0.25))}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Timeline */}
            <div 
              className="relative h-20 overflow-x-auto bg-background/30 p-2"
              style={{ minWidth: `${Math.max(300, totalDuration * 50 * zoom)}px` }}
            >
              <div className="relative h-14 bg-muted/30 rounded-lg overflow-hidden">
                {clips.map((clip) => (
                  <motion.div
                    key={clip.id}
                    layoutId={clip.id}
                    onClick={() => setSelectedClip(clip.id)}
                    className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all ${
                      selectedClip === clip.id
                        ? "bg-primary ring-2 ring-primary ring-offset-1"
                        : "bg-primary/60 hover:bg-primary/80"
                    }`}
                    style={{
                      left: `${clip.startTime * 50 * zoom}px`,
                      width: `${(clip.endTime - clip.startTime) * 50 * zoom}px`,
                    }}
                  >
                    <div className="flex items-center justify-between h-full px-2">
                      <span className="text-[10px] text-primary-foreground truncate">
                        {clip.file.name.slice(0, 8)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveClip(clip.id); }}
                        className="p-0.5 hover:bg-white/20 rounded"
                      >
                        <X className="w-3 h-3 text-primary-foreground" />
                      </button>
                    </div>
                    {clip.speed !== 1 && (
                      <div className="absolute bottom-0.5 left-1 text-[8px] text-primary-foreground/80 bg-black/30 px-1 rounded">
                        {clip.speed}x
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
              
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                style={{ left: `${currentTime * 50 * zoom + 8}px` }}
              >
                <div className="w-2 h-2 bg-red-500 rounded-full -translate-x-[3px] -translate-y-1" />
              </div>
            </div>

            {/* Selected Clip Controls */}
            <AnimatePresence>
              {selectedClipData && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border/50 overflow-hidden"
                >
                  <div className="p-3 space-y-3 bg-background/50">
                    {/* Speed Control */}
                    <div className="flex items-center gap-3">
                      <Gauge className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground font-myanmar w-16">အမြန်နှုန်း</span>
                      <Slider
                        value={[selectedClipData.speed]}
                        onValueChange={([v]) => updateClip({ speed: v })}
                        min={0.1}
                        max={10}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="text-xs font-mono w-10 text-right">{selectedClipData.speed.toFixed(1)}x</span>
                    </div>

                    {/* Trim Control */}
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground font-myanmar w-16">Trim</span>
                      <Slider
                        value={[selectedClipData.startTime, selectedClipData.endTime]}
                        onValueChange={([start, end]) => updateClip({ startTime: start, endTime: end })}
                        min={0}
                        max={selectedClipData.startTime + selectedClipData.duration}
                        step={0.1}
                        className="flex-1"
                      />
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground font-myanmar w-16">Filter</span>
                      <div className="flex gap-1 flex-wrap">
                        {FILTERS.map((f) => (
                          <Button
                            key={f.id}
                            size="sm"
                            variant={selectedClipData.filter === f.css ? "default" : "outline"}
                            onClick={() => handleFilterChange(f.id)}
                            className="text-[10px] h-6 px-2"
                          >
                            {f.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Text Input Dialog */}
      <Dialog open={showTextInput} onOpenChange={setShowTextInput}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-myanmar">စာသားထည့်ပါ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="မြန်မာ/English စာသား..."
              className="font-myanmar"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowTextInput(false)}>ပယ်ဖျက်</Button>
              <Button onClick={handleAddText}>ထည့်မည်</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
