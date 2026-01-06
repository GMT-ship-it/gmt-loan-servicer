// Deno Deploy (Supabase Edge Function)
// Daily interest accrual for fin_instruments
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Starting daily interest accrual job');

  try {
    // Parse optional run_date from request body
    let runDate: string;
    try {
      const body = await req.json();
      runDate = body.run_date || new Date().toISOString().slice(0, 10);
    } catch {
      runDate = new Date().toISOString().slice(0, 10);
    }
    console.log(`Accruing interest for date: ${runDate}`);

    // 1) Check for duplicate run
    const { data: existingRun, error: runCheckError } = await supabase
      .from('fin_interest_accrual_runs')
      .select('id')
      .eq('run_date', runDate)
      .maybeSingle();

    if (runCheckError) {
      console.error('Error checking existing run:', runCheckError);
      throw runCheckError;
    }

    if (existingRun) {
      console.log(`Accrual already run for ${runDate}, skipping`);
      return new Response(JSON.stringify({ 
        ok: true, 
        message: `Accrual already run for ${runDate}`,
        skipped: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // 2) Fetch all active instruments
    const { data: instruments, error: instError } = await supabase
      .from('fin_instruments')
      .select('*')
      .eq('status', 'active');

    if (instError) {
      console.error('Error fetching instruments:', instError);
      throw instError;
    }

    console.log(`Found ${instruments?.length || 0} active instruments`);

    // 3) Fetch all accounts for lookups
    const { data: accounts, error: accError } = await supabase
      .from('fin_accounts')
      .select('id, name, type');

    if (accError) {
      console.error('Error fetching accounts:', accError);
      throw accError;
    }

    const accountByName = (accounts || []).reduce((acc: Record<string, any>, a: any) => {
      acc[a.name] = a;
      return acc;
    }, {});

    // Required accounts
    const notesReceivable = accountByName['Notes Receivable'];
    const notesPayable = accountByName['Notes Payable'];
    const interestReceivable = accountByName['Interest Receivable'];
    const interestPayable = accountByName['Interest Payable'];
    const interestIncome = accountByName['Interest Income'];
    const interestExpense = accountByName['Interest Expense'];

    if (!notesReceivable || !notesPayable || !interestReceivable || !interestPayable || !interestIncome || !interestExpense) {
      throw new Error('Missing required accounts for accrual. Ensure Notes Receivable/Payable, Interest Receivable/Payable, Interest Income, Interest Expense exist.');
    }

    const results: any[] = [];

    // 4) Process each instrument
    for (const inst of instruments || []) {
      console.log(`Processing instrument: ${inst.name} (${inst.id})`);

      // Determine principal account based on position
      const principalAccountId = inst.position === 'receivable' 
        ? notesReceivable.id 
        : notesPayable.id;

      // Get all transaction lines for this instrument on the principal account
      const { data: principalLines, error: plError } = await supabase
        .from('fin_transaction_lines')
        .select('debit, credit')
        .eq('instrument_id', inst.id)
        .eq('account_id', principalAccountId);

      if (plError) {
        console.error(`Error fetching principal lines for ${inst.id}:`, plError);
        continue;
      }

      // Calculate principal outstanding
      let principal = 0;
      if (inst.position === 'receivable') {
        // Notes Receivable: debits - credits
        principal = (principalLines || []).reduce((sum: number, l: any) => 
          sum + (l.debit || 0) - (l.credit || 0), 0);
      } else {
        // Notes Payable: credits - debits
        principal = (principalLines || []).reduce((sum: number, l: any) => 
          sum + (l.credit || 0) - (l.debit || 0), 0);
      }

      console.log(`  Principal outstanding: ${principal}`);

      if (principal <= 0) {
        console.log(`  Skipping - no principal outstanding`);
        continue;
      }

      // Calculate daily interest
      const basisDays = inst.day_count_basis === 'ACT/360' || inst.day_count_basis === '30/360' ? 360 : 365;
      const dailyRate = inst.rate_apr / basisDays;
      const interestToday = Math.round(principal * dailyRate * 100) / 100; // Round to 2 decimals

      console.log(`  APR: ${inst.rate_apr}, Basis: ${basisDays}, Daily rate: ${dailyRate}, Interest today: ${interestToday}`);

      if (interestToday <= 0) {
        console.log(`  Skipping - no interest to accrue`);
        continue;
      }

      // 5) Create accrual transaction
      const { data: txn, error: txnError } = await supabase
        .from('fin_transactions')
        .insert({
          entity_id: inst.entity_id,
          date: runDate,
          type: 'accrual',
          memo: `Daily interest accrual for ${inst.name}`,
          source: 'system',
        })
        .select()
        .single();

      if (txnError) {
        console.error(`Error creating transaction for ${inst.id}:`, txnError);
        continue;
      }

      // 6) Create transaction lines based on position
      let debitAccountId: string;
      let creditAccountId: string;

      if (inst.position === 'receivable') {
        // Dr Interest Receivable, Cr Interest Income
        debitAccountId = interestReceivable.id;
        creditAccountId = interestIncome.id;
      } else {
        // Dr Interest Expense, Cr Interest Payable
        debitAccountId = interestExpense.id;
        creditAccountId = interestPayable.id;
      }

      const { error: linesError } = await supabase
        .from('fin_transaction_lines')
        .insert([
          {
            transaction_id: txn.id,
            account_id: debitAccountId,
            debit: interestToday,
            credit: null,
            instrument_id: inst.id,
            counterparty_id: inst.counterparty_id,
          },
          {
            transaction_id: txn.id,
            account_id: creditAccountId,
            debit: null,
            credit: interestToday,
            instrument_id: inst.id,
            counterparty_id: inst.counterparty_id,
          },
        ]);

      if (linesError) {
        console.error(`Error creating transaction lines for ${inst.id}:`, linesError);
        continue;
      }

      // 7) Get previous day's accrued interest balance
      const prevDate = new Date(runDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().slice(0, 10);

      const { data: prevPosition, error: prevPosError } = await supabase
        .from('fin_instrument_daily_positions')
        .select('accrued_interest_balance')
        .eq('instrument_id', inst.id)
        .eq('as_of_date', prevDateStr)
        .maybeSingle();

      const prevBalance = prevPosition?.accrued_interest_balance || 0;
      const newBalance = prevBalance + interestToday;

      // 8) Upsert daily position
      const { error: posError } = await supabase
        .from('fin_instrument_daily_positions')
        .upsert({
          instrument_id: inst.id,
          as_of_date: runDate,
          principal_outstanding: principal,
          interest_accrued_today: interestToday,
          accrued_interest_balance: newBalance,
        }, {
          onConflict: 'instrument_id,as_of_date',
        });

      if (posError) {
        console.error(`Error upserting daily position for ${inst.id}:`, posError);
      }

      results.push({
        instrument_id: inst.id,
        instrument_name: inst.name,
        position: inst.position,
        principal,
        interest_accrued: interestToday,
        accrued_balance: newBalance,
      });

      console.log(`  Successfully accrued ${interestToday} for ${inst.name}`);
    }

    // 9) Record the accrual run
    const { error: runError } = await supabase
      .from('fin_interest_accrual_runs')
      .insert({
        run_date: runDate,
        status: 'completed',
        instruments_processed: results.length,
        total_interest_accrued: results.reduce((sum, r) => sum + r.interest_accrued, 0),
      });

    if (runError) {
      console.error('Error recording accrual run:', runError);
    }

    console.log(`Interest accrual completed. Processed ${results.length} instruments.`);

    return new Response(JSON.stringify({ 
      ok: true, 
      run_date: runDate,
      instruments_processed: results.length,
      total_interest_accrued: results.reduce((sum, r) => sum + r.interest_accrued, 0),
      details: results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Interest accrual job failed:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
