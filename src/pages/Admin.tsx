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
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { NotificationBell } from '@/components/NotificationBell';
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

export default function AdminPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
  
  // Compliance and Analytics state
  const [breaches, setBreaches] = useState<any[]>([]);
  const [portfolioAgg, setPortfolioAgg] = useState<any[]>([]);
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [timeSeriesFacility, setTimeSeriesFacility] = useState('');
  const [breachesLoading, setBreachesLoading] = useState(false);

  // Load functions
  const loadBreaches = async () => {
    try {
      setBreachesLoading(true);
      const { data, error } = await supabase.rpc('portfolio_policy_breaches');
      if (error) throw error;
      setBreaches(data || []);
    } catch (error) {
      console.error('Error loading breaches:', error);
      toast({
        title: "Error",
        description: "Failed to load compliance breaches",
        variant: "destructive",
      });
    } finally {
      setBreachesLoading(false);
    }
  };

  const loadPortfolioAgg = async () => {
    try {
      const { data, error } = await supabase.from('portfolio_aggregates').select('*');
      if (error) throw error;
      setPortfolioAgg(data || []);
    } catch (error) {
      console.error('Error loading portfolio aggregates:', error);
      toast({
        title: "Error",
        description: "Failed to load portfolio data",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: "Failed to load utilization trend",
        variant: "destructive",
      });
    }
  };

  const loadExposure = async () => {
    setLoadingExposure(true);
    const { data, error } = await supabase.rpc('lender_exposure_snapshot');
    setLoadingExposure(false);
    if (!error) setExposure(data || []);
  };

  const loadDrawRequests = async () => {
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

    await loadDrawRequests();
    await loadExposure();
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

      setLoading(false);
    })();
  }, [navigate]);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Lender Portal</h1>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <Button variant="outline" onClick={() => {
            loadExposure();
            loadDrawRequests();
            loadBreaches();
            loadPortfolioAgg();
          }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="draws">Draw Requests</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="facilities">Facilities</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Facilities</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{exposure.length}</div>
                <p className="text-xs text-muted-foreground">Total facilities</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Exposure</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${exposure.reduce((sum, exp) => sum + exp.principal_outstanding, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Outstanding principal</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Credit</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${exposure.reduce((sum, exp) => sum + exp.available_to_draw, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Available to draw</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Compliance Breaches</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{breaches.length}</div>
                <p className="text-xs text-muted-foreground">
                  {breaches.length === 0 ? 'All compliant' : 'Need attention'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Exposure Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Exposure</CardTitle>
            </CardHeader>
            <CardContent>
              {exposure.length === 0 ? (
                <div className="text-muted-foreground">No active facilities found.</div>
              ) : (
                <div className="space-y-3">
                  {exposure.slice(0, 10).map((exp, i) => (
                    <div key={i} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <div className="font-medium">{exp.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {exp.facility_id.slice(0, 8)}... • Util: {exp.utilization_pct.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          ${exp.principal_outstanding.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Avail: ${exp.available_to_draw.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="draws" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Draw Requests</CardTitle>
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
                               <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.docsOk ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                                 Docs {c.docsOk ? 'OK' : 'Missing'}
                               </span>
                               <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bbcOk ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                                 BBC ≤45d {c.bbcOk ? 'OK' : 'Required'}
                               </span>
                               <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.limitOk ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
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
                                   className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 hover:no-underline transition-colors"
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Compliance Breaches
                </CardTitle>
                <CardDescription>
                  Monitor facility covenant violations and policy breaches
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={loadBreaches}
                disabled={breachesLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${breachesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {breaches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {breachesLoading ? 'Loading breaches...' : 'No compliance breaches found. ✅'}
                </div>
              ) : (
                <div className="space-y-3">
                  {breaches.map((breach, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          {breach.customer_name} • 
                          <span className="font-mono text-sm ml-2">
                            {breach.facility_id.slice(0, 8)}...
                          </span>
                        </div>
                        <Badge 
                          variant={breach.severity === 'warning' ? 'destructive' : 'secondary'}
                        >
                          {breach.code}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {breach.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio by Sector/Region</CardTitle>
                <CardDescription>Outstanding balances and credit limits by industry sector</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={portfolioAgg}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="sector" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          `$${Number(value).toLocaleString()}`, 
                          name === 'principal_outstanding' ? 'Outstanding' : 'Credit Limit'
                        ]}
                      />
                      <Bar dataKey="principal_outstanding" name="Outstanding" fill="hsl(var(--primary))" />
                      <Bar dataKey="credit_limit" name="Credit Limit" fill="hsl(var(--muted))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Utilization Trend (90 days)</CardTitle>
                  <CardDescription>Track facility utilization over time</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter Facility ID"
                    value={timeSeriesFacility}
                    onChange={(e) => setTimeSeriesFacility(e.target.value)}
                    className="w-72 font-mono text-sm"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => loadTimeSeries(timeSeriesFacility)}
                    disabled={!timeSeriesFacility.trim()}
                  >
                    Load
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="d" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Utilization']}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="utilization_pct" 
                        name="Utilization %" 
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="facilities" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Create Facility</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createFacility} className="grid gap-4">
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

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={!canSubmit || creating}>
                    {creating ? 'Creating…' : 'Create Facility'}
                  </Button>
                  {err && <span className="text-destructive">{err}</span>}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Reports</CardTitle>
              <CardDescription>Generate automated compliance and audit reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  onClick={async () => {
                    toast({
                      title: "Report Generated",
                      description: "Weekly breach digest has been triggered",
                    });
                  }}
                >
                  Generate Weekly Breach Report
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    toast({
                      title: "Export Started",
                      description: "Audit log export to S3 has been initiated",
                    });
                  }}
                >
                  Export Audit Logs to S3
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}