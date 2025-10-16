import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Brain, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  FileQuestion, 
  HelpCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AnalysisResult = {
  missing_documents: Array<{
    document_name: string;
    reason: string;
    priority: "high" | "medium" | "low";
  }>;
  discrepancies: Array<{
    issue: string;
    severity: "critical" | "warning" | "info";
    supporting_docs_needed: string[];
    details: string;
  }>;
  clarifications_needed: Array<{
    topic: string;
    question: string;
    urgency: "high" | "medium" | "low";
    context: string;
  }>;
  risk_assessment: {
    overall_risk: "low" | "medium" | "high";
    factors: string[];
    recommendations: string[];
  };
  approval_recommendation: "approve" | "conditional" | "reject" | "review_required";
};

interface AIAnalysisPanelProps {
  applicationId: string;
  customerId: string;
  loanType: string;
  requestedAmount: number;
  onRequestDocuments: (documents: string[]) => void;
}

export default function AIAnalysisPanel({
  applicationId,
  customerId,
  loanType,
  requestedAmount,
  onRequestDocuments
}: AIAnalysisPanelProps) {
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    missing: true,
    discrepancies: true,
    clarifications: true,
    risk: true
  });

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);
      console.log("Starting AI analysis...");

      const { data, error } = await supabase.functions.invoke('analyze-application', {
        body: {
          application_id: applicationId,
          loan_type: loanType,
          requested_amount: requestedAmount
        }
      });

      if (error) throw error;

      console.log("Analysis result:", data);
      setAnalysis(data.analysis);

      toast({
        title: "Analysis Complete",
        description: `AI reviewed the application and found ${data.analysis.missing_documents.length} missing documents and ${data.analysis.discrepancies.length} discrepancies`,
      });
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      case 'low': return 'bg-green-500/10 text-green-600 border-green-500/30';
      default: return '';
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'approve': return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'conditional': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      case 'reject': return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'review_required': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      default: return '';
    }
  };

  const requestAllMissingDocs = async () => {
    if (!analysis) return;
    
    const docs = analysis.missing_documents.map(d => d.document_name);
    onRequestDocuments(docs);
  };

  const requestSupportingDocs = async (discrepancy: any) => {
    onRequestDocuments(discrepancy.supporting_docs_needed);
  };

  if (!analysis) {
    return (
      <Card className="border-2 border-dashed border-accent/30">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <Brain className="w-12 h-12 text-accent/50" />
            <div>
              <h3 className="text-lg font-semibold mb-2">AI-Powered Application Review</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Let AI analyze this application to identify missing documents, flag discrepancies, 
                and assess risk factors automatically.
              </p>
            </div>
            <Button onClick={runAnalysis} disabled={analyzing} className="btn-primary">
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing Application...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Run AI Analysis
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Recommendation */}
      <Alert className={getRecommendationColor(analysis.approval_recommendation)}>
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {analysis.approval_recommendation === 'approve' && <CheckCircle2 className="w-5 h-5" />}
            {analysis.approval_recommendation === 'reject' && <XCircle className="w-5 h-5" />}
            {analysis.approval_recommendation === 'conditional' && <AlertTriangle className="w-5 h-5" />}
            {analysis.approval_recommendation === 'review_required' && <HelpCircle className="w-5 h-5" />}
            <span className="font-semibold">
              Recommendation: {analysis.approval_recommendation.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={runAnalysis}>
            Re-analyze
          </Button>
        </AlertDescription>
      </Alert>

      {/* Missing Documents */}
      {analysis.missing_documents.length > 0 && (
        <Card>
          <Collapsible open={expandedSections.missing} onOpenChange={() => toggleSection('missing')}>
            <CardHeader className="cursor-pointer" onClick={() => toggleSection('missing')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <CardTitle className="flex items-center gap-2">
                  <FileQuestion className="w-5 h-5 text-yellow-500" />
                  Missing Documents ({analysis.missing_documents.length})
                </CardTitle>
                {expandedSections.missing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                {analysis.missing_documents.map((doc, idx) => (
                  <div key={idx} className="p-3 border border-accent/20 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{doc.document_name}</span>
                          <Badge variant={doc.priority === 'high' ? 'destructive' : 'outline'} className="text-xs">
                            {doc.priority} priority
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{doc.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <Button onClick={requestAllMissingDocs} className="w-full btn-primary mt-2">
                  <FileText className="w-4 h-4 mr-2" />
                  Request All Missing Documents
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Discrepancies */}
      {analysis.discrepancies.length > 0 && (
        <Card>
          <Collapsible open={expandedSections.discrepancies} onOpenChange={() => toggleSection('discrepancies')}>
            <CardHeader className="cursor-pointer" onClick={() => toggleSection('discrepancies')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Discrepancies Found ({analysis.discrepancies.length})
                </CardTitle>
                {expandedSections.discrepancies ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                {analysis.discrepancies.map((disc, idx) => (
                  <div key={idx} className="p-3 border border-accent/20 rounded-lg space-y-2">
                    <div className="flex items-start gap-2">
                      {getSeverityIcon(disc.severity)}
                      <div className="flex-1">
                        <p className="font-medium">{disc.issue}</p>
                        <p className="text-sm text-muted-foreground mt-1">{disc.details}</p>
                        {disc.supporting_docs_needed.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold mb-1">Supporting docs needed:</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {disc.supporting_docs_needed.map((doc, i) => (
                                <li key={i}>• {doc}</li>
                              ))}
                            </ul>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => requestSupportingDocs(disc)}
                            >
                              Request These Documents
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Clarifications Needed */}
      {analysis.clarifications_needed.length > 0 && (
        <Card>
          <Collapsible open={expandedSections.clarifications} onOpenChange={() => toggleSection('clarifications')}>
            <CardHeader className="cursor-pointer" onClick={() => toggleSection('clarifications')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-500" />
                  Clarifications Needed ({analysis.clarifications_needed.length})
                </CardTitle>
                {expandedSections.clarifications ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                {analysis.clarifications_needed.map((clar, idx) => (
                  <div key={idx} className="p-3 border border-accent/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{clar.topic}</span>
                          <Badge variant="outline" className="text-xs">
                            {clar.urgency} urgency
                          </Badge>
                        </div>
                        <p className="text-sm mb-1">{clar.question}</p>
                        <p className="text-xs text-muted-foreground">{clar.context}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Risk Assessment */}
      <Card>
        <Collapsible open={expandedSections.risk} onOpenChange={() => toggleSection('risk')}>
          <CardHeader className="cursor-pointer" onClick={() => toggleSection('risk')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Risk Assessment
                <Badge className={getRiskColor(analysis.risk_assessment.overall_risk)}>
                  {analysis.risk_assessment.overall_risk.toUpperCase()} RISK
                </Badge>
              </CardTitle>
              {expandedSections.risk ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">Risk Factors:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {analysis.risk_assessment.factors.map((factor, idx) => (
                    <li key={idx}>• {factor}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Recommendations:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {analysis.risk_assessment.recommendations.map((rec, idx) => (
                    <li key={idx}>• {rec}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
