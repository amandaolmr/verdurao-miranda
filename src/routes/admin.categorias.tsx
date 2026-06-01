import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ImageUpload } from "@/components/ImageUpload";

export const Route = createFileRoute("/admin/categorias")({
  component: AdminCategorias,
});

// ── Linha arrastável ──────────────────────────────────────────────────────────
function SortableCategoria({
  categoria,
  onEdit,
  onRemove,
}: {
  categoria: any;
  onEdit: (c: any) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: categoria.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <button
            className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            aria-label="Arrastar para reordenar"
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
            {categoria.imagem_url && (
              <img
                src={categoria.imagem_url}
                alt={categoria.nome}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <p className="flex-1 font-bold">{categoria.nome}</p>
          <Button variant="ghost" size="icon" onClick={() => onEdit(categoria)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onRemove(categoria.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminCategorias() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .order("ordem", { ascending: true, nullsFirst: false })
      .order("nome");
    if (error) {
      setLoadError(error.message);
      console.error("[Categorias] Erro ao carregar:", error);
    }
    setItems(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const persistOrder = async (ordered: any[]) => {
    const updates = ordered.map((item, index) =>
      supabase
        .from("categorias")
        .update({ ordem: index + 1 })
        .eq("id", item.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) toast.error("Erro ao salvar ordem: " + failed.error.message);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    persistOrder(reordered);
  };

  const save = async () => {
    if (!editing.nome) {
      toast.error("Nome obrigatório");
      return;
    }
    const payload = {
      nome: editing.nome,
      imagem_url: editing.imagem_url || null,
      ativo: editing.ativo ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("categorias").update(payload).eq("id", editing.id)
      : await supabase.from("categorias").insert({ ...payload, ordem: items.length + 1 });
    if (error) toast.error(error.message);
    else {
      toast.success("Salvo");
      setOpen(false);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir?")) return;
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido");
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Categorias</h1>
        <Button
          className="gap-2"
          onClick={() => {
            setEditing({ nome: "", imagem_url: "", ativo: true });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nova
        </Button>
      </div>

      <p className="-mt-2 flex items-center gap-1 text-sm text-muted-foreground">
        <GripVertical className="h-4 w-4" /> Arraste para reordenar
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-3">
            {loadError && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                Erro ao carregar: {loadError}
              </p>
            )}
            {!loadError && items.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
            )}
            {items.map((c) => (
              <SortableCategoria
                key={c.id}
                categoria={c}
                onEdit={(cat) => {
                  setEditing({ ...cat });
                  setOpen(true);
                }}
                onRemove={remove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Nova"} categoria</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                />
              </div>
              <div>
                <Label>Imagem</Label>
                <ImageUpload
                  value={editing.imagem_url}
                  onChange={(url) => setEditing({ ...editing, imagem_url: url })}
                />
              </div>
              <Button onClick={save}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
