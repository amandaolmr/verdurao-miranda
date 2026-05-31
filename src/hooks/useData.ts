import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });
}

export function useProducts(categoryId?: string) {
  return useQuery({
    queryKey: ["products", categoryId || "all"],
    queryFn: async () => {
      console.log("[useProducts] queryFn start", categoryId);
      let query = supabase
        .from("produtos")
        .select("*, categorias(nome)")
        .eq("ativo", true)
        .order("nome");
      if (categoryId) query = query.eq("categoria_id", categoryId);
      const { data, error } = await query;
      console.log("[useProducts] result", { count: data?.length, error: error?.message });
      if (error) throw error;
      return data;
    },
  });
}

export function useBairros() {
  return useQuery({
    queryKey: ["bairros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bairros")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });
}
