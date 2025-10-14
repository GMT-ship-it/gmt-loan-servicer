import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
