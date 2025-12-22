import { useMemo, useState } from "react";
import { PmdLayout } from "@/components/pmd/PmdLayout";
import { OwnerGuard } from "@/components/pmd/OwnerGuard";
import { StatCard } from "@/components/pmd/StatCard";
import { useProjects, useCapitalProviders, useCapitalEvents, useAssets } from "@/hooks/use-pmd-data";
import { 
  calculateAllProviderSummaries, 
  calculatePortfolioTotals, 
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DollarSign, TrendingUp, Wallet, Landmark, PiggyBank } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function PmdDashboard() {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: providers, isLoading: providersLoading } = useCapitalProviders();
  const { data: events, isLoading: eventsLoading } = useCapitalEvents(selectedProject === "all" ? undefined : selectedProject);
  const { data: assets, isLoading: assetsLoading } = useAssets(selectedProject === "all" ? undefined : selectedProject);

  const isLoading = projectsLoading || providersLoading || eventsLoading || assetsLoading;

  // Calculate summaries
  const { summaries, totals, liquidation, totalAssetValue } = useMemo(() => {
    if (!providers || !events || !assets) {
      return { summaries: [], totals: { totalCapitalDeployed: 0, totalInterestEarned: 0, totalBalanceOwed: 0 }, liquidation: null, totalAssetValue: 0 };
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
    const totals = calculatePortfolioTotals(summaries);
    const liquidation = calculateLiquidation(mappedAssets, summaries);
    const totalAssetValue = mappedAssets.reduce((sum, a) => sum + a.sale_value_assumption, 0);

    return { summaries, totals, liquidation, totalAssetValue };
  }, [providers, events, assets, asOfDate]);

  const chartData = summaries.map(s => ({
    name: s.provider_name,
    deployed: s.capital_deployed,
    balance: s.balance_owed,
    roi: s.roi_simple * 100,
  }));

  return (
    <OwnerGuard>
      <PmdLayout>
        <div className="space-y-8">
          {/* Header with filters */}
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Portfolio overview and key metrics</p>
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

          {/* Stats Grid */}
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {[...Array(5)].map((_, i) => (
                <Card key={i}><CardContent className="p-6"><Skeleton className="h-16" /></CardContent></Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <StatCard
                title="Capital Deployed"
                value={formatCurrency(totals.totalCapitalDeployed)}
                tooltip="Total capital invested by all providers"
                icon={<DollarSign className="h-5 w-5" />}
              />
              <StatCard
                title="Interest Earned"
                value={formatCurrency(totals.totalInterestEarned)}
                tooltip="Total simple interest accrued to date"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <StatCard
                title="Notes Balance Owed"
                value={formatCurrency(totals.totalBalanceOwed)}
                tooltip="Total principal + accrued interest owed to providers"
                icon={<Wallet className="h-5 w-5" />}
              />
              <StatCard
                title="Asset Sale Value"
                value={formatCurrency(totalAssetValue)}
                tooltip="Sum of assumed sale values for all assets"
                icon={<Landmark className="h-5 w-5" />}
              />
              <StatCard
                title="Residual After Liquidation"
                value={formatCurrency(liquidation?.residualCash ?? 0)}
                tooltip="Net proceeds minus total notes owed"
                icon={<PiggyBank className="h-5 w-5" />}
                className={liquidation && liquidation.residualCash < 0 ? "border-destructive" : ""}
              />
            </div>
          )}

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Balance Owed by Provider</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} className="text-xs" />
                      <YAxis type="category" dataKey="name" width={80} className="text-xs" />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      />
                      <Bar dataKey="balance" name="Balance Owed">
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ROI by Provider</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}%`} className="text-xs" />
                      <YAxis type="category" dataKey="name" width={80} className="text-xs" />
                      <Tooltip 
                        formatter={(value: number) => `${value.toFixed(2)}%`}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      />
                      <Bar dataKey="roi" name="ROI (Simple)">
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Provider Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Provider Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px]" />
              ) : summaries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No capital providers yet. Add providers in the Projects section.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Provider</th>
                        <th className="text-right py-3 px-2 font-medium">Capital Deployed</th>
                        <th className="text-right py-3 px-2 font-medium">Interest Earned</th>
                        <th className="text-right py-3 px-2 font-medium">Balance Owed</th>
                        <th className="text-right py-3 px-2 font-medium">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaries.map(s => (
                        <tr key={s.provider_id} className="border-b last:border-0">
                          <td className="py-3 px-2 font-medium">{s.provider_name}</td>
                          <td className="py-3 px-2 text-right">{formatCurrency(s.capital_deployed)}</td>
                          <td className="py-3 px-2 text-right">{formatCurrency(s.interest_earned)}</td>
                          <td className="py-3 px-2 text-right">{formatCurrency(s.balance_owed)}</td>
                          <td className="py-3 px-2 text-right">{formatPercent(s.roi_simple)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PmdLayout>
    </OwnerGuard>
  );
}
