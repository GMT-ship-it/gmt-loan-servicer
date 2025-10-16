import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileText, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentTemplate {
  id: string;
  name: string;
  description: string | null;
  required_for_loan_types: string[];
  required_for_amount_min: number;
  is_mandatory: boolean;
}

interface DocumentRequestDialogProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  companyName: string;
  requestedAmount: number;
  loanType: string;
}

export default function DocumentRequestDialog({
  open,
  onClose,
  customerId,
  companyName,
  requestedAmount,
  loanType
}: DocumentRequestDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [customDocs, setCustomDocs] = useState<string[]>([]);
  const [newCustomDoc, setNewCustomDoc] = useState('');
  const [dueDate, setDueDate] = useState<string>('');

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, loanType, requestedAmount]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('name');

      if (error) throw error;

      // Filter templates based on loan type and amount
      const filtered = (data || []).filter((t: DocumentTemplate) => {
        const matchesType = t.required_for_loan_types.includes(loanType);
        const matchesAmount = requestedAmount >= t.required_for_amount_min;
        return matchesType && matchesAmount;
      });

      setTemplates(filtered);

      // Auto-select mandatory documents
      const mandatory = new Set(
        filtered.filter(t => t.is_mandatory).map(t => t.id)
      );
      setSelectedTemplates(mandatory);

      // Set default due date (14 days from now)
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 14);
      setDueDate(defaultDue.toISOString().split('T')[0]);
    } catch (error: any) {
      console.error('Error loading templates:', error);
      toast({
        title: "Error",
        description: "Failed to load document templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template?.is_mandatory) return; // Can't uncheck mandatory

    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId);
    } else {
      newSelected.add(templateId);
    }
    setSelectedTemplates(newSelected);
  };

  const addCustomDoc = () => {
    if (newCustomDoc.trim()) {
      setCustomDocs([...customDocs, newCustomDoc.trim()]);
      setNewCustomDoc('');
    }
  };

  const removeCustomDoc = (index: number) => {
    setCustomDocs(customDocs.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (selectedTemplates.size === 0 && customDocs.length === 0) {
      toast({
        title: "No Documents Selected",
        description: "Please select at least one document to request",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const requests = [];

      // Add template-based requests
      for (const templateId of selectedTemplates) {
        requests.push({
          customer_id: customerId,
          document_template_id: templateId,
          requested_by: session.user.id,
          due_date: dueDate || null,
        });
      }

      // Add custom document requests
      for (const customName of customDocs) {
        requests.push({
          customer_id: customerId,
          custom_document_name: customName,
          requested_by: session.user.id,
          due_date: dueDate || null,
        });
      }

      const { error } = await supabase
        .from('document_requests')
        .insert(requests);

      if (error) throw error;

      toast({
        title: "Documents Requested",
        description: `${requests.length} document(s) requested from ${companyName}`,
      });

      onClose();
    } catch (error: any) {
      console.error('Error creating requests:', error);
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Request Documents from {companyName}</DialogTitle>
          <DialogDescription>
            Loan Type: {loanType.replace('_', ' ').toUpperCase()} | Amount: ${requestedAmount.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-6 pr-4">
              {/* Template Documents */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Standard Documents</Label>
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border border-accent/20 hover:bg-accent/5 transition-colors"
                    >
                      <Checkbox
                        checked={selectedTemplates.has(template.id)}
                        onCheckedChange={() => toggleTemplate(template.id)}
                        disabled={template.is_mandatory}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{template.name}</span>
                          {template.is_mandatory && (
                            <Badge variant="outline" className="ml-auto text-xs">Required</Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Documents */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Custom Documents</Label>
                <div className="space-y-2">
                  {customDocs.map((doc, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded border border-accent/20">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1">{doc}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomDoc(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter custom document name..."
                      value={newCustomDoc}
                      onChange={(e) => setNewCustomDoc(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCustomDoc()}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addCustomDoc}
                      disabled={!newCustomDoc.trim()}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <Label htmlFor="due-date">Due Date (Optional)</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || submitting}
            className="btn-primary flex-1"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Requesting...
              </>
            ) : (
              `Request ${selectedTemplates.size + customDocs.length} Document(s)`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
