import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CovenantChip from '@/components/admin/CovenantChip';
import { motion } from 'framer-motion';

type FacilityRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  credit_limit: number;
  status: 'active' | 'paused' | 'closed';
};

type Covenant = {
  id: string;
  facility_id: string;
  kind: 'max_utilization_pct' | 'bbc_max_age_days';
  threshold: number;
  is_active: boolean;
  created_at: string;
};

type Breach = {
  id: string;
  facility_id: string;
  covenant_id: string;
  kind: Covenant['kind'];
  observed_value: number;
  threshold_value: number;
  status: 'open' | 'acknowledged' | 'waived' | 'cleared';
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
};

function prettyKind(k: Covenant['kind']) {
  if (k === 'max_utilization_pct') return 'Max Utilization %';
  if (k === 'bbc_max_age_days') return 'BBC Max Age (days)';
  return k;
}

const money = (n?: number) =>
  (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function AdminCovenants() {
  const notify = useNotify();

  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [covs, setCovs] = useState<Covenant[]>([]);
  const [breaches, setBreaches] = useState<Breach[]>([]);
  const [metrics, setMetrics] = useState<{ util?: number; bbcAge?: number }>({});
  const [loading, setLoading] = useState(false);
  const [loadingEval, setLoadingEval] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Load facilities for dropdown
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('facilities')
          .select('id, customer_id, credit_limit, status, customers:customer_id(legal_name)')
          .eq('status', 'active');
        if (error) throw error;
        const rows: FacilityRow[] = (data || []).map((r: any) => ({
          id: r.id,
          customer_id: r.customer_id,
          customer_name: r.customers?.legal_name || r.customer_id,
          credit_limit: r.credit_limit,
          status: r.status
        }));
        setFacilities(rows);
        if (!selected && rows[0]) setSelected(rows[0].id);
      } catch (e: any) {
        notify.error('Failed to load facilities', e.message);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load covenants, breaches, metrics when facility changes
  useEffect(() => {
    if (!selected) return;
    (async () => {
      setLoading(true);
      try {
        const [covR, brR, utilR, ageR] = await Promise.all([
          supabase.from('facility_covenants').select('*').eq('facility_id', selected),
          supabase.from('covenant_breaches')
                  .select('*')
                  .eq('facility_id', selected)
                  .order('opened_at', { ascending: false })
                  .limit(200),
          supabase.rpc('facility_utilization_pct', { p_facility: selected }),
          supabase.rpc('facility_bbc_age_days', { p_facility: selected }),
        ]);
        if (covR.error) throw covR.error;
        if (brR.error) throw brR.error;
        setCovs((covR.data || []) as Covenant[]);
        setBreaches((brR.data || []) as Breach[]);
        setMetrics({
          util: typeof utilR.data === 'number' ? utilR.data : undefined,
          bbcAge: typeof ageR.data === 'number' ? ageR.data : undefined,
        });
      } catch (e: any) {
        notify.error('Failed to load covenant data', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [selected, notify]);

  const facility = useMemo(() => facilities.find(f => f.id === selected) || null, [facilities, selected]);
  const openOrWarn = useMemo(() => breaches.filter(b => b.status === 'open' || b.status === 'acknowledged' || b.status === 'waived'), [breaches]);
  const anyOpen = openOrWarn.some(b => b.status === 'open');
  const chipState: 'ok'|'warn'|'bad' = anyOpen ? 'bad' : (openOrWarn.length ? 'warn' : 'ok');

  // CRUD handlers
  async function upsertCovenant(c: Covenant) {
    setSavingId(c.id);
    try {
      const { error } = await supabase
        .from('facility_covenants')
        .update({ threshold: c.threshold, is_active: c.is_active })
        .eq('id', c.id);
      if (error) throw error;
      notify.success('Covenant updated');
    } catch (e: any) {
      notify.error('Update failed', e.message);
    } finally {
      setSavingId(null);
    }
  }

  async function addCovenant(kind: Covenant['kind']) {
    if (!selected) return;
    try {
      const defaultThreshold = kind === 'max_utilization_pct' ? 85 : 45;
      const { error } = await supabase.from('facility_covenants').insert({
        facility_id: selected,
        kind,
        threshold: defaultThreshold,
        is_active: true,
      } as any);
      if (error) throw error;
      notify.success('Covenant added');
      // reload
      const { data, error: e2 } = await supabase.from('facility_covenants').select('*').eq('facility_id', selected);
      if (!e2) setCovs((data || []) as Covenant[]);
    } catch (e: any) {
      notify.error('Create failed', e.message);
    }
  }

  async function evaluateNow() {
    if (!selected) return;
    setLoadingEval(true);
    try {
      const { error } = await supabase.rpc('evaluate_covenants', { p_facility: selected });
      if (error) throw error;
      notify.success('Covenants evaluated');
      // reload breaches + metrics
      const [brR, utilR, ageR] = await Promise.all([
        supabase.from('covenant_breaches')
          .select('*')
          .eq('facility_id', selected)
          .order('opened_at', { ascending: false })
          .limit(200),
        supabase.rpc('facility_utilization_pct', { p_facility: selected }),
        supabase.rpc('facility_bbc_age_days', { p_facility: selected }),
      ]);
      if (!brR.error) setBreaches((brR.data || []) as Breach[]);
      setMetrics({
        util: typeof utilR.data === 'number' ? utilR.data : undefined,
        bbcAge: typeof ageR.data === 'number' ? ageR.data : undefined,
      });
    } catch (e: any) {
      notify.error('Evaluation failed', e.message);
    } finally {
      setLoadingEval(false);
    }
  }

  async function setBreachStatus(id: string, status: Breach['status']) {
    try {
      const { error } = await supabase
        .from('covenant_breaches')
        .update({ status: status, closed_at: status === 'cleared' ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
      notify.success('Breach updated');
      // refresh list
      const brR = await supabase.from('covenant_breaches')
        .select('*')
        .eq('facility_id', selected)
        .order('opened_at', { ascending: false });
      if (!brR.error) setBreaches((brR.data || []) as Breach[]);
    } catch (e: any) {
      notify.error('Update failed', e.message);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Covenants</h1>
          <div className="text-sm text-neutral-400">
            Manage thresholds and review breaches per facility.
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-[#E50914] text-white hover:opacity-90"
            onClick={evaluateNow}
            disabled={!selected || loadingEval}
            aria-label="Re-evaluate covenants now"
          >
            {loadingEval ? 'Evaluating…' : 'Re-evaluate'}
          </Button>
        </div>
      </div>

      {/* Facility selector */}
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-4">
        <label htmlFor="facSel" className="text-sm">Facility</label>
        <select
          id="facSel"
          className="mt-1 w-full bg-transparent border border-white/20 rounded px-3 py-2"
          value={selected || ''}
          onChange={(e) => setSelected(e.target.value || null)}
        >
          {facilities.map(f => (
            <option key={f.id} value={f.id} className="bg-black">
              {f.customer_name} — {money(f.credit_limit)}
            </option>
          ))}
        </select>

        {/* Live metrics */}
        {facility && (
          <div className="mt-3 text-sm text-neutral-300 flex gap-4 flex-wrap">
            <div>Utilization: <span className="font-semibold">{metrics.util?.toFixed(1)}%</span></div>
            <div>BBC Age: <span className="font-semibold">{metrics.bbcAge ?? '—'} days</span></div>
            <CovenantChip state={chipState}>
              {chipState === 'bad' ? 'Breached' : chipState === 'warn' ? 'Attention' : 'Compliant'}
            </CovenantChip>
          </div>
        )}
      </div>

      {/* Covenant list */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Rules</h2>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/5"
              onClick={() => addCovenant('max_utilization_pct')}>
              + Max Utilization %
            </Button>
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/5"
              onClick={() => addCovenant('bbc_max_age_days')}>
              + BBC Max Age
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {covs.map(c => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-4"
            >
              <div className="text-sm text-neutral-400">{prettyKind(c.kind)}</div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1">
                  <label htmlFor={`thr-${c.id}`} className="text-xs">Threshold</label>
                  <Input
                    id={`thr-${c.id}`}
                    type="number"
                    inputMode="decimal"
                    className="bg-transparent"
                    value={c.threshold}
                    onChange={(e) => {
                      const thr = Number(e.target.value);
                      setCovs(prev => prev.map(x => x.id === c.id ? { ...x, threshold: thr } : x));
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={`act-${c.id}`}
                    type="checkbox"
                    checked={c.is_active}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setCovs(prev => prev.map(x => x.id === c.id ? { ...x, is_active: v } : x));
                    }}
                    aria-label="Active"
                  />
                  <label htmlFor={`act-${c.id}`} className="text-sm">Active</label>
                </div>
              </div>
              <div className="mt-3">
                <Button
                  onClick={() => upsertCovenant(c)}
                  disabled={savingId === c.id}
                  className="bg-[#E50914] text-white hover:opacity-90"
                >
                  {savingId === c.id ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </motion.div>
          ))}

          {!covs.length && !loading && (
            <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-6 text-center text-neutral-400">
              No covenants yet. Add a rule above.
            </div>
          )}
        </div>
      </section>

      {/* Breach history */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Breach History</h2>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="odd:bg-white/[0.02]">
                <th scope="col" className="text-left px-2 py-2">Opened</th>
                <th scope="col" className="text-left px-2 py-2">Rule</th>
                <th scope="col" className="text-right px-2 py-2">Observed</th>
                <th scope="col" className="text-left px-2 py-2">Status</th>
                <th scope="col" className="text-left px-2 py-2">Notes</th>
                <th scope="col" className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {breaches.map(b => (
                <tr key={b.id} className="odd:bg-white/[0.02]">
                  <td className="px-2 py-2">{new Date(b.opened_at).toLocaleString()}</td>
                  <td className="px-2 py-2">{prettyKind(b.kind)}</td>
                  <td className="px-2 py-2 text-right">
                    {b.kind === 'max_utilization_pct' ? `${b.observed_value.toFixed(1)}%` : `${Math.round(b.observed_value)} days`}
                  </td>
                  <td className="px-2 py-2">
                    {b.status === 'open' && <CovenantChip state="bad">Open</CovenantChip>}
                    {b.status === 'acknowledged' && <CovenantChip state="warn">Acknowledged</CovenantChip>}
                    {b.status === 'waived' && <CovenantChip state="warn">Waived</CovenantChip>}
                    {b.status === 'cleared' && <CovenantChip state="ok">Cleared</CovenantChip>}
                  </td>
                  <td className="px-2 py-2">{b.notes ?? ''}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      <Button variant="outline" className="border-white/20 text-white hover:bg-white/5"
                        onClick={() => setBreachStatus(b.id, 'acknowledged')}
                        disabled={b.status === 'acknowledged' || b.status === 'waived' || b.status === 'cleared'}
                        aria-label="Acknowledge breach">
                        Acknowledge
                      </Button>
                      <Button variant="outline" className="border-white/20 text-white hover:bg-white/5"
                        onClick={() => setBreachStatus(b.id, 'waived')}
                        disabled={b.status === 'waived' || b.status === 'cleared'}
                        aria-label="Waive breach">
                        Waive
                      </Button>
                      <Button className="bg-[#E50914] text-white hover:opacity-90"
                        onClick={() => setBreachStatus(b.id, 'cleared')}
                        disabled={b.status === 'cleared'}
                        aria-label="Clear breach">
                        Clear
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!breaches.length && !loading && (
                <tr><td colSpan={6} className="text-center text-neutral-400 py-6">No breaches recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}