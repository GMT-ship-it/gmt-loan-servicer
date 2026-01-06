import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNotify } from '@/lib/notify';
import { Plus, Pencil, Trash2, RefreshCw, Building2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type Entity = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export default function FinanceEntities() {
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fin_entities')
        .select('*')
        .order('name');
      if (error) throw error;
      setEntities(data || []);
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to load entities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setDialogOpen(true);
  };

  const openEdit = (entity: Entity) => {
    setEditingId(entity.id);
    setName(entity.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      notify.error('Validation', 'Name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('fin_entities')
          .update({ name: name.trim() })
          .eq('id', editingId);
        if (error) throw error;
        notify.success('Success', 'Entity updated');
      } else {
        const { error } = await supabase
          .from('fin_entities')
          .insert({ name: name.trim() });
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
    if (!confirm('Are you sure? This will fail if instruments reference this entity.')) return;
    
    setDeleting(id);
    try {
      const { error } = await supabase.from('fin_entities').delete().eq('id', id);
      if (error) throw error;
      notify.success('Success', 'Entity deleted');
      loadData();
    } catch (err: any) {
      notify.error('Error', err.message || 'Cannot delete - entity may be in use');
    } finally {
      setDeleting(null);
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
            <h1 className="text-2xl font-bold">Entities</h1>
            <p className="text-muted-foreground">Legal entities that own or owe instruments</p>
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
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : entities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No entities found. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell className="font-medium">{entity.name}</TableCell>
                    <TableCell>{new Date(entity.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(entity)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(entity.id)}
                          disabled={deleting === entity.id}
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
            <DialogTitle>{editingId ? 'Edit Entity' : 'Create Entity'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., SummitLine Holdings LLC"
              />
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
