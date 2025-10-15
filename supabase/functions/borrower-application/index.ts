import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApplicationRequest {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  title: string;
  requestedAmount: number;
  sector: string;
  purpose: string;
  address: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create client with user's JWT to respect RLS
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json();
    
    console.log('Processing application for:', body.companyName);

    // Validate input
    if (!body.companyName || !body.fullName || !body.email || !body.phone || !body.requestedAmount || !body.purpose) {
      throw new Error('Missing required fields');
    }

    if (body.requestedAmount <= 0) {
      throw new Error('Requested amount must be positive');
    }

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Authentication required');
    }

    // Insert into borrower_applications table
    const { error: insertError } = await supabase
      .from('borrower_applications')
      .insert({
        company_name: body.companyName,
        industry: body.industry,
        business_address: body.businessAddress,
        full_name: body.fullName,
        title: body.title,
        email: body.email,
        phone: body.phone,
        requested_amount: Number(body.requestedAmount),
        purpose: body.purpose,
        created_by: user.id,
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log('Application submitted successfully for user:', user.id);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Application error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
