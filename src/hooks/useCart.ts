export interface CartItem {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  unidade_venda: string;
  imagem_url?: string;
  permite_fracionamento?: boolean;
}

export { useCartContext as useCart } from "./CartContext";
