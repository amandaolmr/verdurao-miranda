import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  Package, 
  Tags, 
  MapPin, 
  ClipboardList, 
  Settings, 
  LogOut,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
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
          <AdminNavLink to="/admin/pedidos" icon={<ClipboardList size={20} />}>
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
        </nav>
        
        <div className="absolute bottom-4 w-full px-4">
          <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <LogOut size={20} />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        <header className="flex h-16 items-center border-b bg-background px-6 md:hidden">
          <span className="text-lg font-bold">Verdurão Miranda Admin</span>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminNavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "bg-primary/10 text-primary" }}
      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
    >
      <div className="flex items-center gap-3">
        {icon}
        {children}
      </div>
      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100" />
    </Link>
  );
}
