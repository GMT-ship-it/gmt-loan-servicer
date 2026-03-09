import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// Try Resend for email, as it's standard.
import { Resend } from 'https://esm.sh/resend@2.0.0'

const resendSecret = Deno.env.get('RESEND_API_KEY');
const resend = resendSecret ? new Resend(resendSecret) : null;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const { id, action, note } = await req.json();

    if (!id || !action || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Get the approval request to know what we are dealing with
    const { data: request, error: fetchError } = await supabase
      .from('gmt_approval_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !request) {
       return new Response(JSON.stringify({ error: 'Approval request not found', details: fetchError }), { status: 404 })
    }

    if (request.status !== 'pending') {
        return new Response(JSON.stringify({ error: 'Request is no longer pending' }), { status: 400 })
    }

    // 2. Update the status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error: updateError } = await supabase
      .from('gmt_approval_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      throw updateError
    }

    // 3. Log into audit_trail
    const { error: auditError } = await supabase
      .from('audit_trail')
      .insert({
        action: `APPROVAL_${action.toUpperCase()}`,
        record_id: id,
        resource_type: 'gmt_approval_requests',
        payload: { original_payload: request.payload, note },
        timestamp: new Date().toISOString()
      })
      
    if (auditError) {
      console.error("Failed writing audit trail:", auditError);
      // Non-fatal, keep going
    }

    // 4. Send Email Notification
    if (resend && request.email_to) {
        try {
            await resend.emails.send({
                from: 'GMT Approvals <approvals@johnnybucks.tech>',
                to: request.email_to,
                subject: `Approval Request ${newStatus.toUpperCase()}`,
                text: `Your request (ID: ${id}) was ${newStatus}. ${note ? 'Note: ' + note : ''}`
            });
        } catch (emailErr) {
            console.error("Email send failed:", emailErr);
        }
    }

    return new Response(
      JSON.stringify({ success: true, newStatus }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error handling approval:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
