import { useMemo, useState } from "react";
import { PmdLayout } from "@/components/pmd/PmdLayout";
import { OwnerGuard } from "@/components/pmd/OwnerGuard";
import { StatCard } from "@/components/pmd/StatCard";
import { useCapitalProviders, useCapitalEvents } from "@/hooks/use-pmd-data";
import { 
  buildProviderLedger,
  formatCurrency,
  formatPercent,
  type CapitalEvent,
  type CapitalProvider
} from "@/lib/pmd-calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Wallet, Percent } from "lucide-react";

const eventTypeLabels: Record<string, string> = {
  funding_in: "Funding In",
  interest_payment_out: "Interest Payment",
  principal_payment_out: "Principal Payment",
  expense_out: "Expense",
  adjustment: "Adjustment",
};

export default function PmdCapital() {
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const { data: providers, isLoading: providersLoading } = useCapitalProviders();
  const { data: events, isLoading: eventsLoading } = useCapitalEvents();

  const isLoading = providersLoading || eventsLoading;

  // Auto-select first provider
  const provider = providers?.find(p => p.id === selectedProvider) || providers?.[0];
  
  // Calculate ledger for selected provider
  const { ledger, summary } = useMemo(() => {
    if (!provider || !events) {
      return { ledger: [], summary: null };
    }

    const mappedProvider: CapitalProvider = {
      id: provider.id,
      name: provider.name,
      type: provider.type as 'lender' | 'investor',
      default_interest_rate: Number(provider.default_interest_rate),
    };

    const mappedEvents: CapitalEvent[] = events.map(e => ({
      id: e.id,
      project_id: e.project_id,
      provider_id: e.provider_id,
      event_date: e.event_date,
      event_type: e.event_type as CapitalEvent['event_type'],
      amount: Number(e.amount),
      interest_flag: e.interest_flag,
      interest_rate_override: e.interest_rate_override ? Number(e.interest_rate_override) : null,
      memo: e.memo,
    }));

    return buildProviderLedger(mappedEvents, mappedProvider, asOfDate);
  }, [provider, events, asOfDate]);

  return (
    <OwnerGuard>
      <PmdLayout>
        <div className="space-y-8">
          {/* Header with filters */}
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Capital Ledger</h1>
              <p className="text-muted-foreground mt-1">Detailed view per capital provider</p>
            </div>
            <div className="flex gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs">Provider</Label>
                <Select 
                  value={selectedProvider || provider?.id || ""} 
                  onValueChange={setSelectedProvider}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">As Of Date</Label>
                <Input 
                  type="date" 
                  value={asOfDate} 
                  onChange={e => setAsOfDate(e.target.value)}
                  className="w-[180px]"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}><CardContent className="p-6"><Skeleton className="h-16" /></CardContent></Card>
              ))}
            </div>
          ) : !provider ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No capital providers found. Add providers in the Projects section.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard
                  title="Capital Deployed"
                  value={formatCurrency(summary?.capital_deployed ?? 0)}
                  tooltip="Sum of all funding_in events"
                  icon={<DollarSign className="h-5 w-5" />}
                />
                <StatCard
                  title="Interest Earned"
                  value={formatCurrency(summary?.interest_earned ?? 0)}
                  tooltip="Total simple interest accrued"
                  icon={<TrendingUp className="h-5 w-5" />}
                />
                <StatCard
                  title="Balance Owed"
                  value={formatCurrency(summary?.balance_owed ?? 0)}
                  tooltip="Principal + accrued interest - payments"
                  icon={<Wallet className="h-5 w-5" />}
                />
                <StatCard
                  title="ROI (Simple)"
                  value={formatPercent(summary?.roi_simple ?? 0)}
                  tooltip="Interest Earned / Capital Deployed"
                  icon={<Percent className="h-5 w-5" />}
                />
              </div>

              {/* Ledger Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-3">
                    {provider.name} Ledger
                    <Badge variant="outline" className="font-normal">
                      {provider.type} • {formatPercent(Number(provider.default_interest_rate))} default rate
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ledger.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No events recorded for this provider yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-medium">Date</th>
                            <th className="text-left py-3 px-2 font-medium">Event Type</th>
                            <th className="text-right py-3 px-2 font-medium">Amount</th>
                            <th className="text-right py-3 px-2 font-medium">Rate</th>
                            <th className="text-right py-3 px-2 font-medium">Interest Accrued</th>
                            <th className="text-right py-3 px-2 font-medium">Running Balance</th>
                            <th className="text-left py-3 px-2 font-medium">Memo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledger.map((entry, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-3 px-2">{entry.event_date}</td>
                              <td className="py-3 px-2">
                                <Badge variant="secondary" className="font-normal">
                                  {eventTypeLabels[entry.event_type] || entry.event_type}
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-right font-mono">
                                {formatCurrency(entry.amount)}
                              </td>
                              <td className="py-3 px-2 text-right">
                                {formatPercent(entry.rate_used)}
                              </td>
                              <td className="py-3 px-2 text-right font-mono text-muted-foreground">
                                {entry.interest_accrued > 0 ? `+${formatCurrency(entry.interest_accrued)}` : "—"}
                              </td>
                              <td className="py-3 px-2 text-right font-mono font-medium">
                                {formatCurrency(entry.running_balance)}
                              </td>
                              <td className="py-3 px-2 text-muted-foreground max-w-[200px] truncate">
                                {entry.memo || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </PmdLayout>
    </OwnerGuard>
  );
}
