import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const categories = [
  { id: "1", name: "Frutas", icon: "🍎" },
  { id: "2", name: "Verduras", icon: "🥬" },
  { id: "3", name: "Legumes", icon: "🥕" },
  { id: "4", name: "Temperos", icon: "🌿" },
  { id: "5", name: "Ovos", icon: "🥚" },
  { id: "6", name: "Hortaliças", icon: "🥦" },
  { id: "7", name: "Cestas", icon: "🧺" },
];

interface CategoryBarProps {
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function CategoryBar({ selectedId, onSelect }: CategoryBarProps) {
  return (
    <div className="bg-background py-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex w-max space-x-4 px-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelect?.(category.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all hover:border-primary/50 hover:bg-primary/5",
                selectedId === category.id
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-transparent bg-muted/50"
              )}
            >
              <span className="text-2xl">{category.icon}</span>
              <span className="text-xs font-semibold">{category.name}</span>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
}
