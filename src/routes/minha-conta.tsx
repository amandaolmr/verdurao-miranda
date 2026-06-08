import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Package,
  LogOut,
  MapPin,
  Heart,
  MessageCircle,
  ChevronRight,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Star,
  Settings,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useBairros } from "@/hooks/useData";
import { useConfig } from "@/hooks/useConfig";

export const Route = createFileRoute("/minha-conta")({
  component: AccountPage,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_separacao: "Em separação",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const EMPTY_ADDR = {
  rua: "",
  numero: "",
  complemento: "",
  referencia: "",
  bairroId: "",
  principal: false,
};

function AccountPage() {
  const navigate = useNavigate();
  const { data: bairros = [] } = useBairros();
  const config = useConfig();
  const { user, session, loading, error } = useAuth({ redirectToLogin: true });

  useEffect(() => {
    console.log("user", user);
    console.log("session", session);
    console.log("loading", loading);
  }, [user, session, loading]);

  const [activeSection, setActiveSection] = useState<null | "enderecos" | "configuracoes">(null);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [andamentoPedidos, setAndamentoPedidos] = useState(0);
  const [ultimoPedido, setUltimoPedido] = useState<any>(null);

  // ── Cliente ────────────────────────────────────────────────────────────────
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [editingDados, setEditingDados] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [savingDados, setSavingDados] = useState(false);

  // ── Addresses ──────────────────────────────────────────────────────────────
  const [enderecos, setEnderecos] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState({ ...EMPTY_ADDR });
  const [savingAddr, setSavingAddr] = useState(false);

  // ── Load all data ──────────────────────────────────────────────────────────
  const loadEnderecos = async (uid: string) => {
    const { data } = await supabase
      .from("enderecos_cliente")
      .select("*, bairros(nome)")
      .eq("cliente_id", uid)
      .order("principal", { ascending: false });
    setEnderecos(data ?? []);
  };

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    Promise.all([
      supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("cliente_id", uid),
      supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", uid)
        .not("status", "in", '("entregue","cancelado")'),
      supabase
        .from("pedidos")
        .select("id, status, valor_total, criado_em")
        .eq("cliente_id", uid)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("clientes").select("nome, telefone").eq("id", uid).maybeSingle(),
      supabase
        .from("enderecos_cliente")
        .select("*, bairros(nome)")
        .eq("cliente_id", uid)
        .order("principal", { ascending: false }),
    ]).then(
      ([
        { count: total },
        { count: andamento },
        { data: last },
        { data: cliente },
        { data: addrs },
      ]) => {
        setTotalPedidos(total ?? 0);
        setAndamentoPedidos(andamento ?? 0);
        setUltimoPedido(last ?? null);
        const nome =
          cliente?.nome || user.user_metadata?.nome || user.user_metadata?.full_name || "";
        const telefone = cliente?.telefone || user.user_metadata?.telefone || "";
        setClienteNome(nome);
        setClienteTelefone(telefone);
        setFormNome(nome);
        setFormTelefone(telefone);
        setEnderecos(addrs ?? []);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Dados da conta ─────────────────────────────────────────────────────────
  const saveDados = async () => {
    if (!user) return;
    setSavingDados(true);
    try {
      await supabase
        .from("clientes")
        .upsert(
          { id: user.id, nome: formNome.trim(), telefone: formTelefone.trim() },
          { onConflict: "id" },
        );
      setClienteNome(formNome.trim());
      setClienteTelefone(formTelefone.trim());
      setEditingDados(false);
      toast.success("Dados atualizados!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar dados.");
    } finally {
      setSavingDados(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(user.email);
    if (resetErr) {
      toast.error("Erro ao enviar e-mail de redefinição.");
    } else {
      toast.success("E-mail de redefinição enviado para " + user.email);
    }
  };

  // ── Address CRUD ───────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    setAddrForm({ ...EMPTY_ADDR });
    setDialogOpen(true);
  };

  const openEdit = (addr: any) => {
    setEditingId(addr.id);
    setAddrForm({
      rua: addr.rua,
      numero: addr.numero,
      complemento: addr.complemento || "",
      referencia: addr.referencia || "",
      bairroId: addr.bairro_id || "",
      principal: addr.principal,
    });
    setDialogOpen(true);
  };

  const saveAddr = async () => {
    if (!addrForm.rua || !addrForm.numero || !addrForm.bairroId) {
      toast.error("Preencha rua, número e bairro.");
      return;
    }
    setSavingAddr(true);
    try {
      if (addrForm.principal) {
        await supabase
          .from("enderecos_cliente")
          .update({ principal: false })
          .eq("cliente_id", user!.id);
      }
      if (editingId) {
        await supabase
          .from("enderecos_cliente")
          .update({
            rua: addrForm.rua,
            numero: addrForm.numero,
            complemento: addrForm.complemento || null,
            referencia: addrForm.referencia || null,
            bairro_id: addrForm.bairroId,
            principal: addrForm.principal,
          })
          .eq("id", editingId);
      } else {
        await supabase.from("clientes").upsert({ id: user!.id }, { onConflict: "id" });
        await supabase.from("enderecos_cliente").insert({
          cliente_id: user!.id,
          rua: addrForm.rua,
          numero: addrForm.numero,
          complemento: addrForm.complemento || null,
          referencia: addrForm.referencia || null,
          bairro_id: addrForm.bairroId,
          principal: addrForm.principal,
        });
      }
      toast.success(editingId ? "Endereço atualizado!" : "Endereço adicionado!");
      setDialogOpen(false);
      loadEnderecos(user!.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar endereço");
    } finally {
      setSavingAddr(false);
    }
  };

  const deleteAddr = async (id: string) => {
    await supabase.from("enderecos_cliente").delete().eq("id", id);
    toast.success("Endereço removido.");
    loadEnderecos(user!.id);
  };

  const setPrincipal = async (id: string) => {
    await supabase
      .from("enderecos_cliente")
      .update({ principal: false })
      .eq("cliente_id", user!.id);
    await supabase.from("enderecos_cliente").update({ principal: true }).eq("id", id);
    setEnderecos((prev) => prev.map((a) => ({ ...a, principal: a.id === id })));
    toast.success("Endereço padrão atualizado!");
  };

  const handleLogout = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("signOut timeout")), 5_000),
        ),
      ]);
    } catch (err) {
      console.warn("Logout error/timeout — forçando navegação mesmo assim:", err);
    }
    window.location.assign("/");
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const waUrl = (() => {
    if (!config?.whatsapp) return null;
    const n = config.whatsapp.replace(/\D/g, "");
    const fone = n.startsWith("55") ? n : `55${n}`;
    return `https://wa.me/${fone}?text=${encodeURIComponent("Olá! Preciso de ajuda.")}`;
  })();

  const nomeDisplay =
    clienteNome || user?.user_metadata?.nome || user?.user_metadata?.full_name || "";

  const initials = nomeDisplay
    ? nomeDisplay
        .trim()
        .split(" ")
        .slice(0, 2)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
    : (user?.email?.[0] ?? "?").toUpperCase();

  const since = user?.created_at ? new Date(user.created_at).getFullYear() : null;

  // ── Address dialog (shared) ────────────────────────────────────────────────
  const addressDialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar endereço" : "Novo endereço"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Rua *</Label>
            <Input
              value={addrForm.rua}
              onChange={(e) => setAddrForm((p) => ({ ...p, rua: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Número *</Label>
              <Input
                value={addrForm.numero}
                onChange={(e) => setAddrForm((p) => ({ ...p, numero: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Complemento</Label>
              <Input
                value={addrForm.complemento}
                onChange={(e) => setAddrForm((p) => ({ ...p, complemento: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Bairro *</Label>
            <Select
              value={addrForm.bairroId}
              onValueChange={(v) => setAddrForm((p) => ({ ...p, bairroId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o bairro" />
              </SelectTrigger>
              <SelectContent>
                {bairros.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Referência</Label>
            <Input
              value={addrForm.referencia}
              onChange={(e) => setAddrForm((p) => ({ ...p, referencia: e.target.value }))}
              placeholder="Próximo a..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={addrForm.principal}
              onChange={(e) => setAddrForm((p) => ({ ...p, principal: e.target.checked }))}
              className="rounded"
            />
            Definir como endereço principal
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={saveAddr} disabled={savingAddr}>
            {savingAddr ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-8 text-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Não foi possível carregar</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button className="w-full" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Você não está logado</h1>
          <p className="text-muted-foreground">Entre para ver seus pedidos e endereços.</p>
          <div className="flex flex-col gap-2">
            <Link to="/login">
              <Button className="w-full">Entrar</Button>
            </Link>
            <Link to="/cadastro">
              <Button variant="outline" className="w-full">
                Criar conta
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── ENDEREÇOS ──────────────────────────────────────────────────────────────
  if (activeSection === "enderecos") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-6 max-w-lg space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveSection(null)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <h1 className="text-xl font-black">Meus Endereços</h1>
          </div>

          <Button onClick={openAdd} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Adicionar endereço
          </Button>

          {enderecos.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              Nenhum endereço cadastrado.
            </div>
          ) : (
            <div className="grid gap-3">
              {enderecos.map((addr) => (
                <Card
                  key={addr.id}
                  className={addr.principal ? "border-primary/50 bg-primary/5" : ""}
                >
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 text-sm">
                        {addr.principal && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary mb-1">
                            <Star className="h-3 w-3 fill-primary" /> Principal
                          </span>
                        )}
                        <p className="font-medium">
                          {addr.rua}, {addr.numero}
                          {addr.complemento ? ` — ${addr.complemento}` : ""}
                        </p>
                        <p className="text-muted-foreground">{addr.bairros?.nome}</p>
                        {addr.referencia && (
                          <p className="text-muted-foreground text-xs">{addr.referencia}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {!addr.principal && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPrincipal(addr.id)}
                            title="Definir como principal"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(addr)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAddr(addr.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
        {addressDialog}
      </div>
    );
  }

  // ── CONFIGURAÇÕES ──────────────────────────────────────────────────────────
  if (activeSection === "configuracoes") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-6 max-w-lg space-y-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveSection(null)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <h1 className="text-xl font-black">Configurações</h1>
          </div>

          {/* Dados da Conta */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Dados da Conta
            </h2>
            <Card>
              <CardContent className="py-4 space-y-4">
                {editingDados ? (
                  <>
                    <div className="grid gap-1.5">
                      <Label>Nome</Label>
                      <Input
                        value={formNome}
                        onChange={(e) => setFormNome(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Telefone</Label>
                      <Input
                        value={formTelefone}
                        onChange={(e) => setFormTelefone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        inputMode="tel"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveDados} disabled={savingDados}>
                        {savingDados ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingDados(false);
                          setFormNome(clienteNome);
                          setFormTelefone(clienteTelefone);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Nome</p>
                        <p className="font-medium">{clienteNome || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Telefone</p>
                        <p className="font-medium">{clienteTelefone || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-0.5">E-mail</p>
                        <p className="font-medium break-all">{user.email}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setEditingDados(true)}
                    >
                      <Pencil className="h-3 w-3" /> Editar dados
                    </Button>
                  </div>
                )}

                <div className="border-t pt-3">
                  <button
                    onClick={sendPasswordReset}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Lock className="h-4 w-4 shrink-0" />
                    Alterar senha
                  </button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Endereço Padrão */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> Endereço Padrão
            </h2>
            <p className="text-xs text-muted-foreground -mt-1">
              Permite escolher qual endereço usar automaticamente.
            </p>

            {enderecos.length === 0 ? (
              <Card>
                <CardContent className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum endereço cadastrado.{" "}
                  <button
                    className="text-primary underline"
                    onClick={() => setActiveSection("enderecos")}
                  >
                    Adicionar
                  </button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y">
                  {enderecos.map((addr) => (
                    <button
                      key={addr.id}
                      className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => setPrincipal(addr.id)}
                    >
                      {/* Radio indicator */}
                      <div
                        className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                          addr.principal
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/50"
                        }`}
                      >
                        {addr.principal && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 text-sm">
                        <p className="font-medium">
                          {addr.rua}, {addr.numero}
                        </p>
                        <p className="text-xs text-muted-foreground">{addr.bairros?.nome}</p>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>
        </main>
        {addressDialog}
      </div>
    );
  }

  // ── PERFIL (view principal) ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-lg space-y-5 pb-20">
        {/* Header do perfil */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground shrink-0 select-none">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-black leading-tight">{nomeDisplay || "Cliente"}</h1>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            {since && <p className="text-xs text-muted-foreground">Cliente desde {since}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-3xl font-black text-primary leading-none">{totalPedidos}</p>
              <p className="text-xs text-muted-foreground mt-1">Pedidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-3xl font-black text-primary leading-none">{andamentoPedidos}</p>
              <p className="text-xs text-muted-foreground mt-1">Em andamento</p>
            </CardContent>
          </Card>
        </div>

        {/* Menu */}
        <Card>
          <CardContent className="p-0 divide-y">
            <Link
              to="/pedidos"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors"
            >
              <Package className="h-5 w-5 text-primary shrink-0" />
              <span className="flex-1 text-sm font-medium">Meus Pedidos</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <button
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
              onClick={() => setActiveSection("enderecos")}
            >
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <span className="flex-1 text-sm font-medium">Endereços</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              className="flex items-center gap-3 w-full px-4 py-3.5 transition-colors text-left opacity-50 cursor-not-allowed"
              disabled
            >
              <Heart className="h-5 w-5 text-primary shrink-0" />
              <span className="flex-1 text-sm font-medium">Favoritos</span>
              <span className="text-xs text-muted-foreground">Em breve</span>
            </button>

            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <MessageCircle className="h-5 w-5 text-[#25D366] shrink-0" />
                <span className="flex-1 text-sm font-medium">Falar com a Loja</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </a>
            )}
          </CardContent>
        </Card>

        {/* Último pedido */}
        {ultimoPedido && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Último Pedido
            </p>
            <Link to="/pedidos">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold">
                      #{ultimoPedido.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      R$ {Number(ultimoPedido.valor_total).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {STATUS_LABEL[ultimoPedido.status] ?? ultimoPedido.status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* Configurações & Sair */}
        <div className="space-y-1 pt-1">
          <button
            className="flex items-center gap-3 w-full rounded-lg px-2 py-3 hover:bg-muted/40 transition-colors text-left"
            onClick={() => setActiveSection("configuracoes")}
          >
            <Settings className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium">Configurações</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            className="flex items-center gap-3 w-full rounded-lg px-2 py-3 hover:bg-destructive/5 transition-colors text-left text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-sm font-medium">Sair</span>
          </button>
        </div>
      </main>

      {addressDialog}
    </div>
  );
}
