import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type AppRole = 'admin' | 'analyst' | 'borrower';

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

        // 2) Fetch the user's role from user_roles
        const userId = session.user.id;
        const { data: roleRow, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        const role = roleRow?.role as AppRole | undefined;
        if (!role) {
          throw new Error('No role assigned to this user');
        }

        // 3) Route by role
        if (mounted) {
          setStatus('routing');
          if (role === 'admin' || role === 'analyst') {
            navigate('/admin', { replace: true });
          } else if (role === 'borrower') {
            navigate('/borrower', { replace: true });
          } else {
            throw new Error(`Unknown role: ${role}`);
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
        <Card className="w-full max-w-md" role="status" aria-live="polite">
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
        <Card className="w-full max-w-md" role="alert" aria-live="assertive">
          <CardHeader>
            <CardTitle>Portal Error</CardTitle>
            <CardDescription className="text-destructive">
              Error: {err}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={() => navigate('/setup')}
              className="w-full mb-2"
            >
              Assign Role
            </Button>
            <Button 
              variant="ghost" 
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