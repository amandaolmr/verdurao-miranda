import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { useCart } from "@/hooks/useCart";
import { useBairros } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShoppingBag, CreditCard, Banknote, QrCode } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { data: bairros = [] } = useBairros();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    rua: "",
    numero: "",
    complemento: "",
    referencia: "",
    bairroId: "",
    pagamento: "pix",
  });

  const taxaEntrega = useMemo(() => {
    const b = bairros.find((x: any) => x.id === form.bairroId);
    return b ? Number(b.taxa_entrega) : 0;
  }, [form.bairroId, bairros]);

  const total = subtotal + taxaEntrega;

  const onChange = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bairroId) {
      toast.error("Selecione o bairro de entrega.");
      return;
    }
    if (items.length === 0) {
      toast.error("Seu carrinho está vazio.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: pedido, error } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: user.user?.id ?? null,
          nome_cliente: form.nome,
          telefone: form.telefone,
          rua: form.rua,
          numero: form.numero,
          complemento: form.complemento || null,
          referencia: form.referencia || null,
          bairro_id: form.bairroId,
          forma_pagamento: form.pagamento,
          subtotal,
          taxa_entrega: taxaEntrega,
          valor_total: total,
          status: "pendente",
        })
        .select()
        .single();
      if (error) throw error;

      const itensPayload = items.map((it) => ({
        pedido_id: pedido.id,
        produto_id: it.id,
        quantidade: it.quantidade,
        valor_unitario: it.preco,
        valor_total: it.preco * it.quantidade,
      }));
      const { error: errItens } = await supabase.from("itens_pedido").insert(itensPayload);
      if (errItens) throw errItens;

      clearCart();
      toast.success("Pedido realizado com sucesso!");
      navigate({ to: "/pedidos" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao finalizar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-4">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Seu carrinho está vazio</h1>
          <Link to="/"><Button>Voltar às compras</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-3xl font-black tracking-tight mb-6">Finalizar Compra</h1>
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Contato</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2"><Label>Nome completo</Label>
                  <Input value={form.nome} onChange={(e) => onChange("nome", e.target.value)} required />
                </div>
                <div className="grid gap-2"><Label>Telefone (WhatsApp)</Label>
                  <Input value={form.telefone} onChange={(e) => onChange("telefone", e.target.value)} required placeholder="(00) 99999-9999" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Endereço de entrega</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2"><Label>Rua</Label>
                  <Input value={form.rua} onChange={(e) => onChange("rua", e.target.value)} required />
                </div>
                <div className="grid gap-2"><Label>Número</Label>
                  <Input value={form.numero} onChange={(e) => onChange("numero", e.target.value)} required />
                </div>
                <div className="grid gap-2"><Label>Complemento</Label>
                  <Input value={form.complemento} onChange={(e) => onChange("complemento", e.target.value)} />
                </div>
                <div className="grid gap-2 md:col-span-2"><Label>Bairro</Label>
                  <Select value={form.bairroId} onValueChange={(v) => onChange("bairroId", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione seu bairro" /></SelectTrigger>
                    <SelectContent>
                      {bairros.length === 0 ? (
                        <SelectItem value="-" disabled>Nenhum bairro cadastrado</SelectItem>
                      ) : bairros.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.nome} — R$ {Number(b.taxa_entrega).toFixed(2).replace(".", ",")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 md:col-span-2"><Label>Ponto de referência</Label>
                  <Input value={form.referencia} onChange={(e) => onChange("referencia", e.target.value)} placeholder="Próximo a..." />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Forma de pagamento</CardTitle></CardHeader>
              <CardContent>
                <RadioGroup value={form.pagamento} onValueChange={(v) => onChange("pagamento", v)} className="grid gap-3">
                  <label className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="pix" id="pix" />
                    <QrCode className="h-5 w-5 text-primary" />
                    <span className="font-medium">PIX (na entrega)</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="cartao" id="cartao" />
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="font-medium">Cartão (na entrega)</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="dinheiro" id="dinheiro" />
                    <Banknote className="h-5 w-5 text-primary" />
                    <span className="font-medium">Dinheiro</span>
                  </label>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {items.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm">
                      <span className="truncate pr-2">{it.quantidade}x {it.nome}</span>
                      <span className="font-medium whitespace-nowrap">
                        R$ {(it.preco * it.quantidade).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Entrega</span>
                  <span>{form.bairroId ? `R$ ${taxaEntrega.toFixed(2).replace(".", ",")}` : "—"}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-black">
                  <span>Total</span>
                  <span className="text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
                <Button type="submit" disabled={submitting} className="w-full rounded-2xl py-6 text-base font-bold">
                  {submitting ? "Enviando..." : "Confirmar Pedido"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </main>
    </div>
  );
}
