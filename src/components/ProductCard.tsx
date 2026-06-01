import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Minus } from "lucide-react";
import { formatUnidade } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";

interface Product {
  id: string;
  nome: string;
  preco: number;
  unidade_venda: string;
  imagem_url?: string | null;
  descricao?: string | null;
  categorias?: { nome: string } | null;
  permite_fracionamento?: boolean;
  quantidade_minima?: number | null;
}

interface ProductCardProps {
  product: Product;
}

type Step = { label: string; delta: number };

function normalizeUnit(unit: string): string {
  return (unit ?? "").toUpperCase();
}

type SliderConfig = { min: number; max: number; step: number };

function getSliderConfig(unit: string, minima?: number | null): SliderConfig {
  const qmin = minima != null && minima > 0 ? minima : undefined;
  switch (normalizeUnit(unit)) {
    case "KG":
      return { min: qmin ?? 0.1, max: 5, step: 0.1 };
    case "G":
      return { min: qmin ?? 100, max: 2000, step: 50 };
    case "DZ":
      return { min: qmin ?? 0.5, max: 5, step: 0.5 };
    default:
      return { min: qmin ?? 1, max: 10, step: 1 };
  }
}

function getDefaultQty(unit: string, minima?: number | null): number {
  if (minima != null && minima > 0) return minima;
  switch (normalizeUnit(unit)) {
    case "KG":
      return 0.5;
    case "G":
      return 100;
    case "DZ":
      return 0.5;
    default:
      return 1;
  }
}

function getSteps(unit: string): Step[] {
  switch (normalizeUnit(unit)) {
    case "KG":
      return [
        { label: "+100g", delta: 0.1 },
        { label: "+500g", delta: 0.5 },
        { label: "+1 Kg", delta: 1 },
        { label: "-100g", delta: -0.1 },
        { label: "-500g", delta: -0.5 },
        { label: "-1 Kg", delta: -1 },
      ];
    case "G":
      return [
        { label: "+100g", delta: 100 },
        { label: "+250g", delta: 250 },
        { label: "+500g", delta: 500 },
        { label: "-100g", delta: -100 },
        { label: "-250g", delta: -250 },
        { label: "-500g", delta: -500 },
      ];
    case "DZ":
      return [
        { label: "+0,5 Dz", delta: 0.5 },
        { label: "+1 Dz", delta: 1 },
        { label: "+2 Dz", delta: 2 },
        { label: "-0,5 Dz", delta: -0.5 },
        { label: "-1 Dz", delta: -1 },
        { label: "-2 Dz", delta: -2 },
      ];
    default:
      return [];
  }
}

