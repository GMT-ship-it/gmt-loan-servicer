import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const applicationSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(200, "Company name is too long"),
  contactName: z.string().trim().min(2, "Contact name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().trim().email("Invalid email address").max(255, "Email is too long"),
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits").max(20, "Phone number is too long"),
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(100, "Title is too long"),
  requestedAmount: z.string().trim().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be a positive number"),
  sector: z.string().min(1, "Please select a sector"),
  purpose: z.string().trim().min(10, "Purpose must be at least 10 characters").max(1000, "Purpose is too long"),
  address: z.string().trim().min(10, "Address must be at least 10 characters").max(500, "Address is too long"),
});

export default function Apply() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    title: '',
    requestedAmount: '',
    sector: '',
    purpose: '',
    address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate form
    const validation = applicationSchema.safeParse(form);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast({
        title: "Validation Error",
        description: "Please check the form for errors",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('borrower-application', {
        body: {
          companyName: form.companyName,
          fullName: form.contactName, // Map contactName to fullName
          email: form.email,
          phone: form.phone,
          title: form.title,
          requestedAmount: form.requestedAmount, // Send as string, function will coerce
          industry: form.sector, // Map sector to industry
          purpose: form.purpose,
          businessAddress: form.address, // Map address to businessAddress
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setSubmitted(true);
      toast({
        title: "Application Submitted",
        description: "We'll review your application and get back to you soon.",
      });
    } catch (error: any) {
      console.error('Application error:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10">
            <CheckCircle2 className="w-10 h-10 text-accent" />
          </div>
          <h1 className="heading-lg mb-4">Application Submitted!</h1>
          <p className="text-muted-foreground mb-8">
            Thank you for your interest. Our team will review your application and contact you within 2 business days.
          </p>
          <Button onClick={() => navigate('/')} className="btn-primary">
            Return to Home
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="card-surface border-accent/20">
            <CardHeader>
              <CardTitle className="heading-lg">Apply for Financing</CardTitle>
              <CardDescription className="text-muted-foreground">
                Complete the form below to start your application process. All fields are required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Company Information */}
                <div className="space-y-4">
                  <h3 className="heading-sm">Company Information</h3>
                  
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                      placeholder="ABC Corporation"
                      className={errors.companyName ? 'border-destructive' : ''}
                    />
                    {errors.companyName && <p className="text-sm text-destructive mt-1">{errors.companyName}</p>}
                  </div>

                  <div>
                    <Label htmlFor="sector">Industry Sector</Label>
                    <Select
                      value={form.sector}
                      onValueChange={(value) => setForm({ ...form, sector: value })}
                    >
                      <SelectTrigger className={errors.sector ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select sector" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="services">Services</SelectItem>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="real_estate">Real Estate</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.sector && <p className="text-sm text-destructive mt-1">{errors.sector}</p>}
                  </div>

                  <div>
                    <Label htmlFor="address">Business Address</Label>
                    <Textarea
                      id="address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="123 Main St, Suite 100, City, State, ZIP"
                      rows={3}
                      className={errors.address ? 'border-destructive' : ''}
                    />
                    {errors.address && <p className="text-sm text-destructive mt-1">{errors.address}</p>}
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="heading-sm">Contact Information</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contactName">Full Name</Label>
                      <Input
                        id="contactName"
                        value={form.contactName}
                        onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                        placeholder="John Smith"
                        className={errors.contactName ? 'border-destructive' : ''}
                      />
                      {errors.contactName && <p className="text-sm text-destructive mt-1">{errors.contactName}</p>}
                    </div>

                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="CEO"
                        className={errors.title ? 'border-destructive' : ''}
                      />
                      {errors.title && <p className="text-sm text-destructive mt-1">{errors.title}</p>}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="john@company.com"
                        className={errors.email ? 'border-destructive' : ''}
                      />
                      {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        className={errors.phone ? 'border-destructive' : ''}
                      />
                      {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone}</p>}
                    </div>
                  </div>
                </div>

                {/* Financing Details */}
                <div className="space-y-4">
                  <h3 className="heading-sm">Financing Details</h3>
                  
                  <div>
                    <Label htmlFor="requestedAmount">Requested Amount ($)</Label>
                    <Input
                      id="requestedAmount"
                      type="number"
                      value={form.requestedAmount}
                      onChange={(e) => setForm({ ...form, requestedAmount: e.target.value })}
                      placeholder="500000"
                      className={errors.requestedAmount ? 'border-destructive' : ''}
                    />
                    {errors.requestedAmount && <p className="text-sm text-destructive mt-1">{errors.requestedAmount}</p>}
                  </div>

                  <div>
                    <Label htmlFor="purpose">Purpose of Financing</Label>
                    <Textarea
                      id="purpose"
                      value={form.purpose}
                      onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                      placeholder="Describe how you plan to use the funds..."
                      rows={4}
                      className={errors.purpose ? 'border-destructive' : ''}
                    />
                    {errors.purpose && <p className="text-sm text-destructive mt-1">{errors.purpose}</p>}
                  </div>
                </div>

                <Button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
