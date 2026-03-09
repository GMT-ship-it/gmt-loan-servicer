// DocuSign Integration Service
// Integration Key: 5a21a3a6-87c6-456f-8cf6-67c6e6d89bf3
// Account ID: 46369521

// Load external env vars when in a node environment, or use Vite env in browser
const INTEGRATION_KEY = import.meta.env?.VITE_DOCUSIGN_INTEGRATION_KEY || typeof process !== 'undefined' ? process.env.DOCUSIGN_INTEGRATION_KEY : '5a21a3a6-87c6-456f-8cf6-67c6e6d89bf3';
const ACCOUNT_ID = import.meta.env?.VITE_DOCUSIGN_ACCOUNT_ID || typeof process !== 'undefined' ? process.env.DOCUSIGN_ACCOUNT_ID : '46369521';

// In a real implementation this would likely call a backend edge function, 
// because DocuSign API requires an access token usually obtained via JWT Oauth server-side.
// Since we only have client-side Vite/React context here, we construct a fully wired call 
// pointing to a hypothetical Supabase Edge Function that handles the secure server-to-server call.
import { supabase } from '../integrations/supabase/client';

export const sendEnvelope = async (loanId: string, email: string, name: string) => {
  console.log(`Sending DocuSign envelope for loan ${loanId} to ${name} (${email}) using Account ${ACCOUNT_ID} and Key ${INTEGRATION_KEY}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('docusign-send-envelope', {
      body: { 
        loanId, 
        email, 
        name,
        integrationKey: INTEGRATION_KEY,
        accountId: ACCOUNT_ID
      }
    });

    if (error) {
      console.error('DocuSign envelope creation failed:', error);
      throw error;
    }
    
    return { envelopeId: data.envelopeId, status: data.status };
  } catch (err) {
    console.error('DocuSign Error:', err);
    throw err;
  }
};

export const updateSignatureStatus = async (loanId: string, status: string, signedDocUrl: string) => {
  console.log(`Updating loan ${loanId} in Supabase: status=${status}, documentUrl=${signedDocUrl}`);
  
  try {
    const { data, error } = await supabase
      .from('loans')
      .update({ 
        status: status,
        metadata: { docusignUrl: signedDocUrl } 
      })
      .eq('id', loanId);

    if (error) {
      console.error('Failed to update Supabase loan status:', error);
      throw error;
    }
    
    return true;
  } catch (err) {
    console.error('Update Signature Status Error:', err);
    throw err;
  }
};