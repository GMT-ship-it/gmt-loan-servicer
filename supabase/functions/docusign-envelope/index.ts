import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const DOCUSIGN_INTEGRATION_KEY = Deno.env.get("DOCUSIGN_INTEGRATION_KEY")
const DOCUSIGN_ACCOUNT_ID = Deno.env.get("DOCUSIGN_ACCOUNT_ID")
const DOCUSIGN_ACCESS_TOKEN = Deno.env.get("DOCUSIGN_ACCESS_TOKEN")

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Parse request body
    const bodyText = await req.text()
    if (!bodyText) throw new Error("Missing request body")
    
    let { loan_id, borrower_email, borrower_name, template_id } = JSON.parse(bodyText)

    if (!loan_id || !borrower_email || !template_id) {
       return new Response(JSON.stringify({ error: "loan_id, borrower_email, and template_id required" }), { status: 400 })
    }

    // Call DocuSign API
    const url = `https://demo.docusign.net/restapi/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`
    const docusignBody = {
      emailSubject: `Action Required: Sign Loan Documents for Loan ${loan_id}`,
      status: "sent",
      templateId: template_id,
      templateRoles: [
        {
          email: borrower_email,
          name: borrower_name || "Borrower",
          roleName: "Borrower",
          routingOrder: "1"
        }
      ]
    }
    
    // Send
    const dsResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOCUSIGN_ACCESS_TOKEN}`
      },
      body: JSON.stringify(docusignBody)
    })
    
    if (!dsResponse.ok) {
       const errBody = await dsResponse.text()
       throw new Error(`DocuSign API returned ${dsResponse.status}: ${errBody}`)
    }

    const docusignData = await dsResponse.json()
    const envelopeId = docusignData.envelopeId

    // Note: status callback could be registered via DocuSign Connect (webhooks) using envelope status tracking, 
    // or tracked here via polling. For now, store envelopeId to the loan application record.

    await supabase
      .from('loans')
      .update({ docusign_envelope_id: envelopeId, docusign_status: "sent" })
      .eq('id', loan_id)

    return new Response(JSON.stringify({ success: true, envelopeId }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
