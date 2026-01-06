import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

type AccrualRow = {
  as_of_date: string;
  interest_accrued_today: number;
  accrued_interest_balance: number;
};

type DateFilterOption = 'last7' | 'last30' | 'last90' | 'ytd' | 'all';

interface AccruedInterestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instrumentId: string;
  instrumentName: string;
  instrumentStartDate: string;
}

const fmtMoney = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function AccruedInterestModal({
  open,
  onOpenChange,
  instrumentId,
  instrumentName,
  instrumentStartDate,
}: AccruedInterestModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AccrualRow[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');

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
      
      const { data: positions, error } = await supabase
        .from('fin_instrument_daily_positions')
        .select('as_of_date, interest_accrued_today, accrued_interest_balance')
        .eq('instrument_id', instrumentId)
        .gte('as_of_date', from)
        .lte('as_of_date', to)
        .order('as_of_date', { ascending: false });

      if (error) throw error;
      setData(positions || []);
    } catch (err) {
      console.error('Failed to load accrued interest data:', err);
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
  const totalAccruedInRange = data.reduce((sum, row) => sum + (row.interest_accrued_today || 0), 0);
  const latestBalance = data.length > 0 ? data[0].accrued_interest_balance : 0;

  const filterButtons: { key: DateFilterOption; label: string }[] = [
    { key: 'last7', label: 'Last 7' },
    { key: 'last30', label: 'Last 30' },
    { key: 'last90', label: 'Last 90' },
    { key: 'ytd', label: 'YTD' },
    { key: 'all', label: 'All' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Accrued Interest Details — {instrumentName}</DialogTitle>
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
              No accruals yet for this period.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Interest Today</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.as_of_date}>
                    <TableCell>{row.as_of_date}</TableCell>
                    <TableCell className="text-right font-medium">
                      {fmtMoney(row.interest_accrued_today || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtMoney(row.accrued_interest_balance || 0)}
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
              <span className="text-muted-foreground">Total Accrued in Range:</span>
              <span className="ml-2 font-bold">{fmtMoney(totalAccruedInRange)}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Latest Accrued Balance:</span>
              <span className="ml-2 font-bold text-primary">{fmtMoney(latestBalance)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
