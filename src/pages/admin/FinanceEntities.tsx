import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useNotify } from '@/lib/notify';
import { Plus, Pencil, Trash2, RefreshCw, Building2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type GmtEntity = {
  id: string;
  name: string;
  short_code: string;
  parent_entity_id: string | null;
  jurisdiction: string | null;
  status: 'active' | 'inactive' | 'winding_down';
  reporting_currency: string;
  created_at: string;
  updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  inactive: 'bg-muted text-muted-foreground',
  winding_down: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

const NONE_VALUE = '__none__';

export default function FinanceEntities() {
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<GmtEntity[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    short_code: '',
    parent_entity_id: '' as string,
    jurisdiction: '',
    status: 'active' as 'active' | 'inactive' | 'winding_down',
    reporting_currency: 'USD',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gmt_entities')
        .select('*')
        .order('name');
      if (error) throw error;
      setEntities((data as GmtEntity[]) || []);
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to load entities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const parentName = (id: string | null) => {
    if (!id) return '—';
    return entities.find(e => e.id === id)?.short_code || id.slice(0, 8);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', short_code: '', parent_entity_id: '', jurisdiction: '', status: 'active', reporting_currency: 'USD' });
    setDialogOpen(true);
  };

  const openEdit = (e: GmtEntity) => {
    setEditingId(e.id);
    setForm({
      name: e.name,
      short_code: e.short_code,
      parent_entity_id: e.parent_entity_id || '',
      jurisdiction: e.jurisdiction || '',
      status: e.status,
      reporting_currency: e.reporting_currency,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.short_code.trim()) {
      notify.error('Validation', 'Name and Short Code are required');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        short_code: form.short_code.trim().toUpperCase(),
        parent_entity_id: form.parent_entity_id || null,
        jurisdiction: form.jurisdiction.trim() || null,
        status: form.status as string,
        reporting_currency: form.reporting_currency.trim() || 'USD',
      };

      if (editingId) {
        const { error } = await supabase.from('gmt_entities').update(payload).eq('id', editingId);
        if (error) throw error;
        notify.success('Success', 'Entity updated');
      } else {
        const { error } = await supabase.from('gmt_entities').insert([payload]);
        if (error) throw error;
        notify.success('Success', 'Entity created');
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
    if (!confirm('Delete this entity? Children will be unlinked.')) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from('gmt_entities').delete().eq('id', id);
      if (error) throw error;
      notify.success('Success', 'Entity deleted');
      loadData();
    } catch (err: any) {
      notify.error('Error', err.message || 'Cannot delete — entity may be referenced');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/finance/instruments">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">GMT Entities</h1>
            <p className="text-muted-foreground">Legal entities in the GMT Capital Group hierarchy</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Entity
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Entities ({entities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : entities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No entities found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="font-mono text-xs">{e.short_code}</TableCell>
                    <TableCell>{parentName(e.parent_entity_id)}</TableCell>
                    <TableCell>{e.jurisdiction || '—'}</TableCell>
                    <TableCell>{e.reporting_currency}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[e.status] || ''}>
                        {e.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)} disabled={deleting === e.id}>
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Entity' : 'New Entity'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mountain Investments" />
            </div>
            <div className="space-y-1">
              <Label>Short Code *</Label>
              <Input value={form.short_code} onChange={e => setForm(f => ({ ...f, short_code: e.target.value }))} placeholder="MTN" className="font-mono uppercase" />
            </div>
            <div className="space-y-1">
              <Label>Parent Entity</Label>
              <Select value={form.parent_entity_id || NONE_VALUE} onValueChange={v => setForm(f => ({ ...f, parent_entity_id: v === NONE_VALUE ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None (top-level)</SelectItem>
                  {entities.filter(e => e.id !== editingId).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.short_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Jurisdiction</Label>
                <Input value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))} placeholder="US-GA" />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input value={form.reporting_currency} onChange={e => setForm(f => ({ ...f, reporting_currency: e.target.value }))} placeholder="USD" className="font-mono uppercase" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="winding_down">Winding Down</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
