import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useCredits = (userId: string | undefined) => {
  const [credits, setCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchCredits = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      setCredits(data?.credit_balance ?? 10);
    } catch (error) {
      console.error("Error fetching credits:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCredits();

    // Subscribe to realtime changes for this user's profile
    if (userId) {
      const channel = supabase
        .channel(`profile-credits-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log("Credits updated via realtime:", payload);
            if (payload.new && typeof payload.new.credit_balance === "number") {
              setCredits(payload.new.credit_balance);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchCredits, userId]);

  const deductCredits = async (amount: number, action: string) => {
    if (!userId) return false;
    
    if (credits < amount) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `${action} အတွက် ${amount} Credits လိုအပ်ပါသည်။ ထပ်မံဖြည့်သွင်းပါ။`,
        variant: "destructive",
      });
      return false;
    }

    try {
      // Use atomic RPC to prevent race conditions
      const { data, error } = await supabase.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: amount,
        _action: action,
      });

      if (error) throw error;
      
      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.error || "Failed to deduct credits");
      }
      
      setCredits(result.new_balance);
      
      // Show low credits warning
      if (result.new_balance <= 5) {
        toast({
          title: "သတိပေးချက်",
          description: "သင့်ခရက်ဒစ် ကုန်ဆုံးတော့မည်။ ထပ်မံဖြည့်သွင်းပါ။",
          variant: "destructive",
        });
      }
      
      return true;
    } catch (error) {
      console.error("Error deducting credits:", error);
      toast({
        title: "အမှား",
        description: "Credits နုတ်ယူရာတွင် ပြဿနာရှိပါသည်။",
        variant: "destructive",
      });
      return false;
    }
  };

  const addCredits = async (amount: number) => {
    if (!userId) return false;
    
    try {
      const newBalance = credits + amount;
      const { error } = await supabase
        .from("profiles")
        .update({ credit_balance: newBalance })
        .eq("user_id", userId);

      if (error) throw error;
      
      setCredits(newBalance);
      toast({
        title: "အောင်မြင်ပါသည်",
        description: `သင့်အကောင့်ထဲသို့ ${amount} Credits ထည့်သွင်းပြီးပါပြီ။`,
      });
      
      return true;
    } catch (error) {
      console.error("Error adding credits:", error);
      return false;
    }
  };

  return { credits, isLoading, deductCredits, addCredits, refetch: fetchCredits };
};
