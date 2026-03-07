import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotify } from '@/lib/notify';
import { RefreshCw, CheckCircle, XCircle, Clock, ShieldCheck } from 'lucide-react';

type ApprovalRequest = {
  id: string;
  entity_id: string;
  request_type: string;
  amount: number;
  requested_by: string;
  approved_by: string | null;
  status: string;
  reason: string | null;
  payload: Record<string, any>;
  created_at: string;
  resolved_at: string | null;
};

type EntityMap = Record<string, string>;

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  rejected: 'bg-destructive/15 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const TYPE_LABELS: Record<string, string> = {
  disbursement: 'Funds Used / Disbursement',
  payment_received: 'Payment Received',
  interest_payment: 'Interest Payment',
  principal_payment: 'Principal Payment',
  adjustment: 'Adjustment',
  write_off: 'Write-Off',
  transfer: 'Transfer',
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function Approvals() {
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [entityMap, setEntityMap] = useState<EntityMap>({});
  const [tab, setTab] = useState('pending');

  // Decision dialog
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'approved' | 'rejected'>('approved');
  const [decisionTarget, setDecisionTarget] = useState<ApprovalRequest | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: reqData, error: reqErr }, { data: entData, error: entErr }] = await Promise.all([
        supabase
          .from('gmt_approval_requests')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('gmt_entities').select('id, name'),
      ]);
      if (reqErr) throw reqErr;
      if (entErr) throw entErr;
      setRequests((reqData as ApprovalRequest[]) || []);
      const map: EntityMap = {};
      (entData || []).forEach((e: any) => { map[e.id] = e.name; });
      setEntityMap(map);
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to load approval requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openDecision = (req: ApprovalRequest, action: 'approved' | 'rejected') => {
    setDecisionTarget(req);
    setDecisionAction(action);
    setDecisionReason('');
    setDecisionOpen(true);
  };

  const handleDecision = async () => {
    if (!decisionTarget) return;
    if (decisionAction === 'rejected' && !decisionReason.trim()) {
      notify.error('Validation', 'Reason is required when rejecting');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('gmt_approval_requests')
        .update({
          status: decisionAction,
          approved_by: user.id,
          reason: decisionReason.trim() || decisionTarget.reason || null,
          resolved_at: new Date().toISOString(),
        } as any)
        .eq('id', decisionTarget.id);

      if (error) throw error;

      // If approved, execute the ledger posting
      if (decisionAction === 'approved') {
        await executeLedgerPosting(decisionTarget);
      }

      notify.success('Success', `Request ${decisionAction}`);
      setDecisionOpen(false);
      loadData();
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to process decision');
    } finally {
      setSaving(false);
    }
  };

  const executeLedgerPosting = async (req: ApprovalRequest) => {
    const p = req.payload;
    if (!p) return;

    // Post the transaction from the stored payload
    const { data: txn, error: txnError } = await supabase
      .from('fin_transactions')
      .insert({
        entity_id: p.transaction?.entity_id || req.entity_id,
        date: p.transaction?.date,
        type: p.transaction?.type,
        memo: p.transaction?.memo,
        source: 'approval',
      })
      .select()
      .single();

    if (txnError) throw txnError;

    // Post the lines with the new transaction_id
    if (p.lines && Array.isArray(p.lines)) {
      const lines = p.lines.map((line: any) => ({
        ...line,
        transaction_id: txn.id,
      }));
      const { error: linesError } = await supabase
        .from('fin_transaction_lines')
        .insert(lines);
      if (linesError) throw linesError;
    }
  };

  const filtered = requests.filter(r => {
    if (tab === 'pending') return r.status === 'pending';
    if (tab === 'resolved') return r.status !== 'pending';
    return true;
  });

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Approval Queue
          </h1>
          <p className="text-muted-foreground">Review and approve pending financial transactions</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="h-4 w-4" />
            Pending ({requests.filter(r => r.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardHeader>
              <CardTitle>
                {tab === 'pending' ? 'Pending Approvals' : tab === 'resolved' ? 'Resolved Requests' : 'All Requests'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {tab === 'pending' ? 'No pending approvals 🎉' : 'No requests found.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Details</TableHead>
                      {tab === 'pending' && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">
                          {TYPE_LABELS[req.request_type] || req.request_type}
                        </TableCell>
                        <TableCell>{entityMap[req.entity_id] || req.entity_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtMoney(req.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_BADGE[req.status] || ''}>
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {req.payload?.transaction?.memo || req.reason || '—'}
                        </TableCell>
                        {tab === 'pending' && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                onClick={() => openDecision(req, 'approved')}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => openDecision(req, 'rejected')}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Decision Dialog */}
      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionAction === 'approved' ? 'Approve Request' : 'Reject Request'}
            </DialogTitle>
          </DialogHeader>
          {decisionTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Type</div>
                <div className="font-medium">{TYPE_LABELS[decisionTarget.request_type] || decisionTarget.request_type}</div>
                <div className="text-muted-foreground">Amount</div>
                <div className="font-mono font-medium">{fmtMoney(decisionTarget.amount)}</div>
                <div className="text-muted-foreground">Entity</div>
                <div>{entityMap[decisionTarget.entity_id] || '—'}</div>
              </div>
              {decisionTarget.payload?.transaction?.memo && (
                <div className="p-3 bg-muted/50 rounded text-sm">
                  {decisionTarget.payload.transaction.memo}
                </div>
              )}
              <div className="space-y-1">
                <Label>Reason {decisionAction === 'rejected' ? '*' : '(optional)'}</Label>
                <Textarea
                  value={decisionReason}
                  onChange={e => setDecisionReason(e.target.value)}
                  placeholder={decisionAction === 'approved' ? 'Approval notes…' : 'Reason for rejection…'}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionOpen(false)}>Cancel</Button>
            <Button
              onClick={handleDecision}
              disabled={saving}
              variant={decisionAction === 'rejected' ? 'destructive' : 'default'}
            >
              {saving ? 'Processing…' : decisionAction === 'approved' ? 'Approve & Post' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
