import { addDays, differenceInCalendarDays, format, isWeekend, parseISO, startOfWeek } from "date-fns";
import {
  MOCK_TODAY,
  CURRENT_SPRINT_ID,
  absences,
  currentSprintBurnRatio,
  holidays,
  people,
  projects,
  sprints,
  teams,
  workItems,
} from "@/data/mock";
import type { Absence, Holiday, Person, WorkItem } from "@/data/types";
import { defaultConfig, type CapacityConfig } from "./config";

export type UtilStatus = "available" | "healthy" | "attention" | "overload" | "absent" | "conflict";
export type Severity = "critical" | "attention" | "info";
export type AlertType =
  | "sobrecarga"
  | "ausencia"
  | "feriado"
  | "sobreposicao"
  | "sem-responsavel"
  | "sem-estimativa"
  | "sem-iteracao"
  | "parado"
  | "sprint-risco"
  | "ociosa"
  | "dependencia";

export interface WeekCell {
  weekStart: string;
  capacity: number;
  load: number;
  utilization: number | null; // null quando capacidade = 0
  status: UtilStatus;
  items: { item: WorkItem; hours: number }[];
}

export interface PersonCapacity {
  person: Person;
  weeks: WeekCell[];
  current: WeekCell;
  activeItems: number;
  nextAbsence: Absence | null;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: Severity;
  title: string;
  description: string;
  entities: string[];
  date: string;
  action: string;
  personId?: string | undefined;
  itemIds?: number[];
}

export interface Snapshot {
  today: string;
  config: CapacityConfig;
  weeks: string[];
  people: PersonCapacity[];
  alerts: Alert[];
  briefing: string[];
  healthScore: number;
  burndown: { day: string; ideal: number; real: number | null }[];
  sprintAtRisk: boolean;
  upcomingOff: { date: string; label: string; kind: "Feriado" | Absence["type"]; personId?: string }[];
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");
const isHoliday = (d: string, hs: Holiday[]) => hs.some((h) => h.date === d);

export function weekdays(start: string, end: string): string[] {
  const s = parseISO(start);
  const n = differenceInCalendarDays(parseISO(end), s);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const d = addDays(s, i);
    if (!isWeekend(d)) out.push(fmt(d));
  }
  return out;
}

export function isAbsent(personId: string, day: string) {
  return absences.find((a) => a.personId === personId && a.start <= day && a.end >= day) ?? null;
}

export function statusFor(util: number | null, load: number, cfg: CapacityConfig): UtilStatus {
  if (util === null) return load > 0 ? "conflict" : "absent";
  const pct = util * 100;
  if (pct > cfg.overloadLimit) return "overload";
  if (pct >= cfg.attentionLimit) return "attention";
  if (pct >= 50) return "healthy";
  return "available";
}

const isOpen = (w: WorkItem) => w.state !== "Concluído";

/** Horas do item em um dia (distribuídas pelos dias úteis do item). */
function hoursPerDay(item: WorkItem) {
  const days = weekdays(item.start, item.end);
  return days.length ? (item.estimateHours ?? 0) / days.length : 0;
}

function dayCapacity(person: Person, day: string, cfg: CapacityConfig) {
  if (isHoliday(day, holidays) || isAbsent(person.id, day)) return 0;
  return cfg.hoursPerDay * person.dedication;
}

function computeWeek(person: Person, weekStart: string, cfg: CapacityConfig): WeekCell {
  const days = weekdays(weekStart, fmt(addDays(parseISO(weekStart), 4)));
  const capacity = days.reduce((s, d) => s + dayCapacity(person, d, cfg), 0);
  const items: WeekCell["items"] = [];
  for (const it of workItems) {
    if (it.assigneeId !== person.id || !isOpen(it)) continue;
    const perDay = hoursPerDay(it);
    const hrs = days.filter((d) => d >= it.start && d <= it.end).length * perDay;
    if (hrs > 0) items.push({ item: it, hours: Math.round(hrs * 10) / 10 });
  }
  const load = Math.round(items.reduce((s, i) => s + i.hours, 0) * 10) / 10;
  const utilization = capacity > 0 ? load / capacity : null;
  return { weekStart, capacity, load, utilization, status: statusFor(utilization, load, cfg), items };
}

export const pct = (u: number | null) => (u === null ? "—" : `${Math.round(u * 100)}%`);
const br = (d: string) => format(parseISO(d), "dd/MM");
const first = (name: string) => name.split(" ")[0];