function formatQtyDisplay(qty: number, unit: string): string {
  switch (normalizeUnit(unit)) {
    case "KG":
      return `${qty.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
    case "G":
      return `${qty.toLocaleString("pt-BR")} g`;
    case "DZ":
      return `${qty.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${formatUnidade("DZ")}`;
    default:
      return `${qty} ${formatUnidade(unit)}`;
  }
}

function getUnitLabel(unit: string): string {
  switch (normalizeUnit(unit)) {
    case "KG":
      return "Valor do Kg";
    case "G":
      return "Valor por grama";
    case "DZ":
      return "Valor por D\u00FAzia";
    default:
      return "Valor";
  }
}

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400";

export function ProductCard({ product }: ProductCardProps) {
  const { items, addToCart, updateQuantity } = useCart();
  const cartItem = items.find((item) => item.id === product.id);
  const cartQty = cartItem?.quantidade ?? 0;

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedQty, setSelectedQty] = useState(0);

  const isFractional = product.permite_fracionamento;
  const steps = getSteps(product.unidade_venda);
  const positiveSteps = steps.filter((s) => s.delta > 0);
  const negativeSteps = steps.filter((s) => s.delta < 0);
  const totalPrice = selectedQty * product.preco;
  const sliderConfig = getSliderConfig(product.unidade_venda, product.quantidade_minima);

  const handleStep = (delta: number) => {
    setSelectedQty((prev) => {
      const next = Math.round((prev + delta) * 1000) / 1000;
      return next < 0 ? 0 : next;
    });
  };

  const handleAdicionar = () => {
    if (isFractional) {
      setSelectedQty(getDefaultQty(product.unidade_venda, product.quantidade_minima));
      setModalOpen(true);
    } else {
      addToCart(product, 1);
    }
  };

  const handleConfirm = () => {
    if (selectedQty <= 0) return;
    addToCart(product, selectedQty);
    setModalOpen(false);
  };

  return (
    <>
      <Card className="overflow-hidden border-none bg-card shadow-sm transition-all hover:shadow-md group">
        <div className="aspect-square w-full overflow-hidden bg-muted/30">
          <img
            src={product.imagem_url || DEFAULT_IMAGE}
            alt={product.nome}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
        <CardContent className="p-2 md:p-3">
          <div className="flex flex-col gap-0.5 md:gap-1">
            <span className="text-[9px] md:text-[10px] font-normal text-muted-foreground uppercase tracking-wide">
              {product.categorias?.nome || "Hortifruti"}
            </span>
            <h3 className="line-clamp-2 text-[13px] md:text-sm font-semibold leading-tight">
              {product.nome}
            </h3>
            <span className="text-sm md:text-lg font-black text-primary mt-0.5 md:mt-1">
              R$ {product.preco.toFixed(2).replace(".", ",")}
              <span className="text-[9px] md:text-xs font-normal text-muted-foreground ml-0.5">
                / {formatUnidade(product.unidade_venda)}
              </span>
            </span>
            {product.descricao && (
              <p className="hidden md:line-clamp-2 text-[10px] leading-tight text-muted-foreground mt-1">
                {product.descricao}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-2 pt-0 md:p-3 md:pt-0">
          {isFractional ? (
            <Button
              className="w-full gap-1 rounded-lg md:rounded-xl md:gap-2 bg-primary hover:bg-primary/90 font-bold h-7 text-xs md:h-9 md:text-sm"
              onClick={handleAdicionar}
            >
              <Plus className="h-3 w-3 md:h-4 md:w-4" />
              {cartQty > 0 ? (
                formatQtyDisplay(cartQty, product.unidade_venda)
              ) : (
                <span className="hidden sm:inline">Adicionar</span>
              )}
              {cartQty === 0 && <span className="sm:hidden">Add</span>}
            </Button>
          ) : cartQty > 0 ? (
            <div className="flex w-full items-center rounded-lg md:rounded-xl border bg-muted/50">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:h-9 md:w-9 shrink-0 rounded-l-lg md:rounded-l-xl"
                onClick={() => updateQuantity(product.id, -1)}
              >
                <Minus className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
              <span className="flex-1 text-center text-xs md:text-sm font-bold">{cartQty}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:h-9 md:w-9 shrink-0 rounded-r-lg md:rounded-r-xl"
                onClick={() => updateQuantity(product.id, 1)}
              >
                <Plus className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          ) : (
            <Button
              className="w-full gap-1 rounded-lg md:rounded-xl md:gap-2 bg-primary hover:bg-primary/90 font-bold h-7 text-xs md:h-9 md:text-sm"
              onClick={handleAdicionar}
            >
              <Plus className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden xs:inline">Adicionar</span>
            </Button>
          )}
        </CardFooter>
      </Card>

      {isFractional && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-center">Quantidade</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 overflow-y-auto max-h-[70dvh] pr-1">
              {/* Preços */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">
                    {getUnitLabel(product.unidade_venda)}
                  </p>
                  <p className="text-sm font-black text-primary">
                    R$ {product.preco.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">Valor total</p>
                  <p className="text-sm font-black text-primary">
                    R$ {totalPrice.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>

              {/* Quantidade selecionada */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Quantidade selecionada</p>
                <p className="text-2xl font-black text-primary mt-0.5">
                  {formatQtyDisplay(selectedQty, product.unidade_venda)}
                </p>
              </div>

              {/* Slider */}
              <div className="space-y-1 px-1">
                <input
                  type="range"
                  min={sliderConfig.min}
                  max={sliderConfig.max}
                  step={sliderConfig.step}
                  value={Math.max(
                    sliderConfig.min,
                    Math.min(selectedQty || sliderConfig.min, sliderConfig.max),
                  )}
                  onChange={(e) => setSelectedQty(Number(e.target.value))}
                  className="w-full h-2 cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatQtyDisplay(sliderConfig.min, product.unidade_venda)}</span>
                  <span>{formatQtyDisplay(sliderConfig.max, product.unidade_venda)}</span>
                </div>
              </div>

              {/* Botões positivos */}
              <div className="grid grid-cols-3 gap-2">
                {positiveSteps.map((step) => (
                  <Button
                    key={step.label}
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                    onClick={() => handleStep(step.delta)}
                  >
                    {step.label}
                  </Button>
                ))}
              </div>

              {/* Botões negativos */}
              <div className="grid grid-cols-3 gap-2">
                {negativeSteps.map((step) => (
                  <Button
                    key={step.label}
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold text-destructive border-destructive/20 hover:bg-destructive/5 hover:text-destructive disabled:opacity-30"
                    disabled={selectedQty + step.delta <= 0}
                    onClick={() => handleStep(step.delta)}
                  >
                    {step.label}
                  </Button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full" disabled={selectedQty <= 0} onClick={handleConfirm}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
