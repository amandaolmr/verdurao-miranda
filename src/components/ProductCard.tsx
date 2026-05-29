import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Plus } from "lucide-react";

interface Product {
  id: string;
  nome: string;
  preco: number;
  unidade_venda: string;
  imagem_url?: string;
  descricao?: string;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <Card className="overflow-hidden border-none bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="aspect-square w-full bg-muted/30">
        {product.imagem_url ? (
          <img
            src={product.imagem_url}
            alt={product.nome}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            📦
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-primary">
            R$ {product.preco.toFixed(2).replace(".", ",")}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              / {product.unidade_venda}
            </span>
          </span>
          <h3 className="line-clamp-1 text-sm font-semibold">{product.nome}</h3>
          {product.descricao && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {product.descricao}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-3 pt-0">
        <Button 
          className="w-full gap-2 rounded-xl bg-primary hover:bg-primary/90"
          onClick={() => onAddToCart?.(product)}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </CardFooter>
    </Card>
  );
}
