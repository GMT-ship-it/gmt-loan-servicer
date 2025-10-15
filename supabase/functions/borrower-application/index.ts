// supabase/functions/borrower-application/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

const AppSchema = z.object({
  // accept both camelCase and snake_case; trim strings
  companyName: z.string().min(2).transform(s => s.trim()),
  industry: z.string().optional(),
  businessAddress: z.string().optional(),
  fullName: z.string().min(2).transform(s => s.trim()),
  title: z.string().optional(),
  email: z.string().email().transform(s => s.trim()),
  phone: z.string().min(7).optional(),
  // requestedAmount can arrive as string or number; coerce to number
  requestedAmount: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/[, $]/g, "") : v),
    z.coerce.number().positive()
  ),
  purpose: z.string().min(5).transform(s => s.trim()),
});

// also accept legacy keys and map → AppSchema
function normalizeBody(raw: any) {
  const b = raw ?? {};
  return {
    companyName: b.companyName ?? b.company_name,
    industry: b.industry,
    businessAddress: b.businessAddress ?? b.business_address,
    fullName: b.fullName ?? b.full_name,
    title: b.title,
    email: b.email,
    phone: b.phone,
    requestedAmount: b.requestedAmount ?? b.requested_amount ?? b.amount, // legacy
    purpose: b.purpose,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { "content-type": "application/json", ...cors },
      });
    }

    // Use service role key for public application submissions (no auth required)
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // parse JSON safely
    let raw: any = {};
    try {
      raw = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { "content-type": "application/json", ...cors },
      });
    }

    const normalized = normalizeBody(raw);
    const parsed = AppSchema.safeParse(normalized);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }),
        { status: 400, headers: { "content-type": "application/json", ...cors } }
      );
    }

    const v = parsed.data;
    const payload = {
      company_name: v.companyName,
      industry: v.industry ?? null,
      business_address: v.businessAddress ?? null,
      full_name: v.fullName,
      title: v.title ?? null,
      email: v.email,
      phone: v.phone ?? null,
      requested_amount: v.requestedAmount, // numeric
      purpose: v.purpose,
      created_by: null, // No user auth required for public applications
    };

    const { error } = await supabase.from("borrower_applications").insert(payload);
    if (error) {
      // surface DB errors to client for faster debugging
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { "content-type": "application/json", ...cors },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "content-type": "application/json", ...cors },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "content-type": "application/json", ...cors },
    });
  }
});
