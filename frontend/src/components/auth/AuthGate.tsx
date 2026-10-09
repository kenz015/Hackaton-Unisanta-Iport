import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "./auth-provider";

/** Páginas que podem ser abertas sem estar logado. */
export const PUBLIC_PATHS = ["/", "/auth", "/reset-password"];

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <img src="/Logo_iCrew.ico" alt="" className="size-14 rounded-2xl object-contain" />
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
  const { user, ready, callbackTarget, consumeCallback } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = PUBLIC_PATHS.includes(pathname);

  // Chegou por um link do e-mail (confirmar conta / nova senha): leva direto ao lugar certo,
  // mesmo que o Supabase tenha mandado para a página inicial.
  useEffect(() => {
    if (!ready || !callbackTarget) return;
    // Confirmação sem sessão vai para o login; link de nova senha sempre abre /reset-password,
    // que explica quando o link expirou.
    const target = callbackTarget === "/dashboard" && !user ? "/auth" : callbackTarget;
    consumeCallback();
    if (pathname !== target) void navigate({ to: target, replace: true });
  }, [ready, user, callbackTarget, consumeCallback, pathname, navigate]);

  useEffect(() => {
    if (callbackTarget) return; // o efeito acima cuida do encaminhamento
    if (ready && !user && !isPublic) {
      void navigate({ to: "/auth", search: { redirect: pathname }, replace: true });
    }
  }, [ready, user, isPublic, pathname, navigate, callbackTarget]);

  if (isPublic) return <>{publicPage}</>;
  if (!ready || !user) return <Splash />;
  return <>{children}</>;
}
