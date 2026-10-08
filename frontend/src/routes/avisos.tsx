import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, UserRound } from "lucide-react";
import { useSnapshot } from "@/services/api";
import type { Severity } from "@/services/capacity";
import { useAppState, type AlertStatus } from "@/components/app/app-state";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/app/ui-bits";
import { severityMeta } from "@/components/app/status";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WorkItemTypeBadge } from "@/components/app/WorkItemTypeBadge";
import { typeMeta, type WorkItemType } from "@/data/agile";

export const Route = createFileRoute("/avisos")({
  head: () => ({
    meta: [
      { title: "Central de avisos · iCrew" },
      { name: "description", content: "Sobrecargas, conflitos de ausência, itens parados e riscos de sprint com ação sugerida." },
      { property: "og:title", content: "Central de avisos · iCrew" },
      { property: "og:description", content: "Todos os avisos de capacidade e governança em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Avisos,
});

const typeLabels: Record<WorkItemType, string> = {
  Epic: typeMeta.Epic.label,
  Feature: typeMeta.Feature.label,
  "User Story": typeMeta["User Story"].label,
  Task: typeMeta.Task.label,
  Bug: typeMeta.Bug.label,
  Issue: typeMeta.Issue.label,
};

function Avisos() {
  const { data, isLoading } = useSnapshot();
  const { filters } = useAppState();
  const [sev, setSev] = useState<Severity | "all">("all");
  const [type, setType] = useState<WorkItemType | "all">("all");
  const [status, setStatus] = useState<AlertStatus | "all">("all");
  if (isLoading || !data) return <PageSkeleton />;

  const realTasks = useMemo(() => {
    const seen = new Set<number>();
    return data.workItems.filter((w) => {
      if (!w.title || !w.title.trim()) return false;
      if (seen.has(w.id)) return false;
      if (w.projectId && w.start && w.end) {
        seen.add(w.id);
        return true;
      }
      return false;
    });
  }, [data.workItems]);

  const base = realTasks.filter((w) => {
    if (filters.person !== "all" && w.assigneeId !== filters.person) return false;
    if (filters.project !== "all" && w.projectId !== filters.project) return false;
    if (filters.type !== "all" && w.type !== filters.type) return false;
    return true;
  });

  const list = base.filter((w) => {
    const itemSev = w.priority === 1 ? "critical" : w.priority === 2 ? "attention" : "info";
    const itemStatus = w.state === "Concluído" ? "Resolvido" : "Aberto";
    return (sev === "all" || itemSev === sev) && (type === "all" || w.type === type) && (status === "all" || itemStatus === status);
  });

  const counts = (s: Severity) => base.filter((w) => ((w.priority === 1 ? "critical" : w.priority === 2 ? "attention" : "info") === s) && (w.state !== "Concluído")).length;

  return (
    <div>
      <PageHeader title="Central de avisos" subtitle="Todos os avisos reais, sem duplicatas e sem itens sem criação válida." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "critical", "attention", "info"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSev(s)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", sev === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent")}
          >
            {s === "all" ? "Todas severidades" : `${severityMeta[s].label} (${counts(s)})`}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Select value={type} onValueChange={(v) => setType(v as WorkItemType | "all")}>
            <SelectTrigger className="h-8 w-48 rounded-lg text-xs" aria-label="Tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os tipos</SelectItem>
              {Object.entries(typeLabels).map(([k, l]) => <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as AlertStatus | "all")}>
            <SelectTrigger className="h-8 w-36 rounded-lg text-xs" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "Aberto", "Resolvido"].map((s) => <SelectItem key={s} value={s} className="text-xs">{s === "all" ? "Todos status" : s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="surface-card p-4">
        {list.length === 0 ? (
          <EmptyState title="Nenhuma tarefa com esses filtros" text="Experimente mudar a severidade, o tipo ou o status." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {list.map((w) => (
              <article key={w.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <WorkItemTypeBadge type={w.type} />
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", w.state === "Concluído" ? "bg-status-available text-status-available-foreground" : "bg-highlight-soft text-highlight-foreground dark:text-highlight")}>
                    {w.state}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">#{w.id} · {w.title}</h3>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <UserRound className="size-3.5" aria-hidden />
                    <span>{w.assigneeId ? w.assigneeId : "Sem responsável"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-3.5" aria-hidden />
                    <span>{w.start} → {w.end}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span>Prioridade {w.priority}</span>
                    <span>{w.estimateHours ?? 0}h estimadas</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
