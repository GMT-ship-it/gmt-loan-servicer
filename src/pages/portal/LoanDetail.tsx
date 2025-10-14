import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import { LateFeesPanel } from "@/components/loans/LateFeesPanel";

type Statement = {
  id: string;
  period_start: string;
  period_end: string;
  pdf_path: string;
  created_at: string;
};

export default function BorrowerLoanDetail() {
  const { id } = useParams();
  const [loan, setLoan] = useState<any>(null);
  const [balances, setBalances] = useState<any | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [payoff, setPayoff] = useState<number | null>(null);
  const [due, setDue] = useState<any | null>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [escCalc, setEscCalc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);

      // RLS ensures borrower sees only their own data
      const { data: loanData, error: loanErr } = await supabase
        .from("loans")
        .select("*")
        .eq("id", id)
        .single();
      if (loanErr) {
        setLoading(false);
        return;
      }
      setLoan(loanData);

      // Balances
      const [
        { data: principal },
        { data: accruedInt },
        { data: feeRows },
        { data: unappliedRows },
        { data: escrow },
      ] = await Promise.all([
        supabase.rpc("principal_outstanding", { p_loan_id: id }),
        supabase.rpc("accrued_interest", { p_loan_id: id }),
        supabase
          .from("journal_entries")
          .select("amount")
          .eq("loan_id", id)
          .eq("account_code", "FEE_RECEIVABLE"),
        supabase
          .from("journal_entries")
          .select("amount")
          .eq("loan_id", id)
          .eq("account_code", "UNAPPLIED_CASH"),
        supabase
          .from("escrow_accounts")
          .select("balance")
          .eq("loan_id", id)
          .maybeSingle(),
      ]);

      const fees = (feeRows || []).reduce((s, r) => s + Number(r.amount), 0);
      const unapplied = (unappliedRows || []).reduce(
        (s, r) => s + Number(r.amount),
        0
      );

      setBalances({
        principal: principal ?? 0,
        accrued_interest: accruedInt ?? 0,
        fees,
        unapplied,
        escrow: escrow?.balance ?? 0,
      });

      // Statements list
      const { data: st } = await supabase
        .from("statements")
        .select("id, period_start, period_end, pdf_path, created_at")
        .eq("loan_id", id)
        .order("period_end", { ascending: false });
      setStatements(st || []);

      // Payoff as of today
      const { data: payoffVal } = await supabase.rpc("payoff_quote", {
        p_loan_id: id,
        p_asof: todayISO,
      });
      setPayoff(payoffVal ?? 0);

      // Due summary
      const { data: dueJson } = await supabase.rpc("borrower_due_summary", {
        p_loan_id: id,
        p_asof: todayISO,
      });
      setDue(dueJson || null);

      // Recent payments
      const { data: pays } = await supabase
        .from("loan_recent_payments")
        .select("*")
        .eq("loan_id", id)
        .order("paid_date", { ascending: false })
        .limit(10);
      setRecentPayments(pays || []);

      // Escrow shortage/surplus
      const { data: escData } = await supabase.rpc("escrow_shortage_surplus", {
        p_loan_id: id,
      });
      setEscCalc(escData || null);

      setLoading(false);
    })();
  }, [id, todayISO]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!loan) return <div className="p-6">Not found.</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold">Loan #{loan.loan_number}</h1>

      {balances && (
        <div className="grid md:grid-cols-5 gap-4">
          <CardStat
            label="Principal Outstanding"
            value={balances.principal}
            money
          />
          <CardStat
            label="Accrued Interest"
            value={balances.accrued_interest}
            money
          />
          <CardStat label="Fees Due" value={balances.fees} money />
          <CardStat label="Escrow Balance" value={balances.escrow} money />
          <CardStat label="Unapplied Cash" value={balances.unapplied} money />
        </div>
      )}

      {/* Amount Due Section */}
      {due && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Payment Status</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <CardStat
              label="Amount Due Today"
              value={Number(due.amount_due_today || 0)}
              money
            />
            <CardStat
              label="Past-Due Amount"
              value={Number(due.past_due_amount || 0)}
              money
            />
            <CardStat
              label="Next Due Date"
              value={
                due.next_due_date
                  ? new Date(due.next_due_date).toLocaleDateString()
                  : "—"
              }
            />
          </div>
        </section>
      )}

      {/* Escrow Analysis */}
      {escCalc && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Escrow Analysis</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <CardStat
              label="Monthly Required"
              value={Number((escCalc as any).monthly_required || 0)}
              money
            />
            <CardStat
              label="Cushion Required"
              value={Number((escCalc as any).cushion_required || 0)}
              money
            />
            <CardStat
              label="Shortage"
              value={Number((escCalc as any).shortage || 0)}
              money
            />
            <CardStat
              label="Surplus"
              value={Number((escCalc as any).surplus || 0)}
              money
            />
          </div>
        </section>
      )}

      {/* Late Fees (read-only for borrowers) */}
      <LateFeesPanel loanId={id!} />

      {/* Recent Payments */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Payments</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-medium">Date</th>
                  <th className="p-4 text-right font-medium">Amount</th>
                  <th className="p-4 text-right font-medium">Principal</th>
                  <th className="p-4 text-right font-medium">Interest</th>
                  <th className="p-4 text-right font-medium">Fees</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((r) => (
                  <tr key={r.payment_id} className="border-b border-border">
                    <td className="p-4">
                      {new Date(r.paid_date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {formatMoney(Number(r.amount))}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {formatMoney(Number(r.principal))}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {formatMoney(Number(r.interest))}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {formatMoney(Number(r.fees))}
                    </td>
                  </tr>
                ))}
                {recentPayments.length === 0 && (
                  <tr>
                    <td
                      className="p-4 text-muted-foreground text-center"
                      colSpan={5}
                    >
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Escrow Activity */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Escrow Activity</h2>
        <EscrowActivity loanId={id!} />
      </section>

      {/* Payoff Letter Generator */}
      {loan && balances && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Payoff Letter</h2>
          <PayoffLetter loan={loan} balances={balances} payoff={payoff ?? 0} />
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Statements</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-medium">Period</th>
                  <th className="p-4 text-left font-medium">Generated</th>
                  <th className="p-4 text-left font-medium">Download</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.id} className="border-b border-border">
                    <td className="p-4">
                      {formatPeriod(s.period_start, s.period_end)}
                    </td>
                    <td className="p-4">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <StatementLink path={s.pdf_path} />
                    </td>
                  </tr>
                ))}
                {statements.length === 0 && (
                  <tr>
                    <td
                      className="p-4 text-muted-foreground text-center"
                      colSpan={3}
                    >
                      No statements yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function CardStat({
  label,
  value,
  money = false,
}: {
  label: string;
  value: any;
  money?: boolean;
}) {
  const v = typeof value === "number" && money ? formatMoney(value) : value;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="text-2xl font-semibold">{v}</div>
      </CardContent>
    </Card>
  );
}

function StatementLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      // For private buckets, use createSignedUrl
      const { data } = await supabase.storage
        .from("loan-documents")
        .createSignedUrl(path, 3600);
      setUrl(data?.signedUrl || null);
    })();
  }, [path]);
  return url ? (
    <a
      className="text-primary hover:underline font-medium"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      Download PDF
    </a>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

// --- simple helpers ---
function formatMoney(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString();
}
function formatPeriod(a: string, b: string) {
  return `${formatDate(a)} – ${formatDate(b)}`;
}

function PayoffLetter({
  loan,
  balances,
  payoff,
}: {
  loan: any;
  balances: any;
  payoff: number;
}) {
  const [asOf, setAsOf] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [busy, setBusy] = useState(false);

  async function generate() {
    try {
      setBusy(true);
      // Get payoff for the selected date
      const { data: payoffQuote } = await supabase.rpc("payoff_quote", {
        p_loan_id: loan.id,
        p_asof: asOf,
      });

      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text("Payoff Letter", 14, 16);
      doc.setFontSize(10);
      doc.text(`Loan #${loan.loan_number}`, 14, 22);
      doc.text(`As of: ${new Date(asOf).toLocaleDateString()}`, 14, 27);
      doc.text(`Borrower: (on file)`, 14, 32);

      const lines = [
        `Principal Outstanding: ${formatMoney(balances.principal)}`,
        `Accrued Interest (approx.): ${formatMoney(balances.accrued_interest)}`,
        `Fees Due: ${formatMoney(balances.fees)}`,
        `Unapplied Cash: ${formatMoney(balances.unapplied)}`,
        `------------------------------------`,
        `Total Payoff (as of ${new Date(asOf).toLocaleDateString()}): ${formatMoney(payoffQuote || 0)}`,
        ``,
        `This payoff quote is valid for the date indicated above and may change due to additional accruals,`,
        `fees, payments, or disbursements. Please contact Mountain Investments to remit payoff funds.`,
      ];
      let y = 42;
      lines.forEach((l) => {
        doc.text(l, 14, y);
        y += 6;
      });

      doc.save(`Payoff_${loan.loan_number}_${asOf}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="text-sm text-muted-foreground">
          Generate a payoff letter for a specific date
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={generate} disabled={busy}>
            <FileDown className="w-4 h-4 mr-2" />
            {busy ? "Generating…" : "Download PDF"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This generates a borrower-facing payoff letter locally (not stored).
          Admin PDFs are stored in Statements.
        </p>
      </CardContent>
    </Card>
  );
}

function EscrowActivity({ loanId }: { loanId: string }) {
  const [tx, setTx] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
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
      }
    })();
  }, [loanId]);

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="p-4 text-left font-medium">Date</th>
              <th className="p-4 text-left font-medium">Type</th>
              <th className="p-4 text-right font-medium">Amount</th>
              <th className="p-4 text-left font-medium">Memo</th>
            </tr>
          </thead>
          <tbody>
            {tx.map((t) => (
              <tr key={t.id} className="border-b border-border">
                <td className="p-4">{new Date(t.tx_date).toLocaleDateString()}</td>
                <td className="p-4 capitalize">{t.kind}</td>
                <td className="p-4 text-right font-mono">
                  {formatMoney(Number(t.amount))}
                </td>
                <td className="p-4 text-muted-foreground">{t.memo || "—"}</td>
              </tr>
            ))}
            {tx.length === 0 && (
              <tr>
                <td
                  className="p-4 text-muted-foreground text-center"
                  colSpan={4}
                >
                  No escrow activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
