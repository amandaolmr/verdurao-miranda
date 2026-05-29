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
    queryKey: ["products", categoryId],
    queryFn: async () => {
      let query = supabase
        .from("produtos")
        .select(`
          *,
          categorias (
            nome
          )
        `)
        .eq("ativo", true);
      
      if (categoryId) {
        query = query.eq("categoria_id", categoryId);
      }
      
      const { data, error } = await supabase.from("produtos").select("*").eq("ativo", true);
      // Re-doing query properly with filter if categoryId
      let finalQuery = supabase.from("produtos").select("*, categorias(nome)").eq("ativo", true);
      if (categoryId) {
        finalQuery = finalQuery.eq("categoria_id", categoryId);
      }
      
      const { data: result, error: fetchError } = await finalQuery;

      if (fetchError) throw fetchError;
      return result;
    },
  });
}
