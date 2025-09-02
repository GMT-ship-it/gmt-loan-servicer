// Update this page (the content is just a fallback if you fail to update the page)

import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-4">SummitLine</h1>
          <p className="text-xl text-muted-foreground">Mountain Investments Client Portal</p>
        </div>
        <Button onClick={() => navigate('/login')}>
          Access Portal
        </Button>
      </div>
    </div>
  );
};

export default Index;
