import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Plus } from "lucide-react";

interface Product {
  id: string;
  nome: string;
  preco: number;
  unidade_venda: string;
  imagem_url?: string | null;
  descricao?: string | null;
  categorias?: { nome: string } | null;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400";

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <Card className="overflow-hidden border-none bg-card shadow-sm transition-all hover:shadow-md group">
      <div className="aspect-square w-full overflow-hidden bg-muted/30">
        <img
          src={product.imagem_url || DEFAULT_IMAGE}
          alt={product.nome}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <CardContent className="p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-primary uppercase tracking-wider">
            {product.categorias?.nome || "Hortifruti"}
          </span>
          <h3 className="line-clamp-1 text-sm font-bold">{product.nome}</h3>
          <span className="text-lg font-black text-primary mt-1">
            R$ {product.preco.toFixed(2).replace(".", ",")}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              / {product.unidade_venda}
            </span>
          </span>
          {product.descricao && (
            <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground mt-1">
              {product.descricao}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-3 pt-0">
        <Button 
          className="w-full gap-2 rounded-xl bg-primary hover:bg-primary/90 font-bold"
          onClick={() => onAddToCart?.(product)}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </CardFooter>
    </Card>
  );
}
