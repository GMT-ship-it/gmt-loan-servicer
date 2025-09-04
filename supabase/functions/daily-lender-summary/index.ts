import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(url, service, { auth: { persistSession: false } });

// Optional email provider (Resend/SMTP) — leave unset if not using
const SEND_TO = (Deno.env.get("LENDER_DAILY_TO") || "").split(',').map(s=>s.trim()).filter(Boolean);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating daily lender summary');
    
    const { data: rows, error } = await supabase.rpc('lender_exposure_snapshot');
    
    if (error) {
      console.error('Error fetching exposure snapshot:', error);
      throw error;
    }

    const summary = {
      ts: new Date().toISOString(),
      count: rows?.length || 0,
      high_util: rows?.filter((r:any) => r.utilization_pct >= 80).length || 0,
      bbc_stale: rows?.filter((r:any) => !r.bbc_approved_within_45d).length || 0,
      low_avail: rows?.filter((r:any) => r.available_to_draw <= 10000).length || 0,
    };

    console.log('Summary:', summary);

    // Log to audit trail
    await supabase.from('audit_log').insert({
      action: 'daily_lender_summary',
      table_name: 'facilities',
      new_values: { summary, sample: rows?.slice(0,10) ?? [] }
    });

    // OPTIONAL: send email if configured (pseudo; integrate your provider here)
    if (SEND_TO.length) {
      console.log(`Would send email to: ${SEND_TO.join(', ')}`);
      // TODO: integrate Resend/Mailgun/SMTP here.
      // For safety, we skip sending in this stub.
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      summary 
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
    
  } catch (error) {
    console.error('Error in daily-lender-summary function:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }
});