import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "./auth-provider";

/** Páginas que podem ser abertas sem estar logado. */
export const PUBLIC_PATHS = ["/", "/auth", "/reset-password"];

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <img src="/logo.jpeg" alt="" className="size-14 rounded-2xl object-contain" />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando o iCrew…
      </p>
    </div>
  );
}

/**
 * Porteiro do sistema: o login roda primeiro.
 * - Páginas públicas (tela inicial "/", /auth): mostram direto, sem menu.
 * - Sem sessão: manda para /auth e lembra para onde a pessoa queria ir.
 * - Com sessão: mostra o sistema (children = AppShell + página).
 */
export function AuthGate({ publicPage, children }: { publicPage: ReactNode; children: ReactNode }) {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (ready && !user && !isPublic) {
      void navigate({ to: "/auth", search: { redirect: pathname }, replace: true });
    }
  }, [ready, user, isPublic, pathname, navigate]);

  if (isPublic) return <>{publicPage}</>;
  if (!ready || !user) return <Splash />;
  return <>{children}</>;
}
