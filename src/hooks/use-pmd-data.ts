import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types matching database schema
export interface PmdProject {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export interface PmdCapitalProvider {
  id: string;
  name: string;
  type: string;
  default_interest_rate: number;
  created_at: string;
}

export interface PmdCapitalEvent {
  id: string;
  project_id: string;
  provider_id: string;
  event_date: string;
  event_type: string;
  amount: number;
  interest_flag: boolean;
  interest_rate_override: number | null;
  memo: string | null;
  created_at: string;
}

export interface PmdAsset {
  id: string;
  project_id: string;
  name: string;
  sale_value_assumption: number;
  commission_rate: number;
  created_at: string;
}

// Projects
export function useProjects() {
  return useQuery({
    queryKey: ["pmd-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pmd_projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PmdProject[];
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (project: { name: string; status?: string }) => {
      const { data, error } = await supabase
        .from("pmd_projects")
        .insert(project)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmd-projects"] });
      toast.success("Project created");
    },
    onError: (error) => {
      toast.error("Failed to create project: " + error.message);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...update }: Partial<PmdProject> & { id: string }) => {
      const { data, error } = await supabase
        .from("pmd_projects")
        .update(update)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmd-projects"] });
      toast.success("Project updated");
    },
    onError: (error) => {
      toast.error("Failed to update project: " + error.message);
    },
  });
}

// Capital Providers
export function useCapitalProviders() {
  return useQuery({
    queryKey: ["pmd-capital-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pmd_capital_providers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as PmdCapitalProvider[];
    },
  });
}

export function useCreateCapitalProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (provider: { name: string; type: string; default_interest_rate: number }) => {
      const { data, error } = await supabase
        .from("pmd_capital_providers")
        .insert(provider)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmd-capital-providers"] });
      toast.success("Capital provider created");
    },
    onError: (error) => {
      toast.error("Failed to create provider: " + error.message);
    },
  });
}

// Capital Events
export function useCapitalEvents(projectId?: string) {
  return useQuery({
    queryKey: ["pmd-capital-events", projectId],
    queryFn: async () => {
      let query = supabase
        .from("pmd_capital_events")
        .select("*")
        .order("event_date", { ascending: true });
      
      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PmdCapitalEvent[];
    },
  });
}

export function useCreateCapitalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: Omit<PmdCapitalEvent, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("pmd_capital_events")
        .insert(event)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmd-capital-events"] });
      toast.success("Capital event recorded");
    },
    onError: (error) => {
      toast.error("Failed to record event: " + error.message);
    },
  });
}

// Assets
export function useAssets(projectId?: string) {
  return useQuery({
    queryKey: ["pmd-assets", projectId],
    queryFn: async () => {
      let query = supabase
        .from("pmd_assets")
        .select("*")
        .order("name");
      
      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PmdAsset[];
    },
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (asset: Omit<PmdAsset, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("pmd_assets")
        .insert(asset)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmd-assets"] });
      toast.success("Asset created");
    },
    onError: (error) => {
      toast.error("Failed to create asset: " + error.message);
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...update }: Partial<PmdAsset> & { id: string }) => {
      const { data, error } = await supabase
        .from("pmd_assets")
        .update(update)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmd-assets"] });
      toast.success("Asset updated");
    },
    onError: (error) => {
      toast.error("Failed to update asset: " + error.message);
    },
  });
}
