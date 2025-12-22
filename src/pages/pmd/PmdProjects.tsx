import { useState } from "react";
import { PmdLayout } from "@/components/pmd/PmdLayout";
import { OwnerGuard } from "@/components/pmd/OwnerGuard";
import { 
  useProjects, 
  useCreateProject,
  useUpdateProject,
  useCapitalProviders, 
  useCreateCapitalProvider, 
  useAssets,
  useCreateAsset,
  useCreateCapitalEvent
} from "@/hooks/use-pmd-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Building2, Users, Landmark, DollarSign } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/pmd-calculations";

export default function PmdProjects() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: providers, isLoading: providersLoading } = useCapitalProviders();
  const { data: assets, isLoading: assetsLoading } = useAssets();

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const createProvider = useCreateCapitalProvider();
  const createAsset = useCreateAsset();
  const createEvent = useCreateCapitalEvent();

  const [newProject, setNewProject] = useState({ name: "" });
  const [newProvider, setNewProvider] = useState({ name: "", type: "lender", default_interest_rate: "0.10" });
  const [newAsset, setNewAsset] = useState({ project_id: "", name: "", sale_value_assumption: "", commission_rate: "0.05" });
  const [newEvent, setNewEvent] = useState({ 
    project_id: "", 
    provider_id: "", 
    event_date: new Date().toISOString().split("T")[0],
    event_type: "funding_in",
    amount: "",
    memo: ""
  });

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  const isLoading = projectsLoading || providersLoading || assetsLoading;

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    await createProject.mutateAsync({ name: newProject.name });
    setNewProject({ name: "" });
    setProjectDialogOpen(false);
  };

  const handleCreateProvider = async () => {
    if (!newProvider.name.trim()) return;
    await createProvider.mutateAsync({
      name: newProvider.name,
      type: newProvider.type,
      default_interest_rate: parseFloat(newProvider.default_interest_rate),
    });
    setNewProvider({ name: "", type: "lender", default_interest_rate: "0.10" });
    setProviderDialogOpen(false);
  };

  const handleCreateAsset = async () => {
    if (!newAsset.project_id || !newAsset.name.trim()) return;
    await createAsset.mutateAsync({
      project_id: newAsset.project_id,
      name: newAsset.name,
      sale_value_assumption: parseFloat(newAsset.sale_value_assumption) || 0,
      commission_rate: parseFloat(newAsset.commission_rate) || 0.05,
    });
    setNewAsset({ project_id: "", name: "", sale_value_assumption: "", commission_rate: "0.05" });
    setAssetDialogOpen(false);
  };

  const handleCreateEvent = async () => {
    if (!newEvent.project_id || !newEvent.provider_id || !newEvent.amount) return;
    await createEvent.mutateAsync({
      project_id: newEvent.project_id,
      provider_id: newEvent.provider_id,
      event_date: newEvent.event_date,
      event_type: newEvent.event_type,
      amount: parseFloat(newEvent.amount),
      interest_flag: true,
      interest_rate_override: null,
      memo: newEvent.memo || null,
    });
    setNewEvent({ 
      project_id: "", 
      provider_id: "", 
      event_date: new Date().toISOString().split("T")[0],
      event_type: "funding_in",
      amount: "",
      memo: ""
    });
    setEventDialogOpen(false);
  };

  return (
    <OwnerGuard>
      <PmdLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Projects & Management</h1>
            <p className="text-muted-foreground mt-1">Manage projects, providers, assets, and capital events</p>
          </div>

          <Tabs defaultValue="projects" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 max-w-xl">
              <TabsTrigger value="projects" className="gap-2">
                <Building2 className="h-4 w-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger value="providers" className="gap-2">
                <Users className="h-4 w-4" />
                Providers
              </TabsTrigger>
              <TabsTrigger value="assets" className="gap-2">
                <Landmark className="h-4 w-4" />
                Assets
              </TabsTrigger>
              <TabsTrigger value="events" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Events
              </TabsTrigger>
            </TabsList>

            {/* Projects Tab */}
            <TabsContent value="projects" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Projects</h2>
                <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Project</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Project Name</Label>
                        <Input 
                          value={newProject.name} 
                          onChange={e => setNewProject({ name: e.target.value })}
                          placeholder="e.g., Real Estate Fund I"
                        />
                      </div>
                      <Button onClick={handleCreateProject} disabled={createProject.isPending} className="w-full">
                        {createProject.isPending ? "Creating..." : "Create Project"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
                </div>
              ) : projects?.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No projects yet. Create your first project to get started.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects?.map(project => (
                    <Card key={project.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                          <Badge variant={project.status === "active" ? "default" : "secondary"}>
                            {project.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Created {new Date(project.created_at).toLocaleDateString()}
                        </p>
                        <div className="flex gap-2 mt-4">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateProject.mutate({ id: project.id, status: project.status === "active" ? "closed" : "active" })}
                          >
                            {project.status === "active" ? "Close" : "Reopen"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Providers Tab */}
            <TabsContent value="providers" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Capital Providers</h2>
                <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Provider</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Capital Provider</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Provider Name</Label>
                        <Input 
                          value={newProvider.name} 
                          onChange={e => setNewProvider(p => ({ ...p, name: e.target.value }))}
                          placeholder="e.g., GJNP, JRNB"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={newProvider.type} onValueChange={v => setNewProvider(p => ({ ...p, type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lender">Lender</SelectItem>
                            <SelectItem value="investor">Investor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Default Interest Rate</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          value={newProvider.default_interest_rate} 
                          onChange={e => setNewProvider(p => ({ ...p, default_interest_rate: e.target.value }))}
                          placeholder="e.g., 0.10 for 10%"
                        />
                      </div>
                      <Button onClick={handleCreateProvider} disabled={createProvider.isPending} className="w-full">
                        {createProvider.isPending ? "Adding..." : "Add Provider"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {isLoading ? (
                <Skeleton className="h-64" />
              ) : providers?.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No capital providers yet.
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-medium">Name</th>
                            <th className="text-left py-3 px-2 font-medium">Type</th>
                            <th className="text-right py-3 px-2 font-medium">Default Rate</th>
                            <th className="text-left py-3 px-2 font-medium">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {providers?.map(p => (
                            <tr key={p.id} className="border-b last:border-0">
                              <td className="py-3 px-2 font-medium">{p.name}</td>
                              <td className="py-3 px-2">
                                <Badge variant="outline">{p.type}</Badge>
                              </td>
                              <td className="py-3 px-2 text-right">{formatPercent(Number(p.default_interest_rate))}</td>
                              <td className="py-3 px-2 text-muted-foreground">
                                {new Date(p.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Assets Tab */}
            <TabsContent value="assets" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Assets</h2>
                <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={!projects?.length}><Plus className="h-4 w-4 mr-2" />Add Asset</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Asset</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Project</Label>
                        <Select value={newAsset.project_id} onValueChange={v => setNewAsset(a => ({ ...a, project_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                          <SelectContent>
                            {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Asset Name</Label>
                        <Input 
                          value={newAsset.name} 
                          onChange={e => setNewAsset(a => ({ ...a, name: e.target.value }))}
                          placeholder="e.g., 13 Tiel Way"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Assumed Sale Value ($)</Label>
                        <Input 
                          type="number"
                          value={newAsset.sale_value_assumption} 
                          onChange={e => setNewAsset(a => ({ ...a, sale_value_assumption: e.target.value }))}
                          placeholder="e.g., 500000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Commission Rate</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          value={newAsset.commission_rate} 
                          onChange={e => setNewAsset(a => ({ ...a, commission_rate: e.target.value }))}
                          placeholder="e.g., 0.05 for 5%"
                        />
                      </div>
                      <Button onClick={handleCreateAsset} disabled={createAsset.isPending} className="w-full">
                        {createAsset.isPending ? "Adding..." : "Add Asset"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {isLoading ? (
                <Skeleton className="h-64" />
              ) : assets?.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No assets yet. Add assets to your projects.
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-medium">Name</th>
                            <th className="text-left py-3 px-2 font-medium">Project</th>
                            <th className="text-right py-3 px-2 font-medium">Sale Value</th>
                            <th className="text-right py-3 px-2 font-medium">Commission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assets?.map(a => (
                            <tr key={a.id} className="border-b last:border-0">
                              <td className="py-3 px-2 font-medium">{a.name}</td>
                              <td className="py-3 px-2 text-muted-foreground">
                                {projects?.find(p => p.id === a.project_id)?.name || "—"}
                              </td>
                              <td className="py-3 px-2 text-right">{formatCurrency(Number(a.sale_value_assumption))}</td>
                              <td className="py-3 px-2 text-right">{formatPercent(Number(a.commission_rate))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Capital Events</h2>
                <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={!projects?.length || !providers?.length}>
                      <Plus className="h-4 w-4 mr-2" />Add Event
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Record Capital Event</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Project</Label>
                          <Select value={newEvent.project_id} onValueChange={v => setNewEvent(e => ({ ...e, project_id: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Provider</Label>
                          <Select value={newEvent.provider_id} onValueChange={v => setNewEvent(e => ({ ...e, provider_id: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {providers?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Event Date</Label>
                          <Input 
                            type="date"
                            value={newEvent.event_date} 
                            onChange={e => setNewEvent(ev => ({ ...ev, event_date: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Event Type</Label>
                          <Select value={newEvent.event_type} onValueChange={v => setNewEvent(e => ({ ...e, event_type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="funding_in">Funding In</SelectItem>
                              <SelectItem value="interest_payment_out">Interest Payment</SelectItem>
                              <SelectItem value="principal_payment_out">Principal Payment</SelectItem>
                              <SelectItem value="expense_out">Expense</SelectItem>
                              <SelectItem value="adjustment">Adjustment</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Amount ($)</Label>
                        <Input 
                          type="number"
                          value={newEvent.amount} 
                          onChange={e => setNewEvent(ev => ({ ...ev, amount: e.target.value }))}
                          placeholder="e.g., 100000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Memo (optional)</Label>
                        <Input 
                          value={newEvent.memo} 
                          onChange={e => setNewEvent(ev => ({ ...ev, memo: e.target.value }))}
                          placeholder="Notes about this event"
                        />
                      </div>
                      <Button onClick={handleCreateEvent} disabled={createEvent.isPending} className="w-full">
                        {createEvent.isPending ? "Recording..." : "Record Event"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Capital events are displayed in the Capital Ledger view per provider.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </PmdLayout>
    </OwnerGuard>
  );
}
