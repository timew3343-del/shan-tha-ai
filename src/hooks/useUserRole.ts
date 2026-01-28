import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "moderator" | "user";

export const useUserRole = (userId?: string) => {
  const [role, setRole] = useState<AppRole>("user");
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        setRole("user");
      } else {
        setRole((data?.role as AppRole) || "user");
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      setRole("user");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return {
    role,
    isAdmin: role === "admin",
    isModerator: role === "moderator",
    isLoading,
    refetch: fetchRole,
  };
};
