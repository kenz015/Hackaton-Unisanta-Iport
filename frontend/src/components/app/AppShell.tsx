import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CalendarRange, ChevronRight, Database, Grid3x3, LayoutDashboard, LogOut, Moon, RefreshCw, Settings, Sun, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSnapshot } from "@/services/api";
import { useAppState } from "./app-state";
import { useAuth } from "@/components/auth/auth-provider";
import { Avatar } from "./ui-bits";

/** Só as telas prontas aparecem no menu. As outras rotas continuam existindo. */
const nav = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { to: "/timeline", label: "Timeline", icon: CalendarRange },
  { to: "/heatmap", label: "Heatmap", icon: Grid3x3 },
  { to: "/pessoas", label: "Funcionários", icon: Users },
  { to: "/avisos", label: "Central de avisos", icon: Bell },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:w-60">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-3 lg:px-5">
        <img src="/Logotipo_iC.ico" alt="Logo iCrew" className="size-9 rounded-xl object-contain" />
        <div className="hidden leading-tight lg:block">
          <div className="text-lg font-extrabold tracking-tight text-primary">iCrew</div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Equilíbrio de equipe</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2 lg:p-3" aria-label="Navegação principal">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: true }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground" }}
            title={n.label}
          >
            <n.icon className="size-4 shrink-0" aria-hidden />
            <span className="hidden lg:inline">{n.label}</span>
          </Link>
        ))}
      </nav>
      <UserBox />
    </aside>
  );
}

function UserBox() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const logout = async () => {
    await signOut();
    void navigate({ to: "/", replace: true });
  };
  return (
    <div className="border-t border-sidebar-border p-2 lg:p-3">
      <div className="flex items-center gap-2 rounded-xl px-1 py-1.5 lg:px-2">
        <span className="hidden lg:block"><Avatar name={user.name} /></span>
        <div className="hidden min-w-0 flex-1 leading-tight lg:block">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">{user.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{user.demo ? "Modo demonstração" : user.email}</p>
        </div>
        <Button size="icon" variant="ghost" className="mx-auto shrink-0 rounded-lg lg:mx-0" onClick={logout} aria-label="Sair" title="Sair">
          <LogOut className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function Header() {
  const { lastSync, sync, syncing, theme, toggleTheme, alertStatus } = useAppState();
  const { data, warning } = useSnapshot();
  const navigate = useNavigate();
  const openAlerts = data?.alerts.filter((a) => (alertStatus[a.id] ?? "Aberto") === "Aberto") ?? [];
  const openCount = openAlerts.length;
  const visibleAlerts = openAlerts.slice(0, 4);
  const isAzure = data?.origin === "azure";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-8">
        <p className="title-caps hidden text-sm text-foreground md:block">
          <span className="text-primary">SUA</span> OPERAÇÃO, <span className="text-brand-cyan">NOSSOS</span> SISTEMAS
        </p>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn("hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-flex", isAzure ? "bg-status-available text-status-available-foreground" : "bg-highlight-soft text-highlight-foreground dark:text-highlight")}
            title={warning ?? (isAzure ? "Dados lidos do Azure DevOps" : "Configure o .env para ler o Azure DevOps")}
          >
            <Database className="size-3" aria-hidden /> {isAzure ? "Azure DevOps" : "Dados de demonstração"}
          </span>
          <span className="hidden text-xs text-muted-foreground xl:inline">
            Sincronizado {formatDistanceToNow(lastSync, { locale: ptBR, addSuffix: true })}
          </span>
          <Button size="sm" variant="outline" onClick={sync} disabled={syncing} className="rounded-lg">
            <RefreshCw className={cn("size-4", syncing && "animate-spin")} aria-hidden />
            <span className="hidden sm:inline">{syncing ? "Sincronizando…" : "Sincronizar agora"}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="relative rounded-lg" aria-label="Ver avisos abertos">
                <Bell className="size-5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[22rem] p-0">
              <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
                <span>Avisos em aberto</span>
                {openCount > 0 && <span className="text-[10px] font-medium text-muted-foreground">{openCount} ativas</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {visibleAlerts.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">Nenhum aviso aberto no momento.</div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto p-2">
                  {visibleAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      className="flex w-full items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent"
                      onClick={() => navigate({ to: "/avisos" })}
                    >
                      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", alert.severity === "critical" ? "bg-critical" : alert.severity === "attention" ? "bg-status-attention" : "bg-status-info")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground">{alert.title}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">{alert.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: "/avisos" })} className="cursor-pointer justify-between px-3 py-2 text-sm font-medium">
                <span>Ir para central de avisos</span>
                <ChevronRight className="size-4" aria-hidden />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="icon" variant="ghost" className="rounded-lg" onClick={toggleTheme} aria-label="Alternar tema">
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
