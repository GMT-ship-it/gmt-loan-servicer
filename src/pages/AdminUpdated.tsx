import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { NotificationBell } from "@/components/NotificationBell";

export default function AdminPage() {
  const [exposure, setExposure] = useState<any[]>([]);
  const [draws, setDraws] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  
  // Compliance and Analytics state
  const [breaches, setBreaches] = useState<any[]>([]);
  const [portfolioAgg, setPortfolioAgg] = useState<any[]>([]);
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [timeSeriesFacility, setTimeSeriesFacility] = useState('');
  const [breachesLoading, setBreachesLoading] = useState(false);

  const { toast } = useToast();

  const loadBreaches = async () => {
    try {
      setBreachesLoading(true);
      const { data, error } = await supabase.rpc('portfolio_policy_breaches');
      if (error) throw error;
      setBreaches(data || []);
    } catch (error) {
      console.error('Error loading breaches:', error);
      toast({
        title: "Error",
        description: "Failed to load compliance breaches",
        variant: "destructive",
      });
    } finally {
      setBreachesLoading(false);
    }
  };

  const loadPortfolioAgg = async () => {
    try {
      const { data, error } = await supabase.rpc('get_portfolio_aggregates');
      if (error) throw error;
      setPortfolioAgg(data || []);
    } catch (error) {
      console.error('Error loading portfolio aggregates:', error);
      toast({
        title: "Error",
        description: "Failed to load portfolio data",
        variant: "destructive",
      });
    }
  };

  const loadTimeSeries = async (facilityId: string) => {
    if (!facilityId.trim()) return;
    
    try {
      const { data, error } = await supabase.rpc('utilization_timeseries', { 
        p_facility: facilityId, 
        p_days: 90 
      });
      if (error) throw error;
      setTimeSeries(data || []);
    } catch (error) {
      console.error('Error loading time series:', error);
      toast({
        title: "Error",
        description: "Failed to load utilization trend",
        variant: "destructive",
      });
    }
  };

  const loadExposure = async () => {
    // Mock function for now
    setExposure([]);
  };

  const loadDrawRequests = async () => {
    // Mock function for now
    setDraws([]);
  };

  const loadAuditLogs = async () => {
    // Mock function for now
    setAuditLogs([]);
  };

  useEffect(() => {
    loadExposure();
    loadDrawRequests();
    loadAuditLogs();
    loadBreaches();
    loadPortfolioAgg();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Lender Portal</h1>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <Button variant="outline" onClick={() => {
            loadExposure();
            loadDrawRequests();
            loadAuditLogs();
            loadBreaches();
            loadPortfolioAgg();
          }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="draws">Draw Requests</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Exposure</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0</div>
                <p className="text-xs text-muted-foreground">+0% from last month</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="draws" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Draw Requests</CardTitle>
              <CardDescription>Manage pending draw requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No draw requests found.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Compliance Breaches
                </CardTitle>
                <CardDescription>
                  Monitor facility covenant violations and policy breaches
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={loadBreaches}
                disabled={breachesLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${breachesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {breaches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {breachesLoading ? 'Loading breaches...' : 'No compliance breaches found. ✅'}
                </div>
              ) : (
                <div className="space-y-3">
                  {breaches.map((breach, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          {breach.customer_name} • 
                          <span className="font-mono text-sm ml-2">
                            {breach.facility_id.slice(0, 8)}...
                          </span>
                        </div>
                        <Badge 
                          variant={breach.severity === 'warning' ? 'destructive' : 'secondary'}
                        >
                          {breach.code}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {breach.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio by Sector/Region</CardTitle>
                <CardDescription>Outstanding balances and credit limits by industry sector</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={portfolioAgg}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="sector" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          `$${Number(value).toLocaleString()}`, 
                          name === 'principal_outstanding' ? 'Outstanding' : 'Credit Limit'
                        ]}
                      />
                      <Bar dataKey="principal_outstanding" name="Outstanding" fill="hsl(var(--primary))" />
                      <Bar dataKey="credit_limit" name="Credit Limit" fill="hsl(var(--muted))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Utilization Trend (90 days)</CardTitle>
                  <CardDescription>Track facility utilization over time</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter Facility ID"
                    value={timeSeriesFacility}
                    onChange={(e) => setTimeSeriesFacility(e.target.value)}
                    className="w-72 font-mono text-sm"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => loadTimeSeries(timeSeriesFacility)}
                    disabled={!timeSeriesFacility.trim()}
                  >
                    Load
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="d" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Utilization']}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="utilization_pct" 
                        name="Utilization %" 
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>System activity and changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No audit logs found.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>Generate and download reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Report generation coming soon.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}