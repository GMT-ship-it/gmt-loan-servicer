import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type AnalysisResult = {
  missing_documents: Array<{
    document_name: string;
    reason: string;
    priority: "high" | "medium" | "low";
  }>;
  discrepancies: Array<{
    issue: string;
    severity: "critical" | "warning" | "info";
    supporting_docs_needed: string[];
    details: string;
  }>;
  clarifications_needed: Array<{
    topic: string;
    question: string;
    urgency: "high" | "medium" | "low";
    context: string;
  }>;
  risk_assessment: {
    overall_risk: "low" | "medium" | "high";
    factors: string[];
    recommendations: string[];
  };
  approval_recommendation: "approve" | "conditional" | "reject" | "review_required";
};

function systemPrompt(loanType: string, requestedAmount: number) {
  return `
You are a commercial lending analyst AI reviewing a loan application. Your job is to analyze the application comprehensively and provide actionable insights.

**Application Context:**
- Loan Type: ${loanType}
- Requested Amount: $${requestedAmount.toLocaleString()}

**Your Analysis Should:**
1. Identify any missing standard documents for this loan type/amount
2. Flag any discrepancies between documents (e.g., financial statements don't match loan application)
3. Identify items that fall outside normal approval parameters
4. Assess overall risk and provide recommendations

**CRITICAL RULES:**
- Be thorough but practical - only flag genuinely concerning issues
- Prioritize by severity: critical issues first, then warnings, then info
- For each issue, explain WHY it matters and WHAT documents/clarifications would resolve it
- Consider industry norms and typical lending standards
- If financial ratios seem unusual, request supporting documentation
- Flag any inconsistencies in dates, amounts, or business information across documents

**Output Format:**
Respond with STRICT JSON matching this TypeScript interface:

type AnalysisResult = {
  missing_documents: Array<{
    document_name: string;
    reason: string;
    priority: "high" | "medium" | "low";
  }>;
  discrepancies: Array<{
    issue: string;
    severity: "critical" | "warning" | "info";
    supporting_docs_needed: string[];
    details: string;
  }>;
  clarifications_needed: Array<{
    topic: string;
    question: string;
    urgency: "high" | "medium" | "low";
    context: string;
  }>;
  risk_assessment: {
    overall_risk: "low" | "medium" | "high";
    factors: string[];
    recommendations: string[];
  };
  approval_recommendation: "approve" | "conditional" | "reject" | "review_required";
};

**Example Output:**
{
  "missing_documents": [
    {
      "document_name": "Accounts Receivable Aging Report",
      "reason": "Required for working capital loans over $500K to verify collateral quality",
      "priority": "high"
    }
  ],
  "discrepancies": [
    {
      "issue": "Revenue mismatch between tax returns and financial statements",
      "severity": "critical",
      "supporting_docs_needed": ["Detailed GL reconciliation", "Monthly revenue breakdown"],
      "details": "2023 tax return shows $2.1M revenue, but financial statements show $2.8M. Need reconciliation."
    }
  ],
  "clarifications_needed": [
    {
      "topic": "Unusual large expense in Q3",
      "question": "Can you explain the $500K one-time expense in Q3 2023?",
      "urgency": "medium",
      "context": "This significantly impacts cash flow analysis and debt service coverage"
    }
  ],
  "risk_assessment": {
    "overall_risk": "medium",
    "factors": ["Revenue volatility", "Limited operating history", "Concentration risk with top customer"],
    "recommendations": ["Consider lower advance rate", "Request personal guarantee", "Monthly reporting covenant"]
  },
  "approval_recommendation": "conditional"
}

Respond ONLY with valid JSON, no other text.
`.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("analyze-application: Starting");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { application_id, loan_type, requested_amount } = await req.json();
    console.log("Analyzing application:", application_id);

    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch application details
    const { data: application, error: appError } = await supabase
      .from('borrower_applications')
      .select('*')
      .eq('id', application_id)
      .single();

    if (appError) throw appError;

    // Fetch any uploaded documents
    const { data: customer } = await supabase
      .from('customers')
      .select('id, legal_name, sector, requested_amount, financing_purpose')
      .eq('company_name', application.company_name)
      .single();

    let uploadedDocs: any[] = [];
    if (customer) {
      const { data: docRequests } = await supabase
        .from('document_requests')
        .select(`
          id,
          application_documents (
            id,
            original_name,
            file_path,
            mime_type
          )
        `)
        .eq('customer_id', customer.id);

      uploadedDocs = docRequests?.flatMap(dr => dr.application_documents || []) || [];
    }

    // Build context for AI
    const applicationContext = `
**Application Summary:**
- Company: ${application.company_name}
- Industry: ${application.industry || 'Not specified'}
- Contact: ${application.full_name}
- Email: ${application.email}
- Phone: ${application.phone || 'Not provided'}
- Requested Amount: $${(application.requested_amount || 0).toLocaleString()}
- Purpose: ${application.purpose || 'Not specified'}
- Business Address: ${application.business_address || 'Not provided'}

**Documents Uploaded (${uploadedDocs.length}):**
${uploadedDocs.map(doc => `- ${doc.original_name} (${doc.mime_type})`).join('\n') || 'No documents uploaded yet'}

**Loan Type:** ${loan_type || 'working_capital'}
**Requested Amount:** $${(requested_amount || application.requested_amount || 0).toLocaleString()}
`;

    console.log("Calling Lovable AI Gateway...");
    const payload = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt(loan_type || 'working_capital', requested_amount || application.requested_amount || 0) },
        {
          role: "user",
          content: `Analyze this loan application and provide a comprehensive review:\n\n${applicationContext}`,
        },
      ],
    };

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
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway returned ${resp.status}: ${errorText}`);
    }

    const data = await resp.json();
    console.log("AI response received");

    const content = data.choices?.[0]?.message?.content || "{}";
    console.log("Raw content:", content);

    // Parse JSON from response
    let analysis: AnalysisResult;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                       content.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      analysis = JSON.parse(jsonStr.trim());
      console.log("Analysis complete:", analysis.approval_recommendation);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
      console.error("Content was:", content);
      throw new Error("Failed to parse AI analysis");
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-application error:", e);
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
