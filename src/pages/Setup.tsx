import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function Setup() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('admin');
  const [orgName, setOrgName] = useState('Default Organization');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const assignRole = async () => {
    if (!email) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('assign-user-role', {
        body: {
          user_email: email,
          role: role,
          organization_name: orgName,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: data.message || 'Role assigned successfully',
      });

      // Clear form
      setEmail('');
      setRole('admin');
      setOrgName('Default Organization');
    } catch (error: any) {
      console.error('Error assigning role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign role',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Assign User Role</CardTitle>
          <CardDescription>
            Assign a role to a user account. Use this to set up your first admin user.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">User Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="analyst">Analyst</SelectItem>
                <SelectItem value="borrower">Borrower</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org">Organization Name</Label>
            <Input
              id="org"
              type="text"
              placeholder="Default Organization"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>

          <Button 
            onClick={assignRole} 
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign Role
          </Button>

          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Available Roles:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><strong>Admin:</strong> Full access to admin portal</li>
              <li><strong>Analyst:</strong> Read-only admin access</li>
              <li><strong>Borrower:</strong> Borrower portal access</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
