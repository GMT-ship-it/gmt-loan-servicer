import { supabase } from "@/integrations/supabase/client";

export async function requireUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user;
}

export async function getUserRole(userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data; // { role, organization_id } | null
}

