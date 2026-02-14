import { useState, useEffect } from "react";
import { Film, Loader2, Play, Calendar, RefreshCw, Download, Trash2, Copy, Hash } from "lucide-react";
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

interface DailyContentVideo {
  id: string;
  video_type: string;
  title: string;
  description: string | null;
  video_url: string | null;
  facebook_caption: string | null;
  hashtags: string[] | null;
  api_cost_credits: number | null;
  is_published: boolean | null;
  generated_date: string;
  created_at: string;
}

interface AdminVideoTabProps {
  userId: string;
}

export const AdminVideoTab = ({ userId }: AdminVideoTabProps) => {
  const { toast } = useToast();
  const [autoVideos, setAutoVideos] = useState<AdminVideo[]>([]);
  const [dailyVideos, setDailyVideos] = useState<DailyContentVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"daily" | "auto">("daily");

  const fetchVideos = async () => {
    setIsLoading(true);
    try {
      const [autoRes, dailyRes] = await Promise.all([
        supabase
          .from("auto_service_videos")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("daily_content_videos")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (autoRes.error) throw autoRes.error;
      if (dailyRes.error) throw dailyRes.error;
      setAutoVideos(autoRes.data || []);
      setDailyVideos((dailyRes.data as DailyContentVideo[]) || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchVideos(); }, [userId]);

  const deleteDailyVideo = async (id: string) => {
    try {
      const { error } = await supabase.from("daily_content_videos").delete().eq("id", id);
      if (error) throw error;
      setDailyVideos(prev => prev.filter(v => v.id !== id));
      toast({ title: "ဖျက်ပြီးပါပြီ" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "ကူးယူပြီးပါပြီ" });
  };

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
          My Videos
        </h2>
        <Button variant="outline" size="sm" onClick={fetchVideos}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeSection === "daily" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSection("daily")}
          className="rounded-xl text-xs"
        >
          📺 Daily Content ({dailyVideos.length})
        </Button>
        <Button
          variant={activeSection === "auto" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSection("auto")}
          className="rounded-xl text-xs"
        >
          🤖 Auto Service ({autoVideos.length})
        </Button>
      </div>

      {/* Daily Content Videos */}
      {activeSection === "daily" && (
        <div className="space-y-3">
          {dailyVideos.length === 0 ? (
            <div className="gradient-card rounded-2xl p-12 border border-border/30 text-center">
              <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-myanmar">Daily Content မရှိသေးပါ</p>
            </div>
          ) : (
            dailyVideos.map(video => (
              <div key={video.id} className="gradient-card rounded-2xl p-4 border border-border/30">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{video.video_type}</span>
                      <span className="text-xs text-muted-foreground">{video.generated_date}</span>
                      {video.is_published && (
                        <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">Published</span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-foreground">{video.title}</h4>
                    {video.api_cost_credits && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        API Cost: {Number(video.api_cost_credits).toFixed(1)} credits
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {video.video_url && (
                      <a href={video.video_url} target="_blank" rel="noopener noreferrer" download>
                        <Button variant="outline" size="icon" className="h-7 w-7">
                          <Download className="w-3 h-3" />
                        </Button>
                      </a>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDailyVideo(video.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Description */}
                {video.description && (
                  <div className="mt-2 p-2 bg-secondary/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Script</span>
                      <Button variant="ghost" size="sm" onClick={() => copyText(video.description!)} className="h-5 px-2">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-foreground line-clamp-4 whitespace-pre-wrap">{video.description}</p>
                  </div>
                )}

                {/* Facebook Caption */}
                {video.facebook_caption && (
                  <div className="mt-2 p-2 bg-secondary/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Facebook Caption</span>
                      <Button variant="ghost" size="sm" onClick={() => copyText(video.facebook_caption!)} className="h-5 px-2">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{video.facebook_caption}</p>
                  </div>
                )}

                {/* Hashtags */}
                {video.hashtags && video.hashtags.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <Hash className="w-3 h-3 text-muted-foreground" />
                    {video.hashtags.map((tag, i) => (
                      <span key={i} className="text-xs text-primary">#{tag}</span>
                    ))}
                    <Button variant="ghost" size="sm"
                      onClick={() => copyText(video.hashtags!.map(t => `#${t}`).join(" "))}
                      className="h-5 px-1">
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {!video.video_url && (
                  <p className="text-[10px] text-yellow-500 mt-2 font-myanmar">
                    ⚠️ Script သာ ထုတ်ထားပါသည် - Video rendering မပြီးသေးပါ
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Auto Service Videos */}
      {activeSection === "auto" && (
        <div className="space-y-3">
          {autoVideos.length === 0 ? (
            <div className="gradient-card rounded-2xl p-12 border border-border/30 text-center">
              <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-myanmar">Auto Video များ မရှိသေးပါ</p>
            </div>
          ) : (
            autoVideos.map(video => (
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
                    <a href={video.video_url} target="_blank" rel="noopener noreferrer" download>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <Download className="w-3 h-3" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
