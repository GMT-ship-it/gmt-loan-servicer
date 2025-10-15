import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/NotificationBell';
import { BbcCsvUpload } from '@/components/BbcCsvUpload';
import { MotionRow as Row } from '@/components/MotionRow';
import { MetricCard } from '@/components/MetricCard';
import { ListCard } from '@/components/ListCard';
import { Chip } from '@/components/Chip';
import { useNotify } from '@/lib/notify';
import { MetricSkeleton, SkeletonCard, SkeletonLine } from '@/components/Skeletons';
import { Role } from '@/types/domain';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import 'jspdf-autotable';

type Profile = { role: Role; customer_id: string | null };
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
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [loadingFacility, setLoadingFacility] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [loadingDraws, setLoadingDraws] = useState(true);
  const [loadingBBC, setLoadingBBC] = useState(true);
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

  // Validation helpers - enhanced with error messages
  const reqAmt = Number(drawAmount || '0');
  const tooSmall = facility ? reqAmt > 0 && reqAmt < (facility.min_advance ?? 0) : false;
  const tooLarge = available != null ? reqAmt > available : false;
  const invalidAmt = Number.isNaN(reqAmt) || reqAmt <= 0 || tooSmall || tooLarge;
  
  const getAmountError = () => {
    if (!drawAmount || reqAmt <= 0) return "Amount must be greater than 0";
    if (tooSmall) return `Below minimum advance of ${money(facility?.min_advance || 0)}`;
    if (tooLarge) return `Exceeds available to draw (${money(available || 0)})`;
    return null;
  };

  // Helper function for formatting currency
  const money = (n: number) => (Number(n || 0)).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

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

      // Fetch role from user_roles and profile for customer_id
      const { data: roleRow, error: rErr } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();

      const { data: p, error: pErr } = await (supabase as any)
        .from('profiles')
        .select('customer_id')
        .eq('id', session.user.id)
        .single();

      if (pErr || !p) { setErr(pErr?.message || 'Profile not found'); setLoading(false); return; }
      const userRole = roleRow?.role as Role;
      setProfile({ ...p, role: userRole });

      // Lenders shouldn't be here
      if (userRole === 'lender_admin' || userRole === 'lender_analyst') {
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
        try {
          const { data: fac, error: fErr } = await supabase
            .from('facilities')
            .select('id, type, credit_limit, apr, min_advance')
            .eq('customer_id', p.customer_id!)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fErr) { setErr(fErr.message); setLoading(false); return; }
          setFacility(fac || null);
          setLoadingFacility(false);

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
              setLoadingTx(false);
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
              setLoadingDraws(false);
              
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
            setLoadingBBC(false);

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
            setLoadingFacility(false);
            setLoadingTx(false);
            setLoadingDraws(false);
            setLoadingBBC(false);
          }
        } catch (error) {
          setLoadingFacility(false);
          setLoadingTx(false);
          setLoadingDraws(false);
          setLoadingBBC(false);
        }
      }

      setLoading(false);
    })();
  }, [navigate]);

  // Command palette event listeners
  useEffect(() => {
    const onOpenRequestFunds = () => {
      const drawSection = document.querySelector('[data-section="draw-request"]');
      drawSection?.scrollIntoView({ behavior: 'smooth' });
    };
    
    const onDownloadStatement = () => {
      downloadStatementPdf();
    };
    
    const onOpenBbcUpload = () => {
      const bbcSection = document.querySelector('[data-section="bbc"]');
      bbcSection?.scrollIntoView({ behavior: 'smooth' });
    };

    window.addEventListener('open-request-funds', onOpenRequestFunds as EventListener);
    window.addEventListener('download-latest-statement', onDownloadStatement as EventListener);
    window.addEventListener('open-bbc-upload', onOpenBbcUpload as EventListener);

    return () => {
      window.removeEventListener('open-request-funds', onOpenRequestFunds as EventListener);
      window.removeEventListener('download-latest-statement', onDownloadStatement as EventListener);
      window.removeEventListener('open-bbc-upload', onOpenBbcUpload as EventListener);
    };
  }, []);

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

    try {
      setPostingDraw(true);
      const { error } = await supabase.from('draw_requests').insert({
        facility_id: facility.id,
        amount: amt,
        decision_notes: drawMemo || null
      });

      if (error) throw error;

      notify.success("Draw request submitted", "Your request is now under review");

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
    } catch (err: any) {
      notify.error("Request failed", err.message || "Unknown error");
      setErr(err.message);
    } finally {
      setPostingDraw(false);
    }
  }

  async function createBbc(e: React.FormEvent) {
    e.preventDefault();
    if (!facility?.id) { setErr('No facility found'); return; }
    
    try {
      setCreatingBbc(true); 
      setErr(null);

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

      if (error) throw error;

      setBbc(data);
      setBbcItems([]);
      notify.success("BBC created", "You can now add collateral items");
    } catch (err: any) {
      notify.error("Creation failed", err.message || "Unknown error");
      setErr(err.message);
    } finally {
      setCreatingBbc(false);
    }
  }

  async function addBbcItem(e: React.FormEvent) {
    e.preventDefault();
    if (!bbc?.id) { setErr('Create a BBC first'); return; }
    
    try {
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
      
      if (error) throw error;

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
      notify.success("Item added", "BBC totals have been updated");
    } catch (err: any) {
      notify.error("Add failed", err.message || "Unknown error");
      setErr(err.message);
    }
  }

  async function submitBbc() {
    if (!bbc?.id) return;
    
    try {
      const { error } = await supabase
        .from('borrowing_base_reports')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', bbc.id);
      
      if (error) throw error;

      const { data: rep } = await supabase
        .from('borrowing_base_reports')
        .select('id, facility_id, period_end, status, gross_collateral, ineligibles, reserves, advance_rate, borrowing_base, availability, created_at')
        .eq('id', bbc.id).single();
      if (rep) setBbc(rep);

      notify.success("BBC submitted", "Your report is now under review");
    } catch (err: any) {
      notify.error("Submit failed", err.message || "Unknown error");
      setErr(err.message);
    }
  }

  async function downloadStatementPdf() {
    if (!facility?.id) { setErr('No facility found'); return; }
    
    try {
      setStmtLoading(true); 
      setErr(null);
      notify.info("Generating statement…");

      const { start, end } = monthBounds(stmtMonth);

      // ... keep existing code (fetch data, create PDF, etc.)
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
      notify.success("Statement ready", "Check your downloads.");
    } catch (e: any) {
      notify.error("Statement failed", e.message || "Failed to generate statement");
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

  if (loading) return <div>Loading...</div>;
  if (err) return <div>Error: {err}</div>;

  // Formatted strings
  const creditLimitFmt = facility ? money(facility.credit_limit) : '$0.00';
  const aprFmt = facility ? `${(Number(facility.apr) * 100).toFixed(2)}%` : '—';
  const principalFmt = money(principal ?? 0);
  const availableFmt = money(available ?? 0);
  const accruedFmt = money(accrued ?? 0);
  const bbcFresh = true; // You can implement BBC freshness check

  return (
    <>
      {/* Hero header */}
      <div className="mt-8">
         <div
           className="rounded-2xl overflow-hidden relative"
           style={{
             background:
               'radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)',
           }}
         >
          <div className="p-6 md:p-10">
            <h1 className="text-2xl md:text-3xl font-extrabold">Welcome back</h1>
            <p className="text-neutral-300 mt-2">Your credit line at a glance</p>
            <div className="mt-4 flex gap-3 flex-wrap">
              <Button
                onClick={() => {
                  // Scroll to draw request section
                  const drawSection = document.querySelector('[data-section="draw-request"]');
                  drawSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-white text-black hover:bg-white/90 w-full sm:w-auto"
              >
                Request Funds
              </Button>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="month"
                  value={stmtMonth}
                  onChange={(e) => setStmtMonth(e.target.value)}
                  className="px-3 py-2 bg-[var(--surface)] border border-[var(--card-border)] rounded text-white text-sm"
                  aria-label="Statement month"
                />
                <Button
                  variant="outline"
                  onClick={downloadStatementPdf}
                  disabled={stmtLoading}
                  className="border-[var(--card-border)] hover:bg-[var(--surface-2)] text-[var(--text)]"
                  aria-label="Download monthly statement PDF"
                >
                  {stmtLoading ? 'Generating…' : 'Download Statement (PDF)'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row: Facility snapshot */}
      <Row title="Facility Snapshot">
        {loadingFacility ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <MetricCard label="Credit Limit" value={creditLimitFmt} sub={`APR ${aprFmt}`} />
            <MetricCard label="Outstanding Principal" value={principalFmt} sub="Updated in real time" />
            <MetricCard label="Available to Draw" value={availableFmt} sub={bbcFresh ? 'BBC fresh' : 'BBC stale'} />
            <MetricCard label="Accrued Interest" value={accruedFmt} sub="Unposted" />
          </>
        )}
      </Row>

      {/* Row: Recent Activity (transactions) */}
      <Row title="Recent Activity">
        {loadingTx ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : !txs?.length ? (
          <div className="min-w-[320px] card-surface p-4 text-center text-neutral-400">
            No transactions yet
          </div>
        ) : (
          txs.map((t: any) => (
            <ListCard
              key={t.id}
              title={`${String(t.type).toUpperCase()} • ${money(t.amount)}`}
              meta={new Date(t.effective_at).toLocaleString()}
              right={
                <Chip
                  text={t.type}
                  tone={t.type === 'payment' ? 'ok' : t.type === 'advance' ? 'warn' : 'muted'}
                />
              }
              muted={t.memo || ''}
            />
          ))
        )}
      </Row>

      {/* Row: Draw requests */}
      <Row
        title="Draw Requests"
        action={<button className="text-sm text-muted hover:opacity-80">View all</button>}
      >
        {loadingDraws ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : !draws?.length ? (
          <div className="min-w-[320px] card-surface p-4 text-center text-neutral-400">
            No draws yet — Request funds to get started
          </div>
        ) : (
          draws.map((d: any) => (
            <ListCard
              key={d.id}
              title={`Request ${money(d.amount)}`}
              meta={new Date(d.created_at).toLocaleString()}
              right={
                <Chip
                  text={d.status.replace('_', ' ')}
                  tone={d.status === 'approved' ? 'ok' : d.status === 'rejected' ? 'bad' : 'warn'}
                />
              }
              muted={`Draw ID: ${d.id.slice(0, 8)}`}
            />
          ))
        )}
      </Row>

      {/* Draw Request Form Section */}
      <div data-section="draw-request" className="mt-8">
        <Card className="border-[var(--card-border)] bg-[var(--surface-2)]">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Request Funds
              {activeDrawId && (
                <span className="text-sm font-normal text-neutral-300">
                  Attaching to pending request: {money(draws.find(d => d.id === activeDrawId)?.amount || 0)} on {draws.find(d => d.id === activeDrawId) ? new Date(draws.find(d => d.id === activeDrawId)!.created_at).toLocaleDateString() : ''}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submitDraw} className="space-y-4">
              <div>
                <label htmlFor="amount" className="text-sm font-medium text-white mb-2 block">
                  Amount to Request
                </label>
                <input
                  id="amount"
                  type="number"
                  value={drawAmount}
                  onChange={(e) => setDrawAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--card-border)] rounded text-white placeholder:text-muted"
                  placeholder="Enter amount"
                />
                {getAmountError() && (
                  <p className="text-sm text-red-400 mt-1">{getAmountError()}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="memo" className="text-sm font-medium text-white mb-2 block">
                  Purpose (Optional)
                </label>
                <input
                  id="memo"
                  type="text"
                  value={drawMemo}
                  onChange={(e) => setDrawMemo(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--card-border)] rounded text-white placeholder:text-muted"
                  placeholder="e.g., Working capital"
                />
              </div>
              
              <Button
                type="submit"
                disabled={postingDraw || invalidAmt}
                className="w-full bg-white text-black hover:bg-white/90"
              >
                {postingDraw ? 'Submitting...' : 'Submit Draw Request'}
              </Button>
            </form>

            {/* Document Upload Section */}
            {activeDrawId && (
              <div className="border-t border-[var(--card-border)] pt-4">
                <h3 className="text-white font-medium mb-3">Upload Supporting Documents</h3>
                <form onSubmit={uploadDocs} className="space-y-3">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => setFilesToUpload(e.target.files)}
                    className="w-full text-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-white file:text-black hover:file:bg-white/90"
                  />
                  <Button
                    type="submit"
                    disabled={uploading || !filesToUpload?.length}
                    variant="outline"
                    className="w-full border-[var(--card-border)] text-white hover:bg-[var(--surface-2)]"
                  >
                    {uploading ? 'Uploading...' : 'Upload Files'}
                  </Button>
                </form>

                {/* Show uploaded documents */}
                {docs.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-white mb-2">Uploaded Documents</h4>
                    <div className="space-y-2">
                      {docs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-2 bg-[var(--surface)] rounded border border-[var(--card-border)]">
                          <div>
                            <div className="text-sm text-white">{doc.original_name}</div>
                            <div className="text-xs text-neutral-400">
                              {doc.size_bytes ? `${(doc.size_bytes / 1024).toFixed(1)} KB` : ''} • {new Date(doc.uploaded_at).toLocaleDateString()}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const url = await getSignedUrl(doc.path);
                              if (url) window.open(url, '_blank');
                            }}
                            className="text-xs border-[var(--card-border)] text-white hover:bg-[var(--surface-2)]"
                          >
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row: BBC reports */}
      <Row title="Borrowing Base Certificates">
        {loadingBBC ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : !bbc ? (
          <div className="min-w-[320px] card-surface p-4 text-center text-neutral-400">
            No BBC reports yet
          </div>
        ) : (
          <ListCard
            key={bbc.id}
            title={`Period End • ${bbc.period_end}`}
            meta={`Borrowing Base ${money(bbc.borrowing_base)} • Availability ${money(bbc.availability)}`}
            right={<Chip text={bbc.status} tone={bbc.status === 'approved' ? 'ok' : bbc.status === 'rejected' ? 'bad' : 'warn'} />}
          />
        )}
      </Row>

      {/* Printable Statement Section */}
      <div className="print-compact mt-12">
        <h1 className="text-xl font-bold mb-2">Monthly Statement — {customer?.legal_name || 'Borrower'}</h1>
        <div className="text-sm text-neutral-500 mb-4">
          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
        </div>

        {/* Account Snapshot */}
        <section className="avoid-break mb-6 card-surface p-4">
          <h2 className="font-semibold mb-2">Account Snapshot</h2>
          <table>
            <tbody>
              <tr><td>Credit Limit</td><td>{creditLimitFmt}</td></tr>
              <tr><td>Principal Outstanding</td><td>{principalFmt}</td></tr>
              <tr><td>Available to Draw</td><td>{availableFmt}</td></tr>
              <tr><td>Accrued Interest (unposted)</td><td>{accruedFmt}</td></tr>
            </tbody>
          </table>
        </section>

        {/* Transactions */}
        <section className="avoid-break mb-6 card-surface p-4">
          <h2 className="font-semibold mb-2">Recent Transactions</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Memo</th>
                <th scope="col" style={{textAlign:'right'}}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {txs.slice(0, 20).map((t: any) => (
                <tr key={t.id}>
                  <td>{new Date(t.effective_at).toLocaleDateString()}</td>
                  <td>{String(t.type).toUpperCase()}</td>
                  <td>{t.memo || ''}</td>
                  <td style={{textAlign:'right'}}>{money(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* BBC Summary */}
        <section className="avoid-break mb-6 card-surface p-4">
          <h2 className="font-semibold mb-2">Borrowing Base Summary</h2>
          {bbc ? (
            <table>
              <tbody>
                <tr><td>Period End</td><td>{bbc.period_end}</td></tr>
                <tr><td>Status</td><td>{bbc.status}</td></tr>
                <tr><td>Borrowing Base</td><td>{money(bbc.borrowing_base || 0)}</td></tr>
                <tr><td>Availability (from BBC)</td><td>{money(bbc.availability || 0)}</td></tr>
              </tbody>
            </table>
          ) : (
            <div>No BBC submitted.</div>
          )}
        </section>

        <button
          className="no-print bg-white text-black hover:bg-neutral-100 rounded px-4 py-2 font-medium"
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
      </div>
    </>
  );
}