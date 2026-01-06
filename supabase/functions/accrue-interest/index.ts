// Deno Deploy (Supabase Edge Function)
// Daily interest accrual for fin_instruments with catch-up/backfill support
// Prevents duplicate accruals via fin_accrual_postings table
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

// Helper to add days to a date string
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Helper to get all dates between start (exclusive) and end (inclusive)
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = addDays(startDate, 1);
  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

// Core accrual logic for a single date
async function runAccrualForDate(
  runDate: string,
  instruments: any[],
  accountByName: Record<string, any>
): Promise<{ processed: number; totalInterest: number; skipped: number; details: any[] }> {
  const notesReceivable = accountByName['Notes Receivable'];
  const notesPayable = accountByName['Notes Payable'];
  const interestReceivable = accountByName['Interest Receivable'];
  const interestPayable = accountByName['Interest Payable'];
  const interestIncome = accountByName['Interest Income'];
  const interestExpense = accountByName['Interest Expense'];

  const results: any[] = [];
  let skippedCount = 0;

  for (const inst of instruments) {
    // Check if accrual already exists for this instrument/date (idempotency check)
    const { data: existingAccrual } = await supabase
      .from('fin_accrual_postings')
      .select('id')
      .eq('instrument_id', inst.id)
      .eq('accrual_date', runDate)
      .maybeSingle();

    if (existingAccrual) {
      console.log(`  Skipping ${inst.name} - accrual already exists for ${runDate}`);
      skippedCount++;
      continue;
    }

    // Determine principal account based on position
    const principalAccountId = inst.position === 'receivable' 
      ? notesReceivable.id 
      : notesPayable.id;

    // Get all transaction lines for this instrument on the principal account up to runDate
    const { data: principalLines, error: plError } = await supabase
      .from('fin_transaction_lines')
      .select('debit, credit, transaction:fin_transactions!inner(date)')
      .eq('instrument_id', inst.id)
      .eq('account_id', principalAccountId)
      .lte('transaction.date', runDate);

    if (plError) {
      console.error(`Error fetching principal lines for ${inst.id}:`, plError);
      continue;
    }

    // Calculate principal outstanding as of runDate
    let principal = 0;
    if (inst.position === 'receivable') {
      principal = (principalLines || []).reduce((sum: number, l: any) => 
        sum + (l.debit || 0) - (l.credit || 0), 0);
    } else {
      principal = (principalLines || []).reduce((sum: number, l: any) => 
        sum + (l.credit || 0) - (l.debit || 0), 0);
    }

    if (principal <= 0) {
      continue;
    }

    // Calculate daily interest
    const basisDays = inst.day_count_basis === 'ACT/360' || inst.day_count_basis === '30/360' ? 360 : 365;
    const dailyRate = inst.rate_apr / basisDays;
    const interestToday = Math.round(principal * dailyRate * 100) / 100;

    if (interestToday <= 0) {
      continue;
    }

    // Create accrual transaction
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

    // Create transaction lines based on position
    let debitAccountId: string;
    let creditAccountId: string;

    if (inst.position === 'receivable') {
      debitAccountId = interestReceivable.id;
      creditAccountId = interestIncome.id;
    } else {
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

    // Insert into fin_accrual_postings to prevent future duplicates
    const { error: postingError } = await supabase
      .from('fin_accrual_postings')
      .insert({
        instrument_id: inst.id,
        accrual_date: runDate,
        transaction_id: txn.id,
        interest_amount: interestToday,
      });

    if (postingError) {
      // Unique constraint violation means duplicate - this is expected if racing
      if (postingError.code === '23505') {
        console.log(`  Duplicate accrual detected for ${inst.name} on ${runDate}, skipping`);
        skippedCount++;
        continue;
      }
      console.error(`Error inserting accrual posting for ${inst.id}:`, postingError);
    }

    // Get previous day's accrued interest balance
    const prevDateStr = addDays(runDate, -1);
    const { data: prevPosition } = await supabase
      .from('fin_instrument_daily_positions')
      .select('accrued_interest_balance')
      .eq('instrument_id', inst.id)
      .eq('as_of_date', prevDateStr)
      .maybeSingle();

    const prevBalance = prevPosition?.accrued_interest_balance || 0;
    const newBalance = prevBalance + interestToday;

    // Upsert daily position
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
  }

  return {
    processed: results.length,
    totalInterest: results.reduce((sum, r) => sum + r.interest_accrued, 0),
    skipped: skippedCount,
    details: results,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Starting interest accrual job');

  try {
    // Parse request body
    let mode: 'single' | 'catch_up' = 'catch_up';
    let targetDate: string = new Date().toISOString().slice(0, 10);
    
    try {
      const body = await req.json();
      mode = body.mode || 'catch_up';
      if (body.run_date) {
        targetDate = body.run_date;
      }
    } catch {
      // Use defaults
    }

    console.log(`Mode: ${mode}, Target date: ${targetDate}`);

    // Fetch all active instruments
    const { data: instruments, error: instError } = await supabase
      .from('fin_instruments')
      .select('*')
      .eq('status', 'active');

    if (instError) {
      console.error('Error fetching instruments:', instError);
      throw instError;
    }

    if (!instruments || instruments.length === 0) {
      console.log('No active instruments found');
      return new Response(JSON.stringify({ 
        ok: true, 
        message: 'No active instruments to process',
        dates_processed: 0,
        total_interest_accrued: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    console.log(`Found ${instruments.length} active instruments`);

    // Fetch all accounts for lookups
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

    // Validate required accounts exist
    const requiredAccounts = ['Notes Receivable', 'Notes Payable', 'Interest Receivable', 'Interest Payable', 'Interest Income', 'Interest Expense'];
    for (const accName of requiredAccounts) {
      if (!accountByName[accName]) {
        throw new Error(`Missing required account: ${accName}`);
      }
    }

    // Determine dates to process
    let datesToProcess: string[] = [];

    if (mode === 'single') {
      // Single mode: just process the target date
      datesToProcess = [targetDate];
    } else {
      // Catch-up mode: find last run date and process all missing dates
      const { data: lastRun } = await supabase
        .from('fin_interest_accrual_runs')
        .select('run_date')
        .eq('status', 'completed')
        .order('run_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      let startFrom: string;
      
      if (lastRun?.run_date) {
        startFrom = lastRun.run_date;
        console.log(`Last successful run: ${startFrom}`);
      } else {
        // No previous runs - start from earliest instrument start_date or yesterday
        const earliestStart = instruments.reduce((min: string, inst: any) => {
          return inst.start_date < min ? inst.start_date : min;
        }, instruments[0]?.start_date || addDays(targetDate, -1));
        
        startFrom = addDays(earliestStart, -1); // Start from day before earliest so we include earliest
        console.log(`No previous runs. Starting from instrument earliest: ${earliestStart}`);
      }

      datesToProcess = getDateRange(startFrom, targetDate);
      console.log(`Dates to process: ${datesToProcess.length} (from ${datesToProcess[0] || 'none'} to ${targetDate})`);
    }

    // Filter out dates that already have completed runs in fin_interest_accrual_runs
    const { data: existingRuns } = await supabase
      .from('fin_interest_accrual_runs')
      .select('run_date')
      .in('run_date', datesToProcess);

    const existingDates = new Set((existingRuns || []).map(r => r.run_date));
    const filteredDates = datesToProcess.filter(d => !existingDates.has(d));

    console.log(`After filtering existing runs: ${filteredDates.length} dates to process`);

    if (filteredDates.length === 0) {
      return new Response(JSON.stringify({ 
        ok: true, 
        message: 'All dates already processed',
        dates_processed: 0,
        total_interest_accrued: 0,
        skipped: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // Process each date
    let totalDatesProcessed = 0;
    let grandTotalInterest = 0;
    let totalSkipped = 0;
    const allDetails: any[] = [];

    for (const runDate of filteredDates) {
      console.log(`Processing date: ${runDate}`);
      
      const result = await runAccrualForDate(runDate, instruments, accountByName);
      
      // Record the accrual run
      await supabase
        .from('fin_interest_accrual_runs')
        .insert({
          run_date: runDate,
          status: 'completed',
        });

      totalDatesProcessed++;
      grandTotalInterest += result.totalInterest;
      totalSkipped += result.skipped;
      allDetails.push({
        date: runDate,
        instruments_processed: result.processed,
        instruments_skipped: result.skipped,
        interest_accrued: result.totalInterest,
      });

      console.log(`  Completed: ${result.processed} instruments, ${result.skipped} skipped, $${result.totalInterest.toFixed(2)} interest`);
    }

    console.log(`Accrual complete. Processed ${totalDatesProcessed} dates, total interest: $${grandTotalInterest.toFixed(2)}`);

    return new Response(JSON.stringify({ 
      ok: true, 
      mode,
      dates_processed: totalDatesProcessed,
      total_interest_accrued: grandTotalInterest,
      instruments_skipped: totalSkipped,
      details: allDetails,
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
