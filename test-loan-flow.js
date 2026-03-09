import { sendEnvelope } from './src/services/docusign.ts';

async function main() {
  console.log("Starting DocuSign test...");
  const loanId = "test-loan-" + Date.now();
  const email = "test@example.com";
  const name = "Test Borrower";
  
  try {
    await sendEnvelope(loanId, email, name);
    console.log("DocuSign sendEnvelope function called successfully.");
  } catch (err) {
    console.error("Error in DocuSign test:", err);
  }
}

main();
