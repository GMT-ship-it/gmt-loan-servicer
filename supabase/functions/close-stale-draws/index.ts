import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(url, service, { auth: { persistSession: false } });

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
    console.log('Running stale draws cleanup');
    
    const cutoff = new Date(); 
    cutoff.setDate(cutoff.getDate() - 7); // 7 days
    const iso = cutoff.toISOString();

    // Find stale submitted draws
    const { data: stale, error } = await supabase
      .from('draw_requests')
      .select('id')
      .eq('status','submitted')
      .lte('created_at', iso);

    if (error) {
      console.error('Error finding stale draws:', error);
      throw error;
    }

    let closedCount = 0;
    
    if (stale && stale.length) {
      const ids = stale.map(s => s.id);
      console.log(`Found ${ids.length} stale draws to close:`, ids);
      
      const { error: updateError } = await supabase
        .from('draw_requests')
        .update({
          status: 'rejected',
          decision_notes: 'Auto-closed after 7 days without review',
          decided_at: new Date().toISOString(),
          decided_by: null
        })
        .in('id', ids);

      if (updateError) {
        console.error('Error updating stale draws:', updateError);
        throw updateError;
      }

      // Log the action
      await supabase.from('audit_log').insert({
        action: 'auto_close_stale_draws',
        table_name: 'draw_requests',
        record_id: null,
        new_values: { ids, cutoff: iso },
        old_values: null
      });

      closedCount = ids.length;
    }

    console.log(`Closed ${closedCount} stale draws`);
    
    return new Response(JSON.stringify({ 
      ok: true, 
      count: closedCount,
      cutoff: iso 
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
    
  } catch (error) {
    console.error('Error in close-stale-draws function:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }
});