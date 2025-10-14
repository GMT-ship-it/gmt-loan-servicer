import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type Input = {
  files: { name: string; url: string }[];
};

type Extracted = {
  borrower_full_name?: string;
  borrower_email?: string;
  loan_number?: string;
  principal?: number;
  interest_rate?: number;
  compounding_basis?: "ACT/365" | "30/360";
  payment_frequency?: "monthly" | "biweekly" | "weekly";
  amortization_type?: "interest_only" | "amortizing";
  rate_type?: "fixed" | "variable";
  term_months?: number;
  first_payment_date?: string;
  origination_date?: string;
  balloon_amount?: number | null;
  grace_days?: number | null;
  late_fee_type?: "flat" | "percent" | null;
  late_fee_amount?: number | null;
};

function systemPrompt() {
  return `
You are a loan document parser. Read promissory notes and loan agreement PDFs and output STRICT JSON matching this TypeScript interface:

type Extracted = {
  borrower_full_name?: string;
  borrower_email?: string;
  loan_number?: string;
  principal?: number;
  interest_rate?: number; // decimal annual rate, e.g. 0.115 for 11.5%
  compounding_basis?: "ACT/365" | "30/360";
  payment_frequency?: "monthly" | "biweekly" | "weekly";
  amortization_type?: "interest_only" | "amortizing";
  rate_type?: "fixed" | "variable";
  term_months?: number;
  first_payment_date?: string; // YYYY-MM-DD
  origination_date?: string;   // YYYY-MM-DD
  balloon_amount?: number | null;
  grace_days?: number | null;
  late_fee_type?: "flat" | "percent" | null;
  late_fee_amount?: number | null;
};

CRITICAL RULES:
- If a field isn't present in the document, omit it from the JSON
- Interest rate MUST be decimal (e.g., 0.12 for 12%, 0.0825 for 8.25%)
- All dates must be YYYY-MM-DD format (normalize as best as possible)
- Payment frequency: map textual descriptions to "monthly", "biweekly", or "weekly"
- Day-count basis: detect "30/360" vs "ACT/365" if mentioned; otherwise omit
- Rate type: typically "fixed" unless adjustable/variable is mentioned
- Respond ONLY with valid JSON, no other text

Example input: "Principal amount $250,000. Interest rate of 8.25% per annum..."
Example output: {"principal": 250000, "interest_rate": 0.0825}
`.trim();
}

async function fetchPdfAsBase64(url: string): Promise<string> {
  console.log("Fetching PDF from:", url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch PDF: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("ingest-extract: Starting");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const input = (await req.json()) as Input;
    console.log("Received files:", input.files?.length || 0);

    if (!input.files?.length) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch PDFs as base64 (for small batches)
    const docs: { name: string; content: string }[] = [];
    for (const f of input.files.slice(0, 3)) {
      // Limit to 3 files
      try {
        const b64 = await fetchPdfAsBase64(f.url);
        docs.push({
          name: f.name,
          content: `[PDF file: ${f.name}, base64 length: ${b64.length}]`,
        });
        console.log(`Fetched ${f.name}, size: ${b64.length}`);
      } catch (e) {
        console.error(`Failed to fetch ${f.name}:`, e);
      }
    }

    if (docs.length === 0) {
      throw new Error("No PDFs could be fetched");
    }

    // Call Lovable AI Gateway
    const payload = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt() },
        {
          role: "user",
          content: `Parse the loan terms from these documents:\n\n${JSON.stringify(docs, null, 2)}`,
        },
      ],
    };

    console.log("Calling Lovable AI Gateway...");
    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("AI Gateway error:", resp.status, errorText);

      if (resp.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again later.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (resp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Payment required. Please add credits to your workspace.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`AI Gateway returned ${resp.status}: ${errorText}`);
    }

    const data = await resp.json();
    console.log("AI response received");

    const content = data.choices?.[0]?.message?.content || "{}";
    console.log("Raw content:", content);

    // Parse JSON from response
    let extracted: Extracted = {};
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                       content.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      extracted = JSON.parse(jsonStr.trim());
      console.log("Extracted terms:", extracted);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
      console.error("Content was:", content);
      // Return empty object if parsing fails
      extracted = {};
    }

    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-extract error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
