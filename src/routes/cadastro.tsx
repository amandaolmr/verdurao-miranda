import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, Lock, User, Chrome } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/cadastro")({
  component: SignupPage,
});

function SignupPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Erro ao cadastrar com Google");
      setIsLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { nome },
        },
      });
      if (error) throw error;
      toast.success("Cadastro realizado! Verifique seu e-mail para confirmar.");
      navigate({ to: "/login" });
    } catch (error: any) {
      const msg: string = error.message || "";
      const traducoes: Record<string, string> = {
        "Password is known to be weak and easy to guess, please choose a different one.":
          "A senha é muito fraca e fácil de adivinhar. Escolha uma senha mais segura.",
        "Password should be at least 6 characters.": "A senha deve ter pelo menos 6 caracteres.",
        "User already registered": "Este e-mail já está cadastrado.",
        "Invalid email": "E-mail inválido.",
        "Email not confirmed": "E-mail não confirmado. Verifique sua caixa de entrada.",
      };
      toast.error(traducoes[msg] ?? (msg || "Erro ao cadastrar"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/10 px-4 py-12">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-black text-primary">
            Criar conta no Verdurão <span className="text-accent">Miranda</span>
          </CardTitle>
          <CardDescription>
            Cadastre-se para comprar mais rápido e acompanhar seus pedidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button
            variant="outline"
            className="w-full gap-2 py-6 text-base font-bold"
            onClick={handleGoogleSignup}
            disabled={isLoading}
          >
            <Chrome className="h-5 w-5 text-red-500" />
            Cadastrar com Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Ou com e-mail</span>
            </div>
          </div>

          <form onSubmit={handleEmailSignup} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="nome"
                  className="pl-10"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  minLength={6}
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full py-6 text-lg font-bold" disabled={isLoading}>
              {isLoading ? "Criando..." : "Criar conta"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t pt-6 text-center text-sm">
          <p className="text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="font-bold text-primary hover:underline">
              Entrar
            </Link>
          </p>
          <Link to="/" className="text-muted-foreground hover:text-primary">
            Continuar como visitante
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
