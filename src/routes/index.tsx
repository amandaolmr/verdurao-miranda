import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { CategoryBar } from "@/components/CategoryBar";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { MessageCircle, ShoppingBag, Clock, MapPin, Phone, RefreshCcw } from "lucide-react";
import heroImage from "@/assets/hero-produce.jpg";
import { CartDrawer } from "@/components/CartDrawer";
import { useCategories, useProducts } from "@/hooks/useData";
import { useEffect, useRef } from "react";

interface IndexSearch {
  categoria?: string;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): IndexSearch => {
    return {
      categoria: (search.categoria as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Verdurão Miranda — Hortifruti de Qualidade" },
      { name: "description", content: "O melhor verdurão da região na palma da sua mão. Frutas, verduras e legumes frescos com entrega rápida." },
    ],
  }),
  component: Index,
});

function Index() {
  const { addToCart, count } = useCart();
  const { categoria: selectedCategoryId } = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const productsSectionRef = useRef<HTMLDivElement>(null);

  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const { data: products = [], isLoading: loadingProducts } = useProducts(selectedCategoryId);

  const handleSelectCategory = (id: string) => {
    navigate({
      search: (prev) => ({ ...prev, categoria: id || undefined }),
    });
    
    // Scroll to products section
    if (productsSectionRef.current) {
      const yOffset = -80; 
      const y = productsSectionRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const selectedCategoryName = categories.find(c => c.id === selectedCategoryId)?.nome;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      
      <main>
        {/* Hero Section */}
        <section className="relative h-[40vh] w-full overflow-hidden md:h-[60vh]">
          <img
            src={heroImage}
            alt="Produtos frescos"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-r from-background/80 via-background/40 to-transparent flex items-center px-4 md:px-12">
            <div className="max-w-md space-y-4">
              <h1 className="text-4xl font-black tracking-tight text-primary md:text-6xl">
                Saúde que vem da <span className="text-accent">Terra</span>
              </h1>
              <p className="text-lg font-medium text-foreground/80 md:text-xl">
                O melhor Hortifruti da região entregue na sua porta com um clique.
              </p>
              <Button 
                size="lg" 
                className="rounded-2xl px-8 py-6 text-lg font-bold shadow-xl shadow-primary/20"
                onClick={() => productsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                Comprar Agora
              </Button>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-6">
          <div className="container mx-auto">
            <h2 className="px-4 text-xl font-bold tracking-tight mb-2">Categorias</h2>
            <CategoryBar 
              categories={categories} 
              selectedId={selectedCategoryId}
              onSelect={handleSelectCategory}
            />
          </div>
        </section>

        {/* Featured Products */}
        <section ref={productsSectionRef} id="catalogo" className="py-6 scroll-mt-20">
          <div className="container mx-auto px-4">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-primary">
                  {selectedCategoryName || "Todos os Produtos"}
                </h2>
                {selectedCategoryId && (
                  <p className="text-sm text-muted-foreground">Mostrando itens em {selectedCategoryName}</p>
                )}
              </div>
              
              {selectedCategoryId && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="rounded-xl border-primary text-primary font-bold gap-2"
                  onClick={() => handleSelectCategory("")}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Ver Todos
                </Button>
              )}
            </div>
            
            {loadingProducts ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {products.map((product: any) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-muted/30 rounded-3xl">
                <p className="text-muted-foreground font-medium">Nenhum produto encontrado nesta categoria.</p>
                <Button 
                  variant="link" 
                  className="text-primary font-bold mt-2"
                  onClick={() => handleSelectCategory("")}
                >
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Establishment Info */}
        <section className="bg-secondary/20 py-12 mt-12">
          <div className="container mx-auto px-4 grid gap-8 md:grid-cols-3">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold">Horário de Funcionamento</h3>
                <p className="text-sm text-muted-foreground">Segunda à Sábado: 07h às 19h</p>
                <p className="text-sm text-muted-foreground">Domingo: 07h às 13h</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold">Localização</h3>
                <p className="text-sm text-muted-foreground">Rua das Palmeiras, 123 - Centro</p>
                <p className="text-sm text-muted-foreground">Nossa Cidade - UF</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Phone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold">Contato</h3>
                <p className="text-sm text-muted-foreground">(00) 99999-9999</p>
                <p className="text-sm text-muted-foreground">contato@verduramiranda.com.br</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* WhatsApp Floating Button */}
      <a
        href="https://wa.me/5500999999999"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl transition-transform hover:scale-110 md:bottom-6"
      >
        <MessageCircle className="h-8 w-8 fill-current" />
      </a>

      {/* Mobile Floating Cart Indicator */}
      {count > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 w-full max-w-[90%] -translate-x-1/2 px-4 md:hidden">
          <CartDrawer>
            <Button className="w-full gap-2 rounded-2xl bg-accent py-6 text-lg font-bold shadow-2xl">
              <ShoppingBag className="h-6 w-6" />
              Ver Carrinho ({count})
            </Button>
          </CartDrawer>
        </div>
      )}
      
      {/* Desktop Footer */}
      <footer className="hidden border-t py-12 md:block">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Verdurão Miranda. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
