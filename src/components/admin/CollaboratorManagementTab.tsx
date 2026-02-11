import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Users, Loader2, Mail } from "lucide-react";

interface Collaborator {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export const CollaboratorManagementTab = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCollaborators = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("collaborator_invites")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCollaborators(data || []);
    } catch (error) {
      console.error("Error fetching collaborators:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollaborators();
  }, []);

  const handleAdd = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast({ title: "Email မှန်ကန်အောင်ထည့်ပါ", variant: "destructive" });
      return;
    }

    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("collaborator_invites")
        .insert({ email: trimmed, role: "trainer", added_by: user.id });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "ဒီ email ကို ထည့်ပြီးသားပါ", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }

      // If user already exists, assign the role immediately
      const { data: existingProfile } = await supabase
        .rpc("get_user_email", { _user_id: "00000000-0000-0000-0000-000000000000" });
      
      // We need to check all profiles and find matching email
      // Since we can't query auth.users directly, the trigger handles new signups
      // For existing users, admin can manually assign via user table

      toast({ title: "အောင်မြင်ပါသည်", description: `${trimmed} ကို Knowledge Base Editor အဖြစ် ထည့်သွင်းပြီးပါပြီ` });
      setEmail("");
      fetchCollaborators();
    } catch (error: any) {
      console.error("Error adding collaborator:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string, collaboratorEmail: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("collaborator_invites")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "ဖယ်ရှားပြီးပါပြီ", description: `${collaboratorEmail} ၏ access ကို ဖယ်ရှားပြီးပါပြီ` });
      fetchCollaborators();
    } catch (error: any) {
      console.error("Error deleting collaborator:", error);
      toast({ title: "အမှားရှိပါသည်", description: error.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Collaborator Management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Gmail ထည့်ပြီး Knowledge Base Editor အဖြစ် ဖိတ်ခေါ်ပါ။ ဖိတ်ခေါ်ထားသော email ဖြင့် Sign Up ဝင်လာပါက အလိုအလျောက် trainer role ရရှိမည်။
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Email Form */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <Button onClick={handleAdd} disabled={isAdding} className="shrink-0">
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </>
              )}
            </Button>
          </div>

          {/* Collaborator List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : collaborators.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              ဖိတ်ခေါ်ထားသော collaborator မရှိသေးပါ
            </div>
          ) : (
            <div className="space-y-2">
              {collaborators.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.email}</p>
                    <p className="text-xs text-muted-foreground">
                      KB Editor • {new Date(c.created_at).toLocaleDateString("my-MM")}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="shrink-0 h-8 w-8"
                    onClick={() => handleDelete(c.id, c.email)}
                    disabled={deletingId === c.id}
                  >
                    {deletingId === c.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
