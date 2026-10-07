import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotateCcw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSnapshot } from "@/services/api";
import { isAbsent, isOpen, weekdays, type Item, type PersonCapacity } from "@/services/capacity";
import { countsForCapacity, typeOf } from "@/data/agile";
import { filterPeople, itemMatches, useAppState } from "@/components/app/app-state";
import { Avatar, EmptyState, PageHeader, PageSkeleton } from "@/components/app/ui-bits";
import { UtilizationBadge } from "@/components/app/status";
import { WorkItemTypeBadge } from "@/components/app/WorkItemTypeBadge";
import { ReallocateDialog } from "@/components/app/ReallocateDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline de alocação · iCrew" },
      { name: "description", content: "Visão tipo Gantt da alocação de cada pessoa por dia, com ausências, feriados e conflitos." },
      { property: "og:title", content: "Timeline de alocação · iCrew" },
      { property: "og:description", content: "Quem está fazendo o quê, em cada dia, e onde há conflito." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Timeline,
});

const ROW_H = 30;
const COL_W = 34;

interface Bar {
  item: Item;
  s: number; // índice do primeiro dia visível
  e: number; // índice do último dia visível
  lane: number;
  conflict: string | null;
}

/** Distribui as barras em faixas para não se sobreporem visualmente. */
function layout(items: Item[], days: string[], personId: string | null, absentOn: (p: string, d: string) => unknown, holidays: Set<string>): { bars: Bar[]; lanes: number } {
  const first = days[0]!, last = days.at(-1)!;
  const visible = items
    .filter((w) => w.end >= first && w.start <= last)
    .sort((a, b) => a.start.localeCompare(b.start) || a.priority - b.priority);
  const laneEnds: number[] = [];
  const bars: Bar[] = [];
  for (const item of visible) {
    const s = Math.max(0, days.findIndex((d) => d >= item.start));
    let e = days.length - 1;
    for (let i = days.length - 1; i >= 0; i--) if (days[i]! <= item.end) { e = i; break; }
    if (e < s) continue;
    let lane = laneEnds.findIndex((end) => end < s);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(e); } else laneEnds[lane] = e;
    const span = days.slice(s, e + 1);
    const conflict =
      personId && span.some((d) => absentOn(personId, d)) ? "Cai em ausência da pessoa"
      : span.length <= 2 && span.some((d) => holidays.has(d)) ? "Agendado em feriado"
      : null;
    bars.push({ item, s, e, lane, conflict });
  }
  // Sobreposição de itens P1 da mesma pessoa
  for (const a of bars) for (const b of bars) {
    if (a !== b && personId && a.item.priority === 1 && b.item.priority === 1 && a.s <= b.e && b.s <= a.e) a.conflict ??= `Sobrepõe #${b.item.id} (ambos prioridade 1)`;
  }
  return { bars, lanes: Math.max(1, laneEnds.length) };
}

