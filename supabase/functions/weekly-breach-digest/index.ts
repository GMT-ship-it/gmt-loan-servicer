import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(url, service);

const SEND_TO = (Deno.env.get("LENDER_WEEKLY_TO") || "").split(',').map(s=>s.trim()).filter(Boolean);

function textReport(rows: any[]) {
  if (!rows?.length) return "No policy breaches this week. ✅";
  const lines = rows.map(r => `• ${r.customer_name} (${String(r.facility_id).slice(0,8)}): ${r.code} — ${r.message}`);
  return `Policy Breaches:\n\n${lines.join('\n')}\n`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Running weekly breach digest...');
    
    const { data: rows, error } = await supabase.rpc('portfolio_policy_breaches');
    
    if (error) {
      console.error('Error fetching breaches:', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), { 
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const body = textReport(rows || []);
    console.log('Breach report generated:', body);

    // Log to audit trail
    await supabase.from('audit_log').insert({
      action: 'weekly_breach_digest',
      table_name: 'facilities',
      new_values: { count: rows?.length || 0, sample: rows?.slice(0, 20) || [] }
    });

    // TODO: integrate your email provider here (Resend/Mailgun/SMTP).
    // Skipping send if not configured; audit log acts as proof.
    if (SEND_TO.length) {
      console.log('Email sending not implemented yet. Recipients would be:', SEND_TO);
      // TODO: send email to SEND_TO with "Weekly Breach Digest" and body
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      count: rows?.length || 0,
      report: body 
    }), { 
      headers: { ...corsHeaders, "content-type": "application/json" }
    });

  } catch (error) {
    console.error('Error in weekly-breach-digest function:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }
});