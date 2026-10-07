import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CalendarRange, Database, Grid3x3, LayoutDashboard, Moon, RefreshCw, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSnapshot } from "@/services/api";
import { WORK_ITEM_TYPES, typeMeta } from "@/data/agile";
import { useAppState, type Filters } from "./app-state";

/** Só as telas prontas aparecem no menu. As outras rotas continuam existindo. */
const nav = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/timeline", label: "Timeline", icon: CalendarRange },
  { to: "/heatmap", label: "Heatmap", icon: Grid3x3 },
  { to: "/avisos", label: "Central de avisos", icon: Bell },
] as const;

function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:w-60">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-3 lg:px-5">
        <img src="/logo.jpeg" alt="Logo iPORT" className="size-9 rounded-xl object-contain" />
        <div className="hidden leading-tight lg:block">
          <div className="text-lg font-extrabold tracking-tight text-primary">iCrew</div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">iPORT Solutions</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2 lg:p-3" aria-label="Navegação principal">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground" }}
            title={n.label}
          >
            <n.icon className="size-4 shrink-0" aria-hidden />
            <span className="hidden lg:inline">{n.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function FilterSelect({ k, label, options }: { k: keyof Filters; label: string; options: { value: string; label: string }[] }) {
  const { filters, setFilter } = useAppState();
  return (
    <Select value={filters[k]} onValueChange={(v) => setFilter(k, v as never)}>
      <SelectTrigger className="h-8 w-auto min-w-28 rounded-lg text-xs" aria-label={label}>
        <span className="mr-1 text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Header() {
  const { lastSync, sync, syncing, theme, toggleTheme, filters, resetFilters, alertStatus } = useAppState();
  const { data, warning } = useSnapshot();
  const navigate = useNavigate();
  const openCount = data?.alerts.filter((a) => (alertStatus[a.id] ?? "Aberto") === "Aberto").length ?? 0;
  const hasFilters = Object.entries(filters).some(([k, v]) => (k === "period" ? v !== "8" : v !== "all"));
  const all = { value: "all", label: "Todos" };
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
          <Button size="icon" variant="ghost" className="relative rounded-lg" aria-label={`${openCount} avisos abertos`} onClick={() => navigate({ to: "/avisos" })}>
            <Bell className="size-5" aria-hidden />
            {openCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-critical px-1 text-[10px] font-bold text-critical-foreground">
                {openCount}
              </span>
            )}
          </Button>
          <Button size="icon" variant="ghost" className="rounded-lg" onClick={toggleTheme} aria-label="Alternar tema">
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </div>
      </div>
      {data && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2 lg:px-8">
          <FilterSelect k="project" label="Projeto" options={[all, ...data.projects.map((p) => ({ value: p.id, label: p.name }))]} />
          <FilterSelect k="team" label="Equipe" options={[all, ...data.teams.map((t) => ({ value: t.id, label: t.name }))]} />
          <FilterSelect k="sprint" label="Iteração" options={[{ value: "all", label: "Todas" }, ...data.sprints.map((s) => ({ value: s.id, label: s.name }))]} />
          <FilterSelect k="type" label="Tipo" options={[all, ...WORK_ITEM_TYPES.map((t) => ({ value: t, label: typeMeta[t].label }))]} />
          <FilterSelect k="period" label="Período" options={[{ value: "4", label: "4 semanas" }, { value: "8", label: "8 semanas" }]} />
          <FilterSelect k="person" label="Pessoa" options={[all, ...data.people.map((p) => ({ value: p.person.id, label: p.person.name }))]} />
          {hasFilters && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetFilters}>
              <X className="size-3" /> Limpar filtros
            </Button>
          )}
        </div>
      )}
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
