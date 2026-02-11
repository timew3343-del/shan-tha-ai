import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// User role types for RBAC
type AppRole = "admin" | "moderator" | "trainer" | "user";

export const useUserRole = (userId?: string) => {
  const [role, setRole] = useState<AppRole>("user");
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchRole = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasFetched(false);

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
      setHasFetched(true);
    }
  }, [userId]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return {
    role,
    isAdmin: role === "admin",
    isModerator: role === "moderator",
    isTrainer: role === "trainer",
    isLoading: !hasFetched || isLoading,
    refetch: fetchRole,
  };
};
