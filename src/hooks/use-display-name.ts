import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Owner-scoped RLS means this read can only ever return the signed-in customer's own profile row.
export function useDisplayName() {
  return useQuery({
    queryKey: ["display-name"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return null;
      const { data: rows } = await supabase.from("profiles").select("display_name").eq("id", userId).limit(1);
      const name = rows?.[0]?.display_name?.trim();
      return name ? name : null;
    },
  });
}
