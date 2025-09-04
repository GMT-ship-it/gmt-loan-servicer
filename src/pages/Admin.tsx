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

type BbcStatus = 'draft'|'submitted'|'under_review'|'approved'|'rejected';
type AdminBbc = {
  id: string;
  facility_id: string;
  period_end: string;   // ISO date
  status: BbcStatus;
  gross_collateral: number;
  ineligibles: number;
  reserves: number;
  advance_rate: number;
  borrowing_base: number;
  availability: number;
  created_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  decision_notes: string | null;
};

type AdminBbcItem = {
  id: string;
  report_id: string;
  item_type: 'accounts_receivable'|'inventory'|'cash'|'other';
  ref: string | null;
  note: string | null;
  amount: number;
  ineligible: boolean;
  haircut_rate: number;
  created_at: string;
};

type Compliance = { docsOk: boolean; bbcOk: boolean; limitOk: boolean; available: number };

type ExposureRow = {
  facility_id: string;
  customer_name: string;
  credit_limit: number;
  principal_outstanding: number;
  available_to_draw: number;
  utilization_pct: number;
  last_bbc_date: string | null;
  bbc_approved_within_45d: boolean;
  last_draw_decided_at: string | null;
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

  // Interest posting state
  const [interestFacilityId, setInterestFacilityId] = useState<string>('');
  const [postingInterest, setPostingInterest] = useState(false);
  const [interestMsg, setInterestMsg] = useState<string | null>(null);

  // BBC state
  const [bbcs, setBbcs] = useState<AdminBbc[]>([]);
  const [bbcItemsById, setBbcItemsById] = useState<Record<string, AdminBbcItem[]>>({});
  const [bbcExpanded, setBbcExpanded] = useState<Record<string, boolean>>({});
  const [bbcNotes, setBbcNotes] = useState<Record<string, string>>({});
  const [decidingBbcId, setDecidingBbcId] = useState<string | null>(null);

  // Compliance state
  const [complianceByDraw, setComplianceByDraw] = useState<Record<string, Compliance>>({});

  // Exposure filtering state
  const [utilMin, setUtilMin] = useState<number>(0);
  const [availMax, setAvailMax] = useState<number>(0);
  const [bbcOnlyFresh, setBbcOnlyFresh] = useState<boolean>(false);

  // Audit log state
  type AuditRow = { 
    id: string; 
    created_at: string | null; 
    action: string; 
    table_name: string; 
    user_id: string | null; 
    record_id: string | null; 
    new_values: any; 
    old_values: any; 
  };
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditFrom, setAuditFrom] = useState<string>(() => 
    new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
  );
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Facilities labeled for friendly names
  const [facLabeled, setFacLabeled] = useState<{facility_id: string; customer_name: string; short_id: string}[]>([]);

  // Exposure state (re-added)
  const [exposure, setExposure] = useState<ExposureRow[]>([]);
  const [loadingExposure, setLoadingExposure] = useState(false);

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
        await computeComplianceFor(drs || []);
      }

      // Load recent BBCs (newest period first). Lender RLS lets you see all.
      const { data: reps, error: repErr } = await supabase
        .from('borrowing_base_reports')
        .select('id, facility_id, period_end, status, gross_collateral, ineligibles, reserves, advance_rate, borrowing_base, availability, created_at, submitted_at, decided_at, decision_notes')
        .order('period_end', { ascending: false })
        .limit(50);

      if (!repErr) setBbcs(reps || []);

      // Load exposure data
      await loadExposure();

      // Load facilities labeled for dropdowns using RPC or direct query
      const { data: facLab, error: facErr } = await supabase
        .rpc('lender_exposure_snapshot'); // Use this to get facility names
      if (!facErr && facLab) {
        const labeled = facLab.map((f: any) => ({
          facility_id: f.facility_id,
          customer_name: f.customer_name,
          short_id: f.facility_id.slice(0, 8)
        }));
        setFacLabeled(labeled);
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
      await computeComplianceFor(drs || []);
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
      await computeComplianceFor(drs || []);
    }
    await loadExposure(); // Refresh exposure after draw decisions
  }

  function setNotes(id: string, v: string) {
    setDecisionNotes(prev => ({ ...prev, [id]: v }));
  }

  async function computeComplianceFor(draws: { id: string; facility_id: string; amount: number; required_docs_ok: boolean; }[]) {
    const result: Record<string, Compliance> = {};

    // Pre-group by facility to avoid redundant RPCs
    const uniqueFacilityIds = Array.from(new Set(draws.map(d => d.facility_id)));

    // Fetch availability per facility
    const availabilityMap: Record<string, number> = {};
    await Promise.all(uniqueFacilityIds.map(async (fid) => {
      const { data: avail } = await supabase.rpc('facility_available_to_draw', { p_facility: fid });
      availabilityMap[fid] = Number(avail ?? 0);
    }));

    // Fetch BBC freshness per facility
    const bbcOkMap: Record<string, boolean> = {};
    await Promise.all(uniqueFacilityIds.map(async (fid) => {
      const { data: ok } = await supabase.rpc('facility_has_recent_approved_bbc', { p_facility: fid, p_days: 45 });
      bbcOkMap[fid] = !!ok;
    }));

    // Assemble per-draw
    for (const d of draws) {
      const available = availabilityMap[d.facility_id] ?? 0;
      result[d.id] = {
        docsOk: !!d.required_docs_ok,
        bbcOk: !!bbcOkMap[d.facility_id],
        limitOk: Number(d.amount) <= Number(available),
        available
      };
    }

    setComplianceByDraw(result);
  }

  async function loadAudit() {
    setLoadingAudit(true);
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .gte('created_at', auditFrom)
      .order('created_at', { ascending: false })
      .limit(200);
    setLoadingAudit(false);
    if (!error) setAudit(data || []);
  }

  async function loadExposure() {
    setLoadingExposure(true);
    const { data, error } = await supabase.rpc('lender_exposure_snapshot');
    setLoadingExposure(false);
    if (!error) setExposure(data || []);
  }

  // Filter exposure based on criteria
  const filtered = exposure.filter(r =>
    (utilMin ? r.utilization_pct >= utilMin : true) &&
    (availMax ? r.available_to_draw <= availMax : true) &&
    (!bbcOnlyFresh || r.bbc_approved_within_45d)
  );

  async function loadBbcItems(reportId: string) {
    if (bbcItemsById[reportId]) return; // already loaded
    const { data, error } = await supabase
      .from('borrowing_base_items')
      .select('id, report_id, item_type, ref, note, amount, ineligible, haircut_rate, created_at')
      .eq('report_id', reportId)
      .order('created_at', { ascending: false });
    if (!error) {
      setBbcItemsById(prev => ({ ...prev, [reportId]: data || [] }));
    }
  }

  async function toggleBbcExpand(id: string) {
    const next = !bbcExpanded[id];
    setBbcExpanded(prev => ({ ...prev, [id]: next }));
    if (next) await loadBbcItems(id);
  }

  async function decideBbc(id: string, newStatus: 'approved'|'rejected') {
    setDecidingBbcId(id);
    setErr(null);
    const notes = bbcNotes[id] ?? null;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErr('Not authenticated'); setDecidingBbcId(null); return; }

    const { error } = await supabase
      .from('borrowing_base_reports')
      .update({
        status: newStatus,
        decision_notes: notes,
        decided_by: session.user.id,
        decided_at: new Date().toISOString()
      })
      .eq('id', id);

    setDecidingBbcId(null);
    if (error) { setErr(error.message); return; }

    // Refresh list
    const { data: reps, error: repErr } = await supabase
      .from('borrowing_base_reports')
      .select('id, facility_id, period_end, status, gross_collateral, ineligibles, reserves, advance_rate, borrowing_base, availability, created_at, submitted_at, decided_at, decision_notes')
      .order('period_end', { ascending: false })
      .limit(50);
    if (!repErr) setBbcs(reps || []);
    await loadExposure(); // Refresh exposure after BBC decisions
  }

  function setBbcDecisionNotes(id: string, v: string) {
    setBbcNotes(prev => ({ ...prev, [id]: v }));
  }

  async function postInterestThroughToday(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInterestMsg(null);

    if (!interestFacilityId) { setErr('Select a facility'); return; }

    setPostingInterest(true);
    try {
      // 1) Ask server for accrued (unposted) interest as of today
      const { data: accr, error: aErr } = await supabase
        .rpc('facility_accrued_interest', { p_facility: interestFacilityId });

      if (aErr) throw aErr;

      const amount = Math.round(Number(accr ?? 0) * 100) / 100; // 2-dec rounding
      if (!amount || amount <= 0) {
        setInterestMsg('No accrued interest to post.');
        return;
      }

      // 2) Insert interest transaction
      const memo = `Interest posted through ${new Date().toISOString().slice(0,10)}`;
      const { error: insErr } = await supabase
        .from('transactions')
        .insert({
          facility_id: interestFacilityId,
          type: 'interest',
          amount,
          effective_at: new Date().toISOString(),
          memo
        });

      if (insErr) throw insErr;

      setInterestMsg(`Posted interest: ${amount.toLocaleString('en-US',{style:'currency',currency:'USD'})}`);
    } catch (err: any) {
      setErr(err.message || 'Failed to post interest');
    } finally {
      setPostingInterest(false);
    }
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
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Lender Exposure</CardTitle>
          <Button variant="outline" onClick={loadExposure} disabled={loadingExposure}>
            {loadingExposure ? 'Refreshing…' : 'Refresh'}
          </Button>
        </CardHeader>
        <CardContent>
          {exposure.length === 0 ? (
            <div className="text-muted-foreground">No active facilities.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Facility</th>
                    <th className="py-2 pr-4">Credit Limit</th>
                    <th className="py-2 pr-4">Outstanding</th>
                    <th className="py-2 pr-4">Available</th>
                    <th className="py-2 pr-4">Utilization</th>
                    <th className="py-2 pr-4">BBC ≤45d</th>
                    <th className="py-2 pr-4">Last Draw</th>
                  </tr>
                </thead>
                <tbody>
                  {exposure.map((r) => (
                    <tr key={r.facility_id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{r.customer_name}</td>
                      <td className="py-2 pr-4 font-mono">{r.facility_id}</td>
                      <td className="py-2 pr-4">{r.credit_limit.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td>
                      <td className="py-2 pr-4">{r.principal_outstanding.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td>
                      <td className="py-2 pr-4">{r.available_to_draw.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td>
                      <td className="py-2 pr-4">{r.utilization_pct.toFixed(2)}%</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded ${r.bbc_approved_within_45d ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {r.bbc_approved_within_45d ? 'OK' : 'Stale'}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{r.last_draw_decided_at ? new Date(r.last_draw_decided_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
              {facLabeled.map(f => (
                <SelectItem key={f.facility_id} value={f.facility_id}>
                  {f.customer_name} • {f.short_id}
                </SelectItem>
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

                  {/* Compliance badges */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {(() => {
                      const c = complianceByDraw[d.id];
                      if (!c) return null;
                      return (
                        <>
                          <span className={`px-2 py-0.5 rounded ${c.docsOk ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            Docs {c.docsOk ? 'OK' : 'Missing'}
                          </span>
                          <span className={`px-2 py-0.5 rounded ${c.bbcOk ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            BBC ≤45d {c.bbcOk ? 'OK' : 'Required'}
                          </span>
                          <span className={`px-2 py-0.5 rounded ${c.limitOk ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            Limit {c.limitOk ? 'OK' : `Exceeds (Avail ${c.available.toLocaleString('en-US',{style:'currency',currency:'USD'})})`}
                          </span>
                        </>
                      );
                    })()}
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
                    {(() => {
                      const c = complianceByDraw[d.id];
                      return (
                        <Button
                          variant="outline"
                          disabled={
                            decidingId === d.id ||
                            d.status === 'approved' ||
                            !c || !c.docsOk || !c.bbcOk || !c.limitOk
                          }
                          title={
                            !c ? 'Checking compliance…'
                              : !c.docsOk ? 'Docs not marked OK'
                              : !c.bbcOk ? 'No approved BBC within 45 days'
                              : !c.limitOk ? `Amount exceeds availability (${(c.available||0).toLocaleString('en-US',{style:'currency',currency:'USD'})})`
                              : undefined
                          }
                          onClick={()=>decideDraw(d.id, 'approved')}
                        >
                          {decidingId === d.id ? 'Saving…' : 'Approve'}
                        </Button>
                      );
                    })()}
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

      <Card>
        <CardHeader>
          <CardTitle>Post Interest (through today)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={postInterestThroughToday} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Facility</Label>
              <Select
                value={interestFacilityId}
                onValueChange={(v) => setInterestFacilityId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
            <SelectContent>
              {facLabeled.map(f => (
                <SelectItem key={f.facility_id} value={f.facility_id}>
                  {f.customer_name} • {f.short_id}
                </SelectItem>
              ))}
            </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!interestFacilityId || postingInterest}>
                {postingInterest ? 'Posting…' : 'Post Interest'}
              </Button>
              {interestMsg && <span className="text-sm text-muted-foreground">{interestMsg}</span>}
              {err && <span className="text-destructive">{err}</span>}
            </div>
          </form>
        </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Audit Log</CardTitle>
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs">From</label>
                <input 
                  type="date" 
                  value={auditFrom} 
                  onChange={e => setAuditFrom(e.target.value)} 
                  className="border rounded px-2 py-1" 
                />
              </div>
              <Button variant="outline" onClick={loadAudit} disabled={loadingAudit}>
                {loadingAudit ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <div className="text-muted-foreground">No entries found.</div>
            ) : (
              <div className="grid gap-2 max-h-96 overflow-y-auto">
                {audit.map(a => (
                  <div key={a.id} className="border rounded p-3 text-xs">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium">{a.action}</div>
                      <div className="text-muted-foreground">
                        {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                    <div className="text-muted-foreground mb-2">
                      Table: {a.table_name} • User: {a.user_id || 'system'} • Record: {a.record_id || '—'}
                    </div>
                    {(a.new_values || a.old_values) && (
                      <pre className="whitespace-pre-wrap text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(a.new_values || a.old_values || {}, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      <Card>
        <CardHeader><CardTitle>BBC Review</CardTitle></CardHeader>
        <CardContent>
          {bbcs.length === 0 ? (
            <div className="text-muted-foreground">No BBCs yet.</div>
          ) : (
            <div className="grid gap-4">
              {bbcs.map(r => (
                <div key={r.id} className="border rounded p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">
                        Period End: {r.period_end} • Facility: <span className="font-mono">{r.facility_id}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Status: <span className="uppercase">{r.status}</span>
                        {r.submitted_at && <> • Submitted {new Date(r.submitted_at).toLocaleString()}</>}
                        {r.decided_at && <> • Decided {new Date(r.decided_at).toLocaleString()}</>}
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => toggleBbcExpand(r.id)}>
                      {bbcExpanded[r.id] ? 'Hide' : 'View'}
                    </Button>
                  </div>

                  {bbcExpanded[r.id] && (
                    <>
                      {/* Totals snapshot */}
                      <div className="grid gap-1 text-sm">
                        <div className="flex justify-between"><span>Gross Collateral</span><span className="font-medium">{r.gross_collateral.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span></div>
                        <div className="flex justify-between"><span>Ineligibles</span><span className="font-medium">{r.ineligibles.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span></div>
                        <div className="flex justify-between"><span>Reserves</span><span className="font-medium">{r.reserves.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span></div>
                        <div className="flex justify-between"><span>Advance Rate</span><span className="font-medium">{(r.advance_rate*100).toFixed(2)}%</span></div>
                        <div className="flex justify-between"><span>Borrowing Base</span><span className="font-medium">{r.borrowing_base.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span></div>
                        <div className="flex justify-between"><span>Availability (BBC)</span><span className="font-medium">{r.availability.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span></div>
                      </div>

                      {/* Items */}
                      <div className="pt-2">
                        <div className="font-medium mb-2 text-sm">Items</div>
                        {Array.isArray(bbcItemsById[r.id]) && bbcItemsById[r.id].length > 0 ? (
                          <div className="grid gap-2">
                            {bbcItemsById[r.id].map(it => (
                              <div key={it.id} className="flex items-center justify-between border-b pb-2 last:border-b-0 text-sm">
                                <div className="truncate">
                                  <span className="font-medium capitalize">{it.item_type.replace('_',' ')}</span>
                                  {it.ref && <span> • {it.ref}</span>}
                                  {it.ineligible && <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-800">Ineligible</span>}
                                  <div className="text-xs text-muted-foreground">{it.note || ''}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">{it.amount.toLocaleString('en-US',{style:'currency',currency:'USD'})}</div>
                                  {it.haircut_rate > 0 && (
                                    <div className="text-xs text-muted-foreground">Haircut {(it.haircut_rate*100).toFixed(2)}%</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-sm">No items.</div>
                        )}
                      </div>

                      {/* Decision notes + actions */}
                      <div className="grid gap-2 pt-2">
                        <label className="text-sm">Decision notes</label>
                        <Input
                          className="text-sm"
                          value={bbcNotes[r.id] ?? r.decision_notes ?? ''}
                          onChange={(e)=>setBbcDecisionNotes(r.id, e.target.value)}
                          placeholder="Reason or internal notes"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            disabled={decidingBbcId === r.id || r.status === 'approved'}
                            onClick={()=>decideBbc(r.id, 'approved')}
                          >
                            {decidingBbcId === r.id ? 'Saving…' : 'Approve'}
                          </Button>
                          <Button
                            variant="destructive"
                            disabled={decidingBbcId === r.id || r.status === 'rejected'}
                            onClick={()=>decideBbc(r.id, 'rejected')}
                          >
                            {decidingBbcId === r.id ? 'Saving…' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
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