import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Package, LogOut, MapPin, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/minha-conta")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

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

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Você não está logado</h1>
          <p className="text-muted-foreground">Entre para ver seus pedidos e endereços.</p>
          <div className="flex flex-col gap-2">
            <Link to="/login"><Button className="w-full">Entrar</Button></Link>
            <Link to="/cadastro"><Button variant="outline" className="w-full">Criar conta</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
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
                <p className="text-sm text-muted-foreground">Acompanhe seus pedidos em andamento e histórico.</p>
              </CardContent>
            </Card>
          </Link>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <MapPin className="h-5 w-5 text-primary" /> Endereços
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Gerencie seus endereços de entrega.</p>
            </CardContent>
          </Card>
        </div>

        <Button variant="outline" onClick={handleLogout} className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </main>
    </div>
  );
}
