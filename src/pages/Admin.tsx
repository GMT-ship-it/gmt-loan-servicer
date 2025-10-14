import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useNotify } from '@/lib/notify';
import { ExternalLink, TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { NotificationBell } from '@/components/NotificationBell';
import { MotionRow as Row } from '@/components/MotionRow';
import { MetricCard } from '@/components/MetricCard';
import { ListCard } from '@/components/ListCard';
import { Chip } from '@/components/Chip';
import CovenantChip from '@/components/admin/CovenantChip';
import { MetricSkeleton, SkeletonCard, SkeletonLine } from '@/components/Skeletons';
import type { Facility } from '@/types/facility';
import Sparkline from '@/components/charts/Sparkline';
import { darkAxis, gridStroke, tooltipStyle } from '@/components/charts/theme';

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

type Compliance = { docsOk: boolean; bbcOk: boolean; limitOk: boolean; available: number };

type BBCReview = {
  id: string;
  facility_id: string;
  customer_name?: string;
  period_end: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'draft';
  borrowing_base: number;
  availability: number;
  gross_collateral: number;
};

type AuditEntry = {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  created_at: string;
};

// Helper functions
const money = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtPct = (x: number | null | undefined) =>
  `${(Number(x || 0)).toFixed(2)}%`;

// Optional: tone by utilization
const utilTone = (pct: number) =>
  pct >= 80 ? 'bad' : pct >= 50 ? 'warn' : 'ok';

export default function AdminPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [facilitiesList, setFacilitiesList] = useState<FacilityRow[]>([]);
  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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

  // Compliance state
  const [complianceByDraw, setComplianceByDraw] = useState<Record<string, Compliance>>({});

  // Exposure state
  const [exposure, setExposure] = useState<ExposureRow[]>([]);
  const [loadingExposure, setLoadingExposure] = useState(false);
  const [loadingDraws, setLoadingDraws] = useState(false);
  const [loadingBBC, setLoadingBBC] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  
  // Compliance and Analytics state
  const [breaches, setBreaches] = useState<any[]>([]);
  const [portfolioAgg, setPortfolioAgg] = useState<any[]>([]);
  const [covenantBreaches, setCovenantBreaches] = useState<Record<string, { open: number; total: number }>>({});
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [timeSeriesFacility, setTimeSeriesFacility] = useState('');
  const [breachesLoading, setBreachesLoading] = useState(false);

  // BBC Review and Audit state
  const [bbcReviews, setBbcReviews] = useState<BBCReview[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  // Load functions
  const loadBreaches = async () => {
    try {
      setBreachesLoading(true);
      const { data, error } = await supabase.rpc('portfolio_policy_breaches');
      if (error) throw error;
      setBreaches(data || []);
    } catch (error) {
      console.error('Error loading breaches:', error);
      notify.error("Error", "Failed to load compliance breaches");
    } finally {
      setBreachesLoading(false);
    }
  };

  const loadPortfolioAgg = async () => {
    try {
      const { data, error } = await supabase.rpc('get_portfolio_aggregates');
      if (error) throw error;
      setPortfolioAgg(data || []);
    } catch (error) {
      console.error('Error loading portfolio aggregates:', error);
      notify.error("Error", "Failed to load portfolio data");
    }
  };

  const loadTimeSeries = async (facilityId: string) => {
    if (!facilityId.trim()) return;
    
    try {
      const { data, error } = await supabase.rpc('utilization_timeseries', { 
        p_facility: facilityId, 
        p_days: 90 
      });
      if (error) throw error;
      setTimeSeries(data || []);
    } catch (error) {
      console.error('Error loading time series:', error);
      notify.error("Error", "Failed to load utilization trend");
    }
  };

  const loadExposure = async () => {
    setLoadingExposure(true);
    try {
      const [exposureRes, breachRes] = await Promise.all([
        supabase.rpc('lender_exposure_snapshot'),
        supabase.from('covenant_breaches').select('facility_id, status').in('status', ['open', 'acknowledged', 'waived'])
      ]);
      
      if (!exposureRes.error) setExposure(exposureRes.data || []);
      
      // Group breach counts by facility
      const breachCounts: Record<string, { open: number; total: number }> = {};
      (breachRes.data || []).forEach((b: any) => {
        if (!breachCounts[b.facility_id]) breachCounts[b.facility_id] = { open: 0, total: 0 };
        breachCounts[b.facility_id].total++;
        if (b.status === 'open') breachCounts[b.facility_id].open++;
      });
      setCovenantBreaches(breachCounts);
    } catch (error) {
      console.error('Error loading exposure:', error);
    }
    setLoadingExposure(false);
  };

  const loadBBCReviews = async () => {
    setLoadingBBC(true);
    try {
      const { data, error } = await supabase
        .from('borrowing_base_reports')
        .select(`
          id, facility_id, period_end, status, borrowing_base, availability, gross_collateral,
          facilities!inner(customer_id, customers!inner(legal_name))
        `)
        .eq('status', 'submitted')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const reviews = (data || []).map(r => ({
        id: r.id,
        facility_id: r.facility_id,
        period_end: r.period_end,
        status: r.status,
        borrowing_base: r.borrowing_base,
        availability: r.availability,
        gross_collateral: r.gross_collateral,
        customer_name: (r.facilities as any)?.customers?.legal_name || 'Unknown'
      }));
      
      setBbcReviews(reviews);
    } catch (error) {
      console.error('Error loading BBC reviews:', error);
      notify.error("Error", "Failed to load BBC reviews");
    } finally {
      setLoadingBBC(false);
    }
  };

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, table_name, record_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setAudit(data || []);
    } catch (error) {
      console.error('Error loading audit:', error);
      notify.error("Error", "Failed to load audit logs");
    } finally {
      setLoadingAudit(false);
    }
  };

  const approveBBC = async (id: string) => {
    try {
      const { error } = await supabase
        .from('borrowing_base_reports')
        .update({ status: 'approved' })
        .eq('id', id);
      
      if (error) throw error;
      
      notify.success("Success", "BBC report approved");
      
      await loadBBCReviews();
    } catch (error) {
      console.error('Error approving BBC:', error);
      notify.error("Error", "Failed to approve BBC report");
    }
  };

  const rejectBBC = async (id: string) => {
    try {
      const { error } = await supabase
        .from('borrowing_base_reports')
        .update({ status: 'rejected' })
        .eq('id', id);
      
      if (error) throw error;
      
      notify.success("Success", "BBC report rejected");
      
      await loadBBCReviews();
    } catch (error) {
      console.error('Error rejecting BBC:', error);
      notify.error("Error", "Failed to reject BBC report");
    }
  };

  const loadDrawRequests = async () => {
    setLoadingDraws(true);
    try {
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
    } finally {
      setLoadingDraws(false);
    }
  };

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
      .createSignedUrl(path, 60 * 10);
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
      setFacilityForm(f => ({ ...f, credit_limit: '500000', apr: '0.145', min_advance: '50000' }));
    }
    setCreating(false);
  }

  async function decideDraw(id: string, newStatus: 'approved'|'rejected') {
    try {
      setDecidingId(id);
      setErr(null);

      const notes = decisionNotes[id] ?? null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('draw_requests')
        .update({
          status: newStatus,
          decision_notes: notes,
          decided_by: session.user.id,
          decided_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      notify.success(
        newStatus === 'approved' ? "Draw approved" : "Draw rejected",
        newStatus === 'approved'
          ? "Advance posted and borrower notified."
          : "Borrower will see the decision immediately."
      );

      await Promise.all([loadDrawRequests(), loadExposure()]);
    } catch (err: any) {
      notify.error("Decision failed", err.message || "Unknown error");
      setErr(err.message);
    } finally {
      setDecidingId(null);
    }
  }

  function setNotes(id: string, v: string) {
    setDecisionNotes(prev => ({ ...prev, [id]: v }));
  }

  async function computeComplianceFor(draws: { id: string; facility_id: string; amount: number; required_docs_ok: boolean; }[]) {
    const result: Record<string, Compliance> = {};

    const uniqueFacilityIds = Array.from(new Set(draws.map(d => d.facility_id)));

    const availabilityMap: Record<string, number> = {};
    await Promise.all(uniqueFacilityIds.map(async (fid) => {
      const { data: avail } = await supabase.rpc('facility_available_to_draw', { p_facility: fid });
      availabilityMap[fid] = Number(avail ?? 0);
    }));

    const bbcOkMap: Record<string, boolean> = {};
    await Promise.all(uniqueFacilityIds.map(async (fid) => {
      const { data: ok } = await supabase.rpc('facility_has_recent_approved_bbc', { p_facility: fid, p_days: 45 });
      bbcOkMap[fid] = !!ok;
    }));

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

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/login', { replace: true });

      const { data: profile, error: pErr } = await (supabase as any)
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (pErr || !profile) {
        setErr(pErr?.message || 'No profile'); setLoading(false); return;
      }
      if (!['lender_admin', 'lender_analyst'].includes(profile.role)) {
        return navigate('/borrower', { replace: true });
      }

      const { data, error } = await (supabase as any)
        .from('customers')
        .select('id, legal_name')
        .order('legal_name', { ascending: true });

      if (error) setErr(error.message);
      else setCustomers(data || []);

      const { data: facs, error: fErr } = await supabase
        .from('facilities')
        .select('id, customer_id')
        .order('created_at', { ascending: false });

      if (!fErr && facs) setFacilitiesList(facs);

      await loadDrawRequests();
      await loadExposure();
      await loadBreaches();
      await loadPortfolioAgg();
      await loadBBCReviews();
      await loadAudit();

      setLoading(false);
    })();
  }, [navigate]);

  // Command palette event listeners
  useEffect(() => {
    const onRefreshExposure = () => {
      loadExposure();
    };

    window.addEventListener('refresh-exposure', onRefreshExposure as EventListener);

    return () => {
      window.removeEventListener('refresh-exposure', onRefreshExposure as EventListener);
    };
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

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
            <h1 className="text-2xl md:text-3xl font-extrabold">Lender Console</h1>
            <p className="text-neutral-300 mt-2">Approvals, exposure & compliance at a glance</p>
            <div className="mt-4 flex gap-3 flex-wrap">
              <Button onClick={loadExposure} className="bg-white text-black hover:bg-white/90 w-full sm:w-auto">Refresh Exposure</Button>
              <Button variant="outline" onClick={loadAudit} className="border-[var(--card-border)] text-[var(--text)] hover:bg-[var(--surface-2)] w-full sm:w-auto">Load Audit</Button>
              <Button 
                variant="outline" 
                className="border-[var(--card-border)] text-[var(--text)] hover:bg-[var(--surface-2)] w-full sm:w-auto"
                onClick={() => navigate('/admin/covenants')}
              >
                Manage Covenants
              </Button>
              <Button 
                variant="outline" 
                className="border-[var(--card-border)] text-[var(--text)] hover:bg-[var(--surface-2)] w-full sm:w-auto"
                onClick={() => navigate('/admin/reports')}
              >
                Reports & Exports
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <Row title="Portfolio KPIs">
        {loadingExposure ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              label="Active Facilities"
              value={String(exposure?.length || 0)}
              sub="with current utilization"
            />
            <MetricCard
              label="Total Exposure"
              value={money(exposure?.reduce((a: number, r: any) => a + Number(r.principal_outstanding || 0), 0))}
              sub="Outstanding principal"
            />
            <MetricCard
              label="Total Availability"
              value={money(exposure?.reduce((a: number, r: any) => a + Number(r.available_to_draw || 0), 0))}
              sub="Across facilities"
            />
            <MetricCard
              label="BBC Status"
              value={`${exposure?.filter((r: any) => r.bbc_approved_within_45d).length || 0} fresh`}
              sub={`${exposure?.filter((r: any) => !r.bbc_approved_within_45d).length || 0} stale`}
            />
          </>
        )}
      </Row>

      {/* Approvals (Draw Requests) */}
      <Row title="Approvals (Draw Requests)">
        {loadingDraws ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : !draws?.length ? (
          <div className="min-w-[320px] card-surface p-4 text-center text-neutral-400">
            No draw requests pending
          </div>
        ) : (
          draws.map((d: any) => (
            <div key={d.id} className="min-w-[360px] snap-start card-surface p-4">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">
                  {d.customer_name || d.facility_id?.slice(0,8)} • {money(d.amount)}
                </div>
                <Chip
                  text={d.status.replace('_',' ')}
                  tone={d.status === 'approved' ? 'ok' : d.status === 'rejected' ? 'bad' : 'warn'}
                />
              </div>
              <div className="text-sm text-neutral-400 mt-1">
                Submitted {new Date(d.created_at).toLocaleString()}
                {d.required_docs_ok ? ' • Docs OK' : ' • Docs missing'}
              </div>

              {/* Compliance badge row if you computed it */}
              {complianceByDraw?.[d.id] && (
                <div className="flex flex-wrap gap-2 mt-3 text-xs">
                  {(() => {
                    const c = complianceByDraw[d.id];
                    return (
                      <>
                        <Chip text={`Docs ${c.docsOk ? 'OK' : 'Missing'}`} tone={c.docsOk ? 'ok' : 'bad'} />
                        <Chip text={`BBC ≤45d ${c.bbcOk ? 'OK' : 'Required'}`} tone={c.bbcOk ? 'ok' : 'warn'} />
                        <Chip
                          text={c.limitOk ? 'Within Limit' : `Exceeds • Avail ${money(c.available)}`}
                          tone={c.limitOk ? 'ok' : 'bad'}
                        />
                      </>
                    );
                  })()}
                </div>
              )}

               {/* Documents Section */}
               {docsByDraw[d.id] && docsByDraw[d.id].length > 0 && (
                 <div className="mt-4 border-t border-[var(--card-border)] pt-3">
                   <h4 className="text-sm font-medium text-white mb-2">Supporting Documents</h4>
                   <div className="space-y-2">
                     {docsByDraw[d.id].map((doc: any) => (
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
                           View
                         </Button>
                       </div>
                     ))}
                   </div>
                   
                   {/* Docs OK Toggle */}
                   <div className="flex items-center justify-between mt-3 p-2 bg-[var(--surface)] rounded">
                     <span className="text-sm text-white">Documents Status:</span>
                     <Button
                       variant="outline"
                       size="sm"
                       disabled={togglingDocsOk === d.id}
                       onClick={() => toggleDocsOk(d.id, !d.required_docs_ok)}
                       className={`text-xs ${
                         d.required_docs_ok 
                           ? 'border-green-500 text-green-400 hover:bg-green-500/10' 
                           : 'border-red-500 text-red-400 hover:bg-red-500/10'
                       }`}
                     >
                       {togglingDocsOk === d.id ? 'Updating...' : d.required_docs_ok ? 'Docs OK ✓' : 'Mark Docs OK'}
                     </Button>
                   </div>
                 </div>
               )}

               {/* Compliance Status */}
               {!complianceByDraw?.[d.id]?.docsOk && (
                 <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
                   Approval requires Borrowing Base compliance and all required documents.
                 </div>
               )}

               {/* Actions */}
               <div className="mt-4 flex gap-2">
                 <Button
                   aria-label={`Approve draw request ${d.id.slice(0,8)}`}
                   variant="outline"
                   disabled={
                     d.status === 'approved' ||
                     !complianceByDraw?.[d.id]?.docsOk ||
                     !complianceByDraw?.[d.id]?.bbcOk ||
                     !complianceByDraw?.[d.id]?.limitOk ||
                     decidingId === d.id
                   }
                   onClick={() => decideDraw(d.id, 'approved')}
                   className="border-[var(--card-border)] hover:bg-[var(--surface-2)] text-[var(--text)]"
                   title={
                     !complianceByDraw?.[d.id]
                       ? 'Checking…'
                       : !complianceByDraw[d.id].docsOk
                       ? 'Docs not OK'
                       : !complianceByDraw[d.id].bbcOk
                       ? 'BBC not fresh'
                       : !complianceByDraw[d.id].limitOk
                       ? 'Exceeds availability'
                       : undefined
                   }
                 >
                   {decidingId === d.id ? 'Saving…' : 'Approve'}
                 </Button>
                 <Button
                   aria-label={`Reject draw request ${d.id.slice(0,8)}`}
                   variant="outline"
                   disabled={d.status === 'rejected' || decidingId === d.id}
                   onClick={() => decideDraw(d.id, 'rejected')}
                   className="border-white/20 hover:bg-white/5 text-white"
                 >
                   Reject
                 </Button>
               </div>
            </div>
          ))
        )}
      </Row>

      {/* BBC Review */}
      <Row title="Borrowing Base Review">
        {loadingBBC ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : !bbcReviews?.length ? (
          <div className="min-w-[320px] card-surface p-4 text-center text-neutral-400">
            No BBC reports pending review
          </div>
        ) : (
          bbcReviews.map((r: any) => (
            <div key={r.id} className="min-w-[360px] snap-start card-surface p-4">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">
                  {r.customer_name || r.facility_id?.slice(0,8)} • Period {r.period_end}
                </div>
                <Chip text={r.status} tone={r.status==='approved'?'ok':r.status==='rejected'?'bad':'warn'} />
              </div>
              <div className="text-sm text-neutral-400 mt-1">
                BB {money(r.borrowing_base)} • Availability {money(r.availability)} • AR {money(r.gross_collateral)}
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  aria-label={`Approve BBC report ${r.id.slice(0,8)}`}
                  variant="outline"
                  onClick={() => approveBBC(r.id)}
                  className="border-white/20 hover:bg-white/5 text-white"
                  disabled={r.status === 'approved'}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => rejectBBC(r.id)}
                  className="border-white/20 hover:bg-white/5 text-white"
                  disabled={r.status === 'rejected'}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </Row>

      {/* Exposure */}
      <Row
        title="Exposure (Top Utilization)"
        action={<Button variant="outline" onClick={loadExposure} className="border-[var(--card-border)] hover:bg-[var(--surface-2)] text-[var(--text)]">Refresh</Button>}
      >
        {loadingExposure ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : !exposure?.length ? (
          <div className="min-w-[320px] card-surface p-4 text-center text-neutral-400">
            No facilities found
          </div>
        ) : (
           exposure
            .slice() // copy
            .sort((a: any, b: any) => Number(b.utilization_pct) - Number(a.utilization_pct))
            .map((r: any) => {
              // Mock utilization series (8 data points) - replace with real data if available
              const series = r.utilization_series 
                ?? Array.from({length:8}).map((_,i)=>({ v: Math.max(0, Math.min(100, Number(r.utilization_pct) + (i-4)*0.8)) }));
              
              return (
                <div key={r.facility_id} className="min-w-[360px] snap-start card-surface p-4 compact-p">
                  <div className="flex items-center justify-between">
                    <div className="text-base font-semibold">{r.customer_name}</div>
                    <Chip text={fmtPct(r.utilization_pct)} tone={utilTone(Number(r.utilization_pct || 0))} />
                  </div>
                  <div className="text-sm text-neutral-400 mt-1">
                    Limit {money(r.credit_limit)} • Outst {money(r.principal_outstanding)} • Avail {money(r.available_to_draw)}
                  </div>
                  <div className="mt-3"><Sparkline data={series} /></div>
                  <div className="text-xs text-neutral-500 mt-2 flex items-center justify-between">
                    <span>
                      BBC {r.bbc_approved_within_45d ? 'fresh' : 'stale'}
                      {r.last_draw_decided_at ? ` • Last draw ${new Date(r.last_draw_decided_at).toLocaleString()}` : ''}
                    </span>
                    {(() => {
                      const breachData = covenantBreaches[r.facility_id];
                      if (!breachData) return <CovenantChip state="ok">Compliant</CovenantChip>;
                      const state = breachData.open > 0 ? 'bad' : 'warn';
                      return <CovenantChip state={state}>{breachData.open > 0 ? 'Breached' : 'Attention'}</CovenantChip>;
                    })()}
                  </div>
                </div>
              );
            })
        )}
      </Row>

      {/* Audit (last actions) */}
      <Row
        title="Recent Audit"
        action={<Button variant="outline" onClick={loadAudit} className="border-[var(--card-border)] hover:bg-[var(--surface-2)] text-[var(--text)]">Refresh</Button>}
      >
        {loadingAudit ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : !audit?.length ? (
          <div className="min-w-[320px] card-surface p-4 text-center text-neutral-400">
            No audit logs found
          </div>
        ) : (
          audit.slice(0,12).map((a: any) => (
            <ListCard
              key={a.id}
              title={a.action}
              meta={a.created_at ? new Date(a.created_at).toLocaleString() : ''}
              right={<span className="text-xs text-neutral-400">{a.table_name}</span>}
              muted={a.record_id ? `Record ${a.record_id}` : ''}
            />
          ))
        )}
      </Row>

      {/* Analytics (optional charts already in your file) — wrap them in card-surface or reuse rows */}
      <section className="mt-8">
        <Row title="Analytics">
          <div className="min-w-[500px] card-surface p-6 chart-container">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Portfolio by Sector/Region</h3>
              <p className="text-sm text-neutral-300">Outstanding balances and credit limits by industry sector</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={portfolioAgg}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="sector" tickLine={false} axisLine={{ stroke: darkAxis.stroke }} tick={darkAxis.tick as any} />
                  <YAxis tickLine={false} axisLine={{ stroke: darkAxis.stroke }} tick={darkAxis.tick as any} />
                  <Tooltip 
                    contentStyle={tooltipStyle as any}
                    labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
                    formatter={(value: any, name: string) => [
                      `$${Number(value).toLocaleString()}`, 
                      name === 'principal_outstanding' ? 'Outstanding' : 'Credit Limit'
                    ]}
                  />
                  <Bar dataKey="principal_outstanding" name="Outstanding" fill="#ffffff" />
                  <Bar dataKey="credit_limit" name="Credit Limit" fill="rgba(255,255,255,0.4)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-[500px] card-surface p-6 chart-container">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Utilization Trend (90 days)</h3>
                <p className="text-sm text-neutral-300">Track facility utilization over time</p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <Input
                  placeholder="Enter Facility ID"
                  value={timeSeriesFacility}
                  onChange={(e) => setTimeSeriesFacility(e.target.value)}
                  className="w-72 font-mono text-sm bg-[var(--surface)] border-[var(--card-border)] placeholder:text-muted"
                />
                <Button 
                  variant="outline" 
                  onClick={() => loadTimeSeries(timeSeriesFacility)}
                  disabled={!timeSeriesFacility.trim()}
                  className="border-white/20 hover:bg-white/5 text-white"
                >
                  Load
                </Button>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="d" tickLine={false} axisLine={{ stroke: darkAxis.stroke }} tick={darkAxis.tick as any} />
                  <YAxis tickLine={false} axisLine={{ stroke: darkAxis.stroke }} tick={darkAxis.tick as any} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={tooltipStyle as any}
                    labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
                    formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Utilization']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="utilization_pct" 
                    name="Utilization %" 
                    stroke="#E50914"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Row>

        {/* Compliance Breaches */}
        <Row title="Compliance Breaches" action={<Button variant="outline" onClick={loadBreaches} className="border-white/20 hover:bg-white/5 text-white">Refresh</Button>}>
          {breaches.length === 0 ? (
            <div className="min-w-[320px] card-surface p-4 text-center text-neutral-400">
              No compliance breaches found ✅
            </div>
          ) : (
            breaches.map((breach, i) => (
              <ListCard
                key={i}
                title={`${breach.customer_name} • ${breach.code}`}
                meta={breach.message}
                right={<Chip text={breach.severity} tone={breach.severity === 'warning' ? 'warn' : 'bad'} />}
                muted={`Facility ${breach.facility_id.slice(0, 8)}...`}
              />
            ))
          )}
        </Row>
      </section>

      {/* Printable Admin Report */}
      <div className="print-compact mt-12">
        <h1 className="text-xl font-bold mb-2">Portfolio Exposure — {new Date().toLocaleDateString()}</h1>

        <section className="avoid-break mb-6 card-surface p-4">
          <h2 className="font-semibold mb-2">Exposure Summary</h2>
          <table className="w-full border-separate border-spacing-x-6 border-spacing-y-2">
            <thead>
              <tr>
                <th scope="col" className="text-left font-medium text-muted-foreground">Customer</th>
                <th scope="col" className="text-left font-medium text-muted-foreground">Limit</th>
                <th scope="col" className="text-left font-medium text-muted-foreground">Outstanding</th>
                <th scope="col" className="text-left font-medium text-muted-foreground">Utilization %</th>
                <th scope="col" className="text-left font-medium text-muted-foreground">Available</th>
                <th scope="col" className="text-left font-medium text-muted-foreground">BBC Fresh</th>
                <th scope="col" className="text-left font-medium text-muted-foreground">Last Draw</th>
              </tr>
            </thead>
            <tbody>
              {exposure.map((r:any) => (
                <tr key={r.facility_id}>
                  <td>{r.customer_name}</td>
                  <td>{money(r.credit_limit)}</td>
                  <td>{money(r.principal_outstanding)}</td>
                  <td>{Number(r.utilization_pct).toFixed(1)}%</td>
                  <td>{money(r.available_to_draw)}</td>
                  <td>{r.bbc_approved_within_45d ? 'Yes' : 'No'}</td>
                  <td>{r.last_draw_decided_at ? new Date(r.last_draw_decided_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="avoid-break mb-6 card-surface p-4">
          <h2 className="font-semibold mb-2">Pending Draw Approvals</h2>
          {draws.filter(d => d.status === 'submitted').length ? (
            <table className="w-full border-separate border-spacing-x-6 border-spacing-y-2">
              <thead>
                <tr>
                  <th scope="col" className="text-left font-medium text-muted-foreground">Customer</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground">Amount</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground">Docs</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground">BBC</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {draws.filter(d => d.status === 'submitted').map((d:any)=>(
                  <tr key={d.id}>
                    <td>{d.facility_id.slice(0,8)}</td>
                    <td>{money(d.amount)}</td>
                    <td>{d.required_docs_ok ? 'OK' : 'Missing'}</td>
                    <td>{complianceByDraw?.[d.id]?.bbcOk ? 'Fresh' : 'Stale'}</td>
                    <td>{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div>No pending draws.</div>}
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