function Timeline() {
  const { data, isLoading } = useSnapshot();
  const { filters, overrides, clearOverrides } = useAppState();
  const [selected, setSelected] = useState<Item | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const start = data.weeks[0]!;
    const end = format(addDays(parseISO(start), Number(filters.period) * 7 - 3), "yyyy-MM-dd");
    const days = weekdays(start, end);
    const holidays = new Map(data.holidays.map((h) => [h.date, h.name]));
    const items = data.workItems.filter((w) => isOpen(w) && countsForCapacity(w) && itemMatches(w, filters));
    const people = filterPeople(data.people, filters, data.workItems);
    const unassigned = filters.person === "all" ? items.filter((w) => !w.assigneeId) : [];
    return { days, holidays, items, people, unassigned };
  }, [data, filters]);

  if (isLoading || !data || !view) return <PageSkeleton />;
  const { days, holidays, items, people, unassigned } = view;
  const absentOn = (p: string, d: string) => isAbsent(p, d, data.absences);
  const holidaySet = new Set(holidays.keys());
  const todayIdx = days.indexOf(data.today);
  const projectColor = (id: string) => data.projects.find((p) => p.id === id)?.colorVar ?? "--color-primary";
  const moved = Object.keys(overrides).length;

  const gridCols = { gridTemplateColumns: `repeat(${days.length}, minmax(${COL_W}px, 1fr))` };

  const renderRow = (key: string, label: ReactNode, personId: string | null, rowItems: Item[], pc?: PersonCapacity) => {
    const { bars, lanes } = layout(rowItems, days, personId, absentOn, holidaySet);
    return (
      <div key={key} className="flex border-b border-border last:border-b-0">
        <div className="sticky left-0 z-20 flex w-56 shrink-0 items-center gap-2 border-r border-border bg-card px-3 py-2">{label}{pc && <UtilizationBadge className="ml-auto" util={pc.current.utilization} status={pc.current.status} />}</div>
        <div className="relative grid flex-1 py-1" style={{ ...gridCols, gridTemplateRows: `repeat(${lanes}, ${ROW_H}px)` }}>
          {days.map((d, i) => {
            const off = personId ? absentOn(personId, d) : null;
            return (
              <div
                key={d}
                style={{ gridColumn: i + 1, gridRow: `1 / span ${lanes}` }}
                className={cn("border-l border-border/40", holidays.has(d) && "bg-muted", off && "hatch-absent bg-status-absent/70", i === todayIdx && "border-l-2 border-l-critical")}
                title={off ? `${String(off.type)}` : holidays.get(d)}
              />
            );
          })}
          {bars.map((b) => {
            const moved = b.item.id in overrides;
            return (
              <Tooltip key={b.item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSelected(b.item)}
                    style={{ gridColumn: `${b.s + 1} / ${b.e + 2}`, gridRow: b.lane + 1, background: `color-mix(in oklab, var(${projectColor(b.item.projectId)}) 22%, var(--color-card))`, borderColor: `var(${projectColor(b.item.projectId)})` }}
                    className={cn(
                      "z-10 mx-0.5 my-0.5 flex min-w-0 items-center gap-1 overflow-hidden rounded-md border-l-4 px-1.5 text-left text-[11px] font-medium text-foreground shadow-sm transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-ring",
                      b.conflict && "ring-2 ring-critical",
                      moved && "outline-dashed outline-2 outline-brand-cyan",
                    )}
                    aria-label={`${typeOf(b.item)} #${b.item.id} ${b.item.title}. Clique para realocar.`}
                  >
                    <WorkItemTypeBadge item={b.item} showLabel={false} />
                    <span className="truncate">#{b.item.id} {b.item.title}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold">{typeOf(b.item)} #{b.item.id} · P{b.item.priority}</p>
                  <p>{b.item.title}</p>
                  <p className="text-xs opacity-80">{format(parseISO(b.item.start), "dd/MM")}–{format(parseISO(b.item.end), "dd/MM")} · {b.item.estimateHours ?? "sem estimativa"}{b.item.estimateHours !== null ? "h" : ""} · {b.item.state}</p>
                  {b.conflict && <p className="mt-1 font-semibold text-critical">⚠ {b.conflict}</p>}
                  {moved && <p className="mt-1 text-xs">Realocado no painel</p>}
                  <p className="mt-1 text-xs opacity-80">Clique para realocar</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Timeline de alocação"
        subtitle="Cada barra é uma Task ou Bug no período em que será feita. Clique numa barra para simular a realocação."
        actions={
          moved > 0 ? (
            <Button size="sm" variant="outline" className="rounded-lg" onClick={clearOverrides}>
              <RotateCcw className="size-4" /> Desfazer {moved} {moved === 1 ? "realocação" : "realocações"}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Shuffle className="size-3" /> Nenhuma realocação aplicada</span>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="hatch-absent inline-block size-3 rounded-sm bg-status-absent" /> Ausência</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-muted" /> Feriado</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-sm ring-2 ring-critical" /> Conflito</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-critical" /> Hoje</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-sm outline-dashed outline-2 outline-brand-cyan" /> Realocado</span>
      </div>

      <div className="surface-card overflow-x-auto">
        {people.length === 0 && unassigned.length === 0 ? (
          <EmptyState title="Nada para mostrar com esses filtros" text="Ajuste os filtros no topo da página." />
        ) : (
          <div className="min-w-max">
            <div className="sticky top-0 z-30 flex border-b border-border bg-card">
              <div className="sticky left-0 z-30 w-56 shrink-0 border-r border-border bg-card px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Pessoa</div>
              <div className="grid flex-1" style={gridCols}>
                {days.map((d, i) => (
                  <div key={d} className={cn("border-l border-border/40 py-1.5 text-center text-[10px] leading-tight text-muted-foreground", i === todayIdx && "font-bold text-critical", holidays.has(d) && "bg-muted")} title={holidays.get(d)}>
                    <span className="block uppercase">{format(parseISO(d), "EEEEEE", { locale: ptBR })}</span>
                    {format(parseISO(d), "dd/MM")}
                  </div>
                ))}
              </div>
            </div>
            {people.map((pc) =>
              renderRow(
                pc.person.id,
                <>
                  <Avatar name={pc.person.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{pc.person.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{pc.person.role}</p>
                  </div>
                </>,
                pc.person.id,
                items.filter((w) => w.assigneeId === pc.person.id),
                pc,
              ),
            )}
            {unassigned.length > 0 &&
              renderRow(
                "__unassigned",
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-critical">Sem responsável</p>
                  <p className="text-[11px] text-muted-foreground">{unassigned.length} {unassigned.length === 1 ? "item" : "itens"} · clique para atribuir</p>
                </div>,
                null,
                unassigned,
              )}
          </div>
        )}
      </div>

      <ReallocateDialog item={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
