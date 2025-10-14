import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

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

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">
              Next Due Date
            </div>
            <div className="text-2xl font-semibold mb-2">
              {formatDate(estimateNextDue(loan))}
            </div>
            <p className="text-xs text-muted-foreground">
              (Simple estimate based on first payment date + frequency)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">
              Payoff Quote (as of {formatDate(todayISO)})
            </div>
            <div className="text-2xl font-semibold">
              {formatMoney(payoff ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

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

function estimateNextDue(loan: any) {
  // naive compute: advance from first_payment_date by frequency until >= today
  const first = new Date(loan.first_payment_date);
  const now = new Date();
  const stepDays =
    loan.payment_frequency === "weekly"
      ? 7
      : loan.payment_frequency === "biweekly"
      ? 14
      : 30; // monthly rough; can replace with exact calendar logic later
  let d = new Date(first);
  while (d < now) d = new Date(d.getTime() + stepDays * 24 * 3600 * 1000);
  return d;
}
