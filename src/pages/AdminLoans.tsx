import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Loan } from "@/types/domain";
import { NewLoanWizard } from "@/components/loans/NewLoanWizard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EmptyState from "@/components/EmptyState";

export default function AdminLoans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadLoans();
  }, []);

  async function loadLoans() {
    try {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setLoans((data as Loan[]) || []);
    } catch (err) {
      console.error("Error loading loans:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Loans</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Loan
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading loans...</div>
      ) : loans.length === 0 ? (
        <EmptyState
          title="No loans yet"
          description="Create your first loan to get started."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Loan
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="p-4 text-left font-medium whitespace-nowrap">Loan #</th>
                <th className="p-4 text-left font-medium whitespace-nowrap">Borrower</th>
                <th className="p-4 text-right font-medium whitespace-nowrap">Principal</th>
                <th className="p-4 text-left font-medium whitespace-nowrap">Rate</th>
                <th className="p-4 text-left font-medium whitespace-nowrap">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium whitespace-nowrap">{loan.loan_number}</td>
                  <td className="p-4 whitespace-nowrap">
                    <BorrowerCell borrowerId={loan.borrower_id} />
                  </td>
                  <td className="p-4 text-right font-mono">
                    {Number(loan.principal).toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </td>
                  <td className="p-4">{(loan.interest_rate * 100).toFixed(2)}%</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      loan.status === "active" ? "bg-green-100 text-green-800" :
                      loan.status === "paid_off" ? "bg-blue-100 text-blue-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/loans/${loan.id}`)}
                    >
                      Open →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <NewLoanWizard
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            loadLoans();
          }}
        />
      )}
    </div>
  );
}

function BorrowerCell({ borrowerId }: { borrowerId: string }) {
  const [borrower, setBorrower] = useState<any>(null);

  useEffect(() => {
    supabase
      .from("borrowers")
      .select("legal_name")
      .eq("id", borrowerId)
      .single()
      .then(({ data }) => setBorrower(data));
  }, [borrowerId]);

  return <span className="text-muted-foreground">{borrower?.legal_name || "—"}</span>;
}
