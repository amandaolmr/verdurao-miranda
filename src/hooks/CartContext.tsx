import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CartItem } from "./useCart";

interface CartContextValue {
  items: CartItem[];
  addToCart: (product: any, qty?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  subtotal: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("verdurao-miranda-cart");
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("verdurao-miranda-cart", JSON.stringify(items));
  }, [items]);

  const addToCart = (product: any, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantidade: item.quantidade + qty } : item,
        );
      }
      return [...prev, { ...product, quantidade: qty }];
    });
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantidade: Math.max(0, item.quantidade + delta) } : item,
        )
        .filter((item) => item.quantidade > 0),
    );
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce((acc, item) => acc + item.preco * item.quantidade, 0);
  const count = items.length;

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, subtotal, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCartContext must be used inside CartProvider");
  return ctx;
}
