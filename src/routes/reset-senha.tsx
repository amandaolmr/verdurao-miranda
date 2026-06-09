import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { useConfig } from "@/hooks/useConfig";
import { Lock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import logoLocal from "@/assets/verdurao-miranda-logo.png";

export const Route = createFileRoute("/reset-senha")({
  component: ResetSenhaPage,
});

function ResetSenhaPage() {
  const config = useConfig();
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase processa o token do hash da URL e dispara PASSWORD_RECOVERY
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Timeout: se nenhum evento em 5s, o link está expirado ou inválido
    const timeout = setTimeout(() => {
      setReady((current) => {
        if (!current) {
          toast.error("Link expirado ou inválido. Solicite um novo e-mail de recuperação.");
          navigate({ to: "/login" });
        }
        return current;
      });
    }, 5_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  // — Verificando link —
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/10 px-4">
        <p className="animate-pulse text-muted-foreground">Verificando link de recuperação…</p>
      </div>
    );
  }

  // — Sucesso —
  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/10 px-4">
        <Card className="w-full max-w-sm border-none shadow-xl text-center">
          <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4">
            <CheckCircle className="h-14 w-14 text-primary" />
            <h2 className="text-xl font-bold">Senha redefinida!</h2>
            <p className="text-sm text-muted-foreground">
              Sua senha foi atualizada com sucesso. Faça login com a nova senha.
            </p>
            <Button className="w-full mt-2" onClick={() => navigate({ to: "/login" })}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // — Formulário —
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/10 px-4 py-12">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <img
            src={config?.logo_url ?? logoLocal}
            alt={config?.nome_loja ?? "Verdurão Miranda"}
            className="mx-auto mb-2 h-20 w-auto object-contain"
          />
          <h1 className="text-xl font-bold">Criar nova senha</h1>
          <CardDescription>Escolha uma senha com pelo menos 6 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-password"
                  type="password"
                  className="pl-10"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type="password"
                  className="pl-10"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full py-6 text-base font-bold" disabled={loading}>
              {loading ? "Salvando…" : "Redefinir senha"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
              Voltar ao login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
