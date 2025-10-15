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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      companyName,
      contactName,
      email,
      phone,
      title,
      requestedAmount,
      sector,
      purpose,
      address,
    }: ApplicationRequest = await req.json();

    console.log('Processing application for:', companyName);

    // Validate input
    if (!companyName || !contactName || !email || !phone || !title || !requestedAmount || !sector || !purpose || !address) {
      throw new Error('Missing required fields');
    }

    if (requestedAmount <= 0) {
      throw new Error('Requested amount must be positive');
    }

    // 1. Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('legal_name', companyName)
      .maybeSingle();

    if (existingCustomer) {
      throw new Error('An application already exists for this company');
    }

    // 2. Create customer record
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        legal_name: companyName,
        sector: sector,
        address: address,
        requested_amount: requestedAmount,
        financing_purpose: purpose,
        application_status: 'pending',
      })
      .select('id')
      .single();

    if (customerError) throw customerError;

    console.log('Created customer:', customer.id);

    // 3. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      email_confirm: false,
      user_metadata: {
        full_name: contactName,
        phone: phone,
        title: title,
      }
    });

    if (authError) {
      // Rollback customer creation
      await supabase.from('customers').delete().eq('id', customer.id);
      throw authError;
    }

    console.log('Created auth user:', authData.user.id);

    // 4. Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: authData.user.id,
          full_name: contactName,
          phone: phone,
          title: title,
          customer_id: customer.id,
          is_active: true,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      // Rollback
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('customers').delete().eq('id', customer.id);
      throw profileError;
    }

    console.log('Created profile');

    // 5. Create pending user role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        organization_id: '00000000-0000-0000-0000-000000000000', // Placeholder - will be set on approval
        role: 'borrower',
        status: 'pending_approval',
      });

    if (roleError) {
      // Rollback
      await supabase.from('profiles').delete().eq('id', authData.user.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('customers').delete().eq('id', customer.id);
      throw roleError;
    }

    console.log('Created user role');

    // 6. Send email notifications
    try {
      await supabase.functions.invoke('send-application-emails', {
        body: {
          applicantEmail: email,
          applicantName: contactName,
          companyName: companyName,
        }
      });
    } catch (emailError) {
      console.error('Failed to send emails:', emailError);
      // Don't fail the application if email fails
    }

    return new Response(
      JSON.stringify({ success: true, customerId: customer.id }),
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
