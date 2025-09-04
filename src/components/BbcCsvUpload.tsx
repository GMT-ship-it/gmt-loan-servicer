import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BbcCsvUploadProps {
  bbcId: string;
  onUploadComplete?: () => void;
}

export function BbcCsvUpload({ bbcId, onUploadComplete }: BbcCsvUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const headers = ['item_type', 'ref', 'note', 'amount', 'ineligible', 'haircut_rate'];
    const csv = headers.join(',') + '\n' +
      'accounts_receivable,Invoice 123,,10000,false,0.00\n' +
      'inventory,SKU-456,,25000,false,0.10\n';
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bbc_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bbcId) return;

    try {
      setUploading(true);
      const text = await file.text();
      const rows = text.split(/\r?\n/).filter(Boolean);
      const [header, ...data] = rows;
      
      if (data.length === 0) {
        toast({
          title: "Error",
          description: "CSV file appears to be empty",
          variant: "destructive",
        });
        return;
      }

      const cols = header.split(',').map(s => s.trim().toLowerCase());
      const idx = (name: string) => cols.indexOf(name);

      const toBool = (s: string) => /^true$/i.test(s.trim());
      const toNumber = (s: string) => {
        const num = Number(s.trim());
        return isNaN(num) ? 0 : num;
      };

      const items = data.map(line => {
        const cells = line.split(',').map(cell => cell.trim());
        return {
          report_id: bbcId,
          item_type: cells[idx('item_type')] as any || 'accounts_receivable',
          ref: cells[idx('ref')] || null,
          note: cells[idx('note')] || null,
          amount: toNumber(cells[idx('amount')] || '0'),
          ineligible: toBool(cells[idx('ineligible')] || 'false'),
          haircut_rate: toNumber(cells[idx('haircut_rate')] || '0'),
        };
      }).filter(x => x.amount > 0);

      if (items.length === 0) {
        toast({
          title: "Error",
          description: "No valid items found in CSV file",
          variant: "destructive",
        });
        return;
      }

      // Insert items in chunks to avoid size limits
      const chunkSize = 500;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('borrowing_base_items')
          .insert(chunk);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Successfully uploaded ${items.length} items`,
      });

      // Clear the file input
      e.target.value = '';
      
      // Notify parent component
      onUploadComplete?.();

    } catch (error) {
      console.error('Error uploading CSV:', error);
      toast({
        title: "Error",
        description: "Failed to upload CSV file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={downloadTemplate}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download CSV Template
        </Button>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="csv-upload" className="cursor-pointer">
            <Button
              variant="outline"
              disabled={uploading}
              className="flex items-center gap-2"
              asChild
            >
              <span>
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload CSV'}
              </span>
            </Button>
          </Label>
          <Input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={uploadCsv}
            className="hidden"
            disabled={uploading}
          />
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        <p>Upload a CSV file with BBC items. The file should include columns: item_type, ref, note, amount, ineligible, haircut_rate</p>
      </div>
    </div>
  );
}