import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.645.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const s3 = new S3Client({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
});
const BUCKET = Deno.env.get("S3_BUCKET")!;

function toCsv(rows: any[]) {
  const cols = ["created_at","action","table_name","user_id","record_id","old_values","new_values"];
  const esc = (v: any) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v || '');
    return `"${s.replaceAll(`"`, `""`))}"`;
  };
  const head = cols.join(",");
  const body = rows.map(r => cols.map(c => esc((r as any)[c])).join(",")).join("\n");
  return head + "\n" + body;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting audit export to S3...');
    
    // Check if required environment variables are set
    if (!Deno.env.get("AWS_ACCESS_KEY_ID") || !Deno.env.get("AWS_SECRET_ACCESS_KEY") || !BUCKET) {
      throw new Error('Missing required AWS configuration: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or S3_BUCKET');
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    console.log('Fetching audit logs since:', since);
    
    const { data, error } = await supabase
      .from('audit_log')
      .select('created_at,action,table_name,user_id,record_id,old_values,new_values')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(100000);

    if (error) {
      console.error('Error fetching audit logs:', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), { 
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    console.log(`Found ${data?.length || 0} audit log entries`);

    const csv = toCsv(data || []);
    const now = new Date();
    const key = `audit/${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2,'0')}/${String(now.getUTCDate()).padStart(2,'0')}/audit_last_7d_${now.toISOString().replaceAll(':','-')}.csv`;

    console.log('Uploading to S3 key:', key);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: new TextEncoder().encode(csv),
      ContentType: "text/csv",
    }));

    // Log the export to audit trail
    await supabase.from('audit_log').insert({
      action: 'export_audit_to_s3',
      table_name: 'audit_log',
      new_values: { key, rows: data?.length || 0 }
    });

    console.log('Export completed successfully');

    return new Response(JSON.stringify({ ok: true, key, rows: data?.length || 0 }), { 
      headers: { ...corsHeaders, "content-type": "application/json" }
    });

  } catch (error) {
    console.error('Error in export-audit-to-s3 function:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }
});