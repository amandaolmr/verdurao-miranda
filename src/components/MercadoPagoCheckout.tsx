/**
 * Mercado Pago Payment Brick wrapper.
 *
 * Handles PIX, credit-card, and debit-card payments transparently (no redirect).
 * Uses the official @mercadopago/sdk-react Payment Brick.
 *
 * Required env var (exposed to the browser via Vite):
 *   VITE_MP_PUBLIC_KEY=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
import { useEffect, useState } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type PaymentResult, processarPagamento } from "@/lib/api/payments";

export type { PaymentResult };

export type OnlinePaymentMethod = "pix" | "cartao_credito" | "cartao_debito";

interface OrderData {
  clienteId: string | null;
  nomeCliente: string;
  telefone: string;
  tipoRecebimento: "ENTREGA" | "RETIRADA";
  rua: string;
  numero: string;
  complemento: string | null;
  referencia: string | null;
  bairroId: string | null;
  precisaTroco: boolean | null;
  valorTroco: number | null;
  subtotal: number;
  taxaEntrega: number;
  valorTotal: number;
  itens: Array<{
    produtoId: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
}

interface Props {
  amount: number;
  paymentMethod: OnlinePaymentMethod;
  payerEmail?: string;
  orderData: OrderData;
  onSuccess: (result: PaymentResult) => void;
  onBack: () => void;
}

// Track MP initialisation across re-renders
let mpInitialized = false;

// Map our payment method to the Payment Brick customisation
function buildCustomization(method: OnlinePaymentMethod) {
  switch (method) {
    case "pix":
      return { paymentMethods: { bankTransfer: ["pix"] as ["pix"] } };
    case "cartao_credito":
      return {
        paymentMethods: {
          creditCard: "all" as const,
          debitCard: "none" as const,
          maxInstallments: 12,
        },
      };
    case "cartao_debito":
      return {
        paymentMethods: {
          debitCard: "all" as const,
          creditCard: "none" as const,
        },
      };
  }
}

export function MercadoPagoCheckout({
  amount,
  paymentMethod,
  payerEmail = "",
  orderData,
  onSuccess,
  onBack,
}: Props) {
  const [brickReady, setBrickReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const publicKey = (import.meta.env.VITE_MP_PUBLIC_KEY ?? "") as string;

  useEffect(() => {
    if (!publicKey) return;
    if (!mpInitialized) {
      initMercadoPago(publicKey, { locale: "pt-BR" });
      mpInitialized = true;
    }
  }, [publicKey]);

  if (!publicKey) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
        <span>
          <strong>VITE_MP_PUBLIC_KEY</strong> não configurada.
          Defina a chave pública do Mercado Pago no arquivo{" "}
          <code>.env</code>.
        </span>
      </div>
    );
  }

  // SSR guard — Payment Brick is client-only
  if (typeof window === "undefined") return null;

  const handleSubmit = async (formData: Record<string, unknown>) => {
    setProcessing(true);
    try {
      const result = await processarPagamento({
        data: {
          formData,
          orderData: {
            ...orderData,
            formaPagamento: paymentMethod,
          },
        },
      });

      if (result.status === "rejected") {
        // Let the Brick display the error
        throw new Error(result.message);
      }

      // Success or pending PIX — let parent handle the UI
      onSuccess(result);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={processing}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {processing && (
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando pagamento...
          </span>
        )}
      </div>

      {!brickReady && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground text-sm">
            Carregando formulário de pagamento...
          </span>
        </div>
      )}

      {/* The Payment Brick renders itself into this container */}
      <div className={brickReady ? "" : "invisible h-0 overflow-hidden"}>
        <Payment
          initialization={{
            amount,
            payer: { email: payerEmail },
          }}
          customization={buildCustomization(paymentMethod) as any}
          onReady={() => setBrickReady(true)}
          onSubmit={handleSubmit}
          onError={(error) => {
            console.error("[MP Payment Brick]", error);
          }}
        />
      </div>
    </div>
  );
}
