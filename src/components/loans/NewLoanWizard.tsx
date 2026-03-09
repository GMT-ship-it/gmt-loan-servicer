import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Borrower, Loan } from "@/types/domain";
import { sendEnvelope } from "@/services/docusign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

type ExtractedTerms = {
  loan_number?: string;
  principal?: number;
  interest_rate?: number;
  rate_type?: "fixed" | "variable";
  compounding_basis?: string;
  payment_frequency?: "monthly" | "biweekly" | "weekly";
  amortization_type?: "amortizing" | "interest_only";
  term_months?: number;
  first_payment_date?: string;
  origination_date?: string;
  balloon_amount?: number | null;
  grace_days?: number | null;
  late_fee_type?: "flat" | "percent" | null;
  late_fee_amount?: number | null;
  borrower_full_name?: string;
  borrower_email?: string;
};

type ParsedFields = Set<string>;

export function NewLoanWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [borrowerId, setBorrowerId] = useState<string>("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<string>("");
  const [parsedFields, setParsedFields] = useState<ParsedFields>(new Set());
  const [terms, setTerms] = useState<ExtractedTerms>({
    compounding_basis: "ACT/365",
    payment_frequency: "monthly",
    amortization_type: "amortizing",
    rate_type: "fixed",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadBorrowers();
  }, []);

  async function loadBorrowers() {
    const { data } = await supabase
      .from("borrowers")
      .select("*")
      .is("deleted_at", null)
      .order("legal_name");
    setBorrowers((data as Borrower[]) || []);
  }

  async function createBorrower(name: string, email: string) {
    try {
      const { data, error } = await supabase
        .from("borrowers")
        .insert({ legal_name: name, email } as any)
        .select()
        .single();

      if (error) throw error;

      setBorrowers((prev) => [data as Borrower, ...prev]);
      setBorrowerId(data.id);
      toast({ title: "Borrower created successfully" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  async function uploadDocs() {
    if (!files || !borrowerId) {
      toast({
        title: "Error",
        description: "Please select files and a borrower",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const folder = `ingest/${crypto.randomUUID()}`;
      setUploadFolder(folder);

      for (const file of Array.from(files)) {
        const path = `${folder}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("loan-documents")
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        await supabase.from("loan_documents").insert({
          file_path: path,
          doc_type: "uploaded",
        } as any);
      }

      toast({ title: "Documents uploaded successfully" });
      return folder;
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function extractTermsFromDocs(folder: string) {
    setExtracting(true);
    try {
      // List uploaded files in the folder
      const { data: listed, error: listErr } = await supabase.storage
        .from("loan-documents")
        .list(folder);

      if (listErr) throw listErr;

      // Create signed URLs for private bucket
      const filesWithUrls: { name: string; url: string }[] = [];
      for (const obj of listed || []) {
        const path = `${folder}/${obj.name}`;
        const { data: signed } = await supabase.storage
          .from("loan-documents")
          .createSignedUrl(path, 300); // 5 minutes

        if (signed?.signedUrl) {
          filesWithUrls.push({ name: obj.name, url: signed.signedUrl });
        }
      }

      if (filesWithUrls.length === 0) {
        throw new Error("No files found to extract");
      }

      // Call the Edge Function
      const { data: functionData, error: functionError } =
        await supabase.functions.invoke("ingest-extract", {
          body: { files: filesWithUrls },
        });

      if (functionError) throw functionError;

      const extracted = functionData?.extracted || {};
      console.log("Extracted terms:", extracted);

      // Track which fields were parsed
      const parsed = new Set<string>();
      Object.keys(extracted).forEach((key) => {
        if (extracted[key] !== undefined && extracted[key] !== null) {
          parsed.add(key);
        }
      });
      setParsedFields(parsed);

      // Update terms with extracted data (with fallbacks)
      setTerms((prev) => ({
        ...prev,
        loan_number: extracted.loan_number || `LN-${Math.floor(Math.random() * 1e6)}`,
        principal: extracted.principal ?? prev.principal ?? 250000,
        interest_rate: extracted.interest_rate ?? prev.interest_rate ?? 0.12,
        compounding_basis: extracted.compounding_basis || prev.compounding_basis || "ACT/365",
        payment_frequency: extracted.payment_frequency || prev.payment_frequency || "monthly",
        amortization_type: extracted.amortization_type || prev.amortization_type || "amortizing",
        rate_type: extracted.rate_type || prev.rate_type || "fixed",
        term_months: extracted.term_months ?? prev.term_months ?? 24,
        first_payment_date:
          extracted.first_payment_date ||
          prev.first_payment_date ||
          new Date().toISOString().slice(0, 10),
        origination_date:
          extracted.origination_date || new Date().toISOString().slice(0, 10),
        balloon_amount: extracted.balloon_amount ?? null,
        grace_days: extracted.grace_days ?? 10,
        late_fee_type: extracted.late_fee_type ?? null,
        late_fee_amount: extracted.late_fee_amount ?? null,
        borrower_full_name: extracted.borrower_full_name,
        borrower_email: extracted.borrower_email,
      }));

      // Update loan_documents with parsed JSON
      await supabase
        .from("loan_documents")
        .update({ parsed_json: extracted } as any)
        .ilike("file_path", `${folder}%`);

      toast({
        title: "Terms extracted",
        description: parsed.size > 0
          ? `Extracted ${parsed.size} field(s) from documents`
          : "Review and fill in the loan terms",
      });
    } catch (err: any) {
      console.error("Extract error:", err);
      toast({
        title: "Extraction failed",
        description: err.message || "Could not extract terms. Please fill manually.",
        variant: "destructive",
      });
      // Set defaults on error
      setTerms((prev) => ({
        ...prev,
        loan_number: prev.loan_number || `LN-${Math.floor(Math.random() * 1e6)}`,
        principal: prev.principal ?? 250000,
        interest_rate: prev.interest_rate ?? 0.12,
        term_months: prev.term_months ?? 24,
        first_payment_date:
          prev.first_payment_date || new Date().toISOString().slice(0, 10),
      }));
    } finally {
      setExtracting(false);
    }
  }

  async function createLoan() {
    if (!borrowerId || !terms.loan_number || !terms.principal) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required loan terms",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("loans")
        .insert({
          borrower_id: borrowerId,
          loan_number: terms.loan_number,
          principal: terms.principal,
          interest_rate: terms.interest_rate!,
          rate_type: terms.rate_type!,
          compounding_basis: terms.compounding_basis!,
          payment_frequency: terms.payment_frequency!,
          amortization_type: terms.amortization_type!,
          term_months: terms.term_months!,
          first_payment_date: terms.first_payment_date!,
          status: "active",
          balloon_amount: terms.balloon_amount,
          grace_days: terms.grace_days,
          late_fee_type: terms.late_fee_type,
          late_fee_amount: terms.late_fee_amount,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Link uploaded documents to the new loan
      if (uploadFolder && data?.id) {
        await supabase
          .from("loan_documents")
          .update({ loan_id: data.id, doc_type: "note" } as any)
          .ilike("file_path", `${uploadFolder}%`);
      }

      toast({ title: "Loan created successfully" });

      // Send DocuSign envelope internally
      try {
        const { data: borrowerInfo } = await supabase.from('borrowers').select('*').eq('id', borrowerId).single();
        if (borrowerInfo && borrowerInfo.email) {
            await sendEnvelope(data.id, borrowerInfo.email, borrowerInfo.legal_name || 'Borrower');
            // Mark as sent
            await supabase.from('loans').update({ status: 'pending_signature' }).eq('id', data.id);
            toast({ title: "DocuSign envelope sent automatically." });
        }
      } catch (err) {
        console.error("DocuSign error:", err);
        toast({ title: "Failed to send DocuSign envelope", variant: "destructive" });
      }


      onCreated();
    } catch (err: any) {
      toast({
        title: "Error creating loan",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-background rounded-2xl shadow-xl">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-2xl font-semibold">New Loan</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stepper */}
          <div className="flex gap-2">
            {["Borrower", "Documents", "Terms"].map((label, i) => (
              <div
                key={label}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-center transition-colors ${
                  step === i + 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}. {label}
              </div>
            ))}
          </div>

          {/* Step 1: Borrower */}
          {step === 1 && (
            <BorrowerStep
              borrowers={borrowers}
              borrowerId={borrowerId}
              setBorrowerId={setBorrowerId}
              createBorrower={createBorrower}
              onNext={() => setStep(2)}
            />
          )}

          {/* Step 2: Documents */}
          {step === 2 && (
            <DocumentsStep
              files={files}
              setFiles={setFiles}
              uploading={uploading}
              extracting={extracting}
              onBack={() => setStep(1)}
              onNext={async () => {
                const folder = await uploadDocs();
                if (folder) {
                  await extractTermsFromDocs(folder);
                }
                setStep(3);
              }}
            />
          )}

          {/* Step 3: Terms */}
          {step === 3 && (
            <TermsStep
              terms={terms}
              setTerms={setTerms}
              parsedFields={parsedFields}
              onBack={() => setStep(2)}
              onCreate={createLoan}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BorrowerStep({
  borrowers,
  borrowerId,
  setBorrowerId,
  createBorrower,
  onNext,
}: any) {
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <Label>Select Borrower</Label>
        <select
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2"
          value={borrowerId}
          onChange={(e) => setBorrowerId(e.target.value)}
        >
          <option value="">— Select a borrower —</option>
          {borrowers.map((b: Borrower) => (
            <option key={b.id} value={b.id}>
              {b.legal_name} · {b.email}
            </option>
          ))}
        </select>
      </div>

      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer font-medium">
          + Create new borrower
        </summary>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Full Name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              createBorrower(newName, newEmail);
              setNewName("");
              setNewEmail("");
            }}
          >
            Create Borrower
          </Button>
        </div>
      </details>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!borrowerId}>
          Next →
        </Button>
      </div>
    </div>
  );
}

function DocumentsStep({
  files,
  setFiles,
  uploading,
  extracting,
  onBack,
  onNext,
}: any) {
  return (
    <div className="space-y-6">
      <div>
        <Label>Upload Loan Documents (PDF)</Label>
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={(e) => setFiles(e.target.files)}
          className="mt-2 w-full"
        />
        {files && (
          <div className="mt-2 text-sm text-muted-foreground">
            {files.length} file(s) selected
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          AI will extract loan terms from your documents automatically
        </p>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onNext} disabled={!files || uploading || extracting}>
          {uploading
            ? "Uploading..."
            : extracting
            ? "Extracting terms..."
            : "Upload & Extract →"}
        </Button>
      </div>
    </div>
  );
}

function ParsedBadge({ field, parsedFields }: { field: string; parsedFields: ParsedFields }) {
  if (!parsedFields.has(field)) return null;
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      parsed
    </span>
  );
}

function TermsStep({ terms, setTerms, parsedFields, onBack, onCreate }: any) {
  return (
    <div className="space-y-6">
      {parsedFields?.size > 0 && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-900 dark:text-blue-200">
          ✓ Extracted {parsedFields.size} field(s) from documents. Review and
          edit as needed.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>
            Loan Number
            <ParsedBadge field="loan_number" parsedFields={parsedFields} />
          </Label>
          <Input
            value={terms.loan_number || ""}
            onChange={(e) =>
              setTerms({ ...terms, loan_number: e.target.value })
            }
          />
        </div>
        <div>
          <Label>
            Principal
            <ParsedBadge field="principal" parsedFields={parsedFields} />
          </Label>
          <Input
            type="number"
            value={terms.principal || ""}
            onChange={(e) =>
              setTerms({ ...terms, principal: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Label>
            Interest Rate (decimal, e.g., 0.12)
            <ParsedBadge field="interest_rate" parsedFields={parsedFields} />
          </Label>
          <Input
            type="number"
            step="0.001"
            value={terms.interest_rate || ""}
            onChange={(e) =>
              setTerms({ ...terms, interest_rate: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Label>
            Term (months)
            <ParsedBadge field="term_months" parsedFields={parsedFields} />
          </Label>
          <Input
            type="number"
            value={terms.term_months || ""}
            onChange={(e) =>
              setTerms({ ...terms, term_months: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Label>
            First Payment Date
            <ParsedBadge
              field="first_payment_date"
              parsedFields={parsedFields}
            />
          </Label>
          <Input
            type="date"
            value={terms.first_payment_date || ""}
            onChange={(e) =>
              setTerms({ ...terms, first_payment_date: e.target.value })
            }
          />
        </div>
        <div>
          <Label>
            Payment Frequency
            <ParsedBadge
              field="payment_frequency"
              parsedFields={parsedFields}
            />
          </Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            value={terms.payment_frequency}
            onChange={(e) =>
              setTerms({ ...terms, payment_frequency: e.target.value })
            }
          >
            <option value="monthly">Monthly</option>
            <option value="biweekly">Biweekly</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div>
          <Label>
            Day Count Basis
            <ParsedBadge
              field="compounding_basis"
              parsedFields={parsedFields}
            />
          </Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            value={terms.compounding_basis}
            onChange={(e) =>
              setTerms({ ...terms, compounding_basis: e.target.value })
            }
          >
            <option value="ACT/365">ACT/365</option>
            <option value="30/360">30/360</option>
          </select>
        </div>
        <div>
          <Label>
            Grace Days
            <ParsedBadge field="grace_days" parsedFields={parsedFields} />
          </Label>
          <Input
            type="number"
            value={terms.grace_days || ""}
            onChange={(e) =>
              setTerms({ ...terms, grace_days: Number(e.target.value) })
            }
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onCreate}>Create Loan</Button>
      </div>
    </div>
  );
}
