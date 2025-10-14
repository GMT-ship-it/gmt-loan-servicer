import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface AdjustmentsPanelProps {
  loanId: string;
  onRefresh?: () => void;
}

type AdjustmentKind = "principal" | "interest_receivable" | "fee_receivable" | "escrow" | "memo";

export function AdjustmentsPanel({ loanId, onRefresh }: AdjustmentsPanelProps) {
  const [kind, setKind] = useState<AdjustmentKind>("principal");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function submit() {
    if (!memo.trim()) {
      toast({
        title: "Memo Required",
        description: "Please provide a memo for this adjustment",
        variant: "destructive",
      });
      return;
    }

    if (kind !== "memo" && amount === 0) {
      toast({
        title: "Invalid Amount",
        description: "Amount cannot be zero (except for memo type)",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc("post_adjustment", {
      p_loan_id: loanId,
      p_adj_date: date,
      p_kind: kind,
      p_amount: amount,
      p_memo: memo || `Adjustment: ${kind}`,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Adjustment Posted",
        description: "The adjustment has been recorded successfully",
      });
      setAmount(0);
      setMemo("");
      onRefresh?.();
    }
    setBusy(false);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Adjustments</h2>
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="grid md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type</label>
            <Select value={kind} onValueChange={(v) => setKind(v as AdjustmentKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="principal">Principal</SelectItem>
                <SelectItem value="interest_receivable">Interest Receivable</SelectItem>
                <SelectItem value="fee_receivable">Fee Receivable</SelectItem>
                <SelectItem value="escrow">Escrow Payable</SelectItem>
                <SelectItem value="memo">Memo (no amount)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Amount (+/-)
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={kind === "memo"}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Memo</label>
            <Input
              placeholder="Reason for adjustment"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={submit} disabled={busy}>
            {busy ? "Posting..." : "Post Adjustment"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Positive amounts increase balance, negative amounts decrease
          </p>
        </div>
      </div>
    </section>
  );
}
