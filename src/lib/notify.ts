import { useToast } from "@/hooks/use-toast";

export function useNotify() {
  const { toast } = useToast();
  return {
    success: (title: string, desc?: string) =>
      toast({ title, description: desc, className: "bg-green-600 text-white" }),
    error: (title: string, desc?: string) =>
      toast({ title, description: desc, variant: "destructive" }),
    info: (title: string, desc?: string) =>
      toast({ title, description: desc, className: "bg-neutral-800 text-white" }),
  };
}