import { useState, useEffect } from "react";
import { Film, Loader2, Play, Calendar, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AdminVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  template_category: string;
  target_language: string;
  generation_status: string;
  generated_date: string;
  created_at: string;
}

interface AdminVideoTabProps {
  userId: string;
}

export const AdminVideoTab = ({ userId }: AdminVideoTabProps) => {
  const { toast } = useToast();
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVideos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("auto_service_videos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchVideos(); }, [userId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" />
          My Auto Videos
        </h2>
        <Button variant="outline" size="sm" onClick={fetchVideos}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Admin ၏ Auto Daily Video များကို ဤနေရာတွင် ကြည့်ရှုနိုင်ပါသည်။
      </p>

      {videos.length === 0 ? (
        <div className="gradient-card rounded-2xl p-12 border border-border/30 text-center">
          <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-myanmar">Auto Video များ မရှိသေးပါ</p>
          <p className="text-xs text-muted-foreground mt-1">Auto Service မှ ဗီဒီယိုများ ထုတ်လုပ်ပြီးသည်နှင့် ဤနေရာတွင် ပေါ်လာပါမည်</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map(video => (
            <div key={video.id} className="gradient-card rounded-2xl p-4 border border-border/30">
              <div className="flex items-start gap-3">
                {video.thumbnail_url ? (
                  <img src={video.thumbnail_url} alt={video.title} className="w-20 h-14 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-20 h-14 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
                    <Play className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground truncate">{video.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary">{video.template_category}</span>
                    <span className="text-[10px] text-muted-foreground">{video.target_language}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(video.generated_date).toLocaleDateString("my-MM")}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      video.generation_status === "completed" ? "bg-green-500/20 text-green-500"
                      : video.generation_status === "failed" ? "bg-red-500/20 text-red-500"
                      : "bg-yellow-500/20 text-yellow-500"
                    }`}>
                      {video.generation_status}
                    </span>
                  </div>
                </div>
                {video.video_url && (
                  <a href={video.video_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <Download className="w-3 h-3" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
