import { createFileRoute } from "@tanstack/react-router";
import { BriefcaseBusiness, CalendarClock, CircleDashed, Plane, RotateCcw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, PageSkeleton } from "@/components/app/ui-bits";
import { WorkItemTypeBadge } from "@/components/app/WorkItemTypeBadge";
import { UtilizationBadge } from "@/components/app/status";
import { useAppState } from "@/components/app/app-state";
import { useSnapshot } from "@/services/api";

export const Route = createFileRoute("/pessoas")({
  head: () => ({
    meta: [
      { title: "Pessoas · iCrew" },
      { name: "description", content: "Perfil simples de cada pessoa e suas tarefas atribuídas." },
      { property: "og:title", content: "Pessoas · iCrew" },
      { property: "og:description", content: "Perfil simples de cada pessoa e suas tarefas atribuídas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pessoas,
});

/** "2026-10-12" -> "12/10" */
const dataCurta = (iso?: string | null) => {
  const [, m, d] = (iso ?? "").split("-");
  return d && m ? `${d}/${m}` : (iso ?? "");
};

function Pessoas() {
  const { data, isLoading } = useSnapshot();
  const { filters, setFilter, resetFilters } = useAppState();

  if (isLoading || !data) return <PageSkeleton />;

  // data.people traz { person, current, weeks, nextAbsence }: os dados da pessoa ficam em "person"
  const filteredPeople = data.people
    .filter(({ person }) => {
      if (filters.team !== "all" && person.teamId !== filters.team) return false;
      if (filters.person !== "all" && person.id !== filters.person) return false;
      return true;
    })
    .sort((a, b) => a.person.name.localeCompare(b.person.name, "pt-BR"));

  const peopleWithTasks = filteredPeople.map(({ person, current, nextAbsence }) => {
    const tasks = data.workItems.filter((item) => item.assigneeId === person.id && (filters.project === "all" || item.projectId === filters.project) && (filters.type === "all" || item.type === filters.type));
    const openTasks = tasks.filter((item) => item.state !== "Concluído");
    // Mesma regra do resto do iCrew: só Task e Bug abertas contam horas
    const totalHours = Math.round(
      openTasks.filter((item) => item.type === "Task" || item.type === "Bug").reduce((sum, item) => sum + (item.remainingHours ?? item.estimateHours ?? 0), 0) * 10,
    ) / 10;

    return { person, current, nextAbsence, tasks, openTasks, totalHours };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Pessoas" subtitle="Perfil básico e tarefas atribuídas por pessoa." />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <Select value={filters.project} onValueChange={(value) => setFilter("project", value)}>
          <SelectTrigger className="h-9 w-40 text-xs" aria-label="Filtrar por projeto">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os projetos</SelectItem>
            {data.projects.map((project) => (
              <SelectItem key={project.id} value={project.id} className="text-xs">{project.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.team} onValueChange={(value) => setFilter("team", value)}>
          <SelectTrigger className="h-9 w-40 text-xs" aria-label="Filtrar por equipe">
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todas as equipes</SelectItem>
            {data.teams.map((team) => (
              <SelectItem key={team.id} value={team.id} className="text-xs">{team.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.person} onValueChange={(value) => setFilter("person", value)}>
          <SelectTrigger className="h-9 w-44 text-xs" aria-label="Filtrar por pessoa">
            <SelectValue placeholder="Pessoa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todas as pessoas</SelectItem>
            {[...data.people].map(({ person }) => person).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((person) => (
              <SelectItem key={person.id} value={person.id} className="text-xs">{person.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(value) => setFilter("type", value)}>
          <SelectTrigger className="h-9 w-40 text-xs" aria-label="Filtrar por tipo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os tipos</SelectItem>
            <SelectItem value="Task" className="text-xs">Task</SelectItem>
            <SelectItem value="Bug" className="text-xs">Bug</SelectItem>
            <SelectItem value="User Story" className="text-xs">User Story</SelectItem>
            <SelectItem value="Feature" className="text-xs">Feature</SelectItem>
            <SelectItem value="Epic" className="text-xs">Epic</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="rounded-lg" onClick={resetFilters}>
          <RotateCcw className="size-4" />
          Limpar
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {peopleWithTasks.map(({ person, current, nextAbsence, tasks, openTasks, totalHours }) => {
          const initials = (person.name ?? "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("");

          return (
            <article key={person.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {initials || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-foreground">{person.name || person.id}</h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {person.role}
                    {person.dedication < 1 && ` · ${Math.round(person.dedication * 100)}% de dedicação`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <UtilizationBadge util={current.utilization} status={current.status} />
                  <span className="text-[10px] text-muted-foreground">nesta semana</span>
                </div>
              </div>
              {nextAbsence && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  <Plane className="size-3" aria-hidden />
                  {nextAbsence.start === nextAbsence.end ? `${nextAbsence.type} em ${dataCurta(nextAbsence.start)}` : `${nextAbsence.type} de ${dataCurta(nextAbsence.start)} a ${dataCurta(nextAbsence.end)}`}
                </p>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-border bg-muted/40 p-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <UserRound className="size-3.5" aria-hidden />
                    <span>Abertas</span>
                  </div>
                  <div className="mt-2 text-base font-bold text-foreground">{openTasks.length}</div>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <BriefcaseBusiness className="size-3.5" aria-hidden />
                    <span>Horas abertas</span>
                  </div>
                  <div className="mt-2 text-base font-bold text-foreground">{totalHours}h</div>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <CalendarClock className="size-3.5" aria-hidden />
                    <span>Itens</span>
                  </div>
                  <div className="mt-2 text-base font-bold text-foreground">{tasks.length}</div>
                </div>
              </div>

              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-foreground">Tarefas atribuídas</h3>
                {tasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Nenhuma tarefa atribuída.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {tasks.map((task) => (
                      <li key={task.id} className="rounded-xl border border-border bg-muted/30 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <WorkItemTypeBadge type={task.type} className="shrink-0" />
                              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">#{task.id}</span>
                            </div>
                            <p className="mt-1 text-sm font-medium text-foreground">{task.title}</p>
                          </div>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {task.state}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span>{task.estimateHours ?? 0}h estimadas</span>
                          <span>{dataCurta(task.start)} → {dataCurta(task.end)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {peopleWithTasks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <CircleDashed className="mx-auto mb-2 size-5" aria-hidden />
          Nenhuma pessoa disponível no snapshot atual.
        </div>
      )}
    </div>
  );
}
