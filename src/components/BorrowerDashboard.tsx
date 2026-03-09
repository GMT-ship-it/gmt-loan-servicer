import React, { useEffect, useState } from "react";

type Loan = {
  id: string;
  name: string;
  outstanding_balance: number;
  next_payment_due: string; // ISO
  principal: number;
  interest: number;
  currency?: string;
};

export const BorrowerDashboard: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "";
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
        const res = await fetch(`${supabaseUrl}/rest/v1/fin_loans?select=id,loan_name,outstanding_balance,next_payment_due,principal,interest`, {
          headers: {
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
          },
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map((d: any) => ({
            id: d.id?.toString() || "",
            name: d.loan_name || d.name || "",
            outstanding_balance: Number(d.outstanding_balance || 0),
            next_payment_due: d.next_payment_due,
            principal: Number(d.principal || 0),
            interest: Number(d.interest || 0),
          }));
          setLoans(mapped);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLoans();
  }, []);

  const colorForDate = (iso?: string) => {
    if (!iso) return "green";
    const d = new Date(iso);
    const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff <= 7) return "red";
    if (diff <= 14) return "yellow";
    return "green";
  };

  return (
    <div className="borrower-dashboard" style={{ padding: 20 }}>
      <h2>Borrower Dashboard</h2>
      {loading && <p>Loading loans...</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {loans.map((l) => (
          <div key={l.id} className="loan-card" style={{ border: "1px solid #334", borderRadius: 12, padding: 16, background: "#0a1b1a" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{l.name}</div>
            <div style={{ marginBottom: 8 }}>Balance: ${l.outstanding_balance.toFixed(2)}</div>
            <div style={{ color: "var(--teal)" }}>
              Next due: <span style={{ color: colorForDate(l.next_payment_due) }}>
                {l.next_payment_due ? new Date(l.next_payment_due).toLocaleDateString() : "N/A"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span>Principal: ${l.principal.toFixed(2)}</span>
              <span>Interest: ${l.interest.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button>Make Payment</button>
              <button>View Statement</button>
              <button>Upload Document</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

