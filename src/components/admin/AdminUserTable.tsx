import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Copy, Check, CreditCard, Calendar, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  credit_balance: number;
  created_at: string;
}

export const AdminUserTable = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, credit_balance, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch emails for each user via the get_user_email RPC
      const usersWithEmails = await Promise.all(
        (profiles || []).map(async (p) => {
          let email = "";
          try {
            const { data } = await supabase.rpc("get_user_email", { _user_id: p.user_id });
            email = (data as string) || "";
          } catch {}
          return { ...p, email };
        })
      );

      setUsers(usersWithEmails);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  const handleCopyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "UUID ကူးယူပြီး", description: id });
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
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Name, Email, UUID ဖြင့် ရှာပါ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-background/50 border-border/50 rounded-xl h-10"
        />
      </div>

      {/* User Count */}
      <p className="text-xs text-muted-foreground">
        စုစုပေါင်း: {filteredUsers.length} ဦး
      </p>

      {/* User List */}
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {filteredUsers.map((user) => (
          <div
            key={user.user_id}
            className="gradient-card rounded-xl p-3 border border-border/50 space-y-2"
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-primary">
                    {(user.full_name || user.email || "?")[0].toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.full_name || user.email || "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>

              {/* Balance */}
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1 text-primary">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="text-sm font-bold">{user.credit_balance}</span>
                </div>
              </div>
            </div>

            {/* UUID Row */}
            <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-2 py-1.5">
              <code className="text-[10px] text-muted-foreground flex-1 truncate font-mono">
                {user.user_id}
              </code>
              <button
                onClick={() => handleCopyId(user.user_id)}
                className="p-1 rounded hover:bg-secondary transition-colors flex-shrink-0"
              >
                {copiedId === user.user_id ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Joined Date */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{new Date(user.created_at).toLocaleDateString("my-MM")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
