import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Copy, Loader2, Tag } from "lucide-react";

interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  bonus_credits: number;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export const PromoCodesTab = () => {
  const { toast } = useToast();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newCode, setNewCode] = useState({
    code: "",
    discount_percent: 20,
    bonus_credits: 5,
    max_uses: "",
    expires_at: "",
  });

  const fetchCodes = async () => {
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching promo codes:", error);
    } else {
      setCodes(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCodes();

    const channel = supabase
      .channel("promo-codes-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "promo_codes" }, () => {
        fetchCodes();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddCode = async () => {
    if (!newCode.code.trim()) {
      toast({ title: "Code ထည့်ပါ", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("promo_codes").insert({
        code: newCode.code.toUpperCase().trim(),
        discount_percent: newCode.discount_percent,
        bonus_credits: newCode.bonus_credits,
        max_uses: newCode.max_uses ? parseInt(newCode.max_uses, 10) : null,
        expires_at: newCode.expires_at || null,
        is_active: true,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("ဤ Code ရှိပြီးသားဖြစ်ပါသည်");
        }
        throw error;
      }

      toast({ title: "Promo Code ထည့်ပြီးပါပြီ" });
      setNewCode({ code: "", discount_percent: 20, bonus_credits: 5, max_uses: "", expires_at: "" });
      setShowAddForm(false);
      fetchCodes();
    } catch (error: any) {
      toast({ title: "အမှား", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("promo_codes")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (error) {
      toast({ title: "အမှား", description: "Status ပြောင်းရာတွင် ပြဿနာရှိပါသည်", variant: "destructive" });
    } else {
      fetchCodes();
    }
  };

  const deleteCode = async (id: string) => {
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) {
      toast({ title: "အမှား", description: "ဖျက်ရာတွင် ပြဿနာရှိပါသည်", variant: "destructive" });
    } else {
      toast({ title: "ဖျက်ပြီးပါပြီ" });
      fetchCodes();
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: `${code} ကူးပြီးပါပြီ` });
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
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Promo Codes</h3>
        </div>
        <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4 mr-1" />
          Code အသစ်
        </Button>
      </div>

      {/* Add New Code Form */}
      {showAddForm && (
        <div className="gradient-card rounded-xl p-4 border border-primary/20 space-y-3">
          <Input
            placeholder="Code (e.g. MYANMARAI20)"
            value={newCode.code}
            onChange={(e) => setNewCode(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
            className="uppercase"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Discount %</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={newCode.discount_percent}
                onChange={(e) => setNewCode(prev => ({ ...prev, discount_percent: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bonus Credits</label>
              <Input
                type="number"
                min={0}
                value={newCode.bonus_credits}
                onChange={(e) => setNewCode(prev => ({ ...prev, bonus_credits: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Max Uses (ကန့်သတ်)</label>
              <Input
                type="number"
                min={1}
                placeholder="Unlimited"
                value={newCode.max_uses}
                onChange={(e) => setNewCode(prev => ({ ...prev, max_uses: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Expires At</label>
              <Input
                type="date"
                value={newCode.expires_at}
                onChange={(e) => setNewCode(prev => ({ ...prev, expires_at: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddCode} disabled={isSaving} className="flex-1">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              သိမ်းဆည်းမည်
            </Button>
            <Button variant="outline" onClick={() => setShowAddForm(false)}>
              ပယ်ဖျက်
            </Button>
          </div>
        </div>
      )}

      {/* Codes List */}
      {codes.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">Promo Code မရှိသေးပါ</p>
      ) : (
        <div className="space-y-2">
          {codes.map((code) => (
            <div
              key={code.id}
              className={`gradient-card rounded-xl p-4 border ${
                code.is_active ? "border-primary/20" : "border-border/30 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary text-sm">{code.code}</span>
                  <button onClick={() => copyCode(code.code)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={code.is_active}
                    onCheckedChange={() => toggleActive(code.id, code.is_active)}
                  />
                  <button
                    onClick={() => deleteCode(code.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{code.discount_percent}% off</span>
                <span>+{code.bonus_credits} credits</span>
                <span>{code.uses_count}/{code.max_uses ?? "∞"} used</span>
                {code.expires_at && (
                  <span>Exp: {new Date(code.expires_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
