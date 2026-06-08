/**
 * ErrorBoundary global — captura erros não tratados em qualquer parte da árvore
 * de componentes e exibe uma tela amigável com opção de tentar novamente.
 *
 * Também serve como proteção para falhas de auth, Supabase, rede e timeout:
 * o usuário nunca ficará preso em uma tela branca ou "Carregando..." infinito.
 */
import React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Erro não tratado:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página ou voltar ao início.
            </p>
            {this.state.error?.message && (
              <p className="text-xs font-mono bg-muted rounded px-3 py-2 text-left break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button onClick={this.handleRetry} className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                Tentar novamente
              </Button>
              <Button variant="outline" asChild>
                <a href="/">Ir ao início</a>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
