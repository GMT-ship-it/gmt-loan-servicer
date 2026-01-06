import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNotify } from '@/lib/notify';
import { Plus, Pencil, Trash2, RefreshCw, Building2, Users, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

type Entity = { id: string; name: string };
type Counterparty = { id: string; name: string; type: string };
type Instrument = {
  id: string;
  name: string;
  entity_id: string;
  counterparty_id: string;
  instrument_type: string;
  principal_initial: number;
  rate_apr: number;
  day_count_basis: string;
  interest_method: string;
  start_date: string;
  maturity_date: string | null;
  status: string;
  entity?: Entity;
  counterparty?: Counterparty;
};

type InstrumentForm = {
  name: string;
  entity_id: string;
  counterparty_id: string;
  instrument_type: string;
  principal_initial: string;
  rate_apr: string;
  day_count_basis: string;
  interest_method: string;
  start_date: string;
  maturity_date: string;
  status: string;
};

const defaultForm: InstrumentForm = {
  name: '',
  entity_id: '',
  counterparty_id: '',
  instrument_type: 'loan',
  principal_initial: '',
  rate_apr: '',
  day_count_basis: 'actual_365',
  interest_method: 'simple_daily',
  start_date: new Date().toISOString().split('T')[0],
  maturity_date: '',
  status: 'active',
};

const instrumentTypes = ['loan', 'line_of_credit', 'note_payable', 'bond'];
const dayCountOptions = ['actual_365', 'actual_360', '30_360'];
const interestMethods = ['simple_daily', 'compound_daily', 'simple_monthly'];
const statusOptions = ['active', 'paid_off', 'defaulted', 'cancelled'];

export default function FinanceInstruments() {
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InstrumentForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [instRes, entRes, cpRes] = await Promise.all([
        supabase.from('fin_instruments').select(`
          *,
          entity:fin_entities(id, name),
          counterparty:fin_counterparties(id, name, type)
        `).order('created_at', { ascending: false }),
        supabase.from('fin_entities').select('id, name').order('name'),
        supabase.from('fin_counterparties').select('id, name, type').order('name'),
      ]);

      if (instRes.error) throw instRes.error;
      if (entRes.error) throw entRes.error;
      if (cpRes.error) throw cpRes.error;

      setInstruments(instRes.data || []);
      setEntities(entRes.data || []);
      setCounterparties(cpRes.data || []);
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (inst: Instrument) => {
    setEditingId(inst.id);
    setForm({
      name: inst.name,
      entity_id: inst.entity_id,
      counterparty_id: inst.counterparty_id,
      instrument_type: inst.instrument_type,
      principal_initial: inst.principal_initial.toString(),
      rate_apr: inst.rate_apr.toString(),
      day_count_basis: inst.day_count_basis,
      interest_method: inst.interest_method,
      start_date: inst.start_date,
      maturity_date: inst.maturity_date || '',
      status: inst.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Validation
    if (!form.name.trim()) {
      notify.error('Validation', 'Name is required');
      return;
    }
    if (!form.entity_id) {
      notify.error('Validation', 'Entity is required');
      return;
    }
    if (!form.counterparty_id) {
      notify.error('Validation', 'Counterparty is required');
      return;
    }
    const principal = parseFloat(form.principal_initial);
    if (isNaN(principal) || principal <= 0) {
      notify.error('Validation', 'Principal must be a positive number');
      return;
    }
    const apr = parseFloat(form.rate_apr);
    if (isNaN(apr) || apr < 0 || apr > 1) {
      notify.error('Validation', 'APR must be between 0 and 1 (e.g., 0.08 for 8%)');
      return;
    }
    if (!form.start_date) {
      notify.error('Validation', 'Start date is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        entity_id: form.entity_id,
        counterparty_id: form.counterparty_id,
        instrument_type: form.instrument_type,
        principal_initial: principal,
        rate_apr: apr,
        day_count_basis: form.day_count_basis,
        interest_method: form.interest_method,
        start_date: form.start_date,
        maturity_date: form.maturity_date || null,
        status: form.status,
      };

      if (editingId) {
        const { error } = await supabase
          .from('fin_instruments')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        notify.success('Success', 'Instrument updated');
      } else {
        const { error } = await supabase
          .from('fin_instruments')
          .insert(payload);
        if (error) throw error;
        notify.success('Success', 'Instrument created');
      }

      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this instrument?')) return;
    
    setDeleting(id);
    try {
      const { error } = await supabase.from('fin_instruments').delete().eq('id', id);
      if (error) throw error;
      notify.success('Success', 'Instrument deleted');
      loadData();
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'default';
      case 'paid_off': return 'secondary';
      case 'defaulted': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Instruments</h1>
          <p className="text-muted-foreground">Manage loans, lines of credit, and other instruments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Instrument
          </Button>
        </div>
      </div>

      {/* Quick Links to related pages */}
      <div className="flex gap-2">
        <Link to="/admin/finance/entities">
          <Button variant="outline" size="sm">
            <Building2 className="h-4 w-4 mr-2" />
            Manage Entities
          </Button>
        </Link>
        <Link to="/admin/finance/counterparties">
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Manage Counterparties
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Instruments ({instruments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : instruments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No instruments found. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">APR</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instruments.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell>{inst.entity?.name || '—'}</TableCell>
                    <TableCell>{inst.counterparty?.name || '—'}</TableCell>
                    <TableCell className="capitalize">{inst.instrument_type.replace('_', ' ')}</TableCell>
                    <TableCell className="text-right">{fmtMoney(inst.principal_initial)}</TableCell>
                    <TableCell className="text-right">{fmtPct(inst.rate_apr)}</TableCell>
                    <TableCell>{inst.start_date}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(inst.status)}>{inst.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(inst)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(inst.id)}
                          disabled={deleting === inst.id}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Instrument' : 'Create Instrument'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Term Loan A"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entity">Entity *</Label>
                <Select value={form.entity_id} onValueChange={(v) => setForm({ ...form, entity_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="counterparty">Counterparty *</Label>
                <Select value={form.counterparty_id} onValueChange={(v) => setForm({ ...form, counterparty_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select counterparty" />
                  </SelectTrigger>
                  <SelectContent>
                    {counterparties.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Instrument Type</Label>
                <Select value={form.instrument_type} onValueChange={(v) => setForm({ ...form, instrument_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {instrumentTypes.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="principal">Principal Initial *</Label>
                <Input
                  id="principal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.principal_initial}
                  onChange={(e) => setForm({ ...form, principal_initial: e.target.value })}
                  placeholder="100000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apr">APR (decimal) *</Label>
                <Input
                  id="apr"
                  type="number"
                  min="0"
                  max="1"
                  step="0.001"
                  value={form.rate_apr}
                  onChange={(e) => setForm({ ...form, rate_apr: e.target.value })}
                  placeholder="0.08 for 8%"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="daycount">Day Count Basis</Label>
                <Select value={form.day_count_basis} onValueChange={(v) => setForm({ ...form, day_count_basis: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayCountOptions.map((d) => (
                      <SelectItem key={d} value={d}>{d.replace('_', '/')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">Interest Method</Label>
                <Select value={form.interest_method} onValueChange={(v) => setForm({ ...form, interest_method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {interestMethods.map((m) => (
                      <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start Date *</Label>
                <Input
                  id="start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maturity">Maturity Date</Label>
                <Input
                  id="maturity"
                  type="date"
                  value={form.maturity_date}
                  onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
