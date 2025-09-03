import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Facility } from '@/types/facility';

type Customer = { id: string; legal_name: string; };
type FacilityRow = { id: string; customer_id: string; };
type DrawRow = {
  id: string;
  facility_id: string;
  amount: number;
  status: 'submitted'|'under_review'|'approved'|'rejected';
  decision_notes: string | null;
  required_docs_ok: boolean;
  created_at: string;
};

type DrawDocRow = {
  id: string;
  path: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  draw_request_id: string;
};

export default function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [facilitiesList, setFacilitiesList] = useState<FacilityRow[]>([]);
  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [docsByDraw, setDocsByDraw] = useState<Record<string, DrawDocRow[]>>({});
  const [togglingDocsOk, setTogglingDocsOk] = useState<string | null>(null);
  const [facilityForm, setFacilityForm] = useState<{
    customer_id: string;
    type: 'revolving' | 'single_loan';
    credit_limit: string;
    apr: string;
    min_advance: string;
  }>({
    customer_id: '',
    type: 'revolving',
    credit_limit: '500000',
    apr: '0.145',
    min_advance: '50000'
  });
  const [txForm, setTxForm] = useState<{
    facility_id: string;
    type: 'advance' | 'payment' | 'interest' | 'fee' | 'letter_of_credit' | 'dof' | 'adjustment';
    amount: string;
    effective_at: string; // ISO datetime-local
    memo: string;
  }>({
    facility_id: '',
    type: 'advance',
    amount: '100000',
    effective_at: new Date().toISOString().slice(0,16), // YYYY-MM-DDTHH:mm
    memo: 'Initial funding'
  });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/login', { replace: true });

      // Check role
      const { data: profile, error: pErr } = await (supabase as any)
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (pErr || !profile) {
        setErr(pErr?.message || 'No profile'); setLoading(false); return;
      }
      if (!['lender_admin', 'lender_analyst'].includes(profile.role)) {
        // Not a lender → bounce to borrower
        return navigate('/borrower', { replace: true });
      }

      // Load all customers (allowed by RLS for lender roles)
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('id, legal_name')
        .order('legal_name', { ascending: true });

      if (error) setErr(error.message);
      else setCustomers(data || []);

      // Load facilities (lenders see all; RLS handles scope)
      const { data: facs, error: fErr } = await supabase
        .from('facilities')
        .select('id, customer_id')
        .order('created_at', { ascending: false });

      if (!fErr && facs) setFacilitiesList(facs);

      // Load draw requests (lenders see all per RLS)
      const { data: drs, error: drErr } = await supabase
        .from('draw_requests')
        .select('id, facility_id, amount, status, decision_notes, required_docs_ok, created_at')
        .order('created_at', { ascending: false });

      if (drErr) setErr(drErr.message);
      else {
        setDraws(drs || []);
        await fetchDocsForDraws((drs || []).map(d => d.id));
      }

      setLoading(false);
    })();
  }, [navigate]);

  async function fetchDocsForDraws(drawIds: string[]) {
    if (drawIds.length === 0) { setDocsByDraw({}); return; }
    const { data, error } = await supabase
      .from('draw_documents')
      .select('id, path, original_name, mime_type, size_bytes, uploaded_at, draw_request_id')
      .in('draw_request_id', drawIds)
      .order('uploaded_at', { ascending: false });

    if (!error) {
      const grouped: Record<string, DrawDocRow[]> = {};
      (data || []).forEach(d => {
        if (!grouped[d.draw_request_id]) grouped[d.draw_request_id] = [];
        grouped[d.draw_request_id].push(d);
      });
      setDocsByDraw(grouped);
    }
  }

  async function getSignedUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase
      .storage
      .from('summitline-docs')
      .createSignedUrl(path, 60 * 10); // 10 minutes
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  async function toggleDocsOk(drawId: string, nextVal: boolean) {
    setTogglingDocsOk(drawId);
    const { error } = await supabase
      .from('draw_requests')
      .update({ required_docs_ok: nextVal })
      .eq('id', drawId);

    setTogglingDocsOk(null);

    if (error) { setErr(error.message); return; }

    // refresh draws + docs
    const { data: drs, error: rErr } = await supabase
      .from('draw_requests')
      .select('id, facility_id, amount, status, decision_notes, required_docs_ok, created_at')
      .order('created_at', { ascending: false });

    if (!rErr) {
      setDraws(drs || []);
      await fetchDocsForDraws((drs || []).map(d => d.id));
    }
  }

  const canSubmit = useMemo(() => {
    if (!facilityForm.customer_id) return false;
    const cl = Number(facilityForm.credit_limit);
    const apr = Number(facilityForm.apr);
    const ma = Number(facilityForm.min_advance);
    return cl > 0 && apr > 0 && ma >= 0;
  }, [facilityForm]);

  async function createFacility(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setCreating(true);
    setErr(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErr('Not authenticated'); setCreating(false); return; }

    const payload = {
      customer_id: facilityForm.customer_id,
      type: facilityForm.type,
      status: 'active' as const,
      credit_limit: Number(facilityForm.credit_limit),
      apr: Number(facilityForm.apr),
      min_advance: Number(facilityForm.min_advance),
      created_by: session.user.id
    };

    const { data, error } = await (supabase as any)
      .from('facilities')
      .insert(payload)
      .select('id, customer_id, type, status, credit_limit, apr, min_advance, created_at')
      .single();

    if (error) {
      setErr(error.message);
    } else {
      // Reset the form
      setFacilityForm(f => ({ ...f, credit_limit: '500000', apr: '0.145', min_advance: '50000' }));
    }
    setCreating(false);
  }

  async function postTransaction(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!txForm.facility_id) { setErr('Select a facility'); return; }

    const amt = Number(txForm.amount);
    if (Number.isNaN(amt) || amt < 0) { setErr('Enter a valid amount ≥ 0'); return; }

    setPosting(true);

    // convert datetime-local input to ISO with timezone (assume local)
    const local = txForm.effective_at;
    // If you want server time, you could use `now()` from SQL, but we'll pass the ISO:
    const effectiveISO = new Date(local).toISOString();

    const { error } = await supabase.from('transactions').insert({
      facility_id: txForm.facility_id,
      type: txForm.type,
      amount: amt,
      effective_at: effectiveISO,
      memo: txForm.memo || null
    });

    setPosting(false);

    if (error) { setErr(error.message); return; }

    // reset amount/memo (keep facility/type/date)
    setTxForm(f => ({ ...f, amount: '', memo: '' }));
  }

  async function decideDraw(id: string, newStatus: 'approved'|'rejected') {
    setDecidingId(id);
    setErr(null);

    const notes = decisionNotes[id] ?? null;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErr('Not authenticated'); setDecidingId(null); return; }

    const { error } = await supabase
      .from('draw_requests')
      .update({
        status: newStatus,
        decision_notes: notes,
        decided_by: session.user.id,
        decided_at: new Date().toISOString()
      })
      .eq('id', id);

    setDecidingId(null);

    if (error) { setErr(error.message); return; }

    // refresh list
    const { data: drs, error: rErr } = await supabase
      .from('draw_requests')
      .select('id, facility_id, amount, status, decision_notes, required_docs_ok, created_at')
      .order('created_at', { ascending: false });
    if (!rErr) {
      setDraws(drs || []);
      await fetchDocsForDraws((drs || []).map(d => d.id));
    }
  }

  function setNotes(id: string, v: string) {
    setDecisionNotes(prev => ({ ...prev, [id]: v }));
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  if (loading) return <div className="p-6">Loading admin…</div>;
  if (err) return <div className="p-6 text-destructive">Error: {err}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <Button variant="outline" onClick={logout}>Logout</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Customers</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc pl-6">
            {customers.map(c => (
              <li key={c.id}>{c.legal_name} <span className="text-muted-foreground">({c.id})</span></li>
            ))}
          </ul>
          {customers.length === 0 && <p className="text-muted-foreground">No customers yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Facility</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createFacility} className="grid gap-4">
            {/* Customer select */}
            <div className="grid gap-2">
              <Label>Customer</Label>
              <Select
                value={facilityForm.customer_id}
                onValueChange={(v) => setFacilityForm(f => ({ ...f, customer_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.legal_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label>Facility Type</Label>
              <Select
                value={facilityForm.type}
                onValueChange={(v: 'revolving' | 'single_loan') =>
                  setFacilityForm(f => ({ ...f, type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revolving">Revolving</SelectItem>
                  <SelectItem value="single_loan">Single Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Credit Limit */}
            <div className="grid gap-2">
              <Label>Credit Limit (USD)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={facilityForm.credit_limit}
                onChange={(e) => setFacilityForm(f => ({ ...f, credit_limit: e.target.value }))}
              />
            </div>

            {/* APR */}
            <div className="grid gap-2">
              <Label>APR (decimal, e.g., 0.145 = 14.5%)</Label>
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={facilityForm.apr}
                onChange={(e) => setFacilityForm(f => ({ ...f, apr: e.target.value }))}
              />
            </div>

            {/* Min Advance */}
            <div className="grid gap-2">
              <Label>Minimum Advance (USD)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={facilityForm.min_advance}
                onChange={(e) => setFacilityForm(f => ({ ...f, min_advance: e.target.value }))}
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!canSubmit || creating}>
                {creating ? 'Creating…' : 'Create Facility'}
              </Button>
              {err && <span className="text-destructive">{err}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Post Transaction</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={postTransaction} className="grid gap-4">
            {/* Facility select */}
            <div className="grid gap-2">
              <Label>Facility</Label>
              <Select
                value={txForm.facility_id}
                onValueChange={(v) => setTxForm(f => ({ ...f, facility_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilitiesList.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={txForm.type}
                onValueChange={(v: any) => setTxForm(f => ({ ...f, type: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="interest">Interest</SelectItem>
                  <SelectItem value="fee">Fee</SelectItem>
                  <SelectItem value="letter_of_credit">Letter of Credit</SelectItem>
                  <SelectItem value="dof">DOF</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="grid gap-2">
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={txForm.amount}
                onChange={(e) => setTxForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>

            {/* Effective at */}
            <div className="grid gap-2">
              <Label>Effective Date/Time</Label>
              <Input
                type="datetime-local"
                value={txForm.effective_at}
                onChange={(e) => setTxForm(f => ({ ...f, effective_at: e.target.value }))}
              />
            </div>

            {/* Memo */}
            <div className="grid gap-2">
              <Label>Memo</Label>
              <Input
                type="text"
                value={txForm.memo}
                onChange={(e) => setTxForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="Optional description"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={posting || !txForm.facility_id}>
                {posting ? 'Posting…' : 'Post Transaction'}
              </Button>
              {err && <span className="text-destructive">{err}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approvals — Draw Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {draws.length === 0 ? (
            <div className="text-muted-foreground">No draw requests yet.</div>
          ) : (
            <div className="grid gap-4">
              {draws.map(d => (
                <div key={d.id} className="border rounded p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <div className="font-medium">
                        {d.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Facility: <span className="font-mono">{d.facility_id}</span> • {new Date(d.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs uppercase tracking-wide">{d.status}</div>
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm">Decision notes (optional)</label>
                    <Input
                      value={decisionNotes[d.id] ?? d.decision_notes ?? ''}
                      onChange={(e)=>setNotes(d.id, e.target.value)}
                      placeholder="Reason or internal notes"
                      className="text-sm"
                    />
                  </div>

                  {/* Documents section */}
                  <div className="grid gap-1">
                    <div className="font-medium text-sm">Documents</div>
                    {Array.isArray(docsByDraw[d.id]) && docsByDraw[d.id].length > 0 ? (
                      <div className="grid gap-1">
                        {docsByDraw[d.id].map(doc => (
                          <div key={doc.id} className="flex items-center justify-between text-sm">
                            <div className="truncate">
                              {(doc.original_name || doc.path.split('/').pop())}
                              <span className="text-xs text-muted-foreground">
                                {' '}• {doc.mime_type || 'file'} • {(doc.size_bytes ?? 0).toLocaleString()} bytes
                              </span>
                            </div>
                            <button
                              className="text-xs underline"
                              onClick={async () => {
                                const url = await getSignedUrl(doc.path);
                                if (url) window.open(url, '_blank');
                              }}
                            >
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No documents uploaded.</div>
                    )}
                  </div>

                  {/* Docs OK toggle */}
                  <div className="flex items-center gap-2 pt-2">
                    <label className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!d.required_docs_ok}
                        onChange={(e)=>toggleDocsOk(d.id, e.target.checked)}
                        disabled={togglingDocsOk === d.id}
                      />
                      Required docs OK
                    </label>
                    {togglingDocsOk === d.id && <span className="text-xs">Saving…</span>}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={decidingId === d.id || d.status === 'approved' || !d.required_docs_ok}
                      onClick={()=>decideDraw(d.id, 'approved')}
                      title={!d.required_docs_ok ? 'Mark Required docs OK before approval' : undefined}
                    >
                      {decidingId === d.id ? 'Saving…' : 'Approve'}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={decidingId === d.id || d.status === 'rejected'}
                      onClick={()=>decideDraw(d.id, 'rejected')}
                    >
                      {decidingId === d.id ? 'Saving…' : 'Reject'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {err && <div className="text-destructive mt-3">{err}</div>}
        </CardContent>
      </Card>
    </div>
  );
}