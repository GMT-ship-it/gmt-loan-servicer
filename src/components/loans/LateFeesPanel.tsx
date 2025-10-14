import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface LateFeesPanelProps {
  loanId: string;
}

export function LateFeesPanel({ loanId }: LateFeesPanelProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function refresh() {
    const { data } = await supabase
      .from("assessed_fees")
      .select("*")
      .eq("loan_id", loanId)
      .order("assessed_date", { ascending: false });
    setRows(data || []);
  }

  useEffect(() => {
    refresh();
  }, [loanId]);

  async function waive(id: string) {
    setBusy(true);
    const todayISO = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.rpc("waive_late_fee", {
      p_fee_id: id,
      p_waiver_date: todayISO,
      p_memo: "Late fee waived by admin",
    });
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Late fee waived successfully",
      });
      await refresh();
    }
    setBusy(false);
  }

  const fmt = (n: number) =>
    (n || 0).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Late Fees</h2>
      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Installment</th>
              <th className="p-3 text-left">Due Date</th>
              <th className="p-3 text-left">Assessed</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">#{r.installment_no}</td>
                <td className="p-3">
                  {new Date(r.due_date).toLocaleDateString()}
                </td>
                <td className="p-3">
                  {new Date(r.assessed_date).toLocaleDateString()}
                </td>
                <td className="p-3 text-right">{fmt(Number(r.amount))}</td>
                <td className="p-3 capitalize">{r.status}</td>
                <td className="p-3 text-right">
                  {r.status === "active" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => waive(r.id)}
                    >
                      Waive
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>
                  No late fees.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
