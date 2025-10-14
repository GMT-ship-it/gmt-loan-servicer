import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
        title: "Loan Charged Off",
        description: "The loan has been charged off successfully",
      });
      onRefresh?.();
    }
    setBusy(false);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Charge-off</h3>
        <Badge variant={loan.non_accrual ? "destructive" : "secondary"}>
          {loan.non_accrual ? "Non-accrual" : "Accruing"}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Moves remaining principal and fees to charge-off accounts and stops interest accruals.
        This action reclassifies balances per GAAP requirements.
      </p>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            Charge-off Date
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={loan.status === "charged_off"}
          />
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={busy || loan.status === "charged_off"}
            >
              {busy ? "Processing..." : "Charge-off Loan"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Charge-off</AlertDialogTitle>
              <AlertDialogDescription>
                This will charge-off loan #{loan.loan_number}. The following actions will occur:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Remaining principal moved to CHARGED_OFF_PRINCIPAL</li>
                  <li>Outstanding fees moved to CHARGED_OFF_FEES</li>
                  <li>Interest receivable reversed</li>
                  <li>Loan status set to "charged_off"</li>
                  <li>Interest accruals stopped (non-accrual flag set)</li>
                </ul>
                <p className="mt-2 font-semibold">This action cannot be easily undone.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={chargeOff}>
                Confirm Charge-off
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {loan.status === "charged_off" && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <strong>Loan Charged Off:</strong> This loan has been charged off and is
          no longer accruing interest.
        </div>
      )}
    </section>
  );
}
