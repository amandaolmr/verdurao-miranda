/**
 * Mercado Pago Payment Brick wrapper.
 *
 * Handles PIX, credit-card, and debit-card payments transparently (no redirect).
 * Uses the official @mercadopago/sdk-react Payment Brick.
 *
 * Required env var (exposed to the browser via Vite):
 *   VITE_MP_PUBLIC_KEY=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
import { useEffect, useState, memo } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { Loader2, AlertCircle } from "lucide-react";
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
  onBack?: () => void;
}

// Track MP initialisation across re-renders
let mpInitialized = false;

// Map our payment method to the Payment Brick customisation
function buildCustomization(_method: OnlinePaymentMethod) {
  // CardPayment only handles credit card — no customization needed
  return {};
}

export const MercadoPagoCheckout = memo(function MercadoPagoCheckout({
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
          <strong>VITE_MP_PUBLIC_KEY</strong> não configurada. Defina a chave pública do Mercado
          Pago no arquivo <code>.env</code>.
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
        // Reset processing so the Brick shows the error and lets the user retry
        setProcessing(false);
        throw new Error(result.message);
      }

      // Notify the parent immediately. The parent (checkout.tsx) hides this
      // component via CSS (keeping it in the DOM) and only unmounts it after
      // 500 ms — enough time for the Brick's async DOM cleanup to complete,
      // preventing the "removeChild" crash.
      onSuccess(result);
      // Do NOT reset processing here — the component is about to be hidden.
    } catch (err) {
      // Only reset processing on error (success path is handled above)
      setProcessing(false);
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      {!brickReady && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground text-sm">
            Carregando formulário de pagamento...
          </span>
        </div>
      )}

      {/* The CardPayment Brick renders itself into this container */}
      <div className={brickReady ? "" : "invisible h-0 overflow-hidden"}>
        <CardPayment
          initialization={{
            amount,
            payer: { email: payerEmail },
          }}
          onReady={() => setBrickReady(true)}
          onSubmit={handleSubmit}
          onError={(error) => {
            console.error("[MP CardPayment Brick]", error);
          }}
        />
      </div>
    </div>
  );
});
