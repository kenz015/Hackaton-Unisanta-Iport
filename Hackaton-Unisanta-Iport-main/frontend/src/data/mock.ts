import { addDays, differenceInCalendarDays, format, isWeekend, parseISO } from "date-fns";
import type { Absence, Holiday, Person, Project, Sprint, Team, WorkItem, WorkItemState, WorkItemType } from "./types";

/** Data de referência dos mocks ("hoje"). */
export const MOCK_TODAY = "2026-10-06";

export const teams: Team[] = [
  { id: "t1", name: "Squad Terminal" },
  { id: "t2", name: "Squad Gate" },
  { id: "t3", name: "Squad Portal" },
];

export const people: Person[] = [
  { id: "p1", name: "Marina Costa", role: "Dev Back-end", teamId: "t1", dedication: 1 },
  { id: "p2", name: "Rafael Souza", role: "Dev Full-stack", teamId: "t2", dedication: 1 },
  { id: "p3", name: "Lucas Almeida", role: "Dev Front-end", teamId: "t3", dedication: 1 },
  { id: "p4", name: "Juliana Ribeiro", role: "Analista de QA", teamId: "t1", dedication: 1 },
  { id: "p5", name: "Bruno Martins", role: "Tech Lead", teamId: "t2", dedication: 0.8 },
  { id: "p6", name: "Camila Ferreira", role: "Dev Back-end", teamId: "t3", dedication: 1 },
  { id: "p7", name: "Diego Oliveira", role: "DevOps", teamId: "t2", dedication: 1 },
  { id: "p8", name: "Fernanda Lima", role: "Product Owner", teamId: "t1", dedication: 0.5 },
  { id: "p9", name: "Gustavo Pereira", role: "Dev Mobile", teamId: "t3", dedication: 1 },
  { id: "p10", name: "Helena Santos", role: "Analista de Integração", teamId: "t1", dedication: 1 },
  { id: "p11", name: "Igor Carvalho", role: "Dev Back-end", teamId: "t2", dedication: 1 },
  { id: "p12", name: "Patrícia Rocha", role: "UX Designer", teamId: "t3", dedication: 0.75 },
];

export const projects: Project[] = [
  { id: "pr1", name: "Agendamento de Veículos", code: "AGV", colorVar: "--chart-1" },
  { id: "pr2", name: "Gate Automático", code: "GAT", colorVar: "--chart-2" },
  { id: "pr3", name: "Gestão de Pátio", code: "GPT", colorVar: "--chart-3" },
  { id: "pr4", name: "Portal de Clientes", code: "PCL", colorVar: "--chart-4" },
  { id: "pr5", name: "Integração Aduaneira", code: "IAD", colorVar: "--chart-5" },
];

export const sprints: Sprint[] = [
  { id: "s24", name: "Sprint 24", start: "2026-08-31", end: "2026-09-11" },
  { id: "s25", name: "Sprint 25", start: "2026-09-14", end: "2026-09-25" },
  { id: "s26", name: "Sprint 26", start: "2026-09-28", end: "2026-10-09" },
  { id: "s27", name: "Sprint 27", start: "2026-10-12", end: "2026-10-23" },
  { id: "s28", name: "Sprint 28", start: "2026-10-26", end: "2026-11-06" },
  { id: "s29", name: "Sprint 29", start: "2026-11-09", end: "2026-11-20" },
];
export const CURRENT_SPRINT_ID = "s26";

export const holidays: Holiday[] = [
  { date: "2026-07-09", name: "Revolução Constitucionalista", scope: "Estadual" },
  { date: "2026-09-07", name: "Independência do Brasil", scope: "Nacional" },
  { date: "2026-10-12", name: "Nossa Senhora Aparecida", scope: "Nacional" },
  { date: "2026-11-02", name: "Finados", scope: "Nacional" },
  { date: "2026-11-15", name: "Proclamação da República", scope: "Nacional" },
  { date: "2026-11-20", name: "Consciência Negra", scope: "Nacional" },
  { date: "2026-12-25", name: "Natal", scope: "Nacional" },
];

