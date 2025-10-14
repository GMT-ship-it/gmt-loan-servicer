import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Download } from "lucide-react";

export default function Reports() {
  const [start, setStart] = useState<string>(firstOfPrevMonth());
  const [end, setEnd] = useState<string>(lastOfPrevMonth());
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  async function exportGL() {
    setBusy("gl");
    const { data, error } = await supabase.rpc("gl_entries_between", {
      p_start: start,
      p_end: end,
    });
    setBusy(null);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    downloadCSV(data || [], "gl_entries");
  }

  async function exportPayments() {
    setBusy("pay");
    const { data, error } = await supabase.rpc("payment_register_between", {
      p_start: start,
      p_end: end,
    });
    setBusy(null);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    downloadCSV(data || [], "payment_register");
  }

  async function exportBorrowerActivity() {
    setBusy("act");
    const { data, error } = await supabase.rpc("borrower_activity_between", {
      p_start: start,
      p_end: end,
    });
    setBusy(null);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    downloadCSV(data || [], "borrower_activity");
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Reports & Exports</h1>

      <div className="rounded-xl border p-6 space-y-4">
        <h2 className="text-xl font-semibold">Date Range</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-2">Start Date</label>
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-2">End Date</label>
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border p-6 space-y-3">
          <h3 className="text-lg font-semibold">General Ledger</h3>
          <p className="text-sm text-muted-foreground">
            Export all journal entries with debits and credits for the selected period.
          </p>
          <Button
            onClick={exportGL}
            disabled={busy === "gl"}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            {busy === "gl" ? "Exporting..." : "Export GL"}
          </Button>
        </div>

        <div className="rounded-xl border p-6 space-y-3">
          <h3 className="text-lg font-semibold">Payment Register</h3>
          <p className="text-sm text-muted-foreground">
            Export all successful payments with allocation breakdowns for the period.
          </p>
          <Button
            onClick={exportPayments}
            disabled={busy === "pay"}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            {busy === "pay" ? "Exporting..." : "Export Payments"}
          </Button>
        </div>

        <div className="rounded-xl border p-6 space-y-3">
          <h3 className="text-lg font-semibold">Borrower Activity</h3>
          <p className="text-sm text-muted-foreground">
            Export loan-level activity rollup including payments and escrow for the period.
          </p>
          <Button
            onClick={exportBorrowerActivity}
            disabled={busy === "act"}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            {busy === "act" ? "Exporting..." : "Export Activity"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function firstOfPrevMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
}

function lastOfPrevMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 0)
    .toISOString()
    .slice(0, 10);
}

function downloadCSV(rows: any[], name: string) {
  if (!rows.length) {
    alert("No rows for selected period.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = rows.map((r) => headers.map((h) => csvSafe(r[h])).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvSafe(val: any) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
