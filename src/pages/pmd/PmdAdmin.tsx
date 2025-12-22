import { useState } from "react";
import { PmdLayout } from "@/components/pmd/PmdLayout";
import { OwnerGuard } from "@/components/pmd/OwnerGuard";
import { useProjects, useCapitalProviders, useCapitalEvents, useAssets } from "@/hooks/use-pmd-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Upload, Users, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function PmdAdmin() {
  const { data: projects } = useProjects();
  const { data: providers } = useCapitalProviders();
  const { data: events } = useCapitalEvents();
  const { data: assets } = useAssets();

  const [importing, setImporting] = useState(false);

  // Diagnostic checks
  const diagnostics = {
    hasProjects: (projects?.length ?? 0) > 0,
    hasProviders: (providers?.length ?? 0) > 0,
    hasEvents: (events?.length ?? 0) > 0,
    hasAssets: (assets?.length ?? 0) > 0,
    negativeBalances: false, // Would need calculation
    missingRates: providers?.some(p => !p.default_interest_rate) ?? false,
    orphanEvents: events?.some(e => !providers?.find(p => p.id === e.provider_id)) ?? false,
  };

  const exportCSV = (data: unknown[], filename: string) => {
    if (!data || data.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    const headers = Object.keys(data[0] as object);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(h => {
        const val = (row as Record<string, unknown>)[h];
        if (val === null || val === undefined) return "";
        if (typeof val === "string" && val.includes(",")) return `"${val}"`;
        return String(val);
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filename}`);
  };

  return (
    <OwnerGuard>
      <PmdLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Admin</h1>
            <p className="text-muted-foreground mt-1">System management, exports, and diagnostics</p>
          </div>

          <Tabs defaultValue="exports" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="exports">Exports</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
              <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            </TabsList>

            {/* Exports Tab */}
            <TabsContent value="exports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Export Data
                  </CardTitle>
                  <CardDescription>
                    Download CSV files of your portfolio data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Button 
                      variant="outline" 
                      className="justify-start h-auto py-4"
                      onClick={() => exportCSV(projects ?? [], "projects.csv")}
                    >
                      <div className="text-left">
                        <div className="font-medium">Projects</div>
                        <div className="text-xs text-muted-foreground">{projects?.length ?? 0} records</div>
                      </div>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start h-auto py-4"
                      onClick={() => exportCSV(providers ?? [], "capital_providers.csv")}
                    >
                      <div className="text-left">
                        <div className="font-medium">Capital Providers</div>
                        <div className="text-xs text-muted-foreground">{providers?.length ?? 0} records</div>
                      </div>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start h-auto py-4"
                      onClick={() => exportCSV(events ?? [], "capital_events.csv")}
                    >
                      <div className="text-left">
                        <div className="font-medium">Capital Events</div>
                        <div className="text-xs text-muted-foreground">{events?.length ?? 0} records</div>
                      </div>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start h-auto py-4"
                      onClick={() => exportCSV(assets ?? [], "assets.csv")}
                    >
                      <div className="text-left">
                        <div className="font-medium">Assets</div>
                        <div className="text-xs text-muted-foreground">{assets?.length ?? 0} records</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Import Tab */}
            <TabsContent value="import" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import Data
                  </CardTitle>
                  <CardDescription>
                    Import data from Excel or CSV files
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Coming Soon</AlertTitle>
                    <AlertDescription>
                      Excel/CSV import functionality will allow you to bulk import providers, projects, 
                      capital events, and assets from your existing workbook.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Drag and drop your Excel or CSV file here
                    </p>
                    <Button variant="outline" className="mt-4" disabled>
                      Browse Files
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Diagnostics Tab */}
            <TabsContent value="diagnostics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    System Diagnostics
                  </CardTitle>
                  <CardDescription>
                    Health checks and data validation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <DiagnosticItem 
                      label="Projects exist" 
                      ok={diagnostics.hasProjects} 
                      message={diagnostics.hasProjects ? `${projects?.length} projects` : "No projects created"}
                    />
                    <DiagnosticItem 
                      label="Capital providers exist" 
                      ok={diagnostics.hasProviders} 
                      message={diagnostics.hasProviders ? `${providers?.length} providers` : "No providers created"}
                    />
                    <DiagnosticItem 
                      label="Capital events recorded" 
                      ok={diagnostics.hasEvents} 
                      message={diagnostics.hasEvents ? `${events?.length} events` : "No events recorded"}
                    />
                    <DiagnosticItem 
                      label="Assets added" 
                      ok={diagnostics.hasAssets} 
                      message={diagnostics.hasAssets ? `${assets?.length} assets` : "No assets added"}
                    />
                    <DiagnosticItem 
                      label="All providers have rates" 
                      ok={!diagnostics.missingRates} 
                      warning={diagnostics.missingRates}
                      message={diagnostics.missingRates ? "Some providers missing default rate" : "All rates configured"}
                    />
                    <DiagnosticItem 
                      label="No orphan events" 
                      ok={!diagnostics.orphanEvents} 
                      warning={diagnostics.orphanEvents}
                      message={diagnostics.orphanEvents ? "Some events reference deleted providers" : "All events valid"}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </PmdLayout>
    </OwnerGuard>
  );
}

function DiagnosticItem({ 
  label, 
  ok, 
  warning = false,
  message 
}: { 
  label: string; 
  ok: boolean; 
  warning?: boolean;
  message: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        {ok && !warning ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : warning ? (
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
        ) : (
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}
