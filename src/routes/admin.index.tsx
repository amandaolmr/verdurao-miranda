import { createFileRoute } from "@tanstack/react-router";
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  DollarSign,
  ClipboardCheck,
  Truck,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo ao painel administrativo do Verdurão Miranda.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Vendas Hoje" 
          value="R$ 1.240,00" 
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          description="+12% em relação a ontem"
        />
        <StatCard 
          title="Pedidos Novos" 
          value="8" 
          icon={<ShoppingBag className="h-4 w-4 text-accent" />}
          description="4 pendentes de separação"
        />
        <StatCard 
          title="Novos Clientes" 
          value="12" 
          icon={<Users className="h-4 w-4 text-blue-500" />}
          description="Este mês: 145"
        />
        <StatCard 
          title="Conversão" 
          value="3.2%" 
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          description="+0.4% em relação ao mês anterior"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatusCard 
          title="Pedidos em Separação" 
          value="4" 
          icon={<ClipboardCheck className="h-8 w-8 text-blue-500" />}
        />
        <StatusCard 
          title="Saiu para Entrega" 
          value="2" 
          icon={<Truck className="h-8 w-8 text-accent" />}
        />
        <StatusCard 
          title="Pedidos com Atraso" 
          value="1" 
          icon={<AlertCircle className="h-8 w-8 text-destructive" />}
        />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, description }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusCard({ title, value, icon }: any) {
  return (
    <Card className="flex items-center gap-4 p-6">
      <div className="rounded-full bg-muted p-3">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
