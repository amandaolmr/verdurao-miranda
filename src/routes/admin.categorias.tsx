import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categorias")({
  component: AdminCategorias,
});

function AdminCategorias() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("categorias").select("*").order("nome");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing.nome) { toast.error("Nome obrigatório"); return; }
    const payload = { nome: editing.nome, imagem_url: editing.imagem_url || null, ativo: editing.ativo ?? true };
    const { error } = editing.id
      ? await supabase.from("categorias").update(payload).eq("id", editing.id)
      : await supabase.from("categorias").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Salvo"); setOpen(false); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir?")) return;
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Categorias</h1>
        <Button className="gap-2" onClick={() => { setEditing({ nome: "", imagem_url: "", ativo: true }); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Nova
        </Button>
      </div>
      <div className="grid gap-3">
        {items.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden">
                {c.imagem_url && <img src={c.imagem_url} alt={c.nome} className="h-full w-full object-cover" />}
              </div>
              <p className="flex-1 font-bold">{c.nome}</p>
              <Button variant="ghost" size="icon" onClick={() => { setEditing({ ...c }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><Label>Imagem (URL)</Label><Input value={editing.imagem_url || ""} onChange={(e) => setEditing({ ...editing, imagem_url: e.target.value })} /></div>
              <Button onClick={save}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
