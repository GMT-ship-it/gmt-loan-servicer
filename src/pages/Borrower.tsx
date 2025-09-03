import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Profile = { role: 'borrower_admin'|'borrower_user'|'lender_admin'|'lender_analyst'; customer_id: string | null };
type Customer = { id: string; legal_name: string };
type Facility = { id: string; type: 'revolving' | 'single_loan'; credit_limit: number; apr: number; min_advance: number };
type Tx = {
  id: string;
  type: 'advance' | 'payment' | 'interest' | 'fee' | 'letter_of_credit' | 'dof' | 'adjustment';
  amount: number;
  effective_at: string; // ISO
  memo: string | null;
};
type Draw = {
  id: string;
  amount: number;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  created_at: string;
};

export default function BorrowerPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [principal, setPrincipal] = useState<number | null>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  
  // Draw request state
  const [drawAmount, setDrawAmount] = useState<string>('50000');
  const [drawMemo, setDrawMemo] = useState<string>('Working capital');
  const [postingDraw, setPostingDraw] = useState(false);
  const [draws, setDraws] = useState<Draw[]>([]);

  // Validation helpers
  const reqAmt = Number(drawAmount || '0');
  const tooSmall = facility ? reqAmt > 0 && reqAmt < (facility.min_advance ?? 0) : false;
  const tooLarge = available != null ? reqAmt > available : false;
  const invalidAmt = Number.isNaN(reqAmt) || reqAmt <= 0 || tooSmall || tooLarge;

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/login', { replace: true });

      // Load profile
      const { data: p, error: pErr } = await (supabase as any)
        .from('profiles')
        .select('role, customer_id')
        .eq('id', session.user.id)
        .single();

      if (pErr || !p) { setErr(pErr?.message || 'Profile not found'); setLoading(false); return; }
      setProfile(p);

      // Lenders shouldn't be here
      if (p.role === 'lender_admin' || p.role === 'lender_analyst') {
        return navigate('/admin', { replace: true });
      }

      // Borrowers must have a customer_id
      if (!p.customer_id) {
        setErr('No customer assigned to this borrower user.'); setLoading(false); return;
      }

      // Load *their* customer (RLS ensures they only see their own)
      const { data: cust, error: cErr } = await (supabase as any)
        .from('customers')
        .select('id, legal_name')
        .eq('id', p.customer_id)
        .single();

      if (cErr || !cust) { setErr(cErr?.message || 'Customer not found'); }
      else setCustomer(cust);

      if (cust) {
        // 1) Load the first facility for this customer (you can later support multiple)
        const { data: fac, error: fErr } = await supabase
          .from('facilities')
          .select('id, type, credit_limit, apr, min_advance')
          .eq('customer_id', p.customer_id!)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fErr) { setErr(fErr.message); setLoading(false); return; }
        setFacility(fac || null);

        // 2) Load principal from the view (RLS applies through underlying tables)
        if (fac?.id) {
          const { data: princRow, error: prErr } = await supabase
            .from('facility_principal')
            .select('principal_outstanding')
            .eq('facility_id', fac.id)
            .single();

          if (prErr && prErr.code !== 'PGRST116') { // PGRST116 = no rows (treat as 0)
            setErr(prErr.message);
          } else {
            setPrincipal(princRow?.principal_outstanding ?? 0);
          }

          // 3) Load transactions for this facility
          const { data: txRows, error: txErr } = await supabase
            .from('transactions')
            .select('id, type, amount, effective_at, memo')
            .eq('facility_id', fac.id)
            .order('effective_at', { ascending: false });

          if (txErr) {
            setErr(txErr.message);
          } else {
            setTxs(txRows || []);
          }

          // 4) Available to Draw (server-computed, RLS applies via underlying tables)
          const { data: avail, error: aErr } = await supabase
            .rpc('facility_available_to_draw', { p_facility: fac.id });

          if (!aErr) setAvailable(Number(avail ?? 0));

          // 5) Load draw requests for this facility
          const { data: drs, error: drErr } = await supabase
            .from('draw_requests')
            .select('id, amount, status, created_at')
            .eq('facility_id', fac.id)
            .order('created_at', { ascending: false });

          if (!drErr) setDraws(drs || []);
        } else {
          setPrincipal(0);
        }
      }

      setLoading(false);
    })();
  }, [navigate]);

  async function logout() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  async function submitDraw(e: React.FormEvent) {
    e.preventDefault();
    if (!facility?.id) { setErr('No facility found'); return; }

    const amt = Number(drawAmount);
    if (Number.isNaN(amt) || amt <= 0) { setErr('Enter a valid amount > 0'); return; }
    if (facility?.min_advance != null && amt < facility.min_advance) {
      setErr(`Amount is below the minimum advance of ${facility.min_advance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`); 
      return;
    }
    if (available != null && amt > available) {
      setErr(`Requested amount exceeds available to draw (${available.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}).`);
      return;
    }

    setPostingDraw(true);
    const { error } = await supabase.from('draw_requests').insert({
      facility_id: facility.id,
      amount: amt,
      decision_notes: drawMemo || null
    });
    setPostingDraw(false);

    if (error) { setErr(error.message); return; }

    // refresh list
    const { data: drs } = await supabase
      .from('draw_requests')
      .select('id, amount, status, created_at')
      .eq('facility_id', facility.id)
      .order('created_at', { ascending: false });

    setDraws(drs || []);
    setErr(null);
    setDrawAmount('50000');
    setDrawMemo('Working capital');
  }

  if (loading) return <div className="p-6">Loading borrower…</div>;
  if (err) return <div className="p-6 text-destructive">Error: {err}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Borrower Portal</h1>
        <Button variant="outline" onClick={logout}>Logout</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Your Company</CardTitle></CardHeader>
        <CardContent>
          {customer ? (
            <div>
              <div className="font-medium">{customer.legal_name}</div>
              <div className="text-sm text-muted-foreground">Customer ID: {customer.id}</div>
            </div>
          ) : (
            <div className="text-muted-foreground">No company assigned.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Facility Snapshot</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!facility ? (
            <div className="text-muted-foreground">No facility yet.</div>
          ) : (
            <>
              <div className="flex justify-between">
                <span>Facility Type</span>
                <span className="font-medium capitalize">{facility.type}</span>
              </div>
              <div className="flex justify-between">
                <span>Credit Limit</span>
                <span className="font-medium">
                  {facility.credit_limit?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>APR</span>
                <span className="font-medium">{(facility.apr * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Outstanding Principal</span>
                <span className="font-medium">
                  {(principal ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Available to Draw</span>
                <span className="font-medium">
                  {(available ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent>
          {(!txs || txs.length === 0) ? (
            <div className="text-muted-foreground">No transactions yet.</div>
          ) : (
            <div className="grid gap-3">
              {txs.map(t => (
                <div key={t.id} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                  <div className="space-y-0.5">
                    <div className="font-medium capitalize">{t.type.replace(/_/g,' ')}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.effective_at).toLocaleString()}
                      {t.memo ? ` • ${t.memo}` : ''}
                    </div>
                  </div>
                  <div className="font-medium">
                    {t.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {facility && (
        <Card>
          <CardHeader><CardTitle>Request Funds</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submitDraw} className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-sm">Amount (USD)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={drawAmount}
                  onChange={(e) => setDrawAmount(e.target.value)}
                  className="border rounded px-3 py-2"
                />
                {facility?.min_advance != null && reqAmt > 0 && reqAmt < facility.min_advance && (
                  <div className="text-xs text-destructive">
                    Below minimum advance of {facility.min_advance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </div>
                )}
                {available != null && reqAmt > available && (
                  <div className="text-xs text-destructive">
                    Exceeds available to draw ({available.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})
                  </div>
                )}
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Purpose (optional)</label>
                <input
                  type="text"
                  value={drawMemo}
                  onChange={(e) => setDrawMemo(e.target.value)}
                  className="border rounded px-3 py-2"
                  placeholder="Working capital, equipment purchase, etc."
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={postingDraw || !facility?.id || invalidAmt}
                  className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {postingDraw ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Recent Requests</CardTitle></CardHeader>
        <CardContent>
          {(!draws || draws.length === 0) ? (
            <div className="text-muted-foreground">No draw requests yet.</div>
          ) : (
            <div className="grid gap-3">
              {draws.map(d => (
                <div key={d.id} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                  <div className="space-y-0.5">
                    <div className="font-medium">
                      {d.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs uppercase tracking-wide font-medium">
                    {d.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}