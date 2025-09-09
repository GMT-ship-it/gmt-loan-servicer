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
  facility_id: string;
  max_utilization_pct: number;
  bbc_valid_days: number;
  require_monthly_bbc: boolean;
  require_monthly_statement: boolean;
  created_at: string;
  updated_at: string;
};

type Breach = {
  code: string;
  severity: string;
  message: string;
};

const money = (n?: number) =>
  (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function AdminCovenants() {
  const notify = useNotify();

  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [covenant, setCovenant] = useState<Covenant | null>(null);
  const [breaches, setBreaches] = useState<Breach[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEval, setLoadingEval] = useState(false);
  const [saving, setSaving] = useState(false);

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

  // Load covenant and breaches when facility changes
  useEffect(() => {
    if (!selected) return;
    (async () => {
      setLoading(true);
      try {
        const [covR, breachR] = await Promise.all([
          supabase.from('facility_covenants').select('*').eq('facility_id', selected).maybeSingle(),
          supabase.rpc('facility_policy_breaches', { p_facility: selected }),
        ]);
        
        if (covR.error) throw covR.error;
        if (breachR.error) throw breachR.error;
        
        setCovenant(covR.data);
        setBreaches(breachR.data || []);
      } catch (e: any) {
        notify.error('Failed to load covenant data', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [selected, notify]);

  const facility = useMemo(() => facilities.find(f => f.id === selected) || null, [facilities, selected]);
  const criticalBreaches = useMemo(() => breaches.filter(b => b.severity === 'warning'), [breaches]);
  const chipState: 'ok'|'warn'|'bad' = criticalBreaches.length > 0 ? 'bad' : (breaches.length > 0 ? 'warn' : 'ok');

  // Create covenant if none exists
  async function createCovenant() {
    if (!selected) return;
    try {
      const defaultCovenant = {
        facility_id: selected,
        max_utilization_pct: 85.00,
        bbc_valid_days: 45,
        require_monthly_bbc: true,
        require_monthly_statement: true,
      };
      
      const { data, error } = await supabase
        .from('facility_covenants')
        .insert(defaultCovenant)
        .select()
        .single();
        
      if (error) throw error;
      setCovenant(data);
      notify.success('Covenant created with default settings');
    } catch (e: any) {
      notify.error('Create failed', e.message);
    }
  }

  // Save covenant changes
  async function saveCovenant() {
    if (!covenant || !selected) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('facility_covenants')
        .update({
          max_utilization_pct: covenant.max_utilization_pct,
          bbc_valid_days: covenant.bbc_valid_days,
          require_monthly_bbc: covenant.require_monthly_bbc,
          require_monthly_statement: covenant.require_monthly_statement,
        })
        .eq('facility_id', selected);
        
      if (error) throw error;
      notify.success('Covenant updated');
    } catch (e: any) {
      notify.error('Update failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function evaluateNow() {
    if (!selected) return;
    setLoadingEval(true);
    try {
      const { data, error } = await supabase.rpc('facility_policy_breaches', { p_facility: selected });
      if (error) throw error;
      setBreaches(data || []);
      notify.success('Covenants evaluated');
    } catch (e: any) {
      notify.error('Evaluation failed', e.message);
    } finally {
      setLoadingEval(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Covenants</h1>
          <div className="text-sm text-neutral-400">
            Manage thresholds and review policy compliance per facility.
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

        {/* Status indicator */}
        {facility && (
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-neutral-300">
              <span className="font-semibold">{facility.customer_name}</span> • {money(facility.credit_limit)}
            </div>
            <CovenantChip state={chipState}>
              {chipState === 'bad' ? 'Policy Breach' : chipState === 'warn' ? 'Attention' : 'Compliant'}
            </CovenantChip>
          </div>
        )}
      </div>

      {/* Covenant settings */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Covenant Settings</h2>
          {covenant && (
            <Button
              onClick={saveCovenant}
              disabled={saving}
              className="bg-[#E50914] text-white hover:opacity-90"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </div>

        {covenant ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-4"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="maxUtil" className="text-sm text-neutral-400">Max Utilization %</label>
                <Input
                  id="maxUtil"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  className="mt-1 bg-transparent"
                  value={covenant.max_utilization_pct}
                  onChange={(e) => setCovenant(prev => prev ? { ...prev, max_utilization_pct: Number(e.target.value) } : null)}
                />
              </div>
              
              <div>
                <label htmlFor="bbcDays" className="text-sm text-neutral-400">BBC Valid Days</label>
                <Input
                  id="bbcDays"
                  type="number"
                  className="mt-1 bg-transparent"
                  value={covenant.bbc_valid_days}
                  onChange={(e) => setCovenant(prev => prev ? { ...prev, bbc_valid_days: Number(e.target.value) } : null)}
                />
              </div>
            </div>
            
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="reqBbc"
                  type="checkbox"
                  checked={covenant.require_monthly_bbc}
                  onChange={(e) => setCovenant(prev => prev ? { ...prev, require_monthly_bbc: e.target.checked } : null)}
                />
                <label htmlFor="reqBbc" className="text-sm">Require Monthly BBC</label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  id="reqStmt"
                  type="checkbox"
                  checked={covenant.require_monthly_statement}
                  onChange={(e) => setCovenant(prev => prev ? { ...prev, require_monthly_statement: e.target.checked } : null)}
                />
                <label htmlFor="reqStmt" className="text-sm">Require Monthly Statement</label>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-6 text-center">
            <div className="text-neutral-400 mb-4">No covenant settings found for this facility.</div>
            <Button
              onClick={createCovenant}
              className="bg-[#E50914] text-white hover:opacity-90"
            >
              Create Covenant Settings
            </Button>
          </div>
        )}
      </section>

      {/* Policy breaches */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Policy Compliance Status</h2>
        <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden">
          {breaches.length > 0 ? (
            <div className="divide-y divide-white/10">
              {breaches.map((breach, index) => (
                <div key={index} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{breach.code}</div>
                      <div className="text-sm text-neutral-400 mt-1">{breach.message}</div>
                    </div>
                    <CovenantChip state={breach.severity === 'warning' ? 'bad' : 'warn'}>
                      {breach.severity === 'warning' ? 'Warning' : 'Info'}
                    </CovenantChip>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-neutral-400">
              <CovenantChip state="ok">All Policies Compliant</CovenantChip>
              <div className="mt-2">No policy breaches detected.</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}