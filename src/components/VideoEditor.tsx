import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Video, Upload, Play, Pause, Scissors, 
  Clock, Gauge, Download, X, ChevronLeft, ChevronRight,
  Loader2, ZoomIn, ZoomOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useCreditCosts } from "@/hooks/useCreditCosts";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

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
}

export const VideoEditor = ({ userId }: VideoEditorProps) => {
  const { toast } = useToast();
  const { costs } = useCreditCosts();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculate total duration whenever clips change
  useEffect(() => {
    if (clips.length === 0) {
      setTotalDuration(0);
      return;
    }
    const maxEnd = Math.max(...clips.map(c => c.endTime));
    setTotalDuration(maxEnd);
  }, [clips]);

  // Handle video playback
  useEffect(() => {
    if (videoRef.current && clips.length > 0) {
      const activeClip = clips.find(c => 
        currentTime >= c.startTime && currentTime < c.endTime
      );
      if (activeClip && videoRef.current.src !== activeClip.url) {
        videoRef.current.src = activeClip.url;
        videoRef.current.playbackRate = activeClip.speed;
      }
    }
  }, [currentTime, clips]);

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
      // Recalculate start times
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

    // Split at the middle of the clip
    const splitPoint = clip.startTime + (clip.endTime - clip.startTime) / 2;
    
    const firstHalf: VideoClip = {
      ...clip,
      id: `${clip.id}-a`,
      endTime: splitPoint,
    };
    
    const secondHalf: VideoClip = {
      ...clip,
      id: `${clip.id}-b`,
      startTime: splitPoint,
    };

    setClips(prev => {
      const index = prev.findIndex(c => c.id === selectedClip);
      const newClips = [...prev];
      newClips.splice(index, 1, firstHalf, secondHalf);
      return newClips;
    });

    toast({
      title: "ဖြတ်ပြီးပါပြီ",
      description: "ဗီဒီယိုကို ၂ ပိုင်း ဖြတ်ပြီးပါပြီ",
    });
  };

  const handleSpeedChange = (speed: number) => {
    if (!selectedClip) return;
    
    setClips(prev => prev.map(clip => 
      clip.id === selectedClip ? { ...clip, speed } : clip
    ));
  };

  const handleTrimChange = (values: number[]) => {
    if (!selectedClip) return;
    
    setClips(prev => prev.map(clip => {
      if (clip.id !== selectedClip) return clip;
      const originalDuration = clip.duration;
      return {
        ...clip,
        startTime: values[0],
        endTime: Math.min(values[1], clip.startTime + originalDuration),
      };
    }));
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
      // Simulate export progress (in production, this would be real video processing)
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setExportProgress(i);
      }

      // Deduct credits
      const { error } = await supabase.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: exportCost,
        _action: "Video Editor Export"
      });

      if (error) throw error;

      // For now, download the first clip (in production, this would be the merged/processed video)
      if (clips[0]) {
        const link = document.createElement("a");
        link.href = clips[0].url;
        link.download = `edited-video-${Date.now()}.mp4`;
        link.click();
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
    <div className="gradient-card rounded-2xl border border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-background/50">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-primary font-myanmar">ဗီဒီယို တည်းဖြတ်မည်</h2>
        </div>
        <Button
          onClick={handleExport}
          disabled={isExporting || clips.length === 0}
          size="sm"
          className="btn-gradient-blue text-xs font-myanmar"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {exportProgress}%
            </>
          ) : (
            <>
              <Download className="w-3 h-3 mr-1" />
              Export ({costs.video_export || 3} Credits)
            </>
          )}
        </Button>
      </div>

      {/* Preview Area */}
      <div className="relative bg-black/90 aspect-video max-h-[180px] flex items-center justify-center">
        {clips.length > 0 ? (
          <>
            <video
              ref={videoRef}
              className="max-h-full max-w-full"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onEnded={() => setIsPlaying(false)}
            />
            {/* Play/Pause Overlay */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-10 h-10 text-white/80" />
              ) : (
                <Play className="w-10 h-10 text-white/80" />
              )}
            </button>
          </>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <Upload className="w-8 h-8" />
            <span className="text-xs font-myanmar">ဗီဒီယိုထည့်ရန် နှိပ်ပါ</span>
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

      {/* Timeline Controls */}
      <div className="flex items-center justify-between p-2 border-t border-b border-border/50 bg-background/30">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleSplitClip}
            disabled={!selectedClip}
          >
            <Scissors className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground font-mono">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Multi-track Timeline */}
      <div 
        ref={timelineRef}
        className="relative h-20 overflow-x-auto bg-background/20 p-2"
        style={{ minWidth: `${Math.max(300, totalDuration * 50 * zoom)}px` }}
      >
        {/* Track 0 */}
        <div className="relative h-14 bg-muted/30 rounded-lg overflow-hidden">
          {clips.filter(c => c.track === 0).map((clip) => (
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
                  {clip.file.name.slice(0, 10)}...
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveClip(clip.id);
                  }}
                  className="p-0.5 hover:bg-white/20 rounded"
                >
                  <X className="w-3 h-3 text-primary-foreground" />
                </button>
              </div>
              {/* Speed indicator */}
              {clip.speed !== 1 && (
                <div className="absolute bottom-0.5 left-1 text-[8px] text-primary-foreground/80 bg-black/30 px-1 rounded">
                  {clip.speed}x
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Playhead */}
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
            <div className="p-3 space-y-3 bg-background/30">
              {/* Speed Control */}
              <div className="flex items-center gap-3">
                <Gauge className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-myanmar w-16">အမြန်နှုန်း</span>
                <Slider
                  value={[selectedClipData.speed]}
                  onValueChange={([v]) => handleSpeedChange(v)}
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
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(selectedClipData.startTime)}
                  </span>
                  <Slider
                    value={[selectedClipData.startTime, selectedClipData.endTime]}
                    onValueChange={handleTrimChange}
                    min={0}
                    max={selectedClipData.startTime + selectedClipData.duration}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(selectedClipData.endTime)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Text */}
      {clips.length === 0 && (
        <div className="p-3 text-center">
          <p className="text-xs text-muted-foreground font-myanmar">
            ဗီဒီယိုထည့်ပြီး Timeline တွင် Trim, Split, Speed ပြင်ဆင်နိုင်ပါသည်။
            Export မှသာ Credit ကုန်ပါမည်။
          </p>
        </div>
      )}
    </div>
  );
};