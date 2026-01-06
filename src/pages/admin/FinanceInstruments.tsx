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
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useNotify } from '@/lib/notify';
import { Plus, Pencil, Trash2, RefreshCw, Building2, Users, FileText, DollarSign, ChevronDown, ChevronRight, Banknote, PlayCircle } from 'lucide-react';
import AccruedInterestModal from '@/components/admin/AccruedInterestModal';
import { Link } from 'react-router-dom';

type Entity = { id: string; name: string };
type Counterparty = { id: string; name: string; type: string };
type Account = { id: string; name: string; type: string };
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
  position: string;
  entity?: Entity;
  counterparty?: Counterparty;
};

type FundingEntry = {
  id: string;
  date: string;
  amount: number;
  memo: string | null;
  counterparty_name: string;
};

type InterestPaidEntry = {
  id: string;
  date: string;
  amount: number;
  memo: string | null;
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
  position: string;
};

type FundsInForm = {
  date: string;
  amount: string;
  memo: string;
  cash_account_id: string;
};

type InterestPaidForm = {
  date: string;
  amount: string;
  memo: string;
  cash_account_id: string;
  posting_mode: 'expense' | 'payable';
};

const defaultForm: InstrumentForm = {
  name: '',
  entity_id: '',
  counterparty_id: '',
  instrument_type: 'loan',
  principal_initial: '',
  rate_apr: '',
  day_count_basis: 'ACT/365',
  interest_method: 'simple',
  start_date: new Date().toISOString().split('T')[0],
  maturity_date: '',
  status: 'active',
  position: 'receivable',
};

const defaultFundsInForm: FundsInForm = {
  date: new Date().toISOString().split('T')[0],
  amount: '',
  memo: '',
  cash_account_id: '',
};

const defaultInterestPaidForm: InterestPaidForm = {
  date: new Date().toISOString().split('T')[0],
  amount: '',
  memo: '',
  cash_account_id: '',
  posting_mode: 'expense',
};

const instrumentTypes = ['loan', 'line_of_credit', 'note_payable', 'bond'];
const dayCountOptions = ['ACT/365', 'ACT/360', '30/360'];
const interestMethods = ['simple', 'compound'];
const statusOptions = ['active', 'paid_off', 'defaulted', 'cancelled'];
const positionOptions = ['receivable', 'payable'];

