import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Mail,
  Plus,
  Pencil,
  Trash2,
  Star,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useBairros } from "@/hooks/useData";

export const Route = createFileRoute("/minha-conta")({
  component: AccountPage,
});

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
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [activeSection, setActiveSection] = useState<null | "enderecos">(null);

  // Addresses state
  const [enderecos, setEnderecos] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState({ ...EMPTY_ADDR });
  const [savingAddr, setSavingAddr] = useState(false);

  useEffect(() => {
    console.log("[minha-conta] LOADING START");

    const safetyTimer = setTimeout(() => {
      console.warn("[minha-conta] Timeout (10s) ao carregar usuário — forçando loading=false");
      console.log("[minha-conta] LOADING END (timeout)");
      setAuthError(true);
      setLoading(false);
    }, 10_000);

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (error) {
          console.error("[minha-conta] Erro ao carregar usuário:", error.message);
        }
        console.log(
          "[minha-conta] SESSION",
          data.user ? { id: data.user.id, email: data.user.email } : null,
        );
        console.log("[minha-conta] USER", data.user ?? null);
        setUser(data.user);
      })
      .catch((err) => {
        console.error("[minha-conta] Erro inesperado ao carregar usuário:", err);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        console.log("[minha-conta] LOADING END");
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const loadEnderecos = async (uid: string) => {
    const { data } = await supabase
      .from("enderecos_cliente")
      .select("*, bairros(nome)")
      .eq("cliente_id", uid)
      .order("principal", { ascending: false });
    setEnderecos(data ?? []);
  };

  useEffect(() => {
    if (user?.id && activeSection === "enderecos") {
      loadEnderecos(user.id);
    }
  }, [user?.id, activeSection]);

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
          .eq("cliente_id", user.id);
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
        // Ensure clientes row exists before inserting address
        await supabase.from("clientes").upsert({ id: user.id }, { onConflict: "id" });
        await supabase.from("enderecos_cliente").insert({
          cliente_id: user.id,
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
      loadEnderecos(user.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar endereço");
    } finally {
      setSavingAddr(false);
    }
  };

  const deleteAddr = async (id: string) => {
    await supabase.from("enderecos_cliente").delete().eq("id", id);
    toast.success("Endereço removido.");
    loadEnderecos(user.id);
  };

  const setPrincipal = async (id: string) => {
    await supabase.from("enderecos_cliente").update({ principal: false }).eq("cliente_id", user.id);
    await supabase.from("enderecos_cliente").update({ principal: true }).eq("id", id);
    toast.success("Endereço principal atualizado!");
    loadEnderecos(user.id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    navigate({ to: "/" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-8 text-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Não foi possível carregar</h1>
          <p className="text-muted-foreground">
            Houve um problema ao verificar sua sessão. Por favor, entre novamente.
          </p>
          <Link to="/login">
            <Button className="w-full">Entrar novamente</Button>
          </Link>
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {activeSection === "enderecos" ? (
          <>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection(null)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <h1 className="text-2xl font-black">Meus Endereços</h1>
            </div>

            <Button onClick={openAdd} className="gap-2">
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
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-4">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-black">{user.user_metadata?.nome || "Cliente"}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-3 w-3" /> {user.email}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Link to="/pedidos">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <Package className="h-5 w-5 text-primary" /> Meus Pedidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Acompanhe seus pedidos em andamento e histórico.
                    </p>
                  </CardContent>
                </Card>
              </Link>
              <button
                type="button"
                className="text-left"
                onClick={() => setActiveSection("enderecos")}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <MapPin className="h-5 w-5 text-primary" /> Endereços
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Gerencie seus endereços de entrega.
                    </p>
                  </CardContent>
                </Card>
              </button>
            </div>

            <Button
              variant="outline"
              onClick={handleLogout}
              className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </>
        )}
      </main>

      {/* Dialog para adicionar/editar endereço */}
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
    </div>
  );
}
