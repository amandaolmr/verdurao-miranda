import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({
  component: AdminLogin,
});

type View = "login" | "forgot" | "reset";

function AdminLogin() {
  const [view, setView] = useState<View>("login");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Detecta redirecionamento do link de recuperação de senha (flag posta pelo __root.tsx)
  useEffect(() => {
    if (sessionStorage.getItem("password_recovery_pending") === "1") {
      sessionStorage.removeItem("password_recovery_pending");
      setView("reset");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: email, error: rpcError } = await supabase.rpc("get_admin_email", {
        p_usuario: usuario.trim().toLowerCase(),
      });

      if (rpcError || !email) {
        toast.error("Usuário ou senha incorretos.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      sessionStorage.setItem("admin_verified_uid", data.user.id);
      navigate({ to: "/admin" });
    } catch {
      toast.error("Usuário ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: email, error: rpcError } = await supabase.rpc("get_admin_email", {
        p_usuario: usuario.trim().toLowerCase(),
      });

      if (rpcError || !email) {
        toast.error("Usuário não encontrado.");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setView("login");
      setUsuario("");
    } catch (err: any) {
      console.error("[Admin] Erro ao enviar e-mail de recuperação:", err);
      toast.error(err?.message ?? "Erro ao enviar e-mail de recuperação.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
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
      toast.success("Senha redefinida com sucesso!");
      setView("login");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Erro ao redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-black text-primary">
            Admin <span className="text-accent">
              {view === "forgot" ? "Recuperar Senha" : view === "reset" ? "Nova Senha" : "Login"}
            </span>
          </CardTitle>
          {view === "forgot" && (
            <CardDescription className="text-center">
              Informe seu usuário para receber o link de recuperação.
            </CardDescription>
          )}
          {view === "reset" && (
            <CardDescription className="text-center">
              Escolha uma nova senha para sua conta.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {view === "login" && (
            <form onSubmit={handleLogin} className="grid gap-4">
              <div>
                <Label htmlFor="usuario">Usuário</Label>
                <Input
                  id="usuario"
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <button
                type="button"
                onClick={() => { setView("forgot"); setPassword(""); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors text-center"
              >
                Esqueceu a senha?
              </button>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={handleForgot} className="grid gap-4">
              <div>
                <Label htmlFor="usuario-recuperar">Usuário</Label>
                <Input
                  id="usuario-recuperar"
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
              <button
                type="button"
                onClick={() => setView("login")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors text-center"
              >
                Voltar ao login
              </button>
            </form>
          )}

          {view === "reset" && (
            <form onSubmit={handleResetPassword} className="grid gap-4">
              <div>
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Redefinir senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
