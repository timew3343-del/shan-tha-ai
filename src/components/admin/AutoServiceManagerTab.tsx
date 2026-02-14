import { useState, useEffect } from "react";
import { Zap, Users, CreditCard, Clock, CheckCircle, XCircle, Mail, MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Subscriber {
  id: string;
  user_id: string;
  plan_id: string | null;
  template_category: string;
  target_language: string;
  status: string;
  credits_paid: number;
  starts_at: string;
  expires_at: string;
  user_email?: string;
  plan_name?: string;
}

interface SupportTicket {
  id: string;
  user_id: string;
  message: string;
  issue_type: string;
  status: string;
  ai_response: string | null;
  admin_response: string | null;
  is_escalated: boolean | null;
  created_at: string;
  user_email?: string;
}

interface ServiceStats {
  totalSubscribers: number;
  activeSubscribers: number;
  expiredSubscribers: number;
  totalCreditsEarned: number;
}

export const AutoServiceManagerTab = () => {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<ServiceStats>({ totalSubscribers: 0, activeSubscribers: 0, expiredSubscribers: 0, totalCreditsEarned: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"summary" | "subscribers" | "feedback">("summary");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch subscriptions
      const { data: subs, error: subsError } = await supabase
        .from("auto_service_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (subsError) throw subsError;

      // Fetch plans for names
      const { data: plans } = await supabase
        .from("auto_service_plans")
        .select("id, name");

      const planMap = new Map(plans?.map(p => [p.id, p.name]) || []);

      // Fetch user emails
      const userIds = [...new Set(subs?.map(s => s.user_id) || [])];
      const emailMap = new Map<string, string>();
      for (const uid of userIds) {
        const { data: emailData } = await supabase.rpc("get_user_email", { _user_id: uid });
        if (emailData) emailMap.set(uid, emailData);
      }

      const enrichedSubs: Subscriber[] = (subs || []).map(s => ({
        ...s,
        user_email: emailMap.get(s.user_id) || "Unknown",
        plan_name: s.plan_id ? planMap.get(s.plan_id) || "Unknown" : "Unknown",
      }));

      setSubscribers(enrichedSubs);

      // Calculate stats
      const active = enrichedSubs.filter(s => s.status === "active").length;
      const expired = enrichedSubs.filter(s => s.status === "expired" || new Date(s.expires_at) < new Date()).length;
      const totalCredits = enrichedSubs.reduce((sum, s) => sum + s.credits_paid, 0);

      setStats({
        totalSubscribers: enrichedSubs.length,
        activeSubscribers: active,
        expiredSubscribers: expired,
        totalCreditsEarned: totalCredits,
      });

      // Fetch support tickets
      const { data: ticketData, error: ticketError } = await supabase
        .from("auto_service_support")
        .select("*")
        .order("created_at", { ascending: false });

      if (ticketError) throw ticketError;

      const ticketUserIds = [...new Set(ticketData?.map(t => t.user_id) || [])];
      for (const uid of ticketUserIds) {
        if (!emailMap.has(uid)) {
          const { data: emailData } = await supabase.rpc("get_user_email", { _user_id: uid });
          if (emailData) emailMap.set(uid, emailData);
        }
      }

      setTickets((ticketData || []).map(t => ({
        ...t,
        user_email: emailMap.get(t.user_id) || "Unknown",
      })));

    } catch (error: any) {
      toast({ title: "Error loading data", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRespondTicket = async (ticketId: string, response: string) => {
    try {
      const { error } = await supabase
        .from("auto_service_support")
        .update({ admin_response: response, status: "resolved" })
        .eq("id", ticketId);
      if (error) throw error;
      toast({ title: "တုံ့ပြန်ပြီးပါပြီ" });
      fetchData();
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
          <Zap className="w-5 h-5 text-primary" />
          Auto Service Manager
        </h3>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2">
        {[
          { id: "summary" as const, label: "Summary", icon: CreditCard },
          { id: "subscribers" as const, label: "Subscribers", icon: Users },
          { id: "feedback" as const, label: "Feedback", icon: MessageSquare },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              activeSection === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Section */}
      {activeSection === "summary" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Subscribers</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.totalSubscribers}</p>
            </div>
            <div className="gradient-card rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Credits Earned</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.totalCreditsEarned}</p>
            </div>
            <div className="gradient-card rounded-2xl p-4 border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.activeSubscribers}</p>
            </div>
            <div className="gradient-card rounded-2xl p-4 border border-red-500/20">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Expired</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.expiredSubscribers}</p>
            </div>
          </div>
        </div>
      )}

      {/* Subscribers Section */}
      {activeSection === "subscribers" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Subscribers: {subscribers.length}</p>
          {subscribers.length === 0 ? (
            <div className="gradient-card rounded-2xl p-8 border border-border/30 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Subscriber မရှိသေးပါ</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Gmail</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs">Credits</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map(sub => (
                    <TableRow key={sub.id}>
                      <TableCell className="text-xs font-medium">{sub.user_email}</TableCell>
                      <TableCell className="text-xs">{sub.plan_name}</TableCell>
                      <TableCell className="text-xs font-semibold text-primary">{sub.credits_paid}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          sub.status === "active" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                        }`}>
                          {sub.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {new Date(sub.expires_at).toLocaleDateString("my-MM")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Feedback/Support Section */}
      {activeSection === "feedback" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Support Tickets: {tickets.length} | Escalated: {tickets.filter(t => t.is_escalated).length}
          </p>
          {tickets.length === 0 ? (
            <div className="gradient-card rounded-2xl p-8 border border-border/30 text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Support ticket မရှိသေးပါ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(ticket => (
                <div key={ticket.id} className={`gradient-card rounded-2xl p-4 border ${
                  ticket.is_escalated ? "border-red-500/30" : "border-border/30"
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground truncate">{ticket.user_email}</span>
                        {ticket.is_escalated && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-500">Escalated</span>
                        )}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        ticket.status === "open" ? "bg-yellow-500/20 text-yellow-500"
                        : ticket.status === "resolved" ? "bg-green-500/20 text-green-500"
                        : "bg-secondary text-muted-foreground"
                      }`}>
                        {ticket.status} • {ticket.issue_type}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(ticket.created_at).toLocaleDateString("my-MM")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground font-myanmar whitespace-pre-wrap mb-2">{ticket.message}</p>
                  {ticket.ai_response && (
                    <div className="p-2 bg-primary/5 rounded-lg mb-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">AI Response:</p>
                      <p className="text-xs text-foreground">{ticket.ai_response}</p>
                    </div>
                  )}
                  {ticket.admin_response ? (
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Admin Response:</p>
                      <p className="text-xs text-foreground">{ticket.admin_response}</p>
                    </div>
                  ) : ticket.status === "open" ? (
                    <AdminResponseInput ticketId={ticket.id} onRespond={handleRespondTicket} />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Inline response input component
const AdminResponseInput = ({ ticketId, onRespond }: { ticketId: string; onRespond: (id: string, msg: string) => void }) => {
  const [response, setResponse] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <div className="flex gap-2 mt-2">
      <input
        type="text"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Admin response..."
        className="flex-1 h-8 px-3 text-xs rounded-lg border border-input bg-background"
      />
      <Button
        size="sm"
        disabled={!response.trim() || sending}
        onClick={async () => {
          setSending(true);
          await onRespond(ticketId, response);
          setSending(false);
          setResponse("");
        }}
        className="h-8 text-xs"
      >
        {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Reply"}
      </Button>
    </div>
  );
};
