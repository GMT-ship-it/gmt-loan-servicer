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
import { Plus, Pencil, Trash2, RefreshCw, Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type Counterparty = {
  id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
};

const counterpartyTypes = ['lender', 'borrower', 'investor', 'servicer'];

export default function FinanceCounterparties() {
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'lender' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fin_counterparties')
        .select('id, name, type, created_at, updated_at')
        .order('name');
      if (error) throw error;
      setCounterparties(data || []);
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to load counterparties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', type: 'lender' });
    setDialogOpen(true);
  };

  const openEdit = (cp: Counterparty) => {
    setEditingId(cp.id);
    setForm({
      name: cp.name,
      type: cp.type,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      notify.error('Validation', 'Name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
      };

      if (editingId) {
        const { error } = await supabase
          .from('fin_counterparties')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        notify.success('Success', 'Counterparty updated');
      } else {
        const { error } = await supabase
          .from('fin_counterparties')
          .insert(payload);
        if (error) throw error;
        notify.success('Success', 'Counterparty created');
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
    if (!confirm('Are you sure? This will fail if instruments reference this counterparty.')) return;
    
    setDeleting(id);
    try {
      const { error } = await supabase.from('fin_counterparties').delete().eq('id', id);
      if (error) throw error;
      notify.success('Success', 'Counterparty deleted');
      loadData();
    } catch (err: any) {
      notify.error('Error', err.message || 'Cannot delete - counterparty may be in use');
    } finally {
      setDeleting(null);
    }
  };

  const typeColor = (t: string) => {
    switch (t) {
      case 'lender': return 'default';
      case 'borrower': return 'secondary';
      case 'investor': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/finance/instruments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Counterparties</h1>
            <p className="text-muted-foreground">Banks, investors, and other parties to instruments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Counterparty
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Counterparties ({counterparties.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : counterparties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No counterparties found. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {counterparties.map((cp) => (
                  <TableRow key={cp.id}>
                    <TableCell className="font-medium">{cp.name}</TableCell>
                    <TableCell>
                      <Badge variant={typeColor(cp.type)} className="capitalize">{cp.type}</Badge>
                    </TableCell>
                    <TableCell>{new Date(cp.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cp.id)}
                          disabled={deleting === cp.id}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Counterparty' : 'Create Counterparty'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., First National Bank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {counterpartyTypes.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
