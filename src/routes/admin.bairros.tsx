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

export const Route = createFileRoute("/admin/bairros")({
  component: AdminBairros,
});

function AdminBairros() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("bairros").select("*").order("nome");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing.nome) { toast.error("Nome obrigatório"); return; }
    const payload = { nome: editing.nome, taxa_entrega: Number(editing.taxa_entrega) || 0, ativo: editing.ativo ?? true };
    const { error } = editing.id
      ? await supabase.from("bairros").update(payload).eq("id", editing.id)
      : await supabase.from("bairros").insert(payload);
    if (error) toast.error(error.message); else { toast.success("Salvo"); setOpen(false); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir?")) return;
    const { error } = await supabase.from("bairros").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bairros</h1>
        <Button className="gap-2" onClick={() => { setEditing({ nome: "", taxa_entrega: 0, ativo: true }); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>
      <div className="grid gap-3">
        {items.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-bold">{b.nome}</p>
                <p className="text-xs text-muted-foreground">Taxa: R$ {Number(b.taxa_entrega).toFixed(2).replace(".", ",")}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setEditing({ ...b }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-muted-foreground">Nenhum bairro cadastrado.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} bairro</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><Label>Taxa de entrega (R$)</Label><Input type="number" step="0.01" value={editing.taxa_entrega} onChange={(e) => setEditing({ ...editing, taxa_entrega: e.target.value })} /></div>
              <Button onClick={save}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