export const absences: Absence[] = [
  { personId: "p4", start: "2026-10-12", end: "2026-10-23", type: "Férias" },
  { personId: "p5", start: "2026-10-16", end: "2026-10-16", type: "Folga" },
  { personId: "p6", start: "2026-11-03", end: "2026-11-06", type: "Treinamento" },
  { personId: "p9", start: "2026-10-26", end: "2026-10-30", type: "Férias" },
  { personId: "p12", start: "2026-10-22", end: "2026-10-23", type: "Licença" },
];

// ---------- Geração determinística dos work items ----------

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;

const titles: Record<string, string[]> = {
  pr1: ["Fila de agendamento por janela", "Regra de no-show de caminhões", "Painel de slots por terminal", "Notificação SMS ao motorista", "API de reagendamento", "Validação de placa e CNH", "Relatório de ocupação de janelas"],
  pr2: ["Leitura OCR de contêiner", "Integração com balança rodoviária", "Liberação automática de cancela", "Tratamento de falha de câmera", "Log de passagens no gate", "Fluxo de exceção manual", "Calibração de LPR"],
  pr3: ["Mapa de pátio em tempo real", "Otimização de remanejo", "Inventário de contêineres", "Alocação de quadras", "Integração com RTG", "Alertas de reefer desligado"],
  pr4: ["Rastreamento de carga no portal", "Login com SSO do cliente", "Emissão de segunda via de fatura", "Dashboard do importador", "Upload de documentos", "Central de notificações"],
  pr5: ["Integração Siscomex", "Validação de DU-E", "Presença de carga automática", "Fila de mensagens da Receita", "Conciliação de manifestos", "Tratamento de retificações"],
};

const personProjects: Record<string, string[]> = {
  p1: ["pr3", "pr5"], p2: ["pr2", "pr1"], p3: ["pr4"], p4: ["pr3", "pr2"], p5: ["pr2"], p6: ["pr4", "pr5"],
  p7: ["pr2", "pr5"], p8: ["pr3", "pr1"], p9: ["pr4"], p10: ["pr5", "pr3"], p11: ["pr2", "pr1"], p12: ["pr4", "pr1"],
};

