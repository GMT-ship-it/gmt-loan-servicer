import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Shield, TrendingUp, Users, 
  Building2, Briefcase, Smartphone,
  LineChart, Mail, CheckCircle2
} from 'lucide-react';
import { HeroAnimation } from '@/components/landing/HeroAnimation';
import { MetricCard } from '@/components/landing/MetricCard';
import { FeatureCard } from '@/components/landing/FeatureCard';
import { SolutionCard } from '@/components/landing/SolutionCard';
import { TeamCard } from '@/components/landing/TeamCard';
import { ArticleCard } from '@/components/landing/ArticleCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold">
              Mountain <span className="text-accent">Investments</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#solutions" className="nav-link">Solutions</a>
              <a href="#approach" className="nav-link">Approach</a>
              <a href="#team" className="nav-link">Team</a>
              <a href="#knowledge" className="nav-link">Knowledge</a>
            </div>
            
            <Button onClick={() => navigate('/login')} className="btn-primary">
              Access Portal
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        <HeroAnimation />
        
        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="heading-xl mb-6">
                Powering Growth Through <span className="text-accent-glow">Private Credit</span>
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                We provide sophisticated financing solutions that help businesses scale and investors achieve superior returns.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <button className="btn-primary">
                  Explore Solutions <ArrowRight className="w-5 h-5" />
                </button>
                <button className="btn-outline">
                  Contact Us
                </button>
              </div>
            </motion.div>
            
            <div className="grid grid-cols-2 gap-4">
              <MetricCard value="$150M+" label="Assets Under Management" delay={0.2} />
              <MetricCard value="500+" label="Active Borrowers" delay={0.3} />
              <MetricCard value="19%" label="Average Returns" delay={0.4} />
              <MetricCard value="98%" label="Client Retention" delay={0.5} />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="heading-lg mb-4">
              Why Choose <span className="text-accent">Mountain Investments</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our expertise in private credit markets delivers exceptional value to both borrowers and investors.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Shield}
              title="Risk-Adjusted Returns"
              description="Our disciplined underwriting process ensures superior risk-adjusted returns while protecting capital."
              delay={0}
            />
            <FeatureCard
              icon={TrendingUp}
              title="Flexible Structures"
              description="Customized financing solutions tailored to your unique business needs and growth trajectory."
              delay={0.1}
            />
            <FeatureCard
              icon={Users}
              title="Expert Partnership"
              description="Dedicated relationship managers with deep industry expertise guide you every step of the way."
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* Approach Section - Alternating Layout */}
      <section id="approach" className="py-24 px-6 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="heading-lg mb-6">
                Data-Driven <span className="text-accent">Decision Making</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                We leverage advanced analytics and proprietary models to evaluate opportunities, ensuring every investment meets our rigorous standards.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Our quantitative approach, combined with deep sector expertise, allows us to identify attractive risk-reward profiles across market cycles.
              </p>
              <button className="btn-outline">
                Learn More <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative h-96 rounded-2xl overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                <LineChart className="w-32 h-32 text-accent/40" />
              </div>
            </motion.div>
          </div>
          
          {/* Mirrored Layout */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative h-96 rounded-2xl overflow-hidden order-2 lg:order-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                <TrendingUp className="w-32 h-32 text-accent/40" />
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 lg:order-2"
            >
              <h2 className="heading-lg mb-6">
                Active Portfolio <span className="text-accent">Management</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Our hands-on approach ensures optimal portfolio performance through continuous monitoring and proactive engagement.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                We work closely with borrowers to support their success while maintaining disciplined risk management protocols.
              </p>
              <button className="btn-outline">
                View Services <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Solutions Grid */}
      <section id="solutions" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="heading-lg mb-4">
              How is <span className="text-accent">Mountain Investments</span> Shaping the Future?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              We're investing across innovative sectors that are transforming the economy.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SolutionCard
              icon={Building2}
              title="Real Estate"
              description="Commercial and residential development financing"
              delay={0}
            />
            <SolutionCard
              icon={Briefcase}
              title="FinTech"
              description="Next-generation financial services platforms"
              delay={0.1}
            />
            <SolutionCard
              icon={Smartphone}
              title="Technology"
              description="Software and infrastructure innovation"
              delay={0.2}
            />
            <SolutionCard
              icon={Users}
              title="Service Sector"
              description="Business services and workforce solutions"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="py-24 px-6 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="heading-lg mb-4">
              Our <span className="text-accent">Leadership Team</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Experienced professionals with a track record of excellence in private credit markets.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <TeamCard
              name="Sarah Mitchell"
              role="Chief Investment Officer"
              bio="20+ years in credit markets with expertise in structured finance and risk management."
              delay={0}
            />
            <TeamCard
              name="James Rodriguez"
              role="Managing Director"
              bio="Former investment banker specializing in middle-market lending and corporate finance."
              delay={0.1}
            />
            <TeamCard
              name="Emily Chen"
              role="Head of Portfolio Management"
              bio="Extensive experience in asset management with focus on alternative credit strategies."
              delay={0.2}
            />
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <button className="btn-outline">
              Meet Our Full Team <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Dual CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="card-surface p-12 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <Briefcase className="w-12 h-12 text-accent mb-6" />
                <h3 className="heading-md mb-4">For Borrowers</h3>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  Access flexible capital to fuel your growth. Our streamlined process and experienced team make financing simple.
                </p>
                <button 
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full"
                >
                  Apply for Financing <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="card-surface p-12 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <TrendingUp className="w-12 h-12 text-accent mb-6" />
                <h3 className="heading-md mb-4">For Investors</h3>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  Diversify your portfolio with attractive risk-adjusted returns. Join institutional investors who trust our platform.
                </p>
                <button 
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full"
                >
                  Become an Investor <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Knowledge Hub */}
      <section id="knowledge" className="py-24 px-6 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="heading-lg mb-4">
              Knowledge <span className="text-accent">Hub</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Insights and analysis from our investment team.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <ArticleCard
              category="Market Insight"
              title="Private Credit Opportunities in 2025"
              date="March 15, 2025"
              delay={0}
            />
            <ArticleCard
              category="Strategy"
              title="Navigating Rising Interest Rates"
              date="March 10, 2025"
              delay={0.1}
            />
            <ArticleCard
              category="Portfolio Update"
              title="Q1 2025 Performance Review"
              date="March 5, 2025"
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="card-surface p-12 text-center"
          >
            <Mail className="w-12 h-12 text-accent mx-auto mb-6" />
            <h2 className="heading-lg mb-4">
              Stay <span className="text-accent">Informed</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Subscribe to receive market insights, investment strategies, and portfolio updates directly to your inbox.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <Input 
                type="email" 
                placeholder="Enter your email"
                className="flex-1 bg-background/50 border-accent/30 focus:border-accent"
              />
              <Button className="btn-primary">
                Subscribe <CheckCircle2 className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">Mountain Investments</h4>
              <p className="text-sm text-muted-foreground">
                Sophisticated private credit solutions for businesses and investors.
              </p>
            </div>
            
            <div>
              <h5 className="font-semibold mb-4">Solutions</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-accent transition-colors">Borrowing</a></li>
                <li><a href="#" className="hover:text-accent transition-colors">Investing</a></li>
                <li><a href="#" className="hover:text-accent transition-colors">Portfolio Management</a></li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-semibold mb-4">Company</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-accent transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-accent transition-colors">Team</a></li>
                <li><a href="#" className="hover:text-accent transition-colors">Careers</a></li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-semibold mb-4">Contact</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>info@mountaininvestments.com</li>
                <li>1-800-MTN-INVST</li>
                <li>New York, NY</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 Mountain Investments. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
