import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "moderator" | "user";

export const useUserRole = (userId?: string) => {
  const [role, setRole] = useState<AppRole>("user");
  const [isLoading, setIsLoading] = useState(true);
  const previousUserId = useRef<string | undefined>(undefined);

  const fetchRole = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    // Reset loading when userId changes
    setIsLoading(true);

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
    // Track userId changes and ensure loading state
    if (userId !== previousUserId.current) {
      previousUserId.current = userId;
      if (userId) {
        setIsLoading(true);
      }
    }
    fetchRole();
  }, [fetchRole, userId]);

  return {
    role,
    isAdmin: role === "admin",
    isModerator: role === "moderator",
    isLoading: isLoading || (!!userId && role === "user" && previousUserId.current !== userId),
    refetch: fetchRole,
  };
};
