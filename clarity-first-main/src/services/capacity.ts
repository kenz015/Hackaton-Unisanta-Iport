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
import type { Absence, Holiday, Person, Project, Sprint, Team, WorkItem } from "@/data/types";
import { CONTAINER_TYPES, countsForCapacity, typeOf, type AgileFields } from "@/data/agile";
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
  | "dependencia"
  | "impedimento"
  | "orfa";

/** Work item com os campos do processo Agile (tipo, pai). */
export type Item = WorkItem & AgileFields;

/** Tudo o que o cálculo precisa. Vem dos dados de exemplo ou do Azure DevOps. */
export interface Source {
  origin: "azure" | "mock";
  today: string;
  currentSprintId: string;
  people: Person[];
  projects: Project[];
  sprints: Sprint[];
  teams: Team[];
  workItems: Item[];
  absences: Absence[];
  holidays: Holiday[];
  /** Fração do trabalho restante por dia útil da sprint (para o burndown). */
  burnRatio: (number | undefined)[];
}

export interface WeekCell {
  weekStart: string;
  capacity: number;
  load: number;
  utilization: number | null; // null quando capacidade = 0
  status: UtilStatus;
  items: { item: Item; hours: number }[];
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

export interface RoadmapEntry {
  id: number;
  type: "Epic" | "Feature";
  title: string;
  state: string;
  done: number;
  total: number;
  progress: number; // 0..1
}

export interface Snapshot {
  origin: Source["origin"];
  today: string;
  config: CapacityConfig;
  weeks: string[];
  people: PersonCapacity[];
  alerts: Alert[];
  briefing: string[];
  healthScore: number;
  burndown: { day: string; ideal: number; real: number | null }[];
  sprintAtRisk: boolean;
  sprintName: string;
  upcomingOff: { date: string; label: string; kind: "Feriado" | Absence["type"]; personId?: string }[];
  roadmap: RoadmapEntry[];
  // Listas usadas pelas telas e filtros (antes vinham direto do mock)
  workItems: Item[];
  projects: Project[];
  teams: Team[];
  sprints: Sprint[];
  holidays: Holiday[];
  absences: Absence[];
}

/** Dados de exemplo, usados quando o Azure não está configurado ou falha. */
export const mockSource: Source = {
  origin: "mock",
  today: MOCK_TODAY,
  currentSprintId: CURRENT_SPRINT_ID,
  people,
  projects,
  sprints,
  teams,
  workItems,
  absences,
  holidays,
  burnRatio: currentSprintBurnRatio,
};

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

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

export function isAbsent(personId: string, day: string, list: Absence[] = absences) {
  return list.find((a) => a.personId === personId && a.start <= day && a.end >= day) ?? null;
}

export function statusFor(util: number | null, load: number, cfg: CapacityConfig): UtilStatus {
  if (util === null) return load > 0 ? "conflict" : "absent";
  const pct = util * 100;
  if (pct > cfg.overloadLimit) return "overload";
  if (pct >= cfg.attentionLimit) return "attention";
  if (pct >= 50) return "healthy";
  return "available";
}

export const isOpen = (w: Item) => w.state !== "Concluído";
export const pct = (u: number | null) => (u === null ? "—" : `${Math.round(u * 100)}%`);
const br = (d: string) => format(parseISO(d), "dd/MM");
const first = (name: string) => name.split(" ")[0];

/** Horas do item em um dia (distribuídas pelos dias úteis do item). */
function hoursPerDay(item: Item) {
  const days = weekdays(item.start, item.end);
  return days.length ? (item.estimateHours ?? 0) / days.length : 0;
}

/** Aplica realocações simuladas (itemId → novo responsável) sobre os dados. */
export function applyOverrides(src: Source, overrides: Record<number, string | null>): Source {
  if (!Object.keys(overrides).length) return src;
  return {
    ...src,
    workItems: src.workItems.map((w) => (w.id in overrides ? { ...w, assigneeId: overrides[w.id] ?? null } : w)),
  };
}

export function buildSnapshot(cfg: CapacityConfig = defaultConfig, src: Source = mockSource): Snapshot {
  const { today, people: persons, projects: projs, sprints: sprs, workItems: items, absences: abs, holidays: hols } = src;
  const isHoliday = (d: string) => hols.some((h) => h.date === d);
  const absentOn = (personId: string, day: string) => isAbsent(personId, day, abs);
  const dayCapacity = (person: Person, day: string) => (isHoliday(day) || absentOn(person.id, day) ? 0 : cfg.hoursPerDay * person.dedication);

  const capItems = items.filter((w) => isOpen(w) && countsForCapacity(w));

  const computeWeek = (person: Person, weekStart: string): WeekCell => {
    const days = weekdays(weekStart, fmt(addDays(parseISO(weekStart), 4)));
    const capacity = Math.round(days.reduce((s, d) => s + dayCapacity(person, d), 0) * 10) / 10;
    const wItems: WeekCell["items"] = [];
    for (const it of capItems) {
      if (it.assigneeId !== person.id) continue;
      const hrs = days.filter((d) => d >= it.start && d <= it.end).length * hoursPerDay(it);
      if (hrs > 0) wItems.push({ item: it, hours: Math.round(hrs * 10) / 10 });
    }
    const load = Math.round(wItems.reduce((s, i) => s + i.hours, 0) * 10) / 10;
    const utilization = capacity > 0 ? load / capacity : null;
    return { weekStart, capacity, load, utilization, status: statusFor(utilization, load, cfg), items: wItems };
  };

  const w0 = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  const weeks = Array.from({ length: 8 }, (_, i) => fmt(addDays(w0, i * 7)));

  const peopleCap: PersonCapacity[] = persons.map((person) => {
    const ws = weeks.map((w) => computeWeek(person, w));
    const nextAbsence = abs.filter((a) => a.personId === person.id && a.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
    return {
      person,
      weeks: ws,
      current: ws[0]!,
      activeItems: capItems.filter((w) => w.assigneeId === person.id && w.start <= weeks[1]!).length,
      nextAbsence,
    };
  });

  const alerts: Alert[] = [];
  const name = (id: string | null | undefined) => persons.find((p) => p.id === id)?.name ?? "Sem responsável";
  const proj = (id: string) => projs.find((p) => p.id === id)?.name ?? id;

  // Sobrecarga (próximas 2 semanas) + sugestão de quem absorve
  const horizon = peopleCap.map((pc) => ({
    pc,
    peak: pc.weeks.slice(0, 2).reduce((a, b) => ((b.utilization ?? 0) > (a.utilization ?? 0) ? b : a)),
  }));
  const freeSorted = horizon
    .filter((h) => (h.peak.utilization ?? 1) < 0.6)
    .sort((a, b) => (a.peak.utilization ?? 0) - (b.peak.utilization ?? 0));
  for (const { pc, peak } of horizon) {
    if (peak.utilization !== null && peak.utilization * 100 > cfg.overloadLimit) {
      const helper = freeSorted.find((f) => f.pc.person.id !== pc.person.id);
      const movable = Math.max(1, Math.min(3, peak.items.length - 1));
      alerts.push({
        id: `sobrecarga-${pc.person.id}`,
        type: "sobrecarga",
        severity: "critical",
        title: `${first(pc.person.name)} em sobrecarga`,
        description: `${first(pc.person.name)} está com ${pct(peak.utilization)} na semana de ${br(peak.weekStart)} (${peak.load}h para ${peak.capacity}h)${helper ? `; ${movable} ${movable > 1 ? "itens podem" : "item pode"} ir para ${first(helper.pc.person.name)}, que está com ${pct(helper.peak.utilization)}` : ""}.`,
        entities: [pc.person.name, ...(helper ? [helper.pc.person.name] : [])],
        date: peak.weekStart,
        action: helper ? `Realocar itens para ${first(helper.pc.person.name)}` : "Revisar escopo da semana",
        personId: pc.person.id,
        itemIds: peak.items.map((i) => i.item.id),
      });
    }
  }

  // Pessoa ociosa
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

  // Item em ausência / feriado
  for (const it of capItems) {
    if (!it.assigneeId) continue;
    const days = weekdays(it.start, it.end);
    const absentDay = days.find((d) => absentOn(it.assigneeId!, d));
    if (absentDay) {
      const a = absentOn(it.assigneeId, absentDay)!;
      alerts.push({
        id: `ausencia-${it.id}`,
        type: "ausencia",
        severity: "critical",
        title: `Item alocado durante ${String(a.type).toLowerCase()}`,
        description: `${typeOf(it)} #${it.id} "${it.title}" (${it.estimateHours ?? "?"}h) está com ${first(name(it.assigneeId))}, que estará em ${String(a.type).toLowerCase()} de ${br(a.start)} a ${br(a.end)}.`,
        entities: [name(it.assigneeId), `#${it.id}`],
        date: absentDay,
        action: "Reatribuir ou mover datas do item",
        personId: it.assigneeId,
        itemIds: [it.id],
      });
    }
    const hol = days.find(isHoliday);
    if (hol && days.length <= 2) {
      const h = hols.find((x) => x.date === hol)!;
      alerts.push({
        id: `feriado-${it.id}`,
        type: "feriado",
        severity: "attention",
        title: "Item agendado em feriado",
        description: `${typeOf(it)} #${it.id} "${it.title}" está marcado para ${br(hol)} (${h.name}).`,
        entities: [name(it.assigneeId), `#${it.id}`],
        date: hol,
        action: "Antecipar ou adiar o item",
        personId: it.assigneeId,
        itemIds: [it.id],
      });
    }
  }

  // Sobreposição de itens prioritários (P1) da mesma pessoa
  const p1 = capItems.filter((w) => w.priority === 1 && w.assigneeId);
  for (let i = 0; i < p1.length; i++)
    for (let j = i + 1; j < p1.length; j++) {
      const a = p1[i]!, b = p1[j]!;
      if (a.assigneeId === b.assigneeId && a.start <= b.end && b.start <= a.end) {
        const from = b.start > a.start ? b.start : a.start;
        alerts.push({
          id: `sobreposicao-${a.id}-${b.id}`,
          type: "sobreposicao",
          severity: "attention",
          title: "Itens críticos sobrepostos",
          description: `${first(name(a.assigneeId))} tem #${a.id} e #${b.id} (prioridade 1) no mesmo período (a partir de ${br(from)}).`,
          entities: [name(a.assigneeId), `#${a.id}`, `#${b.id}`],
          date: from,
          action: "Sequenciar ou dividir os itens",
          personId: a.assigneeId!,
          itemIds: [a.id, b.id],
        });
      }
    }

  // Issues abertas = impedimentos
  const issues = items.filter((w) => isOpen(w) && typeOf(w) === "Issue");
  issues.forEach((it) => {
    const age = differenceInCalendarDays(parseISO(today), parseISO(it.lastUpdated));
    alerts.push({
      id: `impedimento-${it.id}`,
      type: "impedimento",
      severity: it.priority === 1 ? "critical" : "attention",
      title: "Impedimento aberto",
      description: `Issue #${it.id} "${it.title}" está aberta${it.assigneeId ? ` com ${first(name(it.assigneeId))}` : " sem responsável"} (última atualização há ${age} dia${age === 1 ? "" : "s"}).`,
      entities: [name(it.assigneeId), `#${it.id}`],
      date: it.lastUpdated,
      action: "Resolver ou escalar o impedimento na Daily",
      personId: it.assigneeId ?? undefined,
      itemIds: [it.id],
    });
  });

  // Qualidade do board (regras do Agile: horas só em Task/Bug)
  const workOpen = items.filter((w) => isOpen(w) && !CONTAINER_TYPES.includes(typeOf(w)));
  const noOwner = workOpen.filter((w) => !w.assigneeId && typeOf(w) !== "User Story");
  noOwner.forEach((it) =>
    alerts.push({
      id: `sem-responsavel-${it.id}`,
      type: "sem-responsavel",
      severity: it.priority === 1 ? "critical" : "attention",
      title: "Item sem responsável",
      description: `${typeOf(it)} #${it.id} "${it.title}" (${proj(it.projectId)}, P${it.priority}) não tem responsável.`,
      entities: [`#${it.id}`, proj(it.projectId)],
      date: it.start,
      action: "Atribuir a alguém com folga",
      itemIds: [it.id],
    }),
  );
  const noEstimate = capItems.filter((w) => w.estimateHours === null);
  noEstimate.forEach((it) =>
    alerts.push({
      id: `sem-estimativa-${it.id}`,
      type: "sem-estimativa",
      severity: "attention",
      title: "Item sem estimativa",
      description: `${typeOf(it)} #${it.id} "${it.title}" não tem horas (Remaining Work); a carga de ${first(name(it.assigneeId))} pode estar subestimada.`,
      entities: [name(it.assigneeId), `#${it.id}`],
      date: it.start,
      action: "Estimar no refinamento",
      personId: it.assigneeId ?? undefined,
      itemIds: [it.id],
    }),
  );
  const noSprint = workOpen.filter((w) => !w.sprintId && typeOf(w) !== "Issue");
  noSprint.forEach((it) =>
    alerts.push({
      id: `sem-iteracao-${it.id}`,
      type: "sem-iteracao",
      severity: "info",
      title: "Item sem iteração",
      description: `${typeOf(it)} #${it.id} "${it.title}" não está em nenhuma sprint.`,
      entities: [name(it.assigneeId), `#${it.id}`],
      date: it.start,
      action: "Planejar em uma sprint",
      personId: it.assigneeId ?? undefined,
      itemIds: [it.id],
    }),
  );
  // Task sem User Story pai (só quando o dado de hierarquia existe)
  capItems
    .filter((w) => typeOf(w) === "Task" && w.parentId === null)
    .forEach((it) =>
      alerts.push({
        id: `orfa-${it.id}`,
        type: "orfa",
        severity: "info",
        title: "Task sem item pai",
        description: `Task #${it.id} "${it.title}" não está ligada a nenhuma User Story ou Bug.`,
        entities: [name(it.assigneeId), `#${it.id}`],
        date: it.start,
        action: "Vincular a uma User Story",
        personId: it.assigneeId ?? undefined,
        itemIds: [it.id],
      }),
    );
  const staleLimit = fmt(addDays(parseISO(today), -cfg.staleDays));
  const stale = workOpen.filter((w) => (w.state === "Ativo" || w.state === "Bloqueado") && w.lastUpdated < staleLimit && typeOf(w) !== "Issue");
  stale.forEach((it) => {
    const daysStale = differenceInCalendarDays(parseISO(today), parseISO(it.lastUpdated));
    alerts.push({
      id: `parado-${it.id}`,
      type: "parado",
      severity: "attention",
      title: "Item parado",
      description: `${typeOf(it)} #${it.id} "${it.title}" está "${it.state}" sem atualização há ${daysStale} dias.`,
      entities: [name(it.assigneeId), `#${it.id}`],
      date: it.lastUpdated,
      action: `Falar com ${first(name(it.assigneeId))}`,
      personId: it.assigneeId ?? undefined,
      itemIds: [it.id],
    });
  });

  // Dependência de uma única pessoa
  for (const pr of projs) {
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

  // Burndown da sprint atual (horas de Task/Bug)
  const sprint = sprs.find((s) => s.id === src.currentSprintId) ?? sprs[0];
  let burndown: Snapshot["burndown"] = [];
  let sprintAtRisk = false;
  let gap = 0;
  if (sprint) {
    const sDays = weekdays(sprint.start, sprint.end).filter((d) => !isHoliday(d));
    const total = items.filter((w) => w.sprintId === sprint.id && countsForCapacity(w)).reduce((s, w) => s + (w.estimateHours ?? 0), 0);
    burndown = sDays.map((d, i) => ({
      day: br(d),
      ideal: Math.round(total * (1 - i / Math.max(1, sDays.length - 1))),
      real: src.burnRatio[i] !== undefined ? Math.round(total * src.burnRatio[i]!) : null,
    }));
    const lastReal = burndown.filter((b) => b.real !== null).at(-1);
    if (lastReal && total > 0) {
      gap = (lastReal.real! - lastReal.ideal) / total;
      sprintAtRisk = gap > 0.15;
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
    }
  }

  const sevOrder: Record<Severity, number> = { critical: 0, attention: 1, info: 2 };
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.date.localeCompare(b.date));

  // Score de saúde do board: média ponderada de 4 critérios, sem ajustes manuais
  const ratio = (n: number, base: number) => (base ? 1 - n / base : 1);
  const healthScore = Math.round(
    100 *
      (0.3 * ratio(noEstimate.length, capItems.length) +
        0.3 * ratio(noOwner.length, workOpen.length) +
        0.2 * ratio(noSprint.length, workOpen.length) +
        0.2 * ratio(stale.length, workOpen.length)),
  );

  // Briefing: todas as frases calculadas a partir dos dados
  const over = peopleCap.filter((p) => p.weeks.slice(0, 2).some((w) => w.utilization !== null && w.utilization * 100 > cfg.overloadLimit));
  const free = [...peopleCap].filter((p) => p.current.utilization !== null).sort((a, b) => a.current.utilization! - b.current.utilization!)[0];
  const limit30 = fmt(addDays(parseISO(today), 30));
  const absenceWithWork = abs
    .filter((a) => a.end >= today && a.start <= limit30)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => ({ a, n: capItems.filter((w) => w.assigneeId === a.personId && w.start <= a.end && w.end >= a.start).length }))
    .find((x) => x.n > 0);
  const briefing = [
    over.length
      ? `${over.length} ${over.length === 1 ? "pessoa está" : "pessoas estão"} acima de ${cfg.overloadLimit}% nas próximas 2 semanas: ${over.map((o) => first(o.person.name)).join(" e ")}.`
      : `Ninguém está acima de ${cfg.overloadLimit}% nas próximas 2 semanas.`,
    free ? `${first(free.person.name)} tem ${Math.round((1 - free.current.utilization!) * 100)}% livre nesta semana e pode absorver itens.` : null,
    sprint ? (sprintAtRisk ? `${sprint.name} está ${Math.round(gap * 100)}% atrás do ideal; vale revisar o escopo hoje.` : `${sprint.name} está dentro do ritmo esperado.`) : null,
    absenceWithWork
      ? `${first(name(absenceWithWork.a.personId))} entra em ${String(absenceWithWork.a.type).toLowerCase()} em ${br(absenceWithWork.a.start)} e ainda tem ${absenceWithWork.n} ${absenceWithWork.n === 1 ? "item" : "itens"} no período.`
      : null,
    issues.length ? `${issues.length} ${issues.length === 1 ? "impedimento (Issue) aberto" : "impedimentos (Issues) abertos"}.` : null,
    `${noOwner.length} ${noOwner.length === 1 ? "item aberto está" : "itens abertos estão"} sem responsável.`,
  ].filter((b): b is string => !!b);

  // Próximas ausências e feriados (30 dias)
  const upcomingOff: Snapshot["upcomingOff"] = [
    ...hols.filter((h) => h.date >= today && h.date <= limit30).map((h) => ({ date: h.date, label: h.name, kind: "Feriado" as const })),
    ...abs
      .filter((a) => a.end >= today && a.start <= limit30)
      .map((a) => ({ date: a.start, label: `${name(a.personId)} · ${br(a.start)}–${br(a.end)}`, kind: a.type, personId: a.personId })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Progresso de Epics e Features (pelas Tasks/Bugs descendentes)
  const children = new Map<number, Item[]>();
  for (const w of items) if (w.parentId) children.set(w.parentId, [...(children.get(w.parentId) ?? []), w]);
  const leaves = (id: number, depth = 0): Item[] =>
    depth > 5 ? [] : (children.get(id) ?? []).flatMap((c) => (countsForCapacity(c) ? [c] : leaves(c.id, depth + 1)));
  const roadmap: RoadmapEntry[] = items
    .filter((w) => CONTAINER_TYPES.includes(typeOf(w)))
    .map((w) => {
      const ls = leaves(w.id);
      const done = ls.filter((l) => !isOpen(l)).length;
      return { id: w.id, type: typeOf(w) as "Epic" | "Feature", title: w.title, state: w.state, done, total: ls.length, progress: ls.length ? done / ls.length : 0 };
    })
    .sort((a, b) => (a.type === b.type ? a.progress - b.progress : a.type === "Epic" ? -1 : 1));

  return {
    origin: src.origin,
    today,
    config: cfg,
    weeks,
    people: peopleCap,
    alerts,
    briefing,
    healthScore,
    burndown,
    sprintAtRisk,
    sprintName: sprint?.name ?? "Sprint atual",
    upcomingOff,
    roadmap,
    workItems: items,
    projects: projs,
    teams: src.teams,
    sprints: sprs,
    holidays: hols,
    absences: abs,
  };
}

/** Pico de utilização de uma pessoa nas semanas que o item ocupa. */
export function peakFor(snap: Snapshot, personId: string, item: Item) {
  const pc = snap.people.find((p) => p.person.id === personId);
  if (!pc) return null;
  const ws = pc.weeks.filter((w) => w.weekStart <= item.end && fmt(addDays(parseISO(w.weekStart), 4)) >= item.start);
  if (!ws.length) return pc.current;
  return ws.reduce((a, b) => ((b.utilization ?? 0) > (a.utilization ?? 0) ? b : a));
}

// Exportados para compatibilidade com arquivos que ainda importam o mock daqui.
export { people, projects, sprints, teams, workItems, holidays, absences, CURRENT_SPRINT_ID };
