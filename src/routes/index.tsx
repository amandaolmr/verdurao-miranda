import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { CategoryBar } from "@/components/CategoryBar";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { MessageCircle, ShoppingBag, Clock, MapPin, Phone } from "lucide-react";
import heroImage from "@/assets/hero-produce.jpg";
import { CartDrawer } from "@/components/CartDrawer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verdurão Miranda — Hortifruti de Qualidade" },
      { name: "description", content: "O melhor verdurão da região na palma da sua mão. Frutas, verduras e legumes frescos com entrega rápida." },
      { property: "og:title", content: "Verdurão Miranda — Hortifruti de Qualidade" },
      { property: "og:description", content: "O melhor verdurão da região na palma da sua mão. Frutas, verduras e legumes frescos com entrega rápida." },
    ],
  }),
  component: Index,
});

const MOCK_PRODUCTS = [
  { id: "1", nome: "Tomate Saladete", preco: 7.99, unidade_venda: "Kg", descricao: "Tomates frescos e selecionados, ideais para saladas." },
  { id: "2", nome: "Alface Crespa", preco: 3.50, unidade_venda: "Unidade", descricao: "Alface crocante e higienizada, colhida no dia." },
  { id: "3", nome: "Banana Prata", preco: 5.49, unidade_venda: "Kg", descricao: "Bananas docinhas, perfeitas para o café da manhã." },
  { id: "4", nome: "Cenoura", preco: 4.80, unidade_venda: "Kg", descricao: "Cenouras crocantes e ricas em vitamina A." },
  { id: "5", nome: "Ovos Brancos", preco: 18.00, unidade_venda: "Bandeja", descricao: "Bandeja com 30 ovos grandes e frescos." },
  { id: "6", nome: "Maço de Cheiro Verde", preco: 2.50, unidade_venda: "Maço", descricao: "Salsa e cebolinha frescas para temperar seus pratos." },
];

function Index() {
  const { addToCart, count } = useCart();

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
                onClick={() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Comprar Agora
              </Button>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-6">
          <div className="container mx-auto">
            <h2 className="px-4 text-xl font-bold tracking-tight">Categorias</h2>
            <CategoryBar />
          </div>
        </section>

        {/* Featured Products */}
        <section id="catalogo" className="py-6 scroll-mt-20">
          <div className="container mx-auto px-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Destaques do Dia</h2>
              <Button variant="link" className="text-primary font-bold">Ver tudo</Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {MOCK_PRODUCTS.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  onAddToCart={addToCart}
                />
              ))}
            </div>
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
