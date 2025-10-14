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

export function AdjustmentsPanel({ loanId, onRefresh }: AdjustmentsPanelProps) {
  const [kind, setKind] = useState<string>("principal");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function submit() {
    if (kind !== "memo" && amount === 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a non-zero amount",
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
        title: "Success",
        description: "Adjustment posted successfully",
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
      <div className="grid md:grid-cols-5 gap-3">
        <Select value={kind} onValueChange={setKind}>
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
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          type="number"
          placeholder="Amount (+/-)"
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value))}
          disabled={kind === "memo"}
        />
        <Input
          className="md:col-span-2"
          placeholder="Memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>
      <Button onClick={submit} disabled={busy}>
        {busy ? "Posting..." : "Post Adjustment"}
      </Button>
    </section>
  );
}
