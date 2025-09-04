import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Plus, Download, FileText, CreditCard, DollarSign, TrendingUp, Building2 } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { NotificationBell } from "@/components/NotificationBell";
import { BbcCsvUpload } from "@/components/BbcCsvUpload";

export default function BorrowerPage() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [draws, setDraws] = useState<any[]>([]);
  const [bbcs, setBbcs] = useState<any[]>([]);
  const [selectedBbc, setSelectedBbc] = useState<any>(null);
  const [bbcItems, setBbcItems] = useState<any[]>([]);
  const { toast } = useToast();

  const loadFacilities = async () => {
    // Mock function for now
    setFacilities([]);
  };

  const loadDraws = async () => {
    // Mock function for now
    setDraws([]);
  };

  const loadBbcs = async () => {
    // Mock function for now
    setBbcs([]);
  };

  const loadBbcItems = async (bbcId: string) => {
    // Mock function for now
    setBbcItems([]);
  };

  useEffect(() => {
    loadFacilities();
    loadDraws();
    loadBbcs();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Borrower Portal</h1>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <Button variant="outline" onClick={() => {
            loadFacilities();
            loadDraws();
            loadBbcs();
          }}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="draws">Draw Requests</TabsTrigger>
          <TabsTrigger value="bbc">BBC Reports</TabsTrigger>
          <TabsTrigger value="statements">Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Credit Limit</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0</div>
                <p className="text-xs text-muted-foreground">Available to draw</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="draws" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Draw Requests</CardTitle>
              <CardDescription>Submit and track draw requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No draw requests found.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bbc" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Borrowing Base Certificate</CardTitle>
              <CardDescription>Manage your borrowing base certificates</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedBbc ? (
                <div className="space-y-6">
                  <BbcCsvUpload 
                    bbcId={selectedBbc.id} 
                    onUploadComplete={() => {
                      // Refresh BBC items and header data
                      loadBbcItems(selectedBbc.id);
                      loadBbcs(); // Refresh to get updated header totals
                    }} 
                  />
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Add Individual Item</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bbc-item-type">Item Type</Label>
                        {/* Form controls would go here */}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No BBC reports found. Create one to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statements" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Statements</CardTitle>
              <CardDescription>Download monthly facility statements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No statements available.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}