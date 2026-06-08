import { Link } from "@tanstack/react-router";
import { Search, ShoppingCart, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { CartDrawer } from "./CartDrawer";
import { useCart } from "@/hooks/useCart";
import { useConfig } from "@/hooks/useConfig";

interface NavbarProps {
  searchValue?: string;
  onSearch?: (v: string) => void;
}

export function Navbar({ searchValue = "", onSearch }: NavbarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { count } = useCart();
  const config = useConfig();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            {config?.logo_url ? (
              <img
                src={config.logo_url}
                alt={config.nome_loja || "Logo"}
                className="h-9 max-w-[160px] object-contain"
              />
            ) : (
              <span className="text-xl font-bold tracking-tight text-primary">
                Verdurão <span className="text-accent">Miranda</span>
              </span>
            )}
          </Link>
        </div>

        <div className="hidden flex-1 px-8 md:flex">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar frutas, verduras..."
              className="w-full pl-10 pr-8"
              value={searchValue}
              onChange={(e) => onSearch?.(e.target.value)}
            />
            {searchValue && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => onSearch?.("")}
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <CartDrawer>
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                  {count}
                </span>
              )}
            </Button>
          </CartDrawer>
          <Link to="/minha-conta">
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {isSearchOpen && (
        <div className="border-t p-4 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              className="w-full pl-10 pr-8"
              autoFocus
              value={searchValue}
              onChange={(e) => onSearch?.(e.target.value)}
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                onSearch?.("");
                setIsSearchOpen(false);
              }}
              aria-label="Fechar busca"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
