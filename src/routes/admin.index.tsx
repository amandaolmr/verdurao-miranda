import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardCheck, Truck, Store, CheckCircle, DollarSign, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

interface DashStats {
  pendente: number;
  em_separacao: number;
  saiu_entrega: number;
  retirada_pronta: number;
  entregue_hoje: number;
  faturamento_dia: number;
}

const EMPTY: DashStats = {
  pendente: 0,
  em_separacao: 0,
  saiu_entrega: 0,
  retirada_pronta: 0,
  entregue_hoje: 0,
  faturamento_dia: 0,
};

async function fetchStats(): Promise<DashStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const iso = todayStart.toISOString();

  const { data } = await supabase
    .from("pedidos")
    .select("status, valor_total, tipo_recebimento, criado_em")
    .neq("status", "cancelado");

  if (!data) return EMPTY;

  const todayOrders = data.filter((o) => o.criado_em >= iso);

  return {
    pendente: data.filter((o) => o.status === "pendente").length,
    em_separacao: data.filter((o) => o.status === "em_separacao").length,
    saiu_entrega: data.filter(
      (o) => o.status === "saiu_entrega" && o.tipo_recebimento === "ENTREGA",
    ).length,
    retirada_pronta: data.filter(
      (o) => o.status === "saiu_entrega" && o.tipo_recebimento === "RETIRADA",
    ).length,
    entregue_hoje: todayOrders.filter((o) => o.status === "entregue").length,
    faturamento_dia: todayOrders.reduce((sum, o) => sum + Number(o.valor_total ?? 0), 0),
  };
}

function AdminDashboard() {
  const [stats, setStats] = useState<DashStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    fetchStats().then((s) => {
      setStats(s);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos" }, reload)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Atualizado em tempo real · {loading ? "carregando..." : new Date().toLocaleTimeString("pt-BR")}
        </p>
      </div>

      {/* Cards de faturamento e pedidos do dia */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Faturamento Hoje"
          value={`R$ ${stats.faturamento_dia.toFixed(2).replace(".", ",")}`}
          icon={<DollarSign className="h-5 w-5 text-primary" />}
          highlight
        />
        <StatCard
          title="Pedidos Pendentes"
          value={stats.pendente}
          icon={<ShoppingBag className="h-5 w-5 text-amber-500" />}
          alert={stats.pendente > 0}
        />
        <StatCard
          title="Entregues Hoje"
          value={stats.entregue_hoje}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
        />
      </div>

      {/* Status operacional */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Status Operacional</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <OperationCard
            title="Em Separação"
            value={stats.em_separacao}
            icon={<ClipboardCheck className="h-8 w-8 text-blue-500" />}
            color="text-blue-600"
          />
          <OperationCard
            title="Saiu p/ Entrega"
            value={stats.saiu_entrega}
            icon={<Truck className="h-8 w-8 text-accent" />}
            color="text-accent"
          />
          <OperationCard
            title="Pronto p/ Retirada"
            value={stats.retirada_pronta}
            icon={<Store className="h-8 w-8 text-purple-500" />}
            color="text-purple-600"
          />
          <OperationCard
            title="Concluídos Hoje"
            value={stats.entregue_hoje}
            icon={<CheckCircle className="h-8 w-8 text-green-500" />}
            color="text-green-600"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  highlight,
  alert,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${highlight ? "text-primary" : alert ? "text-amber-600" : ""}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function OperationCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-6">
      <div className="rounded-full bg-muted p-3">{icon}</div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
      </div>
    </Card>
  );
}
