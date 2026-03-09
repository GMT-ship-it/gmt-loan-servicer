import { createClient } from '@supabase/supabase-js';

// Load directly from .env for the node script
import * as dotenv from 'dotenv';
dotenv.config();

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!URL || !KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(URL, KEY);

const INTEGRATION_KEY = '5a21a3a6-87c6-456f-8cf6-67c6e6d89bf3';
const ACCOUNT_ID = '46369521';

async function sendEnvelope(loanId: string, email: string, name: string) {
  console.log(`Sending DocuSign envelope for loan ${loanId} to ${name} (${email}) using Account ${ACCOUNT_ID} and Key ${INTEGRATION_KEY}`);
  try {
    const { data, error } = await supabase.functions.invoke('docusign-send-envelope', {
      body: { loanId, email, name, integrationKey: INTEGRATION_KEY, accountId: ACCOUNT_ID }
    });
    if (error) {
      console.error('DocuSign envelope creation failed:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('Network catch during invoke:', err);
    return { success: false, error: err };
  }
}

async function main() {
  console.log("Starting DocuSign test...");
  const loanId = "test-loan-" + Date.now();
  const email = "test@example.com";
  const name = "Test Borrower";
  const result = await sendEnvelope(loanId, email, name);
  console.log("DocuSign sendEnvelope function called successfully.");
  console.log(JSON.stringify(result, null, 2));
}

main();
