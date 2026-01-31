import { useState, useEffect } from "react";
import { ExternalLink, CheckCircle, XCircle, Loader2, X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/hooks/useAppSettings";

interface Campaign {
  id: string;
  user_id: string;
  fb_link: string | null;
  tiktok_link: string | null;
  link: string;
  platform: string;
  status: string;
  admin_notes: string | null;
  credits_awarded: number | null;
  created_at: string;
  user_email?: string;
}

export const CampaignSubmissionsTab = () => {
  const { toast } = useToast();
  const { settings } = useAppSettings();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchCampaigns();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel("campaigns-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaigns" },
        () => fetchCampaigns()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (campaign: Campaign) => {
    setProcessingId(campaign.id);
    const rewardAmount = settings.campaign_approval_reward;
    
    try {
      // Update campaign status
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({ 
          status: "approved", 
          credits_awarded: rewardAmount 
        })
        .eq("id", campaign.id);

      if (updateError) throw updateError;

      // Add credits to user
      const { data: creditResult, error: creditError } = await supabase.rpc("add_user_credits", {
        _user_id: campaign.user_id,
        _amount: rewardAmount,
      });

      if (creditError) throw creditError;

      // Add to audit log
      await supabase.from("credit_audit_log").insert({
        user_id: campaign.user_id,
        amount: rewardAmount,
        credit_type: "campaign_reward",
        description: "Campaign review video approval reward",
      });

      toast({
        title: "Campaign အတည်ပြုပြီး",
        description: `${rewardAmount} Credits ထည့်သွင်းပေးပြီးပါပြီ`,
      });

      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (campaignId: string) => {
    if (!rejectReason.trim()) {
      toast({
        title: "ငြင်းပယ်ရသည့် အကြောင်းပြချက် ထည့်ပါ",
        variant: "destructive",
      });
      return;
    }

    setProcessingId(campaignId);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ 
          status: "rejected",
          admin_notes: rejectReason,
        })
        .eq("id", campaignId);

      if (error) throw error;

      toast({
        title: "Campaign ငြင်းပယ်ပြီး",
        description: "အကြောင်းပြချက်ကို သိမ်းဆည်းပြီးပါပြီ",
      });

      setShowRejectModal(null);
      setRejectReason("");
      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("my-MM", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-500">အတည်ပြုပြီး</span>;
      case "rejected":
        return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-500">ငြင်းပယ်ပြီး</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-500">စောင့်ဆိုင်းဆဲ</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = campaigns.filter(c => c.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="gradient-card rounded-xl p-3 border border-primary/20 text-center">
          <p className="text-2xl font-bold text-foreground">{campaigns.length}</p>
          <p className="text-xs text-muted-foreground">စုစုပေါင်း</p>
        </div>
        <div className="gradient-card rounded-xl p-3 border border-yellow-500/20 text-center">
          <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">စောင့်ဆိုင်းဆဲ</p>
        </div>
        <div className="gradient-card rounded-xl p-3 border border-green-500/20 text-center">
          <p className="text-2xl font-bold text-green-500">{campaigns.filter(c => c.status === "approved").length}</p>
          <p className="text-xs text-muted-foreground">အတည်ပြုပြီး</p>
        </div>
      </div>

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Campaign တင်သူ မရှိသေးပါ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="gradient-card rounded-xl p-4 border border-border/50"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                    {campaign.user_id.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(campaign.created_at)}
                  </p>
                </div>
                {getStatusBadge(campaign.status)}
              </div>

              {/* Links */}
              <div className="space-y-2 mb-3">
                {campaign.fb_link && (
                  <a
                    href={campaign.fb_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 truncate"
                  >
                    <span className="text-blue-500">📘</span>
                    <span className="truncate">{campaign.fb_link}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                )}
                {campaign.tiktok_link && (
                  <a
                    href={campaign.tiktok_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-pink-400 hover:text-pink-300 truncate"
                  >
                    <span>🎵</span>
                    <span className="truncate">{campaign.tiktok_link}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                )}
                {/* Fallback to legacy link if no fb/tiktok links */}
                {!campaign.fb_link && !campaign.tiktok_link && campaign.link && (
                  <a
                    href={campaign.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 truncate"
                  >
                    <span className="truncate">{campaign.link}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                )}
              </div>

              {/* Admin notes for rejected */}
              {campaign.status === "rejected" && campaign.admin_notes && (
                <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">
                    <strong>ငြင်းပယ်ရသည့် အကြောင်းပြချက်:</strong> {campaign.admin_notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              {campaign.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(campaign)}
                    disabled={processingId === campaign.id}
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {processingId === campaign.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve (+{settings.campaign_approval_reward})
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowRejectModal(campaign.id)}
                    disabled={processingId === campaign.id}
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="gradient-card rounded-2xl p-6 max-w-md w-full border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground font-myanmar">ငြင်းပယ်ရသည့် အကြောင်းပြချက်</h3>
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason("");
                }}
                className="p-1 rounded-full hover:bg-secondary/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="ငြင်းပယ်ရသည့် အကြောင်းပြချက် ရေးပါ..."
              className="mb-4 font-myanmar"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleReject(showRejectModal)}
                disabled={!rejectReason.trim() || processingId === showRejectModal}
                variant="destructive"
                className="flex-1"
              >
                {processingId === showRejectModal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "ငြင်းပယ်မည်"
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason("");
                }}
                variant="outline"
                className="flex-1"
              >
                မလုပ်တော့ပါ
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
