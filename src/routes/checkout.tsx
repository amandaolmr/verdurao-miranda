import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { useCart } from "@/hooks/useCart";
import { useBairros } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { formatUnidade } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  LogIn,
  MapPin,
  Pencil,
  X,
  Truck,
  Store,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import { useConfig } from "@/hooks/useConfig";

function maskMoeda(value: string): string {
  const nums = value.replace(/\D/g, "");
  if (!nums) return "";
  const n = parseInt(nums, 10) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function maskTelefone(value: string): string {
  const nums = value.replace(/\D/g, "").slice(0, 11);
  if (nums.length === 0) return "";
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { data: bairros = [] } = useBairros();
  const config = useConfig();
  const { user, loading: authChecking } = useAuth();
  const isLoggedIn = !!user;
  const userId = user?.id ?? null;
  const userMeta = {
    nome: user?.user_metadata?.nome ?? user?.user_metadata?.full_name ?? "",
    telefone: user?.user_metadata?.telefone ?? "",
  };
  const [submitting, setSubmitting] = useState(false);
  const [enderecos, setEnderecos] = useState<any[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [editingAddr, setEditingAddr] = useState(false);
  const [tipoRecebimento, setTipoRecebimento] = useState<"entrega" | "retirada">("entrega");
  const [precisaTroco, setPrecisaTroco] = useState<"sim" | "nao" | "">("");
  const [valorTroco, setValorTroco] = useState("");
  const [pedidoSucesso, setPedidoSucesso] = useState<{ waUrl?: string } | null>(null);

  // Auto-fill form from saved profile + addresses
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: cliente }, { data: addrs }] = await Promise.all([
        supabase.from("clientes").select("nome, telefone").eq("id", userId).maybeSingle(),
        supabase
          .from("enderecos_cliente")
          .select("*, bairros(nome)")
          .eq("cliente_id", userId)
          .order("principal", { ascending: false }),
      ]);
      const lista = addrs ?? [];
      setEnderecos(lista);
      const principal = lista.find((a: any) => a.principal) ?? lista[0] ?? null;
      if (principal) setSelectedAddrId(principal.id);
      setForm((prev) => ({
        ...prev,
        nome: cliente?.nome || userMeta.nome || "",
        telefone: cliente?.telefone || userMeta.telefone || "",
        rua: principal?.rua || "",
        numero: principal?.numero || "",
        complemento: principal?.complemento || "",
        referencia: principal?.referencia || "",
        bairroId: principal?.bairro_id || "",
      }));
    })();
  }, [userId]);

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
    if (tipoRecebimento === "retirada") return 0;
    const b = bairros.find((x: any) => x.id === form.bairroId);
    return b ? Number(b.taxa_entrega) : 0;
  }, [form.bairroId, bairros, tipoRecebimento]);

  const total = subtotal + taxaEntrega;

  const onChange = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const applyAddr = (addr: any) => {
    setSelectedAddrId(addr.id);
    setForm((p) => ({
      ...p,
      rua: addr.rua || "",
      numero: addr.numero || "",
      complemento: addr.complemento || "",
      referencia: addr.referencia || "",
      bairroId: addr.bairro_id || "",
    }));
  };

  const selectedAddr = enderecos.find((a) => a.id === selectedAddrId) ?? null;
  const hasAddr = enderecos.length > 0;
  const showSummary = hasAddr && !editingAddr;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tipoRecebimento === "entrega" && !form.bairroId) {
      toast.error("Selecione o bairro de entrega.");
      return;
    }
    if (tipoRecebimento === "entrega" && !form.rua.trim()) {
      toast.error("Informe a rua para entrega.");
      return;
    }
    if (tipoRecebimento === "entrega" && !form.numero.trim()) {
      toast.error("Informe o número para entrega.");
      return;
    }
    if (items.length === 0) {
      toast.error("Seu carrinho está vazio.");
      return;
    }
    const minimo = Number(config?.valor_minimo_pedido) || 0;
    if (minimo > 0 && subtotal < minimo) {
      toast.error(
        `Valor mínimo do pedido é R$ ${minimo.toFixed(2).replace(".", ",")}. Adicione mais itens ao carrinho.`,
      );
      return;
    }
    if (form.pagamento === "dinheiro" && precisaTroco === "sim") {
      const valorNum = parseFloat(valorTroco.replace(/\./g, "").replace(",", "."));
      if (!valorTroco || isNaN(valorNum) || valorNum < total) {
        toast.error(
          `Informe um valor de troco igual ou maior que o total (R$ ${total.toFixed(2).replace(".", ",")}).`,
        );
        return;
      }
    }
    setSubmitting(true);
    try {
      // Garantir que o cliente existe na tabela antes de inserir o pedido (FK)
      if (userId) {
        await supabase
          .from("clientes")
          .upsert({ id: userId, nome: form.nome, telefone: form.telefone }, { onConflict: "id" });
      }

      const { data: pedido, error } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: userId,
          nome_cliente: form.nome,
          telefone: form.telefone,
          tipo_recebimento: tipoRecebimento === "retirada" ? "RETIRADA" : "ENTREGA",
          rua: tipoRecebimento === "entrega" ? form.rua : "",
          numero: tipoRecebimento === "entrega" ? form.numero : "",
          complemento: tipoRecebimento === "entrega" ? form.complemento || null : null,
          referencia: tipoRecebimento === "entrega" ? form.referencia || null : null,
          bairro_id: tipoRecebimento === "entrega" ? form.bairroId : null,
          forma_pagamento: form.pagamento,
          precisa_troco: form.pagamento === "dinheiro" ? precisaTroco === "sim" : null,
          valor_troco:
            form.pagamento === "dinheiro" && precisaTroco === "sim"
              ? parseFloat(valorTroco.replace(/\./g, "").replace(",", "."))
              : null,
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

      // Atualizar endereço para compras futuras (somente entrega)
      if (userId && tipoRecebimento === "entrega") {
        const { data: existingAddr } = await supabase
          .from("enderecos_cliente")
          .select("id")
          .eq("cliente_id", userId)
          .eq("principal", true)
          .maybeSingle();
        if (existingAddr) {
          await supabase
            .from("enderecos_cliente")
            .update({
              rua: form.rua,
              numero: form.numero,
              complemento: form.complemento || null,
              referencia: form.referencia || null,
              bairro_id: form.bairroId,
            })
            .eq("id", existingAddr.id);
        } else {
          await supabase.from("enderecos_cliente").insert({
            cliente_id: userId,
            rua: form.rua,
            numero: form.numero,
            complemento: form.complemento || null,
            referencia: form.referencia || null,
            bairro_id: form.bairroId,
            principal: true,
          });
        }
      }

      clearCart();

      // Monta URL do WhatsApp (não abre automaticamente para evitar bloqueio de popup)
      let waUrl: string | undefined;
      if (config?.whatsapp) {
        const numero = config.whatsapp.replace(/\D/g, "");
        const fone = numero.startsWith("55") ? numero : `55${numero}`;
        const pagamentoLabel: Record<string, string> = {
          pix: "PIX",
          cartao_credito: "Cartão de Crédito",
          cartao_debito: "Cartão de Débito",
          dinheiro: "Dinheiro",
        };
        const bairroNome = bairros.find((b: any) => b.id === form.bairroId)?.nome ?? "";
        const linhasItens = items
          .map((it) => {
            const qty = it.permite_fracionamento
              ? `${it.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${formatUnidade(it.unidade_venda)}`
              : `${it.quantidade}x`;
            const subtotalItem = (it.preco * it.quantidade).toFixed(2).replace(".", ",");
            return `• ${qty} ${it.nome} — R$ ${subtotalItem}`;
          })
          .join("\n");
        const enderecoBloco =
          tipoRecebimento === "entrega"
            ? `*Entrega em:*\n${form.rua}, ${form.numero}${form.complemento ? ` — ${form.complemento}` : ""}${form.referencia ? `\nRef: ${form.referencia}` : ""}\nBairro ${bairroNome}`
            : `*Retirada na loja*`;
        const trocoBloco =
          form.pagamento === "dinheiro" && precisaTroco === "sim" && valorTroco
            ? `\n*Troco para:* R$ ${valorTroco}`
            : form.pagamento === "dinheiro" && precisaTroco === "nao"
              ? "\n*Sem troco necessário*"
              : "";
        const msg = [
          `*${config.nome_loja || "Verdurão Miranda"}*`,
          `*Pedido #${pedido.id.slice(0, 8).toUpperCase()}*`,
          ``,
          `*Cliente:* ${form.nome}`,
          `*Telefone:* ${form.telefone}`,
          ``,
          `*Itens:*`,
          linhasItens,
          ``,
          `*Subtotal:* R$ ${subtotal.toFixed(2).replace(".", ",")}`,
          taxaEntrega > 0
            ? `*Taxa de entrega:* R$ ${taxaEntrega.toFixed(2).replace(".", ",")}`
            : null,
          `*Total:* R$ ${total.toFixed(2).replace(".", ",")}`,
          ``,
          enderecoBloco,
          ``,
          `*Pagamento:* ${pagamentoLabel[form.pagamento] ?? form.pagamento}${trocoBloco}`,
        ]
          .filter((l) => l !== null)
          .join("\n");
        waUrl = `https://wa.me/${fone}?text=${encodeURIComponent(msg)}`;
      }

      setPedidoSucesso({ waUrl });
      toast.success("Pedido realizado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao finalizar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-md text-center">
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-sm text-center space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-primary/10 p-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Faça login para continuar</h1>
            <p className="text-muted-foreground text-sm">
              Para finalizar sua compra, você precisa estar logado na sua conta.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link to="/login">
              <Button className="w-full" size="lg">
                Entrar na minha conta
              </Button>
            </Link>
            <Link to="/cadastro">
              <Button variant="outline" className="w-full" size="lg">
                Criar conta grátis
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (pedidoSucesso) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-5">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Pedido realizado!</h1>
            <p className="text-muted-foreground text-sm">
              Seu pedido foi recebido. Clique no botão abaixo para enviar os detalhes pelo WhatsApp
              e confirmar com a loja.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {pedidoSucesso.waUrl && (
              <a href={pedidoSucesso.waUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white" size="lg">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Enviar Pedido pelo WhatsApp
                </Button>
              </a>
            )}
            <Link to="/pedidos">
              <Button variant="outline" className="w-full" size="lg">
                Ver meus pedidos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-4">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Seu carrinho está vazio</h1>
          <Link to="/">
            <Button>Voltar às compras</Button>
          </Link>
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
              <CardHeader>
                <CardTitle>Contato</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => onChange("nome", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone (WhatsApp)</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => onChange("telefone", maskTelefone(e.target.value))}
                    required
                    placeholder="(83) 99999-9999"
                    maxLength={15}
                    inputMode="numeric"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Como deseja receber?</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={tipoRecebimento}
                  onValueChange={(v) => setTipoRecebimento(v as "entrega" | "retirada")}
                  className="grid gap-3"
                >
                  <label className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="entrega" id="tipo-entrega" />
                    <Truck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Entrega</p>
                      <p className="text-xs text-muted-foreground">Receba em casa</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="retirada" id="tipo-retirada" />
                    <Store className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Retirar no Estabelecimento</p>
                      <p className="text-xs text-muted-foreground">Sem taxa de entrega</p>
                    </div>
                  </label>
                </RadioGroup>
              </CardContent>
            </Card>

            {tipoRecebimento === "entrega" && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Endereço de Entrega
                  </CardTitle>
                  {showSummary && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingAddr(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  )}
                  {editingAddr && hasAddr && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        if (selectedAddr) applyAddr(selectedAddr);
                        setEditingAddr(false);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {showSummary ? (
                    <div className="space-y-3">
                      {enderecos.length > 1 && (
                        <Select
                          value={selectedAddrId ?? ""}
                          onValueChange={(v) => {
                            const addr = enderecos.find((a) => a.id === v);
                            if (addr) applyAddr(addr);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar endereço" />
                          </SelectTrigger>
                          <SelectContent>
                            {enderecos.map((a: any) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.rua}, {a.numero}
                                {a.principal ? " (principal)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {selectedAddr && (
                        <div className="rounded-xl bg-muted/50 p-4 space-y-1 text-sm">
                          <p className="font-semibold">
                            {selectedAddr.rua}, {selectedAddr.numero}
                          </p>
                          {selectedAddr.complemento && (
                            <p className="text-muted-foreground">
                              Complemento: {selectedAddr.complemento}
                            </p>
                          )}
                          <p className="text-muted-foreground">
                            Bairro:{" "}
                            {(selectedAddr as any).bairros?.nome ||
                              bairros.find((b: any) => b.id === selectedAddr.bairro_id)?.nome ||
                              "—"}
                          </p>
                          {selectedAddr.referencia && (
                            <p className="text-muted-foreground">
                              Referência: {selectedAddr.referencia}
                            </p>
                          )}
                          {taxaEntrega > 0 && (
                            <p className="text-primary font-medium pt-1">
                              Taxa de entrega: R$ {taxaEntrega.toFixed(2).replace(".", ",")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2 md:col-span-2">
                        <Label>Rua</Label>
                        <Input
                          value={form.rua}
                          onChange={(e) => onChange("rua", e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Número</Label>
                        <Input
                          value={form.numero}
                          onChange={(e) => onChange("numero", e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Complemento</Label>
                        <Input
                          value={form.complemento}
                          onChange={(e) => onChange("complemento", e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label>Bairro</Label>
                        <Select
                          value={form.bairroId}
                          onValueChange={(v) => onChange("bairroId", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione seu bairro" />
                          </SelectTrigger>
                          <SelectContent>
                            {bairros.length === 0 ? (
                              <SelectItem value="-" disabled>
                                Nenhum bairro cadastrado
                              </SelectItem>
                            ) : (
                              bairros.map((b: any) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.nome} — R${" "}
                                  {Number(b.taxa_entrega).toFixed(2).replace(".", ",")}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label>Ponto de referência</Label>
                        <Input
                          value={form.referencia}
                          onChange={(e) => onChange("referencia", e.target.value)}
                          placeholder="Próximo a..."
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {tipoRecebimento === "retirada" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Retirada no Estabelecimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm">
                    {config?.rua && (
                      <p className="font-semibold">
                        {config.rua}
                        {config.numero ? `, ${config.numero}` : ""}
                        {config.bairro ? ` — ${config.bairro}` : ""}
                      </p>
                    )}
                    {config?.cidade && <p className="text-muted-foreground">{config.cidade}</p>}
                    {config?.horario_funcionamento && (
                      <div className="pt-1 space-y-0.5">
                        <p className="font-medium">Horário de funcionamento:</p>
                        {config.horario_funcionamento.split("\n").map((line, i) => (
                          <p key={i} className="text-muted-foreground">
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                    {!config?.rua && !config?.horario_funcionamento && (
                      <p className="text-muted-foreground">Endereço não configurado</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Forma de pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={form.pagamento}
                  onValueChange={(v) => {
                    onChange("pagamento", v);
                    if (v !== "dinheiro") {
                      setPrecisaTroco("");
                      setValorTroco("");
                    }
                  }}
                  className="grid gap-3"
                >
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

            {form.pagamento === "dinheiro" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-primary" />
                    Troco
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Precisa de troco?</Label>
                    <RadioGroup
                      value={precisaTroco}
                      onValueChange={(v) => setPrecisaTroco(v as "sim" | "nao")}
                      className="flex gap-6"
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="sim" id="troco-sim" />
                        <span className="font-medium">Sim</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="nao" id="troco-nao" />
                        <span className="font-medium">Não</span>
                      </label>
                    </RadioGroup>
                  </div>
                  {precisaTroco === "sim" && (
                    <div className="grid gap-2">
                      <Label>Troco para quanto?</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
                          R$
                        </span>
                        <Input
                          className="pl-9"
                          value={valorTroco}
                          onChange={(e) => setValorTroco(maskMoeda(e.target.value))}
                          placeholder="0,00"
                          inputMode="numeric"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total do pedido: R$ {total.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {items.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm">
                      <span className="truncate pr-2">
                        {it.permite_fracionamento
                          ? `${it.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${formatUnidade(it.unidade_venda)}`
                          : `${it.quantidade}x`}{" "}
                        {it.nome}
                      </span>
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
                  <span className="text-muted-foreground">
                    {tipoRecebimento === "retirada" ? "Retirada" : "Entrega"}
                  </span>
                  <span>
                    {tipoRecebimento === "retirada"
                      ? "Grátis"
                      : form.bairroId
                        ? `R$ ${taxaEntrega.toFixed(2).replace(".", ",")}`
                        : "—"}
                  </span>
                </div>
                {form.pagamento === "dinheiro" && precisaTroco !== "" && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Troco</span>
                      <span>{precisaTroco === "sim" ? "Sim" : "Não"}</span>
                    </div>
                    {precisaTroco === "sim" && valorTroco && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Troco para</span>
                        <span>R$ {valorTroco}</span>
                      </div>
                    )}
                  </>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-black">
                  <span>Total</span>
                  <span className="text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-2xl py-6 text-base font-bold"
                >
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
