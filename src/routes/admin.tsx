import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Tags,
  MapPin,
  ClipboardList,
  LogOut,
  ChevronRight,
  Settings,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [checking, setChecking] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLoginPage = pathname === "/admin/login";

  const loadPending = async () => {
    const { count } = await supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    setPendingCount(count ?? 0);
  };

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      return;
    }

    setChecking(true);
    let cancelled = false;

    const check = async () => {
      try {
        // getSession() aguarda a inicialização completa do Supabase (incluindo
        // renovação de token se expirado) antes de retornar — evita race condition
        // e o problema de INITIAL_SESSION disparar com null enquanto o token renova.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!session) {
          navigate({ to: "/admin/login" });
          return;
        }

        const { data: admin, error: adminError } = await supabase
          .from("administrador")
          .select("id")
          .eq("id", session.user.id)
          .single();

        if (cancelled) return;

        if (adminError) {
          // Erro de rede/RLS: não deslogar, apenas mostrar spinner e tentar de novo no próximo mount
          console.error("[Admin] Falha ao verificar administrador:", adminError.message);
          navigate({ to: "/admin/login" });
          return;
        }

        if (!admin) {
          await supabase.auth.signOut();
          navigate({ to: "/admin/login" });
          return;
        }

        setChecking(false);
      } catch (e) {
        console.error("[Admin] Erro inesperado na verificação:", e);
        if (!cancelled) navigate({ to: "/admin/login" });
      }
    };

    // Timeout de 8s como segurança contra initializePromise travado (ex: Google OAuth)
    const timeout = setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        navigate({ to: "/admin/login" });
      }
    }, 8_000);

    check().finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isLoginPage, navigate]);

  // Contador de pedidos pendentes em tempo real
  useEffect(() => {
    if (checking || isLoginPage) return;
    loadPending();
    const channel = supabase
      .channel("admin-sidebar-pending")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos" }, loadPending)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" }, loadPending)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [checking, isLoginPage]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  };

  // Página de login: renderiza sem sidebar
  if (isLoginPage) return <Outlet />;

  // Enquanto verifica auth/admin, mostra indicador de carregamento (não tela branca)
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm">Verificando acesso...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 border-r bg-background md:block">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-xl font-black tracking-tight text-primary">
            Painel <span className="text-accent">Admin</span>
          </span>
        </div>
        <nav className="space-y-1 p-4">
          <AdminNavLink to="/admin" icon={<LayoutDashboard size={20} />}>
            Dashboard
          </AdminNavLink>
          <AdminNavLink
            to="/admin/pedidos"
            icon={<ClipboardList size={20} />}
            badge={pendingCount > 0 ? pendingCount : undefined}
          >
            Pedidos
          </AdminNavLink>
          <AdminNavLink to="/admin/produtos" icon={<Package size={20} />}>
            Produtos
          </AdminNavLink>
          <AdminNavLink to="/admin/categorias" icon={<Tags size={20} />}>
            Categorias
          </AdminNavLink>
          <AdminNavLink to="/admin/bairros" icon={<MapPin size={20} />}>
            Bairros
          </AdminNavLink>
          <AdminNavLink to="/admin/configuracoes" icon={<Settings size={20} />}>
            Configurações
          </AdminNavLink>
        </nav>

        <div className="absolute bottom-4 w-full px-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        <header className="flex h-16 items-center border-b bg-background px-4 md:hidden gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-16 items-center border-b px-6">
                <span className="text-xl font-black tracking-tight text-primary">
                  Painel <span className="text-accent">Admin</span>
                </span>
              </div>
              <nav className="space-y-1 p-4">
                <AdminNavLink
                  to="/admin"
                  icon={<LayoutDashboard size={20} />}
                  onNavigate={() => setMobileOpen(false)}
                >
                  Dashboard
                </AdminNavLink>
                <AdminNavLink
                  to="/admin/pedidos"
                  icon={<ClipboardList size={20} />}
                  badge={pendingCount > 0 ? pendingCount : undefined}
                  onNavigate={() => setMobileOpen(false)}
                >
                  Pedidos
                </AdminNavLink>
                <AdminNavLink
                  to="/admin/produtos"
                  icon={<Package size={20} />}
                  onNavigate={() => setMobileOpen(false)}
                >
                  Produtos
                </AdminNavLink>
                <AdminNavLink
                  to="/admin/categorias"
                  icon={<Tags size={20} />}
                  onNavigate={() => setMobileOpen(false)}
                >
                  Categorias
                </AdminNavLink>
                <AdminNavLink
                  to="/admin/bairros"
                  icon={<MapPin size={20} />}
                  onNavigate={() => setMobileOpen(false)}
                >
                  Bairros
                </AdminNavLink>
                <AdminNavLink
                  to="/admin/configuracoes"
                  icon={<Settings size={20} />}
                  onNavigate={() => setMobileOpen(false)}
                >
                  Configurações
                </AdminNavLink>
              </nav>
              <div className="absolute bottom-4 w-full px-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut size={20} />
                  Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <span className="text-lg font-bold">Verdurão Miranda Admin</span>
          {pendingCount > 0 && (
            <Badge className="ml-auto bg-destructive text-white">{pendingCount}</Badge>
          )}
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminNavLink({
  to,
  icon,
  children,
  badge,
  onNavigate,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      activeProps={{ className: "bg-primary/10 text-primary" }}
      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
    >
      <div className="flex items-center gap-3">
        {icon}
        {children}
      </div>
      <div className="flex items-center gap-1">
        {badge !== undefined && (
          <Badge className="h-5 min-w-5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
            {badge}
          </Badge>
        )}
        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100" />
      </div>
    </Link>
  );
}
