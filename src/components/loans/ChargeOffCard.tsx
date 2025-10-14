import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface ChargeOffCardProps {
  loan: any;
  onRefresh?: () => void;
}

export function ChargeOffCard({ loan, onRefresh }: ChargeOffCardProps) {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function chargeOff() {
    if (!confirm("Charge-off this loan? This will stop accruals and reclassify balances.")) {
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc("charge_off_loan", {
      p_loan_id: loan.id,
      p_co_date: date,
      p_memo: `Charge-off of loan #${loan.loan_number}`,
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
        description: "Loan charged off successfully",
      });
      onRefresh?.();
    }
    setBusy(false);
  }

  return (
    <section className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Charge-off</h3>
        <Badge variant={loan.non_accrual ? "destructive" : "secondary"}>
          {loan.non_accrual ? "Non-accrual" : "Accruing"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Moves remaining principal/fees to charge-off accounts and stops accruals.
      </p>
      <div className="flex gap-2 items-center">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant="destructive"
          disabled={busy || loan.status === "charged_off"}
          onClick={chargeOff}
        >
          {busy ? "Charging off..." : "Charge-off Loan"}
        </Button>
      </div>
    </section>
  );
}
