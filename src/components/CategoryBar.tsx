import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  nome: string;
  imagem_url?: string | null;
}

interface CategoryBarProps {
  categories: Category[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function CategoryBar({ categories, selectedId, onSelect }: CategoryBarProps) {
  return (
    <div className="bg-background py-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex w-max space-x-4 px-4">
          <button
            onClick={() => onSelect?.("")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border p-2 transition-all hover:border-primary/50 hover:bg-primary/5 w-24",
              !selectedId
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-transparent bg-muted/50"
            )}
          >
            <div className="h-16 w-16 overflow-hidden rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">🌟</span>
            </div>
            <span className="text-xs font-semibold">Todos</span>
          </button>

          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelect?.(category.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-2 transition-all hover:border-primary/50 hover:bg-primary/5 w-24",
                selectedId === category.id
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-transparent bg-muted/50"
              )}
            >
              <div className="h-16 w-16 overflow-hidden rounded-xl bg-muted">
                {category.imagem_url ? (
                  <img
                    src={category.imagem_url}
                    alt={category.nome}
                    className="h-full w-full object-cover transition-transform hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">
                    📦
                  </div>
                )}
              </div>
              <span className="text-xs font-semibold truncate w-full text-center">{category.nome}</span>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
}
