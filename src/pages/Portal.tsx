import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type AppRole = 'lender_admin' | 'lender_analyst' | 'borrower_admin' | 'borrower_user';

export default function Portal() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'no-session' | 'routing' | 'error'>('checking');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 1) Ensure we have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (mounted) {
            setStatus('no-session');
          }
          navigate('/login', { replace: true });
          return;
        }

        // 2) Fetch the profile for this user and read the role
        const userId = session.user.id;
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();

        if (error || !profile) {
          throw new Error(error?.message || 'Profile not found');
        }

        const role = profile.role as AppRole;

        // 3) Route by role
        if (mounted) {
          setStatus('routing');
          if (role === 'lender_admin' || role === 'lender_analyst') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/borrower', { replace: true });
          }
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unexpected error');
        setStatus('error');
      }
    })();

    return () => { mounted = false; };
  }, [navigate]);

  if (status === 'checking' || status === 'routing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p>Checking your session...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Portal Error</CardTitle>
            <CardDescription className="text-destructive">
              Error: {err}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={() => navigate('/login')}
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // no-session: brief fallback while we redirect to /login
  return null;
}