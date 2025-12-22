import { useMemo, useState } from "react";
import { PmdLayout } from "@/components/pmd/PmdLayout";
import { OwnerGuard } from "@/components/pmd/OwnerGuard";
import { StatCard } from "@/components/pmd/StatCard";
import { useProjects, useCapitalProviders, useCapitalEvents, useAssets } from "@/hooks/use-pmd-data";
import { 
  calculateAllProviderSummaries, 
  calculateLiquidation,
  formatCurrency,
  formatPercent,
  type CapitalEvent,
  type CapitalProvider,
  type Asset
} from "@/lib/pmd-calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DollarSign, AlertTriangle, TrendingDown, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PmdLiquidation() {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: providers, isLoading: providersLoading } = useCapitalProviders();
  const { data: events, isLoading: eventsLoading } = useCapitalEvents(selectedProject === "all" ? undefined : selectedProject);
  const { data: assets, isLoading: assetsLoading } = useAssets(selectedProject === "all" ? undefined : selectedProject);

  const isLoading = projectsLoading || providersLoading || eventsLoading || assetsLoading;

  // Calculate liquidation scenario
  const liquidation = useMemo(() => {
    if (!providers || !events || !assets) {
      return null;
    }

    const mappedProviders: CapitalProvider[] = providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type as 'lender' | 'investor',
      default_interest_rate: Number(p.default_interest_rate),
    }));

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

    const mappedAssets: Asset[] = assets.map(a => ({
      id: a.id,
      project_id: a.project_id,
      name: a.name,
      sale_value_assumption: Number(a.sale_value_assumption),
      commission_rate: Number(a.commission_rate),
    }));

    const summaries = calculateAllProviderSummaries(mappedEvents, mappedProviders, asOfDate);
    return calculateLiquidation(mappedAssets, summaries);
  }, [providers, events, assets, asOfDate]);

  const isPositive = (liquidation?.residualCash ?? 0) >= 0;

  return (
    <OwnerGuard>
      <PmdLayout>
        <div className="space-y-8">
          {/* Header with filters */}
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Liquidation Scenario</h1>
              <p className="text-muted-foreground mt-1">
                What happens if we sold assets today and paid all notes?
              </p>
            </div>
            <div className="flex gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs">Project</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects?.map(p => (
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
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : !liquidation || (liquidation.assetResults.length === 0 && liquidation.providerPayoffs.length === 0) ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No assets or capital events to calculate liquidation scenario. Add assets and capital events first.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Alert */}
              <Alert className={cn(isPositive ? "border-green-500/50" : "border-destructive/50")}>
                {isPositive ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                <AlertTitle className={isPositive ? "text-green-500" : "text-destructive"}>
                  {isPositive ? "Positive Residual" : "Shortfall Warning"}
                </AlertTitle>
                <AlertDescription>
                  {isPositive 
                    ? `After paying all notes, there would be ${formatCurrency(liquidation.residualCash)} remaining.`
                    : `There is a shortfall of ${formatCurrency(Math.abs(liquidation.residualCash))}. Notes would be prorated.`
                  }
                </AlertDescription>
              </Alert>

              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  title="Total Net Proceeds"
                  value={formatCurrency(liquidation.totalNetProceeds)}
                  tooltip="Asset sale values minus commissions"
                  icon={<DollarSign className="h-5 w-5" />}
                />
                <StatCard
                  title="Total Notes Owed"
                  value={formatCurrency(liquidation.totalNotesOwed)}
                  tooltip="Sum of all provider balances"
                  icon={<TrendingDown className="h-5 w-5" />}
                />
                <StatCard
                  title="Residual Cash"
                  value={formatCurrency(liquidation.residualCash)}
                  tooltip="Net proceeds minus notes owed"
                  icon={isPositive ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                  className={cn(!isPositive && "border-destructive")}
                />
              </div>

              {/* Asset Liquidation Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Asset Liquidation</CardTitle>
                </CardHeader>
                <CardContent>
                  {liquidation.assetResults.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No assets to liquidate.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-medium">Asset Name</th>
                            <th className="text-right py-3 px-2 font-medium">Sale Value</th>
                            <th className="text-right py-3 px-2 font-medium">Commission %</th>
                            <th className="text-right py-3 px-2 font-medium">Commission $</th>
                            <th className="text-right py-3 px-2 font-medium">Net Proceeds</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liquidation.assetResults.map((asset, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-3 px-2 font-medium">{asset.asset_name}</td>
                              <td className="py-3 px-2 text-right">{formatCurrency(asset.sale_value)}</td>
                              <td className="py-3 px-2 text-right">{formatPercent(asset.commission_rate)}</td>
                              <td className="py-3 px-2 text-right text-muted-foreground">
                                ({formatCurrency(asset.commission_amount)})
                              </td>
                              <td className="py-3 px-2 text-right font-medium">{formatCurrency(asset.net_proceeds)}</td>
                            </tr>
                          ))}
                          <tr className="bg-muted/50">
                            <td className="py-3 px-2 font-bold">Total</td>
                            <td className="py-3 px-2 text-right font-bold">
                              {formatCurrency(liquidation.assetResults.reduce((s, a) => s + a.sale_value, 0))}
                            </td>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2 text-right text-muted-foreground font-medium">
                              ({formatCurrency(liquidation.assetResults.reduce((s, a) => s + a.commission_amount, 0))})
                            </td>
                            <td className="py-3 px-2 text-right font-bold">
                              {formatCurrency(liquidation.totalNetProceeds)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Provider Payoff Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Provider Payoff Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {liquidation.providerPayoffs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No providers to pay.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-medium">Provider</th>
                            <th className="text-right py-3 px-2 font-medium">Balance Owed</th>
                            <th className="text-right py-3 px-2 font-medium">% of Total</th>
                            <th className="text-right py-3 px-2 font-medium">Paid in Liquidation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liquidation.providerPayoffs.map((provider, i) => {
                            const isPaidInFull = provider.paid_in_liquidation >= provider.balance_owed;
                            return (
                              <tr key={i} className="border-b last:border-0">
                                <td className="py-3 px-2 font-medium">{provider.provider_name}</td>
                                <td className="py-3 px-2 text-right">{formatCurrency(provider.balance_owed)}</td>
                                <td className="py-3 px-2 text-right">{formatPercent(provider.percent_of_total)}</td>
                                <td className={cn(
                                  "py-3 px-2 text-right font-medium",
                                  !isPaidInFull && "text-destructive"
                                )}>
                                  {formatCurrency(provider.paid_in_liquidation)}
                                  {!isPaidInFull && " (prorated)"}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-muted/50">
                            <td className="py-3 px-2 font-bold">Total</td>
                            <td className="py-3 px-2 text-right font-bold">
                              {formatCurrency(liquidation.totalNotesOwed)}
                            </td>
                            <td className="py-3 px-2 text-right font-bold">100%</td>
                            <td className="py-3 px-2 text-right font-bold">
                              {formatCurrency(Math.min(liquidation.totalNetProceeds, liquidation.totalNotesOwed))}
                            </td>
                          </tr>
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
