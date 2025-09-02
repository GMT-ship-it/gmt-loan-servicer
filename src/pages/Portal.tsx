import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export default function Portal() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">SummitLine Portal</CardTitle>
            <CardDescription>Welcome to Mountain Investments Client Portal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Login succeeded! This is a placeholder portal page. 
              Role-based routing and dashboard features will be added next.
            </p>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate('/login')}
              >
                Back to Login
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
              >
                Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}