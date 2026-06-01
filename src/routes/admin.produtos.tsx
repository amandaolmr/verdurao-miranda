import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { UNIDADES, formatUnidade } from "@/lib/utils";

export const Route = createFileRoute("/admin/produtos")({
  component: AdminProducts,
});

const PAGE_SIZE = 10;

function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const load = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("produtos").select("*, categorias(nome)").order("nome"),
      supabase.from("categorias").select("*").order("nome"),
    ]);
    setProducts(p || []);
    setCategories(c || []);
  };

  const filtered = products.filter((p) => {
    const matchCat = filterCat === "all" || p.categoria_id === filterCat;
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    load();
  }, []);

  const changeFilter = (cat: string) => {
    setFilterCat(cat);
    setPage(0);
  };
  const changeSearch = (s: string) => {
    setSearch(s);
    setPage(0);
  };

  const openNew = () => {
    setEditing({
      nome: "",
      preco: 0,
      unidade_venda: "KG",
      categoria_id: null,
      imagem_url: "",
      descricao: "",
      ativo: true,
      permite_fracionamento: false,
      quantidade_minima: null,
    });
    setOpen(true);
  };
  const openEdit = (p: any) => {
    setEditing({ ...p });
    setOpen(true);
  };

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
      permite_fracionamento: editing.permite_fracionamento ?? false,
      quantidade_minima:
        editing.permite_fracionamento && editing.quantidade_minima != null
          ? Number(editing.quantidade_minima) || null
          : null,
    };
    const { error } = editing.id
      ? await supabase.from("produtos").update(payload).eq("id", editing.id)
      : await supabase.from("produtos").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Salvo");
      setOpen(false);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido");
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Produtos</h1>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          className="w-full sm:w-60"
        />
        <Select value={filterCat} onValueChange={changeFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterCat !== "all" || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              changeFilter("all");
              changeSearch("");
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {paginated.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden">
                {p.imagem_url && (
                  <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold">{p.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {p.categorias?.nome || "—"} · R$ {Number(p.preco).toFixed(2).replace(".", ",")} /{" "}
                  {formatUnidade(p.unidade_venda)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground">Nenhum produto encontrado.</p>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo"} produto</DialogTitle>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.preco}
                    onChange={(e) => setEditing({ ...editing, preco: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Unidade de Venda</Label>
                  <Select
                    value={editing.unidade_venda}
                    onValueChange={(v) => setEditing({ ...editing, unidade_venda: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={editing.categoria_id || ""}
                  onValueChange={(v) => setEditing({ ...editing, categoria_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Imagem</Label>
                <ImageUpload
                  value={editing.imagem_url}
                  onChange={(url) => setEditing({ ...editing, imagem_url: url })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={editing.descricao || ""}
                  onChange={(e) => setEditing({ ...editing, descricao: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editing.permite_fracionamento ?? false}
                  onChange={(e) =>
                    setEditing({ ...editing, permite_fracionamento: e.target.checked })
                  }
                  className="h-4 w-4 rounded accent-primary"
                />
                <span className="text-sm">Permite quantidade fracionada (ex: 0,5 Kg)</span>
              </label>
              {editing.permite_fracionamento && (
                <div>
                  <Label>Quantidade mínima ({formatUnidade(editing.unidade_venda)})</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder={editing.unidade_venda === "G" ? "100" : "0.5"}
                    value={editing.quantidade_minima ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        quantidade_minima: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quantidade inicial sugerida ao abrir o seletor
                  </p>
                </div>
              )}
              <Button onClick={save}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
