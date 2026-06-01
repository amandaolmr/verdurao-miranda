import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { CategoryBar } from "@/components/CategoryBar";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { MessageCircle, Clock, MapPin, Phone, RefreshCcw } from "lucide-react";
import heroImage from "@/assets/hero-produce.jpg";
import { useCategories, useProducts } from "@/hooks/useData";
import { useConfig } from "@/hooks/useConfig";
import { useEffect, useRef, useState } from "react";

function maskWhatsApp(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

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
      {
        name: "description",
        content:
          "O melhor verdurão da região na palma da sua mão. Frutas, verduras e legumes frescos com entrega rápida.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { categoria: selectedCategoryId } = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const productsSectionRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const { data: products = [], isLoading: loadingProducts } = useProducts(selectedCategoryId);
  const config = useConfig();

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value && selectedCategoryId) {
      navigate({ search: (prev: IndexSearch) => ({ ...prev, categoria: undefined }) });
    }
    if (value && productsSectionRef.current) {
      const y = productsSectionRef.current.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const filteredProducts = searchTerm
    ? products.filter(
        (p: any) =>
          p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.categorias?.nome?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : products;

  const handleSelectCategory = (id: string) => {
    setSearchTerm("");
    navigate({
      search: (prev: IndexSearch) => ({ ...prev, categoria: id || undefined }),
    });

    // Scroll to products section
    if (productsSectionRef.current) {
      const yOffset = -80;
      const y =
        productsSectionRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const selectedCategoryName = categories.find((c) => c.id === selectedCategoryId)?.nome;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar searchValue={searchTerm} onSearch={handleSearch} />

      <main>
        {/* Hero Section */}
        <section className="relative h-[50vh] w-full overflow-hidden md:h-[65vh]">
          <img src={heroImage} alt="Produtos frescos" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-0 flex items-center px-6 md:px-16">
            <div className="max-w-lg space-y-4">
              <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-lg md:text-6xl">
                Saúde que vem da <span className="text-green-400">Terra</span>
              </h1>
              <p className="text-base font-medium text-white/90 drop-shadow md:text-xl">
                O melhor Hortifruti da região entregue na sua porta com um clique.
              </p>
              <Button
                size="lg"
                className="rounded-2xl px-8 py-6 text-lg font-bold shadow-xl"
                onClick={() => productsSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
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
                  {searchTerm
                    ? `Resultados para "${searchTerm}"`
                    : selectedCategoryName || "Todos os Produtos"}
                </h2>
                {searchTerm && (
                  <p className="text-sm text-muted-foreground">
                    {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""}{" "}
                    encontrado{filteredProducts.length !== 1 ? "s" : ""}
                  </p>
                )}
                {!searchTerm && selectedCategoryId && (
                  <p className="text-sm text-muted-foreground">
                    Mostrando itens em {selectedCategoryName}
                  </p>
                )}
              </div>

              {(selectedCategoryId || searchTerm) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-primary text-primary font-bold gap-2"
                  onClick={() => {
                    handleSelectCategory("");
                    setSearchTerm("");
                  }}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Ver Todos
                </Button>
              )}
            </div>

            {loadingProducts ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredProducts.map((product: any) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-muted/30 rounded-3xl">
                <p className="text-muted-foreground font-medium">
                  {searchTerm
                    ? `Nenhum produto encontrado para "${searchTerm}".`
                    : "Nenhum produto encontrado nesta categoria."}
                </p>
                <Button
                  variant="link"
                  className="text-primary font-bold mt-2"
                  onClick={() => {
                    handleSelectCategory("");
                    setSearchTerm("");
                  }}
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
                {config?.horario_funcionamento ? (
                  config.horario_funcionamento.split("\n").map((line, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">A definir</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold">Localização</h3>
                {config?.rua ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {config.rua}
                      {config.numero ? `, ${config.numero}` : ""}
                      {config.bairro ? ` - ${config.bairro}` : ""}
                    </p>
                    {config.cidade && (
                      <p className="text-sm text-muted-foreground">{config.cidade}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">A definir</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Phone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold">Contato</h3>
                {config?.telefone && (
                  <p className="text-sm text-muted-foreground">{config.telefone}</p>
                )}
                {config?.whatsapp && (
                  <p className="text-sm text-muted-foreground">
                    WhatsApp: {maskWhatsApp(config.whatsapp)}
                  </p>
                )}
                {!config?.telefone && !config?.whatsapp && (
                  <p className="text-sm text-muted-foreground">A definir</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* WhatsApp Floating Button */}
      {(() => {
        const raw = (config?.whatsapp || "5500999999999").replace(/\D/g, "");
        const waNumber = raw.startsWith("55") ? raw : `55${raw}`;
        return (
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl transition-transform hover:scale-110 md:bottom-6"
          >
            <MessageCircle className="h-8 w-8 fill-current" />
          </a>
        );
      })()}

      {/* Desktop Footer */}
      <footer className="hidden border-t py-12 md:block">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {config?.nome_loja || "Verdurão Miranda"}. Todos os
            direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
