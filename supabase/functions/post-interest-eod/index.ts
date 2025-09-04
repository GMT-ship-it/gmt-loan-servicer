// Deno Deploy (Supabase Edge Function)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // DO NOT expose on client

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

serve(async (_req) => {
  console.log('Starting nightly interest posting job');
  
  const asOf = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  console.log(`Posting interest as of: ${asOf}`);

  try {
    // 1) Post interest for all active facilities
    const { data, error } = await supabase
      .rpc("post_interest_all_active", { p_as_of: asOf });

    if (error) {
      console.error('Error calling post_interest_all_active:', error);
      throw error;
    }

    console.log('Interest posting RPC result:', data);

    // Prepare audit payload
    const summary = Array.isArray(data)
      ? {
          facilities_processed: data.length,
          posted_total: Number(
            data.reduce((acc: number, r: any) => acc + Number(r.posted || 0), 0)
          ).toFixed(2),
          details: data,
          as_of: asOf,
        }
      : { facilities_processed: 0, posted_total: "0.00", details: [], as_of: asOf };

    console.log('Audit summary:', summary);

    // 2) Write an audit log row (best-effort)
    const { error: auditError } = await supabase.from("audit_log").insert({
      action: "post_interest_all_active",
      table_name: "transactions",
      record_id: null,
      user_id: null, // system job
      old_values: null,
      new_values: summary as any,
    });

    if (auditError) {
      console.error('Error writing audit log:', auditError);
      // Don't fail the whole job for audit logging issues
    }

    console.log('Interest posting job completed successfully');

    return new Response(JSON.stringify({ ok: true, summary }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  } catch (error) {
    console.error('Interest posting job failed:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});