/** Ocupação-alvo por pessoa/sprint, para criar os cenários do mock. */
function targetFor(personId: string, sprintId: string): number {
  const base: Record<string, number> = {
    p1: 0.9, p2: 0.88, p3: 0.42, p4: 0.8, p5: 0.86, p6: 0.74, p7: 0.82, p8: 0.7, p9: 0.78, p10: 0.84, p11: 0.66, p12: 0.6,
  };
  if (personId === "p1" && (sprintId === "s26" || sprintId === "s27")) return 1.32;
  if (personId === "p2" && (sprintId === "s26" || sprintId === "s27")) return 1.18;
  return base[personId] ?? 0.75;
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");
const weekdaysBetween = (start: string, end: string) => {
  const s = parseISO(start);
  const n = differenceInCalendarDays(parseISO(end), s);
  const days: string[] = [];
  for (let i = 0; i <= n; i++) {
    const d = addDays(s, i);
    if (!isWeekend(d)) days.push(fmt(d));
  }
  return days;
};

const sprintIndex = (id: string) => sprints.findIndex((s) => s.id === id);
const currentIdx = sprintIndex(CURRENT_SPRINT_ID);

function stateFor(sIdx: number): WorkItemState {
  if (sIdx < currentIdx) return "Concluído";
  if (sIdx > currentIdx) return "Novo";
  return pick<WorkItemState>(["Ativo", "Ativo", "Ativo", "Em revisão", "Concluído", "Bloqueado"]);
}

let nextId = 4810;
const items: WorkItem[] = [];

for (const person of people) {
  for (const sprint of sprints) {
    const sIdx = sprintIndex(sprint.id);
    // pula sprints com ausência longa (cenários de conflito são injetados à parte)
    const longAbsence = absences.some(
      (a) => a.personId === person.id && weekdaysBetween(a.start, a.end).length >= 3 && a.start <= sprint.end && a.end >= sprint.start,
    );
    if (longAbsence) continue;

    const days = weekdaysBetween(sprint.start, sprint.end);
    const capacity = days.filter((d) => !holidays.some((h) => h.date === d)).length * 8 * person.dedication;
    const total = Math.round(capacity * targetFor(person.id, sprint.id));
    const count = rand() < 0.55 ? 2 : 1;
    const weights = Array.from({ length: count }, () => 0.6 + rand());
    const wsum = weights.reduce((a, b) => a + b, 0);

    weights.forEach((w, i) => {
      const projectId = pick(personProjects[person.id]!);
      const hours = Math.max(4, Math.round((total * w) / wsum));
      const state = stateFor(sIdx);
      const type: WorkItemType = pick(["User Story", "User Story", "Task", "Task", "Bug", "Feature"]);
      items.push({
        id: nextId++,
        title: pick(titles[projectId]!),
        type,
        state,
        assigneeId: person.id,
        projectId,
        sprintId: sprint.id,
        priority: (i === 0 ? pick([2, 2, 3]) : pick([3, 3, 4])) as 2 | 3 | 4,
        estimateHours: hours,
        remainingHours: state === "Concluído" ? 0 : sIdx === currentIdx ? Math.round(hours * 0.55) : hours,
        start: sprint.start,
        end: sprint.end,
        lastUpdated: sIdx < currentIdx ? sprint.end : fmt(addDays(parseISO(MOCK_TODAY), -Math.floor(rand() * 3))),
      });
    });
  }
}

// ---------- Cenários injetados de propósito ----------
const inject = (w: Omit<WorkItem, "id">) => items.push({ id: nextId++, ...w });

// 1 pessoa com item durante as férias
inject({ title: "Testes de regressão do Gate", type: "Task", state: "Novo", assigneeId: "p4", projectId: "pr2", sprintId: "s27", priority: 2, estimateHours: 24, remainingHours: 24, start: "2026-10-14", end: "2026-10-20", lastUpdated: "2026-10-05" });
// item em feriado
inject({ title: "Janela de deploy em produção", type: "Task", state: "Novo", assigneeId: "p11", projectId: "pr2", sprintId: "s28", priority: 2, estimateHours: 8, remainingHours: 8, start: "2026-11-02", end: "2026-11-02", lastUpdated: "2026-10-02" });
// sobreposição de itens críticos (Helena)
inject({ title: "Homologação Siscomex com a Receita", type: "Feature", state: "Ativo", assigneeId: "p10", projectId: "pr5", sprintId: "s26", priority: 1, estimateHours: 16, remainingHours: 10, start: "2026-10-05", end: "2026-10-08", lastUpdated: "2026-10-05" });
inject({ title: "Migração da fila de mensagens aduaneiras", type: "Feature", state: "Ativo", assigneeId: "p10", projectId: "pr5", sprintId: "s26", priority: 1, estimateHours: 12, remainingHours: 12, start: "2026-10-06", end: "2026-10-09", lastUpdated: "2026-10-05" });
// dependência de uma única pessoa (Diego) em itens críticos do Gate
inject({ title: "Pipeline de deploy do OCR", type: "Task", state: "Ativo", assigneeId: "p7", projectId: "pr2", sprintId: "s26", priority: 1, estimateHours: 6, remainingHours: 4, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-06" });
inject({ title: "Monitoramento das câmeras LPR", type: "Task", state: "Novo", assigneeId: "p7", projectId: "pr2", sprintId: "s27", priority: 1, estimateHours: 8, remainingHours: 8, start: "2026-10-13", end: "2026-10-16", lastUpdated: "2026-10-01" });
inject({ title: "Plano de contingência do gate", type: "Task", state: "Novo", assigneeId: "p7", projectId: "pr2", sprintId: "s27", priority: 1, estimateHours: 6, remainingHours: 6, start: "2026-10-19", end: "2026-10-21", lastUpdated: "2026-10-01" });
// sem responsável
inject({ title: "Corrigir timeout na consulta de DU-E", type: "Bug", state: "Novo", assigneeId: null, projectId: "pr5", sprintId: "s26", priority: 1, estimateHours: 6, remainingHours: 6, start: "2026-10-06", end: "2026-10-09", lastUpdated: "2026-10-03" });
inject({ title: "Tela de bloqueio de janela por terminal", type: "User Story", state: "Novo", assigneeId: null, projectId: "pr1", sprintId: "s27", priority: 2, estimateHours: 16, remainingHours: 16, start: "2026-10-12", end: "2026-10-23", lastUpdated: "2026-10-01" });
inject({ title: "Exportação de inventário em CSV", type: "Task", state: "Novo", assigneeId: null, projectId: "pr3", sprintId: "s27", priority: 3, estimateHours: 8, remainingHours: 8, start: "2026-10-12", end: "2026-10-23", lastUpdated: "2026-09-30" });
inject({ title: "Erro de fuso na timeline do portal", type: "Bug", state: "Novo", assigneeId: null, projectId: "pr4", sprintId: "s26", priority: 2, estimateHours: 4, remainingHours: 4, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-02" });
// sem estimativa
inject({ title: "Refatorar regras de no-show", type: "User Story", state: "Novo", assigneeId: "p2", projectId: "pr1", sprintId: "s27", priority: 2, estimateHours: null, remainingHours: null, start: "2026-10-12", end: "2026-10-23", lastUpdated: "2026-10-01" });
inject({ title: "Tela de auditoria do pátio", type: "User Story", state: "Novo", assigneeId: "p8", projectId: "pr3", sprintId: "s27", priority: 3, estimateHours: null, remainingHours: null, start: "2026-10-12", end: "2026-10-23", lastUpdated: "2026-09-29" });
inject({ title: "Acessibilidade do portal (WCAG)", type: "Feature", state: "Novo", assigneeId: "p12", projectId: "pr4", sprintId: "s28", priority: 3, estimateHours: null, remainingHours: null, start: "2026-10-26", end: "2026-11-06", lastUpdated: "2026-09-28" });
inject({ title: "Retentativa de mensagens rejeitadas", type: "Task", state: "Ativo", assigneeId: "p6", projectId: "pr5", sprintId: "s26", priority: 2, estimateHours: null, remainingHours: null, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-05" });
// sem iteração
inject({ title: "Investigar lentidão no mapa do pátio", type: "Bug", state: "Novo", assigneeId: "p1", projectId: "pr3", sprintId: null, priority: 3, estimateHours: 6, remainingHours: 6, start: "2026-10-19", end: "2026-10-23", lastUpdated: "2026-09-25" });
inject({ title: "Spike: leitura de lacres por câmera", type: "Task", state: "Novo", assigneeId: "p5", projectId: "pr2", sprintId: null, priority: 4, estimateHours: 8, remainingHours: 8, start: "2026-10-26", end: "2026-10-30", lastUpdated: "2026-09-22" });

// itens parados: alguns itens ativos da sprint atual sem atualização há dias
let staleCount = 0;
for (const it of items) {
  if (staleCount >= 4) break;
  if (it.sprintId === CURRENT_SPRINT_ID && (it.state === "Ativo" || it.state === "Bloqueado") && it.assigneeId !== "p10") {
    it.lastUpdated = fmt(addDays(parseISO(MOCK_TODAY), -(7 + staleCount * 3)));
    staleCount++;
  }
}

export const workItems: WorkItem[] = items;

/** Fração restante do escopo da sprint atual por dia útil (mock do histórico do Azure DevOps). */
export const currentSprintBurnRatio = [1, 0.96, 0.9, 0.84, 0.77, 0.71, 0.66];
