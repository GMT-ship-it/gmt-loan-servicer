import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, Loader2, Mail, Phone, Building2, DollarSign, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DocumentRequestDialog from './DocumentRequestDialog';

interface PendingApplication {
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  title: string | null;
  company_name: string;
  sector: string | null;
  requested_amount: number | null;
  financing_purpose: string | null;
  address: string | null;
  applied_at: string;
}

export default function PendingApplications() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<PendingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loanTypes, setLoanTypes] = useState<Record<string, string>>({});
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<PendingApplication | null>(null);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          applied_at,
          profiles!inner(
            id,
            full_name,
            phone,
            title,
            customer_id,
            customers!inner(
              id,
              legal_name,
              sector,
              requested_amount,
              financing_purpose,
              address
            )
          )
        `)
        .eq('status', 'pending_approval')
        .order('applied_at', { ascending: true });

      if (error) throw error;

      // Get auth user emails
      const { data: authUsers } = await supabase.auth.admin.listUsers();

      const enriched: PendingApplication[] = (data || []).map((app: any) => {
        const authUser = authUsers?.users?.find((u: any) => u.id === app.user_id);
        const profile = app.profiles;
        const customer = profile?.customers;
        
        return {
          user_id: app.user_id,
          email: authUser?.email || 'N/A',
          full_name: profile?.full_name || 'N/A',
          phone: profile?.phone,
          title: profile?.title,
          company_name: customer?.legal_name || 'N/A',
          sector: customer?.sector,
          requested_amount: customer?.requested_amount,
          financing_purpose: customer?.financing_purpose,
          address: customer?.address,
          applied_at: app.applied_at,
        };
      });

      setApplications(enriched);
    } catch (error: any) {
      console.error('Error loading applications:', error);
      toast({
        title: "Error",
        description: "Failed to load pending applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const approveApplication = async (userId: string) => {
    try {
      setProcessing(userId);

      // Get the lender's organization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', session.user.id)
        .single();

      if (!adminRole) throw new Error('Organization not found');

      // Update user role to active with correct organization
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({
          status: 'active',
          approved_at: new Date().toISOString(),
          approved_by: session.user.id,
          organization_id: adminRole.organization_id,
        })
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // Update customer application status
      const { error: customerError } = await supabase
        .from('customers')
        .update({ application_status: 'approved' })
        .eq('id', (await supabase.from('profiles').select('customer_id').eq('id', userId).single()).data?.customer_id);

      if (customerError) throw customerError;

      // Send password reset email
      const app = applications.find(a => a.user_id === userId);
      if (app?.email) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(app.email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (resetError) console.error('Failed to send password reset:', resetError);
      }

      toast({
        title: "Application Approved",
        description: "User has been notified and can now access the portal",
      });

      await loadApplications();
    } catch (error: any) {
      console.error('Approval error:', error);
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const rejectApplication = async (userId: string) => {
    try {
      setProcessing(userId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Update user role status
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({
          status: 'rejected',
          approved_at: new Date().toISOString(),
          approved_by: session.user.id,
        })
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // Update customer application status
      const { error: customerError } = await supabase
        .from('customers')
        .update({ application_status: 'rejected' })
        .eq('id', (await supabase.from('profiles').select('customer_id').eq('id', userId).single()).data?.customer_id);

      if (customerError) throw customerError;

      toast({
        title: "Application Rejected",
        description: "The application has been rejected",
      });

      await loadApplications();
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (applications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No pending applications</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Applications ({applications.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {applications.map((app) => (
            <div key={app.user_id} className="border border-accent/20 rounded-lg p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{app.company_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Applied: {new Date(app.applied_at).toLocaleDateString()}
                  </p>
                </div>
                {app.sector && (
                  <Badge variant="outline">{app.sector}</Badge>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{app.full_name} ({app.title || 'N/A'})</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{app.email}</span>
                  </div>
                  {app.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{app.phone}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {app.requested_amount && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span>{app.requested_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                    </div>
                  )}
                  {app.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground">{app.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {app.financing_purpose && (
                <div>
                  <Label className="text-sm font-medium">Purpose</Label>
                  <p className="text-sm text-muted-foreground mt-1">{app.financing_purpose}</p>
                </div>
              )}

              <div>
                <Label htmlFor={`loan-type-${app.user_id}`}>Loan Type</Label>
                <Select
                  value={loanTypes[app.user_id] || 'working_capital'}
                  onValueChange={(value) => setLoanTypes({ ...loanTypes, [app.user_id]: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="working_capital">Working Capital</SelectItem>
                    <SelectItem value="equipment_loan">Equipment Loan</SelectItem>
                    <SelectItem value="equipment_lease">Equipment Finance Lease</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor={`notes-${app.user_id}`}>Internal Notes (Optional)</Label>
                <Textarea
                  id={`notes-${app.user_id}`}
                  value={notes[app.user_id] || ''}
                  onChange={(e) => setNotes({ ...notes, [app.user_id]: e.target.value })}
                  placeholder="Add any notes about this application..."
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button
                  onClick={async () => {
                    // Get customer_id from profiles
                    const { data: profile } = await supabase
                      .from('profiles')
                      .select('customer_id')
                      .eq('id', app.user_id)
                      .single();
                    
                    if (profile?.customer_id) {
                      setSelectedApplication(app);
                      setDocDialogOpen(true);
                    }
                  }}
                  disabled={processing === app.user_id}
                  variant="outline"
                  className="border-accent/30 hover:bg-accent/10"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Request Documents
                </Button>

                <div className="flex gap-3">
                  <Button
                    onClick={() => approveApplication(app.user_id)}
                    disabled={processing === app.user_id}
                    className="btn-primary flex-1"
                  >
                    {processing === app.user_id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => rejectApplication(app.user_id)}
                    disabled={processing === app.user_id}
                    variant="outline"
                    className="flex-1 border-destructive/30 hover:bg-destructive/10"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {selectedApplication && (
        <DocumentRequestDialog
          open={docDialogOpen}
          onClose={() => {
            setDocDialogOpen(false);
            setSelectedApplication(null);
          }}
          customerId={selectedApplication.user_id}
          companyName={selectedApplication.company_name}
          requestedAmount={selectedApplication.requested_amount || 0}
          loanType={loanTypes[selectedApplication.user_id] || 'working_capital'}
        />
      )}
    </Card>
  );
}
