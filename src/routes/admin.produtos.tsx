import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/produtos")({
  component: AdminProducts,
});

function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("produtos").select("*, categorias(nome)").order("nome"),
      supabase.from("categorias").select("*").order("nome"),
    ]);
    setProducts(p || []);
    setCategories(c || []);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing({ nome: "", preco: 0, unidade_venda: "Kg", categoria_id: null, imagem_url: "", descricao: "", ativo: true }); setOpen(true); };
  const openEdit = (p: any) => { setEditing({ ...p }); setOpen(true); };

  const save = async () => {
    if (!editing.nome || !editing.preco || !editing.unidade_venda) {
      toast.error("Preencha nome, preço e unidade.");
      return;
    }
    const payload = {
      nome: editing.nome,
      preco: Number(editing.preco),
      unidade_venda: editing.unidade_venda,
      categoria_id: editing.categoria_id || null,
      imagem_url: editing.imagem_url || null,
      descricao: editing.descricao || null,
      ativo: editing.ativo ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("produtos").update(payload).eq("id", editing.id)
      : await supabase.from("produtos").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Salvo"); setOpen(false); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Produtos</h1>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo</Button>
      </div>

      <div className="grid gap-3">
        {products.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden">
                {p.imagem_url && <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="font-bold">{p.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {p.categorias?.nome || "—"} · R$ {Number(p.preco).toFixed(2).replace(".", ",")} / {p.unidade_venda}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && <p className="text-muted-foreground">Nenhum produto cadastrado.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} produto</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço</Label><Input type="number" step="0.01" value={editing.preco} onChange={(e) => setEditing({ ...editing, preco: e.target.value })} /></div>
                <div><Label>Unidade</Label><Input value={editing.unidade_venda} onChange={(e) => setEditing({ ...editing, unidade_venda: e.target.value })} /></div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={editing.categoria_id || ""} onValueChange={(v) => setEditing({ ...editing, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Imagem (URL)</Label><Input value={editing.imagem_url || ""} onChange={(e) => setEditing({ ...editing, imagem_url: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={editing.descricao || ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
              <Button onClick={save}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
