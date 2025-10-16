import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, FileText, Upload, Check, Clock, AlertCircle, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentRequest {
  id: string;
  document_template_id: string | null;
  custom_document_name: string | null;
  status: 'pending' | 'uploaded' | 'approved' | 'rejected';
  due_date: string | null;
  reviewer_notes: string | null;
  requested_at: string;
  document_templates: {
    name: string;
    description: string | null;
  } | null;
  application_documents: Array<{
    id: string;
    file_path: string;
    original_name: string | null;
    size_bytes: number | null;
    uploaded_at: string;
  }>;
}

export default function BorrowerDocuments() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    loadDocumentRequests();
  }, []);

  const loadDocumentRequests = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get customer ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('customer_id')
        .eq('id', session.user.id)
        .single();

      if (!profile?.customer_id) {
        toast({
          title: "No Application Found",
          description: "Please submit an application first",
          variant: "destructive",
        });
        return;
      }

      setCustomerId(profile.customer_id);

      const { data, error } = await supabase
        .from('document_requests')
        .select(`
          *,
          document_templates (name, description),
          application_documents (id, file_path, original_name, size_bytes, uploaded_at)
        `)
        .eq('customer_id', profile.customer_id)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as DocumentRequest[]);
    } catch (error: any) {
      console.error('Error loading requests:', error);
      toast({
        title: "Error",
        description: "Failed to load document requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (requestId: string, file: File) => {
    if (!customerId) return;

    try {
      setUploading(requestId);

      // Upload to storage
      const filePath = `${customerId}/${requestId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('application-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: { session } } = await supabase.auth.getSession();
      const { error: docError } = await supabase
        .from('application_documents')
        .insert({
          document_request_id: requestId,
          file_path: filePath,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: session?.user.id,
        });

      if (docError) throw docError;

      // Update request status
      const { error: statusError } = await supabase
        .from('document_requests')
        .update({
          status: 'uploaded',
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (statusError) throw statusError;

      toast({
        title: "Document Uploaded",
        description: "Your document has been submitted successfully",
      });

      await loadDocumentRequests();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('application-documents')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (docId: string, filePath: string, requestId: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('application-documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete record
      const { error: dbError } = await supabase
        .from('application_documents')
        .delete()
        .eq('id', docId);

      if (dbError) throw dbError;

      // Check if there are any remaining documents for this request
      const { data: remainingDocs } = await supabase
        .from('application_documents')
        .select('id')
        .eq('document_request_id', requestId);

      if (!remainingDocs || remainingDocs.length === 0) {
        // Reset status to pending
        await supabase
          .from('document_requests')
          .update({ status: 'pending', uploaded_at: null })
          .eq('id', requestId);
      }

      toast({
        title: "Document Deleted",
        description: "The document has been removed",
      });

      await loadDocumentRequests();
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploaded':
        return <Badge className="bg-blue-500/10 text-blue-500"><Clock className="w-3 h-3 mr-1" />Under Review</Badge>;
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-500"><Check className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline"><Upload className="w-3 h-3 mr-1" />Pending Upload</Badge>;
    }
  };

  const completedCount = requests.filter(r => r.status === 'approved' || r.status === 'uploaded').length;
  const progress = requests.length > 0 ? (completedCount / requests.length) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Requested Documents</CardTitle>
          <CardDescription>No documents have been requested yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Your lender will request documents as part of the application review process
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Document Requests</CardTitle>
              <CardDescription>{completedCount} of {requests.length} documents submitted</CardDescription>
            </div>
            <span className="text-2xl font-bold">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {requests.map((request) => {
          const docName = request.document_templates?.name || request.custom_document_name || 'Document';
          const hasUpload = request.application_documents.length > 0;
          const isDueAndPending = request.due_date && request.status === 'pending' && new Date(request.due_date) < new Date();

          return (
            <Card key={request.id} className="card-surface">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-5 h-5 text-accent" />
                        <h3 className="font-semibold">{docName}</h3>
                      </div>
                      {request.document_templates?.description && (
                        <p className="text-sm text-muted-foreground">{request.document_templates.description}</p>
                      )}
                      {request.due_date && (
                        <p className={`text-sm mt-2 ${isDueAndPending ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          Due: {new Date(request.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  {request.reviewer_notes && request.status === 'rejected' && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      <p className="text-sm text-destructive">
                        <strong>Note:</strong> {request.reviewer_notes}
                      </p>
                    </div>
                  )}

                  {/* Uploaded Documents */}
                  {hasUpload && (
                    <div className="space-y-2">
                      {request.application_documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 bg-accent/5 rounded-lg">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.original_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.size_bytes ? `${(doc.size_bytes / 1024).toFixed(1)} KB` : ''} • 
                              Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(doc.file_path, doc.original_name || 'document')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            {request.status === 'pending' || request.status === 'rejected' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(doc.id, doc.file_path, request.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Button */}
                  {(request.status === 'pending' || request.status === 'rejected') && (
                    <div>
                      <Input
                        type="file"
                        id={`file-${request.id}`}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(request.id, file);
                        }}
                        disabled={uploading === request.id}
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => document.getElementById(`file-${request.id}`)?.click()}
                        disabled={uploading === request.id}
                      >
                        {uploading === request.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            {hasUpload ? 'Upload Another File' : 'Upload Document'}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
