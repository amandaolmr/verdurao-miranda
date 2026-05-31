import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Minus, Trash2, ShoppingBag, Pencil } from "lucide-react";
import { useCart, type CartItem } from "@/hooks/useCart";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Link } from "@tanstack/react-router";
import { formatUnidade } from "@/lib/utils";

function normalizeUnit(unit: string): string {
  return (unit ?? "").toUpperCase();
}

type Step = { label: string; delta: number };

function getSteps(unit: string): Step[] {
  switch (normalizeUnit(unit)) {
    case "KG":
      return [
        { label: "+100g", delta: 0.1 },
        { label: "+500g", delta: 0.5 },
        { label: "+1Kg", delta: 1 },
        { label: "-100g", delta: -0.1 },
        { label: "-500g", delta: -0.5 },
        { label: "-1Kg", delta: -1 },
      ];
    case "G":
      return [
        { label: "+100g", delta: 100 },
        { label: "+500g", delta: 500 },
        { label: "+1Kg", delta: 1000 },
        { label: "-100g", delta: -100 },
        { label: "-500g", delta: -500 },
        { label: "-1Kg", delta: -1000 },
      ];
    case "DZ":
      return [
        { label: "+½ Dz", delta: 0.5 },
        { label: "+1 Dz", delta: 1 },
        { label: "+2 Dz", delta: 2 },
        { label: "-½ Dz", delta: -0.5 },
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
      return `${qty.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} Kg`;
    case "G":
      return `${qty.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} g`;
    case "DZ":
      return `${qty.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Dz`;
    default:
      return `${qty}`;
  }
}

function getUnitLabel(unit: string): string {
  switch (normalizeUnit(unit)) {
    case "KG":
      return "Preço / Kg";
    case "G":
      return "Preço / 100g";
    case "DZ":
      return "Preço / Dz";
    default:
      return "Preço / Un";
  }
}

type SliderConfig = { min: number; max: number; step: number };

function getSliderConfig(unit: string): SliderConfig {
  switch (normalizeUnit(unit)) {
    case "KG":
      return { min: 0.1, max: 5, step: 0.1 };
    case "G":
      return { min: 100, max: 2000, step: 50 };
    case "DZ":
      return { min: 0.5, max: 5, step: 0.5 };
    default:
      return { min: 1, max: 10, step: 1 };
  }
}

export function CartDrawer({ children }: { children?: React.ReactNode }) {
  const { items, updateQuantity, removeFromCart, subtotal, count } = useCart();
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editQty, setEditQty] = useState(0);

  const openEdit = (item: CartItem) => {
    setEditingItem(item);
    setEditQty(item.quantidade);
  };

  const handleEditStep = (delta: number) => {
    setEditQty((prev) => {
      const next = Math.round((prev + delta) * 1000) / 1000;
      return next <= 0 ? prev : next;
    });
  };

  const handleEditConfirm = () => {
    if (!editingItem || editQty <= 0) return;
    const delta = Math.round((editQty - editingItem.quantidade) * 1000) / 1000;
    if (delta !== 0) updateQuantity(editingItem.id, delta);
    setEditingItem(null);
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          {children || (
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                  {count}
                </span>
              )}
            </Button>
          )}
        </SheetTrigger>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="p-6 pb-2">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Meu Carrinho
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-6">
                <div className="rounded-full bg-muted p-6">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Seu carrinho está vazio</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione produtos frescos para começar suas compras.
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full px-6">
                <div className="space-y-6 py-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted/30">
                        {item.imagem_url ? (
                          <img
                            src={item.imagem_url}
                            alt={item.nome}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl">
                            🥗
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between py-1">
                        <div>
                          <h4 className="line-clamp-1 text-sm font-bold">{item.nome}</h4>
                          <p className="text-xs text-muted-foreground">
                            R$ {item.preco.toFixed(2).replace(".", ",")} /{" "}
                            {formatUnidade(item.unidade_venda)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          {item.permite_fracionamento ? (
                            <button
                              onClick={() => openEdit(item)}
                              className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-sm font-bold hover:bg-muted transition-colors"
                            >
                              {item.quantidade.toLocaleString("pt-BR", {
                                maximumFractionDigits: 3,
                              })}{" "}
                              {formatUnidade(item.unidade_venda)}
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                          ) : (
                            <div className="flex items-center rounded-lg border bg-muted/50 p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-xs font-bold">
                                {item.quantidade}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {items.length > 0 && (
            <SheetFooter className="border-t p-6">
              <div className="w-full space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">
                      R$ {subtotal.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Entrega</span>
                    <span className="text-xs italic text-primary">Calcular no checkout</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
                <SheetClose asChild>
                  <Link to="/checkout">
                    <Button className="w-full rounded-2xl py-6 text-lg font-bold shadow-lg shadow-primary/20">
                      Finalizar Compra
                    </Button>
                  </Link>
                </SheetClose>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal de edição de quantidade fracionada */}
      {editingItem &&
        (() => {
          const steps = getSteps(editingItem.unidade_venda);
          const positiveSteps = steps.filter((s) => s.delta > 0);
          const negativeSteps = steps.filter((s) => s.delta < 0);
          const sliderConfig = getSliderConfig(editingItem.unidade_venda);
          const totalPrice = editQty * editingItem.preco;
          return (
            <Dialog
              open
              onOpenChange={(open) => {
                if (!open) setEditingItem(null);
              }}
            >
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-center">{editingItem.nome}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 overflow-y-auto max-h-[70dvh] pr-1">
                  {/* Preços */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl bg-muted/50 p-2.5">
                      <p className="text-xs text-muted-foreground">
                        {getUnitLabel(editingItem.unidade_venda)}
                      </p>
                      <p className="text-sm font-black text-primary">
                        R$ {editingItem.preco.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2.5">
                      <p className="text-xs text-muted-foreground">Valor total</p>
                      <p className="text-sm font-black text-primary">
                        R$ {totalPrice.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  </div>

                  {/* Quantidade */}
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Quantidade selecionada</p>
                    <p className="text-2xl font-black text-primary mt-0.5">
                      {formatQtyDisplay(editQty, editingItem.unidade_venda)}
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
                        Math.min(editQty || sliderConfig.min, sliderConfig.max),
                      )}
                      onChange={(e) => setEditQty(Number(e.target.value))}
                      className="w-full h-2 cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatQtyDisplay(sliderConfig.min, editingItem.unidade_venda)}</span>
                      <span>{formatQtyDisplay(sliderConfig.max, editingItem.unidade_venda)}</span>
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
                        onClick={() => handleEditStep(step.delta)}
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
                        disabled={editQty + step.delta <= 0}
                        onClick={() => handleEditStep(step.delta)}
                      >
                        {step.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button className="w-full" onClick={handleEditConfirm}>
                    Confirmar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}
    </>
  );
}
