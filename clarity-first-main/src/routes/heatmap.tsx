import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, parseISO } from "date-fns";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSnapshot } from "@/services/api";
import { pct, type PersonCapacity, type WeekCell } from "@/services/capacity";
import { WorkItemTypeBadge } from "@/components/app/WorkItemTypeBadge";
import { filterPeople, useAppState } from "@/components/app/app-state";
import { Avatar, EmptyState, PageHeader, PageSkeleton } from "@/components/app/ui-bits";
import { Legend, UtilizationBadge, statusMeta } from "@/components/app/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/heatmap")({
  head: () => ({
    meta: [
      { title: "Heatmap de capacidade · iCrew" },
      { name: "description", content: "Matriz pessoa × semana com a utilização de cada membro da equipe." },
      { property: "og:title", content: "Heatmap de capacidade · iCrew" },
      { property: "og:description", content: "Veja quem está disponível, saudável, em atenção ou em sobrecarga." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Heatmap,
});

export function HeatmapCell({ cell, onClick }: { cell: WeekCell; onClick: () => void }) {
  const m = statusMeta[cell.status];
  return (
    <button
      onClick={onClick}
      className={cn("flex h-12 w-full flex-col items-center justify-center rounded-lg text-xs font-bold tabular-nums transition-transform hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-ring", m.cls)}
      aria-label={`${m.label}: ${pct(cell.utilization)}`}
    >
      <span className="flex items-center gap-1"><m.Icon className="size-3" aria-hidden />{cell.utilization === null ? m.label : pct(cell.utilization)}</span>
      <span className="text-[10px] font-medium opacity-80">{cell.load}h/{cell.capacity}h</span>
    </button>
  );
}

function Heatmap() {
  const { data, isLoading } = useSnapshot();
  const { filters } = useAppState();
  const [sel, setSel] = useState<{ pc: PersonCapacity; cell: WeekCell } | null>(null);
  if (isLoading || !data) return <PageSkeleton />;
  const n = Number(filters.period);
  const { projects, teams } = data;
  const list = filterPeople(data.people, filters, data.workItems);
  const cfg = data.config;

  return (
    <div>
      <PageHeader
        title="Heatmap de capacidade"
        subtitle={`<50% disponível · 50–${cfg.attentionLimit}% saudável · ${cfg.attentionLimit}–${cfg.overloadLimit}% atenção · >${cfg.overloadLimit}% sobrecarga`}
        actions={<Legend />}
      />
      <div className="surface-card overflow-x-auto p-4">
        {list.length === 0 ? <EmptyState title="Ninguém nos filtros atuais" text="Ajuste os filtros no topo da página." /> : (
          <table className="w-full border-separate border-spacing-1.5">
            <thead>
              <tr>
                <th className="w-56 text-left text-xs font-semibold uppercase text-muted-foreground">Pessoa</th>
                {data.weeks.slice(0, n).map((w) => (
                  <th key={w} className="min-w-20 text-center text-xs font-semibold text-muted-foreground">
                    {format(parseISO(w), "dd/MM")}
                    <span className="block text-[10px] font-normal">a {format(addDays(parseISO(w), 4), "dd/MM")}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((pc) => (
                <tr key={pc.person.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={pc.person.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{pc.person.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{pc.person.role} · {teams.find((t) => t.id === pc.person.teamId)?.name}</p>
                      </div>
                    </div>
                  </td>
                  {pc.weeks.slice(0, n).map((c) => (
                    <td key={c.weekStart}><HeatmapCell cell={c} onClick={() => setSel({ pc, cell: c })} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle className="title-caps">{sel.pc.person.name}</SheetTitle>
                <SheetDescription>Semana de {format(parseISO(sel.cell.weekStart), "dd/MM/yyyy")}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 px-4 pb-6">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[["Capacidade", `${sel.cell.capacity}h`], ["Alocado", `${sel.cell.load}h`], ["Livre", `${Math.round((sel.cell.capacity - sel.cell.load) * 10) / 10}h`]].map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-accent p-3">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{l}</p>
                      <p className="text-lg font-bold text-foreground">{v}</p>
                    </div>
                  ))}
                </div>
                <UtilizationBadge util={sel.cell.utilization} status={sel.cell.status} />
                <div className="space-y-2">
                  {sel.cell.items.length === 0 ? <EmptyState title="Sem itens nesta semana" /> : sel.cell.items.map(({ item, hours }) => {
                    const p = projects.find((x) => x.id === item.projectId);
                    return (
                      <div key={item.id} className="rounded-xl border border-border p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="size-2 rounded-full" style={{ background: `var(${p?.colorVar ?? "--color-primary"})` }} aria-hidden />
                          <WorkItemTypeBadge item={item} showLabel={false} /> #{item.id} · {p?.code ?? item.projectId} · {item.state} · P{item.priority}
                          <span className="ml-auto font-bold text-foreground">{hours}h</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
