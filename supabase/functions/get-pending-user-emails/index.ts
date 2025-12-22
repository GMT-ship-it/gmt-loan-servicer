import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with anon key to verify the caller
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // First verify the caller is authenticated and has admin/lender role
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      console.error("User verification failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has lender_admin or lender_analyst role
    const { data: roleData, error: roleError } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["lender_admin", "lender_analyst"])
      .limit(1)
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("User is not authorized (not a lender):", roleError);
      return new Response(
        JSON.stringify({ error: "Forbidden - lender role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body to get user IDs
    const { userIds } = await req.json();
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ users: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit the number of user IDs to prevent abuse
    const limitedUserIds = userIds.slice(0, 100);

    // Use service role client to access auth.users
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch only the specific users we need (not all users)
    const userEmails: Record<string, string> = {};
    
    for (const userId of limitedUserIds) {
      try {
        const { data: authUser, error: authError } = await serviceClient.auth.admin.getUserById(userId);
        if (!authError && authUser?.user?.email) {
          userEmails[userId] = authUser.user.email;
        }
      } catch (e) {
        console.error(`Failed to fetch user ${userId}:`, e);
      }
    }

    console.log(`Returning emails for ${Object.keys(userEmails).length} users`);

    return new Response(
      JSON.stringify({ users: userEmails }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
