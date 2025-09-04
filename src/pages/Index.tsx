import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(/lovable-uploads/146415eb-e4ba-457e-9cb0-2712384c6195.png)` }}
      />
      
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-8 max-w-2xl">
          {/* Mountain Investments Logo/Brand */}
          <div className="mb-8">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-2 tracking-tight">
              Mountain Investments
            </h1>
            <div className="w-24 h-1 bg-white mx-auto"></div>
          </div>
          
          {/* Main Content */}
          <div className="space-y-6">
            <div className="text-2xl md:text-3xl font-extrabold text-white">
              SummitLine
            </div>
            <p className="text-xl md:text-2xl text-white/90 font-light">
              Client Portal
            </p>
            <p className="text-lg text-white/80 max-w-lg mx-auto">
              Secure access to your investment portfolio and financial services
            </p>
          </div>
          
          {/* Action Button */}
          <div className="pt-4">
            <Button 
              onClick={() => navigate('/login')}
              size="lg"
              className="bg-white text-black hover:bg-white/90 px-8 py-4 text-lg font-semibold rounded-lg shadow-2xl hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              Access Portal
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
