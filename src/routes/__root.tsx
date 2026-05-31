import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CartProvider } from "@/hooks/CartContext";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      {
        name: "description",
        content: "Verdurão Miranda is a mobile-first e-commerce app for local produce sales.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      {
        property: "og:description",
        content: "Verdurão Miranda is a mobile-first e-commerce app for local produce sales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      {
        name: "twitter:description",
        content: "Verdurão Miranda is a mobile-first e-commerce app for local produce sales.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/28e27f34-e970-4db9-9e08-512df989c958/id-preview-e44993f8--dfef37b2-499a-4d53-8eac-ee041f105eb3.lovable.app-1780058601210.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/28e27f34-e970-4db9-9e08-512df989c958/id-preview-e44993f8--dfef37b2-499a-4d53-8eac-ee041f105eb3.lovable.app-1780058601210.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="top-center" richColors />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Limpeza de sessão corrompida no startup (ex: Google OAuth mal configurado).
  // Se a sessão no localStorage estiver inválida, o Supabase bloqueia initializePromise
  // e toda chamada supabase.from() fica presa. Detectamos isso com um timeout de 3s
  // e fazemos signOut local (sem rede) para desbloquear.
  useEffect(() => {
    let resolved = false;

    const forceLocalSignout = () => {
      if (!resolved) {
        resolved = true;
        supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }
    };

    const timeout = setTimeout(forceLocalSignout, 3000);

    supabase.auth
      .getSession()
      .then(({ error }) => {
        clearTimeout(timeout);
        if (error) {
          console.warn("[Auth] Sessão inválida no startup, limpando:", error.message);
          forceLocalSignout();
        } else {
          resolved = true;
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        forceLocalSignout();
      });

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Apenas reagir a mudanças reais de autenticação. INITIAL_SESSION e
      // TOKEN_REFRESHED disparam com frequência e cancelariam queries em andamento.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;

      if (event === "SIGNED_IN" && session?.user) {
        const u = session.user;
        await supabase.from("clientes").upsert(
          {
            id: u.id,
            email: u.email,
            nome:
              u.user_metadata?.full_name ||
              u.user_metadata?.name ||
              u.user_metadata?.nome ||
              null,
            avatar_url:
              u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
          },
          { onConflict: "id" },
        );
      }
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </CartProvider>
    </QueryClientProvider>
  );
}