export function buildSnapshot(cfg: CapacityConfig = defaultConfig): Snapshot {
  const today = MOCK_TODAY;
  const w0 = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  const weeks = Array.from({ length: 8 }, (_, i) => fmt(addDays(w0, i * 7)));

  const peopleCap: PersonCapacity[] = people.map((person) => {
    const ws = weeks.map((w) => computeWeek(person, w, cfg));
    const nextAbsence =
      absences.filter((a) => a.personId === person.id && a.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
    return {
      person,
      weeks: ws,
      current: ws[0]!,
      activeItems: workItems.filter((w) => w.assigneeId === person.id && isOpen(w) && w.start <= weeks[1]).length,
      nextAbsence,
    };
  });

  const alerts: Alert[] = [];
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? "Sem responsável";
  const proj = (id: string) => projects.find((p) => p.id === id)?.name ?? id;

  // Sobrecarga (próximas 2 semanas) + sugestão de quem absorve
  const horizon = peopleCap.map((pc) => ({ pc, peak: pc.weeks.slice(0, 2).reduce((a, b) => ((b.utilization ?? 0) > (a.utilization ?? 0) ? b : a)) }));
  const freeSorted = [...horizon].filter((h) => (h.peak.utilization ?? 1) < 0.6).sort((a, b) => (a.peak.utilization ?? 0) - (b.peak.utilization ?? 0));
  for (const { pc, peak } of horizon) {
    if (peak.utilization !== null && peak.utilization * 100 > cfg.overloadLimit) {
      const helper = freeSorted.find((f) => f.pc.person.teamId !== "" && f.pc.person.id !== pc.person.id);
      const movable = Math.max(1, Math.min(3, peak.items.length - 1));
      alerts.push({
        id: `sobrecarga-${pc.person.id}`,
        type: "sobrecarga",
        severity: "critical",
        title: `${first(pc.person.name)} em sobrecarga`,
        description: `${first(pc.person.name)} está com ${pct(peak.utilization)} na semana de ${br(peak.weekStart)}${helper ? `; ${movable} ${movable > 1 ? "itens podem" : "item pode"} ir para ${first(helper.pc.person.name)}, que está com ${pct(helper.peak.utilization)}` : ""}.`,
        entities: [pc.person.name, ...(helper ? [helper.pc.person.name] : [])],
        date: peak.weekStart,
        action: helper ? `Realocar itens para ${first(helper.pc.person.name)}` : "Revisar escopo da semana",
        personId: pc.person.id,
        itemIds: peak.items.map((i) => i.item.id),
      });
    }
  }

  // Ociosa
  for (const { pc } of freeSorted.slice(0, 1)) {
    const avgU = pc.weeks.slice(0, 4).reduce((s, w) => s + (w.utilization ?? 0), 0) / 4;
    if (avgU < 0.5) {
      const freeH = Math.round(pc.weeks.slice(0, 2).reduce((s, w) => s + (w.capacity - w.load), 0));
      alerts.push({
        id: `ociosa-${pc.person.id}`,
        type: "ociosa",
        severity: "info",
        title: `${first(pc.person.name)} tem capacidade livre`,
        description: `${first(pc.person.name)} tem ~${freeH}h livres nas próximas 2 semanas (média de ${pct(avgU)} nas próximas 4).`,
        entities: [pc.person.name],
        date: today,
        action: "Oferecer itens de quem está em sobrecarga",
        personId: pc.person.id,
      });
    }
  }

  const open = workItems.filter(isOpen);

  // Item em ausência / feriado
  for (const it of open) {
    if (!it.assigneeId) continue;
    const days = weekdays(it.start, it.end);
    const absentDay = days.find((d) => isAbsent(it.assigneeId!, d));
    if (absentDay) {
      const a = isAbsent(it.assigneeId, absentDay)!;
      alerts.push({
        id: `ausencia-${it.id}`,
        type: "ausencia",
        severity: "critical",
        title: `Item alocado durante ${a.type.toLowerCase()}`,
        description: `#${it.id} "${it.title}" (${it.estimateHours ?? "?"}h) está com ${first(name(it.assigneeId))}, que estará em ${a.type.toLowerCase()} de ${br(a.start)} a ${br(a.end)}.`,
        entities: [name(it.assigneeId), `#${it.id}`],
        date: absentDay,
        action: "Reatribuir ou mover datas do item",
        personId: it.assigneeId,
        itemIds: [it.id],
      });
    }
    const hol = days.find((d) => isHoliday(d, holidays));
    if (hol && days.length <= 2) {
      const h = holidays.find((x) => x.date === hol)!;
      alerts.push({
        id: `feriado-${it.id}`,
        type: "feriado",
        severity: "attention",
        title: "Item agendado em feriado",
        description: `#${it.id} "${it.title}" está marcado para ${br(hol)} (${h.name}).`,
        entities: [name(it.assigneeId), `#${it.id}`],
        date: hol,
        action: "Antecipar ou adiar o item",
        personId: it.assigneeId,
        itemIds: [it.id],
      });
    }
  }

  // Sobreposição de itens prioritários (P1) da mesma pessoa
  const p1 = open.filter((w) => w.priority === 1 && w.assigneeId);
  for (let i = 0; i < p1.length; i++)
    for (let j = i + 1; j < p1.length; j++) {
      const a = p1[i]!, b = p1[j]!;
      if (a.assigneeId === b.assigneeId && a.start <= b.end && b.start <= a.end) {
        alerts.push({
          id: `sobreposicao-${a.id}-${b.id}`,
          type: "sobreposicao",
          severity: "attention",
          title: "Itens críticos sobrepostos",
          description: `${first(name(a.assigneeId))} tem #${a.id} e #${b.id} (prioridade 1) no mesmo período (${br(b.start > a.start ? b.start : a.start)}).`,
          entities: [name(a.assigneeId), `#${a.id}`, `#${b.id}`],
          date: b.start > a.start ? b.start : a.start,
          action: "Sequenciar ou dividir os itens",
          personId: a.assigneeId!,
          itemIds: [a.id, b.id],
        });
      }
    }

  // Qualidade do board
  const noOwner = open.filter((w) => !w.assigneeId);
  noOwner.forEach((it) =>
    alerts.push({
      id: `sem-responsavel-${it.id}`,
      type: "sem-responsavel",
      severity: it.priority === 1 ? "critical" : "attention",
      title: "Item sem responsável",
      description: `#${it.id} "${it.title}" (${proj(it.projectId)}, P${it.priority}) não tem responsável.`,
      entities: [`#${it.id}`, proj(it.projectId)],
      date: it.start,
      action: "Atribuir a alguém com folga",
      itemIds: [it.id],
    }),
  );
  open.filter((w) => w.estimateHours === null).forEach((it) =>
    alerts.push({
      id: `sem-estimativa-${it.id}`,
      type: "sem-estimativa",
      severity: "attention",
      title: "Item sem estimativa",
      description: `#${it.id} "${it.title}" não tem horas estimadas; a carga de ${first(name(it.assigneeId))} pode estar subestimada.`,
      entities: [name(it.assigneeId), `#${it.id}`],
      date: it.start,
      action: "Estimar no refinamento",
      personId: it.assigneeId ?? undefined,
      itemIds: [it.id],
    }),
  );
  open.filter((w) => !w.sprintId).forEach((it) =>
    alerts.push({
      id: `sem-iteracao-${it.id}`,
      type: "sem-iteracao",
      severity: "info",
      title: "Item sem iteração",
      description: `#${it.id} "${it.title}" não está em nenhuma sprint.`,
      entities: [name(it.assigneeId), `#${it.id}`],
      date: it.start,
      action: "Planejar em uma sprint",
      personId: it.assigneeId ?? undefined,
      itemIds: [it.id],
    }),
  );
  const staleLimit = fmt(addDays(parseISO(today), -cfg.staleDays));
  open
    .filter((w) => (w.state === "Ativo" || w.state === "Bloqueado") && w.lastUpdated < staleLimit)
    .forEach((it) => {
      const daysStale = differenceInCalendarDays(parseISO(today), parseISO(it.lastUpdated));
      alerts.push({
        id: `parado-${it.id}`,
        type: "parado",
        severity: "attention",
        title: "Item parado",
        description: `#${it.id} "${it.title}" está "${it.state}" sem atualização há ${daysStale} dias.`,
        entities: [name(it.assigneeId), `#${it.id}`],
        date: it.lastUpdated,
        action: `Falar com ${first(name(it.assigneeId))}`,
        personId: it.assigneeId ?? undefined,
        itemIds: [it.id],
      });
    });

  // Dependência de uma única pessoa
  for (const pr of projects) {
    const crit = p1.filter((w) => w.projectId === pr.id);
    const owners = new Set(crit.map((w) => w.assigneeId));
    if (crit.length >= 3 && owners.size === 1) {
      const owner = [...owners][0]!;
      alerts.push({
        id: `dependencia-${pr.id}`,
        type: "dependencia",
        severity: "attention",
        title: "Dependência de uma única pessoa",
        description: `Os ${crit.length} itens críticos de ${pr.name} estão todos com ${first(name(owner))}.`,
        entities: [name(owner), pr.name],
        date: today,
        action: "Parear alguém para dividir o conhecimento",
        personId: owner,
        itemIds: crit.map((c) => c.id),
      });
    }
  }

  // Burndown da sprint atual
  const sprint = sprints.find((s) => s.id === CURRENT_SPRINT_ID)!;
  const sDays = weekdays(sprint.start, sprint.end).filter((d) => !isHoliday(d, holidays));
  const total = workItems.filter((w) => w.sprintId === sprint.id).reduce((s, w) => s + (w.estimateHours ?? 0), 0);
  const burndown = sDays.map((d, i) => ({
    day: br(d),
    ideal: Math.round(total * (1 - i / (sDays.length - 1))),
    real: currentSprintBurnRatio[i] !== undefined ? Math.round(total * currentSprintBurnRatio[i]!) : null,
  }));
  const lastReal = burndown.filter((b) => b.real !== null).at(-1)!;
  const gap = (lastReal.real! - lastReal.ideal) / total;
  const sprintAtRisk = gap > 0.15;
  if (sprintAtRisk) {
    const remainingDays = sDays.filter((d) => d > today).length;
    alerts.push({
      id: `sprint-risco-${sprint.id}`,
      type: "sprint-risco",
      severity: "critical",
      title: `${sprint.name} em risco`,
      description: `Restam ${lastReal.real}h de trabalho e ${remainingDays} dias úteis; o ideal hoje seria ${lastReal.ideal}h (${Math.round(gap * 100)}% acima).`,
      entities: [sprint.name],
      date: today,
      action: "Renegociar escopo com o PO",
    });
  }

  const sevOrder: Record<Severity, number> = { critical: 0, attention: 1, info: 2 };
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.date.localeCompare(b.date));

  // Score de saúde do board
  const ratio = (n: number) => (open.length ? 1 - n / open.length : 1);
  const healthScore = Math.round(
    100 *
      (0.3 * ratio(open.filter((w) => w.estimateHours === null).length) +
        0.3 * ratio(noOwner.length) +
        0.2 * ratio(open.filter((w) => !w.sprintId).length) +
        0.2 * ratio(alerts.filter((a) => a.type === "parado").length)) -
      8,
  );

  // Briefing
  const over = peopleCap.filter((p) => p.weeks.slice(0, 2).some((w) => w.utilization !== null && w.utilization * 100 > cfg.overloadLimit));
  const free = [...peopleCap].sort((a, b) => (a.current.utilization ?? 1) - (b.current.utilization ?? 1))[0]!;
  const briefing = [
    `${over.length} ${over.length === 1 ? "pessoa está" : "pessoas estão"} acima de ${cfg.overloadLimit}% nas próximas 2 semanas: ${over.map((o) => first(o.person.name)).join(" e ")}.`,
    `${first(free.person.name)} tem ${Math.round((1 - (free.current.utilization ?? 0)) * 100)}% livre e pode absorver itens.`,
    sprintAtRisk ? `${sprint.name} está ${Math.round(gap * 100)}% atrás do ideal; vale revisar o escopo hoje.` : `${sprint.name} está dentro do ritmo esperado.`,
    `Juliana entra de férias em 12/10 e ainda tem item atribuído no período.`,
    `${noOwner.length} itens abertos estão sem responsável.`,
  ];

  // Próximas ausências e feriados (30 dias)
  const limit = fmt(addDays(parseISO(today), 30));
  const upcomingOff: Snapshot["upcomingOff"] = [
    ...holidays.filter((h) => h.date >= today && h.date <= limit).map((h) => ({ date: h.date, label: h.name, kind: "Feriado" as const })),
    ...absences
      .filter((a) => a.end >= today && a.start <= limit)
      .map((a) => ({ date: a.start, label: `${name(a.personId)} · ${br(a.start)}–${br(a.end)}`, kind: a.type, personId: a.personId })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return { today, config: cfg, weeks, people: peopleCap, alerts, briefing, healthScore, burndown, sprintAtRisk, upcomingOff };
}

export { people, projects, sprints, teams, workItems, holidays, absences, CURRENT_SPRINT_ID };
