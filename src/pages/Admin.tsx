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

export default function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
      setLoading(false);
    })();
  }, [navigate]);

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
    </div>
  );
}