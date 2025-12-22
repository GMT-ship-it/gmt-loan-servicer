import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // SECURITY: Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callerUser) {
      console.error('Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify the caller has admin role
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('Error checking caller role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!callerRole) {
      console.error('Caller is not an admin:', callerUser.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin user verified:', callerUser.email);

    const { user_email, role, organization_name } = await req.json();

    if (!user_email || !role) {
      return new Response(
        JSON.stringify({ error: 'user_email and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role - must match app_role enum
    const validRoles = ['admin', 'analyst', 'borrower'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user by email
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.find(u => u.email === user_email);

    if (!user) {
      return new Response(
        JSON.stringify({ error: `User with email ${user_email} not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create organization
    let orgId;
    const orgNameToUse = organization_name || 'Default Organization';
    
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('name', orgNameToUse)
      .single();

    if (existingOrg) {
      orgId = existingOrg.id;
    } else {
      const { data: newOrg, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({ name: orgNameToUse })
        .select('id')
        .single();
      
      if (orgError) {
        console.error('Error creating organization:', orgError);
        return new Response(
          JSON.stringify({ error: 'Failed to create organization: ' + orgError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      orgId = newOrg.id;
    }

    // Check if role already exists
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Log the role assignment for audit purposes
    console.log('Role assignment:', {
      assigned_by: callerUser.email,
      target_user: user_email,
      role,
      organization: orgNameToUse
    });

    if (existingRole) {
      // Update existing role
      const { error: updateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role, organization_id: orgId })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating role:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update role: ' + updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Role updated to ${role} for ${user_email}`,
          user_id: user.id,
          organization_id: orgId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Insert new role
      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: user.id,
          role,
          organization_id: orgId
        });

      if (insertError) {
        console.error('Error assigning role:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to assign role: ' + insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Role ${role} assigned to ${user_email}`,
          user_id: user.id,
          organization_id: orgId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in assign-user-role function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
