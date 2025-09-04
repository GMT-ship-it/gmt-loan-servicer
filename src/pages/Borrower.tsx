import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import 'jspdf-autotable';

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
type DrawDoc = { 
  id: string; 
  path: string; 
  original_name: string | null; 
  mime_type: string | null; 
  size_bytes: number | null; 
  uploaded_at: string; 
};

type BbcStatus = 'draft'|'submitted'|'under_review'|'approved'|'rejected';
type BbcReport = {
  id: string; facility_id: string; period_end: string; status: BbcStatus;
  gross_collateral: number; ineligibles: number; reserves: number;
  advance_rate: number; borrowing_base: number; availability: number; created_at: string;
};
type BbcItemType = 'accounts_receivable'|'inventory'|'cash'|'other';
type BbcItem = {
  id: string; report_id: string; item_type: BbcItemType;
  ref: string|null; note: string|null; amount: number;
  ineligible: boolean; haircut_rate: number; created_at: string;
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
  const [accrued, setAccrued] = useState<number | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  
  // Draw request state
  const [drawAmount, setDrawAmount] = useState<string>('50000');
  const [drawMemo, setDrawMemo] = useState<string>('Working capital');
  const [postingDraw, setPostingDraw] = useState(false);
  const [draws, setDraws] = useState<Draw[]>([]);
  
  // Document upload state
  const [activeDrawId, setActiveDrawId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DrawDoc[]>([]);
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);

  // BBC state
  const [bbc, setBbc] = useState<BbcReport | null>(null);
  const [bbcItems, setBbcItems] = useState<BbcItem[]>([]);
  const [bbcPeriodEnd, setBbcPeriodEnd] = useState<string>(new Date().toISOString().slice(0,10));
  const [creatingBbc, setCreatingBbc] = useState(false);

  // Statement PDF state
  const [stmtMonth, setStmtMonth] = useState<string>(new Date().toISOString().slice(0,7)); // YYYY-MM
  const [stmtLoading, setStmtLoading] = useState(false);

  const [itemForm, setItemForm] = useState({
    item_type: 'accounts_receivable' as BbcItemType,
    ref: '', note: '', amount: '10000', ineligible: false, haircut_rate: '0.0000'
  });

  // Validation helpers
  const reqAmt = Number(drawAmount || '0');
  const tooSmall = facility ? reqAmt > 0 && reqAmt < (facility.min_advance ?? 0) : false;
  const tooLarge = available != null ? reqAmt > available : false;
  const invalidAmt = Number.isNaN(reqAmt) || reqAmt <= 0 || tooSmall || tooLarge;

  function monthBounds(yyyyMm: string): { start: string; end: string } {
    const [y, m] = yyyyMm.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0)); // last day of month
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }

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

        // 2) Load principal using the secure function
        if (fac?.id) {
          const { data: princData, error: prErr } = await supabase
            .rpc('get_facility_principal', { p_facility_id: fac.id });

          if (prErr) {
            setErr(prErr.message);
          } else {
            // The function returns an array, get the first result
            const princRow = princData?.[0];
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

          // 5) Accrued Interest (unposted)
          const { data: accr, error: accErr } = await supabase
            .rpc('facility_accrued_interest', { p_facility: fac.id });
          if (!accErr) setAccrued(Number(accr ?? 0));

          // 5) Load draw requests for this facility
          const { data: drs, error: drErr } = await supabase
            .from('draw_requests')
            .select('id, amount, status, created_at')
            .eq('facility_id', fac.id)
            .order('created_at', { ascending: false });

          if (!drErr) {
            setDraws(drs || []);
            
            // Load docs for latest submitted draw
            const latestSubmitted = (drs || []).find(d => d.status === 'submitted');
            setActiveDrawId(latestSubmitted?.id ?? null);
            
            if (latestSubmitted?.id) {
              const { data: dd, error: ddErr } = await supabase
                .from('draw_documents')
                .select('id, path, original_name, mime_type, size_bytes, uploaded_at')
                .eq('draw_request_id', latestSubmitted.id)
                .order('uploaded_at', { ascending: false });
              
              if (!ddErr) setDocs(dd || []);
            } else {
              setDocs([]);
            }
          }

          // 6) Load BBC for this facility
          const { data: rep } = await supabase
            .from('borrowing_base_reports')
            .select('id, facility_id, period_end, status, gross_collateral, ineligibles, reserves, advance_rate, borrowing_base, availability, created_at')
            .eq('facility_id', fac.id)
            .order('period_end', { ascending: false })
            .limit(1)
            .maybeSingle();

          setBbc(rep || null);

          if (rep?.id) {
            const { data: items } = await supabase
              .from('borrowing_base_items')
              .select('id, report_id, item_type, ref, note, amount, ineligible, haircut_rate, created_at')
              .eq('report_id', rep.id)
              .order('created_at', { ascending: false });
            setBbcItems(items || []);
          } else {
            setBbcItems([]);
          }
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

  async function uploadDocs(e: React.FormEvent) {
    e.preventDefault();
    if (!facility?.id) { setErr('No facility found'); return; }
    if (!activeDrawId) { setErr('No submitted draw to attach documents to.'); return; }
    if (!filesToUpload || filesToUpload.length === 0) { setErr('Choose file(s) to upload.'); return; }

    setErr(null);
    setUploading(true);

    try {
      for (const file of Array.from(filesToUpload)) {
        // 1) Choose a stable storage path: draws/<draw_id>/<timestamp>-<original>
        const safeName = file.name.replace(/[^\w\-.]+/g, '_');
        const path = `draws/${activeDrawId}/${Date.now()}-${safeName}`;

        // 2) Insert metadata FIRST (RLS requires draw_documents row to exist before storage insert)
        const { error: metaErr } = await supabase
          .from('draw_documents')
          .insert({
            draw_request_id: activeDrawId,
            path,
            original_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size ?? null
          });
        if (metaErr) throw metaErr;

        // 3) Upload the file to the same path
        const { error: upErr } = await supabase
          .storage
          .from('summitline-docs')
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
      }

      // 4) Refresh docs list
      const { data: dd } = await supabase
        .from('draw_documents')
        .select('id, path, original_name, mime_type, size_bytes, uploaded_at')
        .eq('draw_request_id', activeDrawId)
        .order('uploaded_at', { ascending: false });

      setDocs(dd || []);
      setFilesToUpload(null);
    } catch (err: any) {
      setErr(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // Helper to get a temporary download URL (signed) for a given path
  async function getSignedUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase
      .storage
      .from('summitline-docs')
      .createSignedUrl(path, 60 * 10); // 10 minutes
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
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
    
    // Update active draw and docs after creating new draw
    const latestSubmitted = (drs || []).find(d => d.status === 'submitted');
    setActiveDrawId(latestSubmitted?.id ?? null);
    setDocs([]); // New draw has no docs yet
    
    setErr(null);
    setDrawAmount('50000');
    setDrawMemo('Working capital');
  }

  async function createBbc(e: React.FormEvent) {
    e.preventDefault();
    if (!facility?.id) { setErr('No facility found'); return; }
    setCreatingBbc(true); setErr(null);

    const { data, error } = await supabase
      .from('borrowing_base_reports')
      .insert({
        facility_id: facility.id,
        period_end: bbcPeriodEnd,
        status: 'draft',
        advance_rate: 0.80
      })
      .select('id, facility_id, period_end, status, gross_collateral, ineligibles, reserves, advance_rate, borrowing_base, availability, created_at')
      .single();

    setCreatingBbc(false);
    if (error) { setErr(error.message); return; }
    setBbc(data);
    setBbcItems([]);
  }

  async function addBbcItem(e: React.FormEvent) {
    e.preventDefault();
    if (!bbc?.id) { setErr('Create a BBC first'); return; }
    setErr(null);
    const amt = Number(itemForm.amount);
    const hr  = Number(itemForm.haircut_rate);
    if (!(amt > 0)) { setErr('Enter amount > 0'); return; }
    if (Number.isNaN(hr) || hr < 0 || hr > 1) { setErr('Haircut must be between 0 and 1'); return; }

    const { error } = await supabase.from('borrowing_base_items').insert({
      report_id: bbc.id, item_type: itemForm.item_type as BbcItemType,
      ref: itemForm.ref || null, note: itemForm.note || null,
      amount: amt, ineligible: itemForm.ineligible, haircut_rate: hr
    });
    if (error) { setErr(error.message); return; }

    const [{ data: items }, { data: rep }] = await Promise.all([
      supabase.from('borrowing_base_items')
        .select('id, report_id, item_type, ref, note, amount, ineligible, haircut_rate, created_at')
        .eq('report_id', bbc.id).order('created_at', { ascending: false }),
      supabase.from('borrowing_base_reports')
        .select('id, facility_id, period_end, status, gross_collateral, ineligibles, reserves, advance_rate, borrowing_base, availability, created_at')
        .eq('id', bbc.id).single()
    ]);
    setBbcItems(items || []);
    if (rep) setBbc(rep);

    setItemForm(f => ({ ...f, ref: '', note: '', amount: '10000', ineligible: false, haircut_rate: '0.0000' }));
  }

  async function submitBbc() {
    if (!bbc?.id) return;
    const { error } = await supabase
      .from('borrowing_base_reports')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', bbc.id);
    if (error) { setErr(error.message); return; }

    const { data: rep } = await supabase
      .from('borrowing_base_reports')
      .select('id, facility_id, period_end, status, gross_collateral, ineligibles, reserves, advance_rate, borrowing_base, availability, created_at')
      .eq('id', bbc.id).single();
    if (rep) setBbc(rep);
  }

  async function downloadStatementPdf() {
    if (!facility?.id) { setErr('No facility found'); return; }
    setStmtLoading(true); setErr(null);
    try {
      const { start, end } = monthBounds(stmtMonth);

      // Fetch customer name and BBC compliance
      const [
        { data: header, error: hErr }, 
        { data: lines, error: lErr },
        { data: bbcOk, error: bbcErr }
      ] = await Promise.all([
        supabase.rpc('statement_header', { p_facility: facility.id, p_start: start, p_end: end }),
        supabase.rpc('statement_txns', { p_facility: facility.id, p_start: start, p_end: end }),
        supabase.rpc('facility_has_recent_approved_bbc', { p_facility: facility.id, p_days: 45 })
      ]);
      
      if (hErr) throw hErr;
      if (lErr) throw lErr;

      const hdr = Array.isArray(header) ? header[0] : header;
      const txns = Array.isArray(lines) ? lines : [];
      const customerName = customer?.legal_name || 'Customer';

      const doc = new jsPDF();
      const money = (n: number) => (Number(n || 0)).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

      // OPTIONAL: Add logo (uncomment and replace with actual base64)
      // try {
      //   doc.addImage('data:image/png;base64,YOUR_BASE64_HERE', 'PNG', 14, 8, 28, 10);
      // } catch { /* no logo */ }

      // Enhanced Header
      doc.setFontSize(14);
      doc.text('Mountain Investments — Monthly Statement', 14, 16);
      doc.setFontSize(10);
      doc.text(`Customer: ${customerName}`, 14, 22);
      doc.text(`Facility: ${facility.id}`, 14, 27);
      doc.text(`Period: ${start} to ${end}`, 14, 32);

      // Compliance status line
      doc.text(`Compliance: BBC ≤45d ${bbcOk ? 'OK' : 'STALE'} • Docs OK reflects draw-level`, 14, 38);

      // Financial snapshot (shifted down)
      doc.text(`Opening Principal: ${money(hdr?.opening_principal)}`, 14, 46);
      doc.text(`Closing Principal: ${money(hdr?.closing_principal)}`, 14, 52);
      doc.text(`Interest Posted: ${money(hdr?.interest_posted)}`, 14, 58);
      doc.text(`Accrued (EOM, unposted): ${money(hdr?.accrued_interest_eom)}`, 14, 64);

      // Table of transactions (shifted down)
      // @ts-ignore
      doc.autoTable({
        startY: 72,
        head: [['Date/Time', 'Type', 'Amount', 'Memo']],
        body: txns.map((t: any) => [
          new Date(t.effective_at).toLocaleString(),
          String(t.type),
          money(t.amount),
          t.memo || ''
        ]),
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [0, 0, 0] }
      });

      doc.save(`statement_${stmtMonth}.pdf`);
    } catch (e: any) {
      setErr(e.message || 'Failed to generate statement');
    } finally {
      setStmtLoading(false);
    }
  }

  // Helper to set last month quickly
  const setLastMonth = () => {
    const dt = new Date(); 
    dt.setMonth(dt.getMonth() - 1);
    setStmtMonth(dt.toISOString().slice(0, 7));
  };

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
              <div className="flex justify-between">
                <span>Accrued Interest (unposted)</span>
                <span className="font-medium">
                  {(accrued ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Monthly Statement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="grid gap-1">
              <label className="text-sm">Month</label>
              <input
                type="month"
                value={stmtMonth}
                onChange={(e) => setStmtMonth(e.target.value)}
                className="border rounded px-3 py-2"
              />
            </div>
            <Button variant="outline" onClick={setLastMonth}>Last Month</Button>
            <Button onClick={downloadStatementPdf} disabled={!facility?.id || stmtLoading}>
              {stmtLoading ? 'Preparing…' : 'Download PDF'}
            </Button>
          </div>
          
          <details className="mt-2">
            <summary className="cursor-pointer text-sm underline">How is interest calculated?</summary>
            <div className="text-xs text-muted-foreground mt-1">
              Daily accrual: principal × APR / 365 × days between cashflow events. Posting resets accrual.
            </div>
          </details>
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
        <CardHeader><CardTitle>Upload Required Docs</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {!activeDrawId ? (
            <div className="text-muted-foreground">
              No submitted draw found. Submit a draw request to attach documents.
            </div>
          ) : (
            <>
              <div className="text-sm">
                Attaching to Draw ID: <span className="font-mono">{activeDrawId}</span>
              </div>
              <form onSubmit={uploadDocs} className="grid gap-3">
                <input
                  type="file"
                  multiple
                  onChange={(e) => setFilesToUpload(e.target.files)}
                  className="border rounded px-3 py-2"
                />
                <div>
                  <button
                    type="submit"
                    disabled={uploading || !filesToUpload || filesToUpload.length === 0}
                    className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="pt-2">
            <div className="font-medium mb-2">Attached Files</div>
            {docs.length === 0 ? (
              <div className="text-muted-foreground">No documents uploaded yet.</div>
            ) : (
              <div className="grid gap-2">
                {docs.map(d => (
                  <div key={d.id} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                    <div className="text-sm">
                      <div className="font-medium">{d.original_name || d.path.split('/').pop()}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(d.uploaded_at).toLocaleString()} • {d.mime_type || 'file'} • {(d.size_bytes ?? 0).toLocaleString()} bytes
                      </div>
                    </div>
                    <button
                      className="text-sm underline"
                      onClick={async () => {
                        const url = await getSignedUrl(d.path);
                        if (url) window.open(url, '_blank');
                      }}
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {err && <div className="text-destructive">{err}</div>}
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader><CardTitle>Borrowing Base Certificate (BBC)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!bbc ? (
            <form onSubmit={createBbc} className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-sm">Period End</label>
                <input type="date" value={bbcPeriodEnd}
                       onChange={(e)=>setBbcPeriodEnd(e.target.value)}
                       className="border rounded px-3 py-2" />
              </div>
              <div>
                <button className="px-4 py-2 rounded bg-primary text-primary-foreground"
                        disabled={creatingBbc || !facility?.id}>
                  {creatingBbc ? 'Creating…' : 'Create BBC'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Header snapshot */}
              <div className="grid gap-1 text-sm">
                <div className="flex justify-between"><span>Status</span><span className="font-medium uppercase">{bbc.status}</span></div>
                <div className="flex justify-between"><span>Period End</span><span className="font-medium">{bbc.period_end}</span></div>
                <div className="flex justify-between"><span>Gross Collateral</span><span className="font-medium">{bbc.gross_collateral.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span></div>
                <div className="flex justify-between"><span>Ineligibles</span><span className="font-medium">{bbc.ineligibles.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span></div>
                <div className="flex justify-between"><span>Reserves</span><span className="font-medium">{bbc.reserves.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span></div>
                <div className="flex justify-between"><span>Borrowing Base</span><span className="font-medium">{bbc.borrowing_base.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span></div>
                <div className="flex justify-between"><span>Availability (BBC)</span><span className="font-medium">{bbc.availability.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span></div>
              </div>

              {/* Add line item (draft/submitted) */}
              {(bbc.status === 'draft' || bbc.status === 'submitted') && (
                <form onSubmit={addBbcItem} className="grid gap-3 pt-2">
                  <div className="grid gap-1">
                    <label className="text-sm">Type</label>
                    <select value={itemForm.item_type}
                            onChange={(e)=>setItemForm(f=>({...f, item_type: e.target.value as BbcItemType}))}
                            className="border rounded px-3 py-2">
                      <option value="accounts_receivable">Accounts Receivable</option>
                      <option value="inventory">Inventory</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm">Reference</label>
                    <input className="border rounded px-3 py-2"
                           value={itemForm.ref}
                           onChange={(e)=>setItemForm(f=>({...f, ref: e.target.value}))}/>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm">Note</label>
                    <input className="border rounded px-3 py-2"
                           value={itemForm.note}
                           onChange={(e)=>setItemForm(f=>({...f, note: e.target.value}))}/>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm">Amount (USD)</label>
                    <input type="number" min="0" step="0.01" className="border rounded px-3 py-2"
                           value={itemForm.amount}
                           onChange={(e)=>setItemForm(f=>({...f, amount: e.target.value}))}/>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm">Haircut Rate (0–1)</label>
                    <input type="number" min="0" max="1" step="0.0001" className="border rounded px-3 py-2"
                           value={itemForm.haircut_rate}
                           onChange={(e)=>setItemForm(f=>({...f, haircut_rate: e.target.value}))}/>
                  </div>
                  <label className="text-sm inline-flex items-center gap-2">
                    <input type="checkbox"
                           checked={itemForm.ineligible}
                           onChange={(e)=>setItemForm(f=>({...f, ineligible: e.target.checked}))}/>
                    Mark ineligible
                  </label>
                  <div>
                    <button className="px-4 py-2 rounded bg-primary text-primary-foreground">Add Item</button>
                  </div>
                </form>
              )}

              {/* Items list */}
              <div className="pt-2">
                <div className="font-medium mb-2">Items</div>
                {bbcItems.length === 0 ? (
                  <div className="text-muted-foreground">No items yet.</div>
                ) : (
                  <div className="grid gap-2">
                    {bbcItems.map(it => (
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
                )}
              </div>

              {(bbc.status === 'draft' || bbc.status === 'submitted') && (
                <div className="pt-2">
                  <button className="px-4 py-2 rounded bg-primary text-primary-foreground" onClick={submitBbc}>
                    Submit BBC for Review
                  </button>
                </div>
              )}
            </>
          )}
          {err && <div className="text-destructive">{err}</div>}
        </CardContent>
      </Card>
    </div>
  );
}