import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LateFeesPanel } from "@/components/loans/LateFeesPanel";

export default function AdminLoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loan, setLoan] = useState<any>(null);
  const [borrower, setBorrower] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [balances, setBalances] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [genBusy, setGenBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [dlq, setDlq] = useState<any | null>(null);
  const [escCalc, setEscCalc] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select("*")
        .eq("id", id)
        .single();

      if (loanError) throw loanError;
      setLoan(loanData);

      if (loanData.borrower_id) {
        const { data: borrowerData } = await supabase
          .from("borrowers")
          .select("*")
          .eq("id", loanData.borrower_id)
          .single();
        setBorrower(borrowerData);
      }

      const { data: paymentsData } = await supabase
        .from("payments")
        .select("*")
        .eq("loan_id", id)
        .order("created_at", { ascending: false });

      setPayments(paymentsData || []);

      // Balances: call Postgres RPC helpers (principal_outstanding etc.)
      const { data: principalData } = await supabase.rpc("principal_outstanding", { p_loan_id: id });
      const { data: intDue } = await supabase
        .from("journal_entries")
        .select("amount")
        .eq("loan_id", id)
        .eq("account_code", "INTEREST_RECEIVABLE");
      const { data: feeDue } = await supabase
        .from("journal_entries")
        .select("amount")
        .eq("loan_id", id)
        .eq("account_code", "FEE_RECEIVABLE");
      const { data: escrow } = await supabase
        .from("escrow_accounts")
        .select("balance")
        .eq("loan_id", id)
        .maybeSingle();
      const { data: unapplied } = await supabase
        .from("journal_entries")
        .select("amount")
        .eq("loan_id", id)
        .eq("account_code", "UNAPPLIED_CASH");

      setBalances({
        principal: principalData ?? 0,
        accrued_interest: intDue?.reduce((s, v) => s + Number(v.amount), 0) ?? 0,
        fees: feeDue?.reduce((s, v) => s + Number(v.amount), 0) ?? 0,
        escrow: escrow?.balance ?? 0,
        unapplied: unapplied?.reduce((s, v) => s + Number(v.amount), 0) ?? 0,
      });

      // Journal history
      const { data: je } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("loan_id", id)
        .order("entry_date", { ascending: false })
        .limit(50);
      setEntries(je || []);

      // Fetch delinquency summary
      const { data: dlqData } = await supabase
        .from('loan_delinquency_summary')
        .select('*')
        .eq('loan_id', id)
        .maybeSingle();
      setDlq(dlqData || null);

      // Fetch escrow shortage/surplus
      const { data: escData } = await supabase.rpc("escrow_shortage_surplus", { p_loan_id: id });
      setEscCalc(escData || null);
    } catch (err) {
      console.error("Error loading loan:", err);
      toast({
        title: "Error",
        description: "Failed to load loan details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function postPayment() {
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("payments").insert({
        loan_id: id,
        borrower_id: loan.borrower_id,
        amount,
        status: "succeeded",
        received_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Payment Posted",
        description: `Successfully posted payment of $${amount.toLocaleString()}`,
      });

      setAmount(0);
      loadData();
    } catch (err: any) {
      console.error("Error posting payment:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to post payment",
        variant: "destructive",
      });
    }
  }

  function prevMonthRange(today = new Date()) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { start, end, startISO: iso(start), endISO: iso(end) };
  }

  async function regenerateSchedule() {
    if (!loan) return;
    try {
      setRegenerating(true);
      const { error } = await supabase.rpc("generate_monthly_schedule", {
        p_loan_id: loan.id,
      });
      if (error) throw error;
      toast({
        title: "Schedule regenerated",
        description: "The payment schedule has been updated.",
      });
      loadData();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Failed to regenerate schedule",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function generateMonthlyStatement() {
    try {
      setGenBusy(true);
      if (!loan) throw new Error("Loan not loaded");

      const { startISO, endISO } = prevMonthRange(new Date());

      // Fetch balances & activity for the period
      const [{ data: begPrin }, { data: endPrin }] = await Promise.all([
        supabase.rpc("principal_outstanding_asof", {
          p_loan_id: loan.id,
          p_asof: startISO,
        }),
        supabase.rpc("principal_outstanding_asof", {
          p_loan_id: loan.id,
          p_asof: endISO,
        }),
      ]);

      // Interest accrued in period (journal_entries: INTEREST_RECEIVABLE debits)
      const { data: intRows } = await supabase
        .from("journal_entries")
        .select("amount, entry_date")
        .eq("loan_id", loan.id)
        .eq("account_code", "INTEREST_RECEIVABLE")
        .gte("entry_date", startISO)
        .lte("entry_date", endISO);

      const interestAccrued = (intRows || []).reduce(
        (s: number, r: any) => s + (Number(r.amount) || 0),
        0
      );

      // Payments in period with breakdowns
      const { data: pays } = await supabase
        .from("payments")
        .select("amount, received_at, breakdown")
        .eq("loan_id", loan.id)
        .eq("status", "succeeded")
        .gte("received_at", `${startISO} 00:00:00`)
        .lte("received_at", `${endISO} 23:59:59`)
        .order("received_at", { ascending: true });

      const totals = (pays || []).reduce(
        (acc: any, p: any) => {
          const b = (p.breakdown as any) || {};
          acc.total += Number(p.amount) || 0;
          acc.principal += Number(b.principal || 0);
          acc.interest += Number(b.interest || 0);
          acc.fees += Number(b.fees || 0);
          return acc;
        },
        { total: 0, principal: 0, interest: 0, fees: 0 }
      );

      // Escrow activity (optional)
      const { data: escrowAcct } = await supabase
        .from("escrow_accounts")
        .select("id")
        .eq("loan_id", loan.id)
        .maybeSingle();

      let escrowTx: any[] = [];
      if (escrowAcct?.id) {
        const { data: escrowData } = await supabase
          .from("escrow_transactions")
          .select("tx_date, amount, kind, memo")
          .eq("escrow_id", escrowAcct.id)
          .gte("tx_date", startISO)
          .lte("tx_date", endISO)
          .in("kind", ["deposit", "disbursement", "adjustment"]);
        escrowTx = escrowData || [];
      }

      // Escrow shortage/surplus for statement
      const { data: escInfo } = await supabase.rpc("escrow_shortage_surplus", {
        p_loan_id: loan.id,
      });

      // --- Build PDF ---
      const doc = new jsPDF();

      const title = `Mountain Investments — Monthly Statement`;
      const period = `${new Date(startISO).toLocaleDateString()} – ${new Date(
        endISO
      ).toLocaleDateString()}`;
      doc.setFontSize(14);
      doc.text(title, 14, 16);
      doc.setFontSize(10);
      doc.text(`Loan #${loan.loan_number}`, 14, 22);
      doc.text(`Period: ${period}`, 14, 27);

      // Summary table
      autoTable(doc, {
        startY: 32,
        head: [["Item", "Amount (USD)"]],
        body: [
          ["Beginning Principal", fmt(begPrin)],
          ["Interest Accrued", fmt(interestAccrued)],
          ["Payments - Total", fmt(totals.total)],
          ["  ↳ Principal", fmt(totals.principal)],
          ["  ↳ Interest", fmt(totals.interest)],
          ["  ↳ Fees", fmt(totals.fees)],
          ["Ending Principal", fmt(endPrin)],
        ],
        styles: { fontSize: 10 },
        theme: "grid",
      });

      // Payments table
      if ((pays || []).length) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 8,
          head: [["Date", "Amount", "Principal", "Interest", "Fees"]],
          body: (pays || []).map((p) => [
            new Date(p.received_at).toLocaleDateString(),
            fmt(p.amount),
            fmt((p.breakdown as any)?.principal || 0),
            fmt((p.breakdown as any)?.interest || 0),
            fmt((p.breakdown as any)?.fees || 0),
          ]),
          styles: { fontSize: 9 },
          theme: "striped",
        });
      }

      // Escrow table (optional)
      if (escrowTx.length) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 8,
          head: [["Date", "Kind", "Amount", "Memo"]],
          body: escrowTx.map((t: any) => [
            new Date(t.tx_date).toLocaleDateString(),
            t.kind,
            fmt(t.amount),
            t.memo || "",
          ]),
          styles: { fontSize: 9 },
          theme: "striped",
        });
      }

      // Escrow analysis summary
      if (escInfo) {
        const esc = escInfo as any;
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 8,
          head: [["Escrow", "Amount (USD)"]],
          body: [
            ["Monthly Required", fmt(esc.monthly_required || 0)],
            ["Cushion Required", fmt(esc.cushion_required || 0)],
            ["Balance", fmt(esc.balance || 0)],
            ["Shortage", fmt(esc.shortage || 0)],
            ["Surplus", fmt(esc.surplus || 0)],
          ],
          styles: { fontSize: 10 },
          theme: "grid",
        });
      }

      // Escrow summary with shortage/surplus
      if (escInfo) {
        const esc = escInfo as any;
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 8,
          head: [["Escrow", "Amount (USD)"]],
          body: [
            ["Monthly Required", fmt(esc.monthly_required || 0)],
            ["Cushion Required", fmt(esc.cushion_required || 0)],
            ["Balance", fmt(esc.balance || 0)],
            ["Shortage", fmt(esc.shortage || 0)],
            ["Surplus", fmt(esc.surplus || 0)],
          ],
          styles: { fontSize: 10 },
          theme: "grid",
        });
      }

      function fmt(n: any) {
        const v = Number(n || 0);
        return v.toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
        });
      }

      // Save to a Blob
      const pdfBlob = doc.output("blob");

      // Upload to Storage (bucket: statements)
      const fileName = `loan_${loan.id}_${startISO}_${endISO}.pdf`;
      const storagePath = `${loan.id}/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from("statements")
        .upload(storagePath, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) throw upErr;

      // Insert statements row
      const { error: insErr } = await supabase.from("statements").insert({
        loan_id: loan.id,
        period_start: startISO,
        period_end: endISO,
        pdf_path: storagePath,
      });
      if (insErr) throw insErr;

      toast({
        title: "Statement Generated",
        description: "Monthly statement has been generated and saved successfully",
      });

      loadData();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Failed to generate statement",
        variant: "destructive",
      });
    } finally {
      setGenBusy(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading loan details...</div>;
  }

  if (!loan) {
    return <div className="p-6">Loan not found</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/loans")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-3xl font-semibold">Loan {loan.loan_number}</h1>
      </div>

      {borrower && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Borrower</div>
          <div className="text-lg font-semibold mt-1">{borrower.legal_name}</div>
          <div className="text-sm text-muted-foreground mt-1">{borrower.email}</div>
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          label="Principal"
          value={loan.principal}
          money
        />
        <StatCard
          label="Rate (APR)"
          value={`${(loan.interest_rate * 100).toFixed(2)}%`}
        />
        <StatCard
          label="Term"
          value={`${loan.term_months} months`}
        />
        <StatCard
          label="Status"
          value={loan.status}
        />
      </div>

      {balances && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Current Balances</h2>
          <div className="grid md:grid-cols-5 gap-3">
            <StatCard label="Principal Outstanding" value={balances.principal} money />
            <StatCard label="Accrued Interest" value={balances.accrued_interest} money />
            <StatCard label="Fees Due" value={balances.fees} money />
            <StatCard label="Escrow Balance" value={balances.escrow} money />
            <StatCard label="Unapplied Cash" value={balances.unapplied} money />
          </div>
        </section>
      )}

      {/* Delinquency Status */}
      {dlq && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Delinquency Status</h2>
            <Button
              onClick={regenerateSchedule}
              disabled={regenerating}
              variant="outline"
              size="sm"
            >
              {regenerating ? "Regenerating..." : "Regenerate Schedule"}
            </Button>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <StatCard 
              label="Next Due Date" 
              value={dlq.next_due_date ? new Date(dlq.next_due_date).toLocaleDateString() : '—'} 
            />
            <StatCard 
              label="Past-Due Amount" 
              value={Number(dlq.past_due_amount || 0)} 
              money 
            />
            <StatCard 
              label="Days Past Due" 
              value={dlq.days_past_due ?? 0} 
            />
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Bucket</div>
              <div className={`text-2xl font-semibold mt-2 ${
                dlq.bucket === 'CURRENT' 
                  ? 'text-emerald-600' 
                  : dlq.bucket === '1-30' 
                  ? 'text-yellow-600' 
                  : 'text-rose-600'
              }`}>
                {dlq.bucket}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Escrow Analysis */}
      {escCalc && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Escrow Analysis</h2>
          <div className="grid md:grid-cols-4 gap-3">
            <StatCard label="Monthly Required" value={escCalc.monthly_required} money />
            <StatCard label="Cushion Required" value={escCalc.cushion_required} money />
            <StatCard label="Shortage" value={escCalc.shortage} money />
            <StatCard label="Surplus" value={escCalc.surplus} money />
          </div>
        </section>
      )}

      <EscrowSettings loan={loan} onRefresh={loadData} />

      <LateFeesPanel loanId={loan.id} onRefresh={loadData} />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Post Payment</h2>
        <div className="flex gap-3">
          <Input
            type="number"
            placeholder="Amount"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="max-w-xs"
          />
          <Button onClick={postPayment}>Post Payment</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Payment History</h2>
        {payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No payments recorded yet
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-medium">Date</th>
                  <th className="p-4 text-right font-medium">Amount</th>
                  <th className="p-4 text-left font-medium">Status</th>
                  <th className="p-4 text-left font-medium">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border">
                    <td className="p-4">
                      {new Date(payment.created_at).toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {Number(payment.amount).toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        payment.status === "succeeded" ? "bg-green-100 text-green-800" :
                        payment.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {payment.breakdown ? JSON.stringify(payment.breakdown) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EscrowSettings loan={loan} onRefresh={loadData} />

      <EscrowPanel loanId={id!} onRefresh={loadData} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Actions</h2>
          <div className="flex gap-3">
            <Button
              onClick={generateMonthlyStatement}
              disabled={genBusy}
              variant="outline"
            >
              <FileText className="w-4 h-4 mr-2" />
              {genBusy ? "Generating..." : "Generate Prior-Month Statement"}
            </Button>
            <Button 
              onClick={async () => {
                if (!loan?.id) return;
                await supabase.rpc('generate_monthly_schedule', { p_loan_id: loan.id });
                toast({ title: "Schedule Regenerated", description: "Loan payment schedule has been regenerated" });
                loadData();
              }} 
              variant="outline"
            >
              Regenerate Schedule
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Journal Entries</h2>
        {entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No journal entries yet
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-medium">Date</th>
                  <th className="p-4 text-left font-medium">Account</th>
                  <th className="p-4 text-right font-medium">Amount</th>
                  <th className="p-4 text-left font-medium">Memo</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border">
                    <td className="p-4">
                      {new Date(e.entry_date).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-mono text-xs">{e.account_code}</td>
                    <td className="p-4 text-right font-mono">
                      {Number(e.amount).toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td className="p-4 text-muted-foreground">{e.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  money = false,
}: {
  label: string;
  value: any;
  money?: boolean;
}) {
  const displayValue =
    typeof value === "number" && money
      ? value.toLocaleString(undefined, { style: "currency", currency: "USD" })
      : value;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-2">{displayValue}</div>
    </div>
  );
}

function EscrowSettings({ loan, onRefresh }: { loan: any; onRefresh: () => void }) {
  const { toast } = useToast();
  const [projTax, setProjTax] = useState<number>(0);
  const [projIns, setProjIns] = useState<number>(0);
  const [cushionMonths, setCushionMonths] = useState<number>(2);
  const [calc, setCalc] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("escrow_settings")
        .select("*")
        .eq("loan_id", loan.id)
        .maybeSingle();
      if (data) {
        setProjTax(Number(data.proj_tax_annual || 0));
        setProjIns(Number(data.proj_ins_annual || 0));
        setCushionMonths(Number(data.cushion_months || 2));
      }
      const { data: ss } = await supabase.rpc("escrow_shortage_surplus", {
        p_loan_id: loan.id,
      });
      setCalc(ss || null);
    })();
  }, [loan.id]);

  async function saveAndRecalc() {
    try {
      setBusy(true);
      await supabase.from("escrow_settings").upsert({
        loan_id: loan.id,
        proj_tax_annual: projTax,
        proj_ins_annual: projIns,
        cushion_months: cushionMonths,
      });

      await supabase.rpc("recalc_escrow_requirements", { p_loan_id: loan.id });
      await supabase.rpc("generate_monthly_schedule", { p_loan_id: loan.id });

      const { data: ss } = await supabase.rpc("escrow_shortage_surplus", {
        p_loan_id: loan.id,
      });
      setCalc(ss || null);

      toast({
        title: "Escrow Settings Saved",
        description:
          "Requirements recalculated and schedule updated successfully",
      });

      onRefresh();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to save escrow settings",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  const fmt = (n: number) =>
    (n || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Escrow Settings</h2>
        <Button disabled={busy} onClick={saveAndRecalc}>
          {busy ? "Saving…" : "Save & Recalculate"}
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Projected Taxes (annual)
          </div>
          <Input
            type="number"
            value={projTax || ""}
            onChange={(e) => setProjTax(Number(e.target.value))}
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Projected Insurance (annual)
          </div>
          <Input
            type="number"
            value={projIns || ""}
            onChange={(e) => setProjIns(Number(e.target.value))}
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Cushion (months)
          </div>
          <Input
            type="number"
            value={cushionMonths || ""}
            onChange={(e) => setCushionMonths(Number(e.target.value))}
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <div>
            <div className="text-xs text-muted-foreground">Monthly Required</div>
            <div className="font-semibold text-sm">
              {fmt(calc?.monthly_required || loan.escrow_monthly_required || 0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Cushion Required</div>
            <div className="font-semibold text-sm">
              {fmt(calc?.cushion_required || loan.escrow_cushion_required || 0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Balance</div>
            <div className="font-semibold text-sm">{fmt(calc?.balance || 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Shortage / Surplus</div>
            <div className="font-semibold text-sm">
              {fmt(calc?.shortage || 0)} / {fmt(calc?.surplus || 0)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EscrowPanel({ loanId, onRefresh }: { loanId: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<any | null>(null);
  const [tx, setTx] = useState<any[]>([]);
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState<string>("");

  async function refresh() {
    const { data: sum } = await supabase
      .from("escrow_summary")
      .select("*")
      .eq("loan_id", loanId)
      .maybeSingle();
    setSummary(sum || null);

    const { data: esc } = await supabase
      .from("escrow_accounts")
      .select("id")
      .eq("loan_id", loanId)
      .maybeSingle();

    if (esc?.id) {
      const { data: rows } = await supabase
        .from("escrow_transactions")
        .select("*")
        .eq("escrow_id", esc.id)
        .order("tx_date", { ascending: false })
        .limit(25);
      setTx(rows || []);
    } else {
      setTx([]);
    }
  }

  useEffect(() => {
    refresh();
  }, [loanId]);

  async function postDeposit() {
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Enter a positive amount",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.rpc("escrow_post_transaction", {
      p_loan_id: loanId,
      p_tx_date: date,
      p_amount: amount,
      p_memo: memo || "Escrow deposit",
    });
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Deposit Posted",
      description: `Successfully posted escrow deposit of $${amount.toLocaleString()}`,
    });
    setAmount(0);
    setMemo("");
    await refresh();
    onRefresh();
  }

  async function postDisbursement() {
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Enter a positive amount",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.rpc("escrow_post_transaction", {
      p_loan_id: loanId,
      p_tx_date: date,
      p_amount: -amount,
      p_memo: memo || "Escrow disbursement",
    });
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Disbursement Posted",
      description: `Successfully posted escrow disbursement of $${amount.toLocaleString()}`,
    });
    setAmount(0);
    setMemo("");
    await refresh();
    onRefresh();
  }

  const fmtMoney = (n: number) =>
    (n || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Escrow</h2>

      <div className="grid md:grid-cols-3 gap-3">
        <StatCard label="Balance" value={summary?.escrow_balance || 0} money />
        <StatCard label="Deposits (lifetime)" value={summary?.deposits_total || 0} money />
        <StatCard label="Disbursements (lifetime)" value={summary?.disbursements_total || 0} money />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input
            type="number"
            placeholder="Amount"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <Input
            className="md:col-span-2"
            placeholder="Memo (optional)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={postDeposit}>
            Post Deposit
          </Button>
          <Button variant="secondary" onClick={postDisbursement}>
            Post Disbursement
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Kind</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">Memo</th>
            </tr>
          </thead>
          <tbody>
            {tx.map((t: any) => (
              <tr key={t.id} className="border-b border-border">
                <td className="p-3">{new Date(t.tx_date).toLocaleDateString()}</td>
                <td className="p-3 capitalize">{t.kind}</td>
                <td className="p-3 text-right">{fmtMoney(t.amount)}</td>
                <td className="p-3 text-muted-foreground">{t.memo || "—"}</td>
              </tr>
            ))}
            {tx.length === 0 && (
              <tr>
                <td className="p-3 text-muted-foreground text-center" colSpan={4}>
                  No escrow activity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
