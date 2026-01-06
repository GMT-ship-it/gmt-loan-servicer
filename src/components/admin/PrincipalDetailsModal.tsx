import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

type PrincipalRow = {
  id: string;
  date: string;
  type: string;
  memo: string | null;
  principalChange: number;
  runningPrincipal: number;
};

type DateFilterOption = 'last7' | 'last30' | 'last90' | 'ytd' | 'all';

interface PrincipalDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instrumentId: string;
  instrumentName: string;
  instrumentStartDate: string;
  position: 'receivable' | 'payable';
}

const fmtMoney = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function PrincipalDetailsModal({
  open,
  onOpenChange,
  instrumentId,
  instrumentName,
  instrumentStartDate,
  position,
}: PrincipalDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PrincipalRow[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');

  const accountName = position === 'payable' ? 'Notes Payable' : 'Notes Receivable';

  const getDateRange = (filter: DateFilterOption): { from: string; to: string } => {
    const today = new Date();
    const to = today.toISOString().split('T')[0];
    let from: string;

    switch (filter) {
      case 'last7':
        from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last30':
        from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last90':
        from = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'ytd':
        from = `${today.getFullYear()}-01-01`;
        break;
      case 'all':
      default:
        from = instrumentStartDate;
        break;
    }

    return { from, to };
  };

  const loadData = async () => {
    if (!instrumentId) return;
    
    setLoading(true);
    try {
      const { from, to } = getDateRange(dateFilter);
      
      // Get all transaction lines for this instrument on the principal account
      const { data: lines, error } = await supabase
        .from('fin_transaction_lines')
        .select(`
          id,
          credit,
          debit,
          transaction:fin_transactions!inner(id, date, memo, type),
          account:fin_accounts!inner(name)
        `)
        .eq('instrument_id', instrumentId);

      if (error) throw error;

      // Filter by account name and date range
      const filteredLines = (lines || []).filter((line: any) => {
        if (line.account?.name !== accountName) return false;
        const txDate = line.transaction?.date;
        return txDate && txDate >= from && txDate <= to;
      });

      // Create unique rows by transaction and calculate running principal
      const txMap = new Map<string, PrincipalRow>();
      
      filteredLines.forEach((line: any) => {
        const txId = line.transaction?.id;
        if (!txId) return;

        // Calculate principal change based on position
        let change: number;
        if (position === 'payable') {
          // For payable: credit increases principal, debit decreases
          change = (line.credit || 0) - (line.debit || 0);
        } else {
          // For receivable: debit increases principal, credit decreases
          change = (line.debit || 0) - (line.credit || 0);
        }

        if (!txMap.has(txId)) {
          txMap.set(txId, {
            id: txId,
            date: line.transaction?.date || '',
            type: line.transaction?.type || '',
            memo: line.transaction?.memo || null,
            principalChange: change,
            runningPrincipal: 0, // Will be calculated after sorting
          });
        } else {
          // Aggregate multiple lines from same transaction
          const existing = txMap.get(txId)!;
          existing.principalChange += change;
        }
      });

      // Sort by date ascending for running total calculation
      const rows = Array.from(txMap.values()).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculate running principal
      let runningTotal = 0;
      rows.forEach((row) => {
        runningTotal += row.principalChange;
        row.runningPrincipal = runningTotal;
      });

      // Reverse for display (newest first)
      rows.reverse();

      setData(rows);
    } catch (err) {
      console.error('Failed to load principal data:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, instrumentId, dateFilter]);

  // Calculate totals
  const netPrincipalChange = data.reduce((sum, row) => sum + row.principalChange, 0);
  const endingPrincipal = data.length > 0 ? data[0].runningPrincipal : 0;

  const filterButtons: { key: DateFilterOption; label: string }[] = [
    { key: 'last7', label: 'Last 7' },
    { key: 'last30', label: 'Last 30' },
    { key: 'last90', label: 'Last 90' },
    { key: 'ytd', label: 'YTD' },
    { key: 'all', label: 'All' },
  ];

  const formatType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Principal Details — {instrumentName}</DialogTitle>
        </DialogHeader>

        {/* Date filter buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {filterButtons.map((btn) => (
            <Button
              key={btn.key}
              variant={dateFilter === btn.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter(btn.key)}
            >
              {btn.label}
            </Button>
          ))}
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No principal transactions for this period.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="text-right">Principal Change</TableHead>
                  <TableHead className="text-right">Running Principal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell className="capitalize">{formatType(row.type)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {row.memo || '—'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${row.principalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.principalChange >= 0 ? '+' : ''}{fmtMoney(row.principalChange)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtMoney(row.runningPrincipal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Footer with totals */}
        {!loading && data.length > 0 && (
          <div className="border-t pt-4 mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Net Change in Range:</span>
              <span className={`ml-2 font-bold ${netPrincipalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netPrincipalChange >= 0 ? '+' : ''}{fmtMoney(netPrincipalChange)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Ending Principal:</span>
              <span className="ml-2 font-bold text-primary">{fmtMoney(endingPrincipal)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
