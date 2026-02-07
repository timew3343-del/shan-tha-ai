import { useState, useEffect } from "react";
import { MessageSquare, Trash2, Loader2, Mail, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FeedbackItem {
  id: string;
  user_name: string | null;
  user_email: string | null;
  message: string;
  created_at: string;
}

export const UserFeedbackTab = () => {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFeedback = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_feedback")
        .select("id, user_name, user_email, message, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedback(data || []);
    } catch (error: any) {
      toast({ title: "Error loading feedback", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("user_feedback").delete().eq("id", id);
      if (error) throw error;
      setFeedback(prev => prev.filter(f => f.id !== id));
      toast({ title: "ဖျက်ပြီးပါပြီ" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          User Feedback ({feedback.length})
        </h3>
        <Button variant="outline" size="sm" onClick={fetchFeedback}>
          Refresh
        </Button>
      </div>

      {feedback.length === 0 ? (
        <div className="gradient-card rounded-2xl p-8 border border-border/30 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Feedback မရှိသေးပါ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => (
            <div key={item.id} className="gradient-card rounded-2xl p-4 border border-border/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground truncate">
                      {item.user_name || "Unknown User"}
                    </span>
                  </div>
                  {item.user_email && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <Mail className="w-3 h-3" />
                      {item.user_email}
                    </div>
                  )}
                  <p className="text-sm text-foreground font-myanmar whitespace-pre-wrap">{item.message}</p>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2">
                    <Calendar className="w-3 h-3" />
                    {new Date(item.created_at).toLocaleString("my-MM")}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
