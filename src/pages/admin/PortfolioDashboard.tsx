import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

type Row = {
  loan_id: string;
  loan_number: string;
  status: string;
  origination_date: string;
  maturity_date: string | null;
  rate: number;
  principal_outstanding: number;
  accrued_interest: number;
  next_due_date: string | null;
  past_due_amount: number;
  days_past_due: number | null;
  bucket: "CURRENT" | "1-30" | "31-60" | "61-90" | "90+" | null;
};

export default function PortfolioDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<string>("ALL");
  const [show, setShow] = useState<"active" | "defaulted" | "all">("active");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("portfolio_dashboard")
        .select("*")
        .order("loan_number", { ascending: true });
      setRows((data as any) || []);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (show === "active" && r.status !== "active") return false;
      if (show === "defaulted" && r.status !== "defaulted") return false;
      if (bucket !== "ALL" && r.bucket !== bucket) return false;
      if (q && !(`${r.loan_number}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [rows, q, bucket, show]);

  const kpis = useMemo(() => {
    const totalPrin = filtered.reduce((s, r) => s + Number(r.principal_outstanding || 0), 0);
    const totalAccr = filtered.reduce((s, r) => s + Number(r.accrued_interest || 0), 0);
    const totalPast = filtered.reduce((s, r) => s + Number(r.past_due_amount || 0), 0);
    const count90p = filtered.filter(r => r.bucket === "90+").length;
    return { totalPrin, totalAccr, totalPast, count90p };
  }, [filtered]);

  function fmtMoney(n: number) {
    return (n || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
  }
  function fmtDate(d?: string | null) {
    return d ? new Date(d).toLocaleDateString() : "—";
  }

  function exportCSV() {
    const headers = [
      "Loan #", "Status", "Principal Outstanding", "Accrued Interest",
      "Next Due", "Past-Due Amount", "Days Past Due", "Bucket", "Origination", "Maturity", "Rate"
    ];
    const lines = filtered.map(r => [
      r.loan_number,
      r.status,
      (r.principal_outstanding || 0).toFixed(2),
      (r.accrued_interest || 0).toFixed(2),
      r.next_due_date || "",
      (r.past_due_amount || 0).toFixed(2),
      r.days_past_due ?? "",
      r.bucket ?? "",
      r.origination_date,
      r.maturity_date ?? "",
      (r.rate * 100).toFixed(3) + "%"
    ].join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Portfolio Dashboard</h1>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-3">
        <KPI label="Principal Outstanding" value={fmtMoney(kpis.totalPrin)} />
        <KPI label="Accrued Interest" value={fmtMoney(kpis.totalAccr)} />
        <KPI label="Past-Due (All)" value={fmtMoney(kpis.totalPast)} />
        <KPI label="90+ Count" value={kpis.count90p} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          className="max-w-xs"
          placeholder="Search Loan #"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <Select value={bucket} onValueChange={setBucket}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["ALL", "CURRENT", "1-30", "31-60", "61-90", "90+"].map(b => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={show} onValueChange={(v) => setShow(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="defaulted">Defaulted</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">Loan #</th>
              <th className="p-3 text-right">Principal</th>
              <th className="p-3 text-right">Accrued Int</th>
              <th className="p-3 text-left">Next Due</th>
              <th className="p-3 text-right">Past-Due</th>
              <th className="p-3 text-left">Bucket</th>
              <th className="p-3 text-right">DPD</th>
              <th className="p-3 text-left">Maturity</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.loan_id} className="border-t hover:bg-muted/30">
                <td className="p-3">
                  <a className="text-primary hover:underline" href={`/admin/loans/${r.loan_id}`}>
                    {r.loan_number}
                  </a>
                </td>
                <td className="p-3 text-right">{fmtMoney(r.principal_outstanding)}</td>
                <td className="p-3 text-right">{fmtMoney(r.accrued_interest)}</td>
                <td className="p-3">{fmtDate(r.next_due_date)}</td>
                <td className="p-3 text-right">{fmtMoney(r.past_due_amount)}</td>
                <td className="p-3">
                  <span className={
                    "px-2 py-1 rounded text-xs " +
                    (r.bucket === "CURRENT" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : r.bucket === "1-30" ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : r.bucket === "31-60" ? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                          : r.bucket === "61-90" ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300")
                  }>{r.bucket || "—"}</span>
                </td>
                <td className="p-3 text-right">{r.days_past_due ?? 0}</td>
                <td className="p-3">{fmtDate(r.maturity_date)}</td>
                <td className="p-3">{r.status}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td className="p-3 text-muted-foreground" colSpan={9}>No loans match filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
