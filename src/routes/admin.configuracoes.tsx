import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import type { ConfigLoja } from "@/hooks/useConfig";

/** Formata dígitos no padrão (DD) 99999-9999 */
function maskWhatsApp(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const Route = createFileRoute("/admin/configuracoes")({
  component: AdminConfiguracoes,
});

const DEFAULT_CONFIG: Omit<ConfigLoja, "id" | "atualizado_em"> = {
  nome_loja: "",
  descricao: "",
  whatsapp: "",
  telefone: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  horario_funcionamento: "",
  valor_minimo_pedido: 0,
  logo_url: null,
  banner_url: null,
};

function AdminConfiguracoes() {
  const [form, setForm] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("configuracoes_loja")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            nome_loja: data.nome_loja ?? "",
            descricao: data.descricao ?? "",
            whatsapp: data.whatsapp ?? "",
            telefone: data.telefone ?? "",
            rua: data.rua ?? "",
            numero: data.numero ?? "",
            bairro: data.bairro ?? "",
            cidade: data.cidade ?? "",
            horario_funcionamento: data.horario_funcionamento ?? "",
            valor_minimo_pedido: data.valor_minimo_pedido ?? 0,
            logo_url: data.logo_url ?? null,
            banner_url: data.banner_url ?? null,
          });
        }
      });
  }, []);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.nome_loja.trim()) {
      toast.error("O nome da loja é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("configuracoes_loja")
        .update({
          ...form,
          valor_minimo_pedido: Number(form.valor_minimo_pedido) || 0,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
      toast.success("Configurações salvas!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Configurações da Loja</h1>

      {/* Informações da Loja */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações da Loja</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label>Nome da Loja *</Label>
            <Input value={form.nome_loja} onChange={(e) => set("nome_loja", e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={form.descricao ?? ""}
              onChange={(e) => set("descricao", e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label>Logo da Loja</Label>
            <ImageUpload value={form.logo_url} onChange={(url) => set("logo_url", url)} />
          </div>
          <div>
            <Label>Banner Principal</Label>
            <ImageUpload value={form.banner_url} onChange={(url) => set("banner_url", url)} />
          </div>
        </CardContent>
      </Card>

      {/* Contato */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contato</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label>WhatsApp</Label>
            <Input
              value={maskWhatsApp(form.whatsapp ?? "")}
              onChange={(e) => set("whatsapp", e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="(11) 99999-9999"
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground mt-1">DDD + número — ex: (11) 99999-9999</p>
          </div>
          <div>
            <Label>Telefone (opcional)</Label>
            <Input
              value={form.telefone ?? ""}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder="(00) 0000-0000"
            />
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Rua</Label>
              <Input value={form.rua ?? ""} onChange={(e) => set("rua", e.target.value)} />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={form.numero ?? ""} onChange={(e) => set("numero", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bairro</Label>
              <Input value={form.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Funcionamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funcionamento</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Horário de Funcionamento</Label>
          <Textarea
            value={form.horario_funcionamento ?? ""}
            onChange={(e) => set("horario_funcionamento", e.target.value)}
            rows={3}
            placeholder={"Segunda a Sexta: 07:00 às 18:00\nSábado: 07:00 às 14:00"}
          />
        </CardContent>
      </Card>

      {/* Configurações de Venda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações de Venda</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Valor Mínimo do Pedido (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.valor_minimo_pedido ?? 0}
            onChange={(e) => set("valor_minimo_pedido", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Pedidos abaixo desse valor não poderão ser finalizados.
          </p>
        </CardContent>
      </Card>

      <Separator />

      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
        {saving ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
}