export default function FinanceInstruments() {
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InstrumentForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Funds In modal state
  const [fundsInOpen, setFundsInOpen] = useState(false);
  const [fundsInInstrument, setFundsInInstrument] = useState<Instrument | null>(null);
  const [fundsInForm, setFundsInForm] = useState<FundsInForm>(defaultFundsInForm);
  const [savingFundsIn, setSavingFundsIn] = useState(false);

  // Interest Paid modal state
  const [interestPaidOpen, setInterestPaidOpen] = useState(false);
  const [interestPaidInstrument, setInterestPaidInstrument] = useState<Instrument | null>(null);
  const [interestPaidForm, setInterestPaidForm] = useState<InterestPaidForm>(defaultInterestPaidForm);
  const [savingInterestPaid, setSavingInterestPaid] = useState(false);

  // Expanded instrument detail state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [principalOutstanding, setPrincipalOutstanding] = useState<Record<string, number>>({});
  const [accruedInterest, setAccruedInterest] = useState<Record<string, number>>({});
  const [latestAccrualDate, setLatestAccrualDate] = useState<Record<string, string>>({});
  const [fundingHistory, setFundingHistory] = useState<Record<string, FundingEntry[]>>({});
  const [interestPaidHistory, setInterestPaidHistory] = useState<Record<string, InterestPaidEntry[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  
  // Accrual state
  const [runningAccrual, setRunningAccrual] = useState(false);
  
  // Instrument positions (loaded for all instruments)
  const [instrumentPositions, setInstrumentPositions] = useState<Record<string, { principal: number; accrued: number; asOfDate: string | null }>>({});

  // Accrued Interest drill-down modal state
  const [accruedInterestModalOpen, setAccruedInterestModalOpen] = useState(false);
  const [accruedInterestInstrument, setAccruedInterestInstrument] = useState<Instrument | null>(null);

  const openAccruedInterestModal = (inst: Instrument) => {
    setAccruedInterestInstrument(inst);
    setAccruedInterestModalOpen(true);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [instRes, entRes, cpRes, accRes, posRes] = await Promise.all([
        supabase.from('fin_instruments').select(`
          *,
          entity:fin_entities(id, name),
          counterparty:fin_counterparties(id, name, type)
        `).order('created_at', { ascending: false }),
        supabase.from('fin_entities').select('id, name').order('name'),
        supabase.from('fin_counterparties').select('id, name, type').order('name'),
        supabase.from('fin_accounts').select('id, name, type').order('name'),
        // Get latest daily position for each instrument
        supabase.from('fin_instrument_daily_positions')
          .select('instrument_id, as_of_date, principal_outstanding, accrued_interest_balance')
          .order('as_of_date', { ascending: false }),
      ]);

      if (instRes.error) throw instRes.error;
      if (entRes.error) throw entRes.error;
      if (cpRes.error) throw cpRes.error;
      if (accRes.error) throw accRes.error;

      setInstruments(instRes.data || []);
      setEntities(entRes.data || []);
      setCounterparties(cpRes.data || []);
      setAccounts(accRes.data || []);
      
      // Build positions map (latest position per instrument)
      const posMap: Record<string, { principal: number; accrued: number; asOfDate: string | null }> = {};
      for (const pos of posRes.data || []) {
        if (!posMap[pos.instrument_id]) {
          posMap[pos.instrument_id] = {
            principal: pos.principal_outstanding || 0,
            accrued: pos.accrued_interest_balance || 0,
            asOfDate: pos.as_of_date,
          };
        }
      }
      setInstrumentPositions(posMap);
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadInstrumentDetail = async (instrumentId: string) => {
    setLoadingDetail(instrumentId);
    try {
      // Get all transaction lines for this instrument
      const [linesRes, positionsRes] = await Promise.all([
        supabase
          .from('fin_transaction_lines')
          .select(`
            credit,
            debit,
            transaction:fin_transactions!inner(id, date, memo, type),
            account:fin_accounts!inner(name),
            counterparty:fin_counterparties(name)
          `)
          .eq('instrument_id', instrumentId),
        // Get latest position for accrued interest
        supabase
          .from('fin_instrument_daily_positions')
          .select('principal_outstanding, accrued_interest_balance, as_of_date')
          .eq('instrument_id', instrumentId)
          .order('as_of_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (linesRes.error) throw linesRes.error;
      const lines = linesRes.data || [];

      // Calculate principal outstanding (credits - debits on Notes Payable)
      let principal = 0;
      const funding: FundingEntry[] = [];
      const interestPaid: InterestPaidEntry[] = [];
      const seenTxIds = new Set<string>();

      lines.forEach((line: any) => {
        if (line.account?.name === 'Notes Payable') {
          principal += (line.credit || 0) - (line.debit || 0);
          // Each credit to Notes Payable is a funding entry
          if (line.credit && line.credit > 0) {
            funding.push({
              id: line.transaction?.id || '',
              date: line.transaction?.date || '',
              amount: line.credit,
              memo: line.transaction?.memo || null,
              counterparty_name: line.counterparty?.name || '—',
            });
          }
        }
        // Interest paid entries: debit to Interest Expense or Interest Payable (exclude accruals)
        if (
          (line.account?.name === 'Interest Expense' || line.account?.name === 'Interest Payable') && 
          line.debit && 
          line.debit > 0 &&
          line.transaction?.type !== 'accrual'
        ) {
          // Dedupe by transaction id
          if (!seenTxIds.has(line.transaction?.id)) {
            seenTxIds.add(line.transaction?.id);
            interestPaid.push({
              id: line.transaction?.id || '',
              date: line.transaction?.date || '',
              amount: line.debit,
              memo: line.transaction?.memo || null,
            });
          }
        }
      });

      setPrincipalOutstanding(prev => ({ ...prev, [instrumentId]: principal }));
      setFundingHistory(prev => ({ 
        ...prev, 
        [instrumentId]: funding.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) 
      }));
      setInterestPaidHistory(prev => ({
        ...prev,
        [instrumentId]: interestPaid.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));
      
      // Set accrued interest from daily positions
      if (positionsRes.data) {
        setAccruedInterest(prev => ({ ...prev, [instrumentId]: positionsRes.data.accrued_interest_balance || 0 }));
        setLatestAccrualDate(prev => ({ ...prev, [instrumentId]: positionsRes.data.as_of_date || '' }));
      } else {
        setAccruedInterest(prev => ({ ...prev, [instrumentId]: 0 }));
        setLatestAccrualDate(prev => ({ ...prev, [instrumentId]: '' }));
      }
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to load instrument detail');
    } finally {
      setLoadingDetail(null);
    }
  };

  const toggleExpand = (inst: Instrument) => {
    if (expandedId === inst.id) {
      setExpandedId(null);
    } else {
      setExpandedId(inst.id);
      if (inst.position === 'payable') {
        loadInstrumentDetail(inst.id);
      }
    }
  };

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
      position: inst.position,
    });
    setDialogOpen(true);
  };

  const openFundsIn = (inst: Instrument) => {
    setFundsInInstrument(inst);
    // Find Cash account as default
    const cashAccount = accounts.find(a => a.name === 'Cash' && a.type === 'asset');
    setFundsInForm({
      ...defaultFundsInForm,
      cash_account_id: cashAccount?.id || '',
    });
    setFundsInOpen(true);
  };

  const openInterestPaid = (inst: Instrument) => {
    setInterestPaidInstrument(inst);
    // Find Cash account as default
    const cashAccount = accounts.find(a => a.name === 'Cash' && a.type === 'asset');
    setInterestPaidForm({
      ...defaultInterestPaidForm,
      cash_account_id: cashAccount?.id || '',
    });
    setInterestPaidOpen(true);
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
    if (isNaN(principal) || principal < 0) {
      notify.error('Validation', 'Principal must be 0 or greater');
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
        position: form.position,
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

  const handleSaveFundsIn = async () => {
    if (!fundsInInstrument) return;

    // Validation
    if (!fundsInForm.date) {
      notify.error('Validation', 'Date is required');
      return;
    }
    const amount = parseFloat(fundsInForm.amount);
    if (isNaN(amount) || amount <= 0) {
      notify.error('Validation', 'Amount must be greater than 0');
      return;
    }
    if (!fundsInForm.cash_account_id) {
      notify.error('Validation', 'Cash account is required');
      return;
    }

    // Find Notes Payable account
    const notesPayableAccount = accounts.find(a => a.name === 'Notes Payable' && a.type === 'liability');
    if (!notesPayableAccount) {
      notify.error('Error', 'Notes Payable account not found. Please create it first.');
      return;
    }

    setSavingFundsIn(true);
    try {
      // Create transaction
      const { data: txn, error: txnError } = await supabase
        .from('fin_transactions')
        .insert({
          entity_id: fundsInInstrument.entity_id,
          date: fundsInForm.date,
          type: 'funds_in',
          memo: fundsInForm.memo || `Funds received for ${fundsInInstrument.name}`,
          source: 'manual',
        })
        .select()
        .single();

      if (txnError) throw txnError;

      // Create transaction lines (double-entry)
      const { error: linesError } = await supabase
        .from('fin_transaction_lines')
        .insert([
          {
            transaction_id: txn.id,
            account_id: fundsInForm.cash_account_id,
            debit: amount,
            credit: null,
            instrument_id: fundsInInstrument.id,
            counterparty_id: fundsInInstrument.counterparty_id,
          },
          {
            transaction_id: txn.id,
            account_id: notesPayableAccount.id,
            debit: null,
            credit: amount,
            instrument_id: fundsInInstrument.id,
            counterparty_id: fundsInInstrument.counterparty_id,
          },
        ]);

      if (linesError) throw linesError;

      notify.success('Success', 'Funds recorded successfully');
      setFundsInOpen(false);
      
      // Reload instrument detail if expanded
      if (expandedId === fundsInInstrument.id) {
        loadInstrumentDetail(fundsInInstrument.id);
      }
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to record funds');
    } finally {
      setSavingFundsIn(false);
    }
  };

  const handleSaveInterestPaid = async () => {
    if (!interestPaidInstrument) return;

    // Validation
    if (!interestPaidForm.date) {
      notify.error('Validation', 'Date is required');
      return;
    }
    const amount = parseFloat(interestPaidForm.amount);
    if (isNaN(amount) || amount <= 0) {
      notify.error('Validation', 'Amount must be greater than 0');
      return;
    }
    if (!interestPaidForm.cash_account_id) {
      notify.error('Validation', 'Cash account is required');
      return;
    }

    // Find the debit account based on posting mode
    const debitAccountName = interestPaidForm.posting_mode === 'expense' ? 'Interest Expense' : 'Interest Payable';
    const debitAccountType = interestPaidForm.posting_mode === 'expense' ? 'expense' : 'liability';
    const debitAccount = accounts.find(a => a.name === debitAccountName && a.type === debitAccountType);
    if (!debitAccount) {
      notify.error('Error', `${debitAccountName} account not found. Please create it first.`);
      return;
    }

    setSavingInterestPaid(true);
    try {
      // Create transaction
      const { data: txn, error: txnError } = await supabase
        .from('fin_transactions')
        .insert({
          entity_id: interestPaidInstrument.entity_id,
          date: interestPaidForm.date,
          type: 'interest_paid',
          memo: interestPaidForm.memo || `Interest paid for ${interestPaidInstrument.name}`,
          source: 'manual',
        })
        .select()
        .single();

      if (txnError) throw txnError;

      // Create transaction lines (double-entry)
      // Debit: Interest Expense or Interest Payable
      // Credit: Cash
      const { error: linesError } = await supabase
        .from('fin_transaction_lines')
        .insert([
          {
            transaction_id: txn.id,
            account_id: debitAccount.id,
            debit: amount,
            credit: null,
            instrument_id: interestPaidInstrument.id,
            counterparty_id: interestPaidInstrument.counterparty_id,
          },
          {
            transaction_id: txn.id,
            account_id: interestPaidForm.cash_account_id,
            debit: null,
            credit: amount,
            instrument_id: interestPaidInstrument.id,
            counterparty_id: interestPaidInstrument.counterparty_id,
          },
        ]);

      if (linesError) throw linesError;

      notify.success('Success', 'Interest payment recorded successfully');
      setInterestPaidOpen(false);
      
      // Reload instrument detail if expanded
      if (expandedId === interestPaidInstrument.id) {
        loadInstrumentDetail(interestPaidInstrument.id);
      }
    } catch (err: any) {
      notify.error('Error', err.message || 'Failed to record interest payment');
    } finally {
      setSavingInterestPaid(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this instrument?')) return;
    
    setDeleting(id);
    try {
      const { error } = await supabase.from('fin_instruments').delete().eq('id', id);
      if (error) throw error;
      notify.success('Deleted', 'Instrument removed');
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

  const assetAccounts = accounts.filter(a => a.type === 'asset');

  const handleRunAccrual = async () => {
    setRunningAccrual(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.functions.invoke('accrue-interest', {
        body: { run_date: today, mode: 'catch_up' },
      });
      
      if (error) throw error;
      
      if (data?.skipped) {
        notify.info('Accrual Up to Date', 'All dates already processed');
      } else {
        const datesMsg = data?.dates_processed === 1 
          ? '1 date' 
          : `${data?.dates_processed || 0} dates`;
        notify.success(
          'Accrual Complete', 
          `Processed ${datesMsg}, total interest accrued: $${(data?.total_interest_accrued || 0).toFixed(2)}`
        );
      }
      
      // Refresh data to show updated positions
      await loadData();
    } catch (err: any) {
      console.error('Accrual error:', err);
      notify.error('Accrual Failed', err.message || 'Failed to run accrual');
    } finally {
      setRunningAccrual(false);
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRunAccrual} 
            disabled={runningAccrual}
          >
            <PlayCircle className={`h-4 w-4 mr-2 ${runningAccrual ? 'animate-spin' : ''}`} />
            {runningAccrual ? 'Running...' : 'Run Accrual (Catch Up)'}
          </Button>
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
            <div className="space-y-2">
              {instruments.map((inst) => (
                <div key={inst.id} className="border rounded-lg">
                  {/* Instrument Row */}
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(inst)}
                  >
                    <div className="flex items-center gap-4">
                      {inst.position === 'payable' ? (
                        expandedId === inst.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                      ) : (
                        <div className="w-4" />
                      )}
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {inst.name}
                          <Badge variant={inst.position === 'payable' ? 'secondary' : 'outline'} className="text-xs">
                            {inst.position}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {inst.entity?.name} → {inst.counterparty?.name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Principal</div>
                        <div className="font-medium">
                          {fmtMoney(instrumentPositions[inst.id]?.principal || inst.principal_initial)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Accrued Int.</div>
                        <div className="font-medium">
                          {fmtMoney(instrumentPositions[inst.id]?.accrued || 0)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Payoff</div>
                        <div className="font-medium text-primary">
                          {fmtMoney(
                            (instrumentPositions[inst.id]?.principal || inst.principal_initial) + 
                            (instrumentPositions[inst.id]?.accrued || 0)
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">APR</div>
                        <div className="font-medium">{fmtPct(inst.rate_apr)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Start Date</div>
                        <div className="font-medium">{inst.start_date}</div>
                      </div>
                      <Badge variant={statusColor(inst.status)}>{inst.status}</Badge>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {inst.position === 'payable' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => openFundsIn(inst)}>
                              <DollarSign className="h-4 w-4 mr-1" />
                              Record Funds In
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openInterestPaid(inst)}>
                              <Banknote className="h-4 w-4 mr-1" />
                              Record Interest Paid
                            </Button>
                          </>
                        )}
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
                    </div>
                  </div>

                  {/* Expanded Detail for Payable Instruments */}
                  {expandedId === inst.id && inst.position === 'payable' && (
                    <div className="border-t p-4 bg-muted/30 space-y-4">
                      {loadingDetail === inst.id ? (
                        <div className="text-center py-4 text-muted-foreground">Loading details...</div>
                      ) : (
                        <>
                          {/* Balance Summary */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-background rounded-lg p-3 border">
                              <div className="text-sm text-muted-foreground">Principal Outstanding</div>
                              <div className="text-xl font-bold">
                                {fmtMoney(principalOutstanding[inst.id] || 0)}
                              </div>
                            </div>
                            <div 
                              className="bg-background rounded-lg p-3 border cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
                              onClick={() => openAccruedInterestModal(inst)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && openAccruedInterestModal(inst)}
                            >
                              <div className="text-sm text-muted-foreground">
                                Accrued Interest
                                {latestAccrualDate[inst.id] && (
                                  <span className="text-xs ml-1">(as of {latestAccrualDate[inst.id]})</span>
                                )}
                              </div>
                              <div className="text-xl font-bold">
                                {fmtMoney(accruedInterest[inst.id] || 0)}
                              </div>
                              <div className="text-xs text-primary mt-1">Click for details →</div>
                            </div>
                            <div className="bg-background rounded-lg p-3 border col-span-2 md:col-span-2">
                              <div className="text-sm text-muted-foreground">Payoff Balance</div>
                              <div className="text-2xl font-bold text-primary">
                                {fmtMoney((principalOutstanding[inst.id] || 0) + (accruedInterest[inst.id] || 0))}
                              </div>
                            </div>
                          </div>

                          {/* Funding History Table */}
                          <div>
                            <h4 className="font-medium mb-2">Funding History</h4>
                            {(fundingHistory[inst.id] || []).length === 0 ? (
                              <div className="text-sm text-muted-foreground py-2">
                                No funding recorded yet. Use "Record Funds In" to add entries.
                              </div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Lender/Counterparty</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Memo</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(fundingHistory[inst.id] || []).map((entry) => (
                                    <TableRow key={entry.id}>
                                      <TableCell>{entry.date}</TableCell>
                                      <TableCell>{entry.counterparty_name}</TableCell>
                                      <TableCell className="text-right font-medium">{fmtMoney(entry.amount)}</TableCell>
                                      <TableCell className="text-muted-foreground">{entry.memo || '—'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>

                          {/* Interest Paid History Table */}
                          <div>
                            <h4 className="font-medium mb-2">Interest Paid History</h4>
                            {(interestPaidHistory[inst.id] || []).length === 0 ? (
                              <div className="text-sm text-muted-foreground py-2">
                                No interest payments recorded yet. Use "Record Interest Paid" to add entries.
                              </div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Memo</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(interestPaidHistory[inst.id] || []).map((entry) => (
                                    <TableRow key={entry.id}>
                                      <TableCell>{entry.date}</TableCell>
                                      <TableCell className="text-right font-medium">{fmtMoney(entry.amount)}</TableCell>
                                      <TableCell className="text-muted-foreground">{entry.memo || '—'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
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
                <Label htmlFor="position">Position</Label>
                <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {positionOptions.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="principal">Initial Principal {form.position === 'payable' ? '(can be 0)' : '*'}</Label>
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
                      <SelectItem key={d} value={d}>{d}</SelectItem>
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
                      <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

      {/* Record Funds In Dialog */}
      <Dialog open={fundsInOpen} onOpenChange={setFundsInOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Funds In</DialogTitle>
          </DialogHeader>
          {fundsInInstrument && (
            <div className="space-y-4 py-4">
              <div className="text-sm text-muted-foreground">
                Recording funds received for <span className="font-medium text-foreground">{fundsInInstrument.name}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="funds-date">Date *</Label>
                <Input
                  id="funds-date"
                  type="date"
                  value={fundsInForm.date}
                  onChange={(e) => setFundsInForm({ ...fundsInForm, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="funds-amount">Amount *</Label>
                <Input
                  id="funds-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={fundsInForm.amount}
                  onChange={(e) => setFundsInForm({ ...fundsInForm, amount: e.target.value })}
                  placeholder="Enter amount received"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="funds-cash-account">Cash Account *</Label>
                <Select value={fundsInForm.cash_account_id} onValueChange={(v) => setFundsInForm({ ...fundsInForm, cash_account_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cash account" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="funds-memo">Memo</Label>
                <Textarea
                  id="funds-memo"
                  value={fundsInForm.memo}
                  onChange={(e) => setFundsInForm({ ...fundsInForm, memo: e.target.value })}
                  placeholder="Optional note about this funding"
                  rows={2}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="font-medium mb-1">Double-Entry Preview:</div>
                <div className="text-muted-foreground space-y-1">
                  <div>• Debit: {assetAccounts.find(a => a.id === fundsInForm.cash_account_id)?.name || 'Cash'}</div>
                  <div>• Credit: Notes Payable</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFundsInOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveFundsIn} disabled={savingFundsIn}>
              {savingFundsIn ? 'Recording...' : 'Record Funds'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Interest Paid Dialog */}
      <Dialog open={interestPaidOpen} onOpenChange={setInterestPaidOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Interest Paid</DialogTitle>
          </DialogHeader>
          {interestPaidInstrument && (
            <div className="space-y-4 py-4">
              <div className="text-sm text-muted-foreground">
                Recording interest payment for <span className="font-medium text-foreground">{interestPaidInstrument.name}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interest-date">Date *</Label>
                <Input
                  id="interest-date"
                  type="date"
                  value={interestPaidForm.date}
                  onChange={(e) => setInterestPaidForm({ ...interestPaidForm, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interest-amount">Amount *</Label>
                <Input
                  id="interest-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={interestPaidForm.amount}
                  onChange={(e) => setInterestPaidForm({ ...interestPaidForm, amount: e.target.value })}
                  placeholder="Enter interest amount paid"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interest-cash-account">Cash Account *</Label>
                <Select value={interestPaidForm.cash_account_id} onValueChange={(v) => setInterestPaidForm({ ...interestPaidForm, cash_account_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cash account" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Posting Mode *</Label>
                <RadioGroup 
                  value={interestPaidForm.posting_mode} 
                  onValueChange={(v: 'expense' | 'payable') => setInterestPaidForm({ ...interestPaidForm, posting_mode: v })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="expense" id="posting-expense" />
                    <Label htmlFor="posting-expense" className="font-normal cursor-pointer">
                      Expense
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="payable" id="posting-payable" />
                    <Label htmlFor="posting-payable" className="font-normal cursor-pointer">
                      Payable (when accruals exist)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interest-memo">Memo</Label>
                <Textarea
                  id="interest-memo"
                  value={interestPaidForm.memo}
                  onChange={(e) => setInterestPaidForm({ ...interestPaidForm, memo: e.target.value })}
                  placeholder="Optional note about this interest payment"
                  rows={2}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="font-medium mb-1">Double-Entry Preview:</div>
                <div className="text-muted-foreground space-y-1">
                  <div>• Debit: {interestPaidForm.posting_mode === 'expense' ? 'Interest Expense' : 'Interest Payable'}</div>
                  <div>• Credit: {assetAccounts.find(a => a.id === interestPaidForm.cash_account_id)?.name || 'Cash'}</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterestPaidOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveInterestPaid} disabled={savingInterestPaid}>
              {savingInterestPaid ? 'Recording...' : 'Record Interest Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accrued Interest Drill-Down Modal */}
      {accruedInterestInstrument && (
        <AccruedInterestModal
          open={accruedInterestModalOpen}
          onOpenChange={setAccruedInterestModalOpen}
          instrumentId={accruedInterestInstrument.id}
          instrumentName={accruedInterestInstrument.name}
          instrumentStartDate={accruedInterestInstrument.start_date}
        />
      )}
    </div>
  );
}
