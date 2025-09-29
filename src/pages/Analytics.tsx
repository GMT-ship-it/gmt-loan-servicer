import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotify } from '@/lib/notify';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, BarChart3 } from 'lucide-react';
import { MotionRow as Row } from '@/components/MotionRow';
import { MetricCard } from '@/components/MetricCard';
import { darkAxis, gridStroke, tooltipStyle, getChartTheme } from '@/components/charts/theme';

type AnalyticsData = {
  portfolio_summary: any[];
  utilization_trends: any[];
  sector_breakdown: any[];
  compliance_metrics: any[];
};

const COLORS = ['#E50914', '#ffffff', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.3)'];

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [chartTheme, setChartTheme] = useState(getChartTheme());
  const [data, setData] = useState<AnalyticsData>({
    portfolio_summary: [],
    utilization_trends: [],
    sector_breakdown: [],
    compliance_metrics: []
  });

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Load portfolio aggregates
      const { data: portfolioData, error: portfolioError } = await supabase.rpc('get_portfolio_aggregates');
      if (portfolioError) throw portfolioError;

      // Load exposure data
      const { data: exposureData, error: exposureError } = await supabase.rpc('lender_exposure_snapshot');
      if (exposureError) throw exposureError;

      // Load compliance breaches
      const { data: breachData, error: breachError } = await supabase.rpc('portfolio_policy_breaches');
      if (breachError) throw breachError;

      // Process data for charts
      const sectorBreakdown = portfolioData || [];
      const utilizationTrends = (exposureData || []).map((item: any, index: number) => ({
        name: item.customer_name.substring(0, 15) + '...',
        utilization: Number(item.utilization_pct),
        outstanding: Number(item.principal_outstanding),
        available: Number(item.available_to_draw)
      }));

      const complianceMetrics = [
        { name: 'Compliant', value: Math.max(0, (exposureData?.length || 0) - (breachData?.length || 0)) },
        { name: 'Breaches', value: breachData?.length || 0 }
      ];

      setData({
        portfolio_summary: sectorBreakdown,
        utilization_trends: utilizationTrends,
        sector_breakdown: sectorBreakdown,
        compliance_metrics: complianceMetrics
      });

    } catch (error: any) {
      console.error('Error loading analytics:', error);
      notify.error("Error", "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error || !profile) {
        notify.error("Error", "Failed to load user profile");
        return;
      }

      if (!['lender_admin', 'lender_analyst'].includes(profile.role)) {
        navigate('/borrower', { replace: true });
        return;
      }

      await loadAnalytics();
    };

    // Update chart theme on mount and theme changes
    const updateTheme = () => setChartTheme(getChartTheme());
    updateTheme();
    
    // Listen for theme changes
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });

    checkAuth();
    
    return () => observer?.disconnect();
  }, []);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const totalOutstanding = data.portfolio_summary.reduce((sum, item) => sum + Number(item.principal_outstanding || 0), 0);
  const totalLimit = data.portfolio_summary.reduce((sum, item) => sum + Number(item.credit_limit || 0), 0);
  const avgUtilization = totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;
  const totalFacilities = data.portfolio_summary.reduce((sum, item) => sum + Number(item.facilities || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text)] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Portfolio Analytics</h1>
            <p className="text-muted-foreground mt-2">Comprehensive insights into portfolio performance and risk metrics</p>
          </div>
          <Button onClick={loadAnalytics} variant="outline" className="border-[var(--card-border)] hover:bg-[var(--surface-2)]">
            <BarChart3 className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>

        {/* Key Metrics */}
        <Row title="Key Portfolio Metrics">
          <MetricCard
            label="Total Outstanding"
            value={formatCurrency(totalOutstanding)}
            sub="Principal amount currently outstanding"
          />
          <MetricCard
            label="Total Credit Limit"
            value={formatCurrency(totalLimit)}
            sub="Total approved credit facilities"
          />
          <MetricCard
            label="Average Utilization"
            value={`${avgUtilization.toFixed(1)}%`}
            sub={avgUtilization > 75 ? "High utilization" : avgUtilization > 50 ? "Moderate utilization" : "Low utilization"}
          />
          <MetricCard
            label="Active Facilities"
            value={totalFacilities.toString()}
            sub="Number of active credit facilities"
          />
        </Row>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Portfolio by Sector */}
          <Card className="card-surface">
            <CardHeader>
              <CardTitle>Portfolio by Sector</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.sector_breakdown}>
                    <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                    <XAxis 
                      dataKey="sector" 
                      tickLine={false} 
                      axisLine={{ stroke: chartTheme.axis.stroke }} 
                      tick={chartTheme.axis.tick as any}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={{ stroke: chartTheme.axis.stroke }} 
                      tick={chartTheme.axis.tick as any}
                      tickFormatter={(value) => `$${(value / 1000)}K`}
                    />
                    <Tooltip 
                      contentStyle={chartTheme.tooltip as any}
                      formatter={(value: any, name: string) => [
                        formatCurrency(Number(value)), 
                        name === 'principal_outstanding' ? 'Outstanding' : 'Credit Limit'
                      ]}
                    />
                    <Bar dataKey="principal_outstanding" name="Outstanding" fill="#E50914" />
                    <Bar dataKey="credit_limit" name="Credit Limit" fill="rgba(255,255,255,0.4)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Utilization by Customer */}
          <Card className="card-surface">
            <CardHeader>
              <CardTitle>Utilization by Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.utilization_trends}>
                    <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tickLine={false} 
                      axisLine={{ stroke: chartTheme.axis.stroke }} 
                      tick={chartTheme.axis.tick as any}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={{ stroke: chartTheme.axis.stroke }} 
                      tick={chartTheme.axis.tick as any}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                      contentStyle={chartTheme.tooltip as any}
                      formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Utilization']}
                    />
                    <Bar dataKey="utilization" name="Utilization %" fill="#ffffff" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Overview */}
          <Card className="card-surface">
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.compliance_metrics}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.compliance_metrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={chartTheme.tooltip as any}
                      formatter={(value: any, name: string) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                {data.compliance_metrics.map((entry, index) => (
                  <div key={entry.name} className="flex items-center">
                    <div 
                      className="w-3 h-3 mr-2" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-sm">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Outstanding vs Available */}
          <Card className="card-surface">
            <CardHeader>
              <CardTitle>Outstanding vs Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.utilization_trends}>
                    <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tickLine={false} 
                      axisLine={{ stroke: chartTheme.axis.stroke }} 
                      tick={chartTheme.axis.tick as any}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={{ stroke: chartTheme.axis.stroke }} 
                      tick={chartTheme.axis.tick as any}
                      tickFormatter={(value) => `$${(value / 1000)}K`}
                    />
                    <Tooltip 
                      contentStyle={chartTheme.tooltip as any}
                      formatter={(value: any, name: string) => [formatCurrency(Number(value)), name]}
                    />
                    <Bar dataKey="outstanding" name="Outstanding" fill="#E50914" />
                    <Bar dataKey="available" name="Available" fill="rgba(255,255,255,0.6)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}