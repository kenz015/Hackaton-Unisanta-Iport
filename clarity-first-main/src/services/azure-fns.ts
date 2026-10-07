/**
 * Funções que rodam SÓ NO SERVIDOR (TanStack Start "server functions").
 * O PAT do Azure e a chave da IA ficam no .env e nunca chegam ao navegador.
 *
 * Variáveis no .env (na pasta clarity-first-main):
 *   ADO_ORG=nome-da-organizacao
 *   ADO_PROJECT=nome-do-projeto
 *   ADO_TEAM=nome-do-time           (opcional; padrão "<projeto> Team")
 *   ADO_PAT=token-com-Work-Items-Read-Write
 *   AI_API_KEY=chave-da-ia
 *   AI_MODEL=gpt-4o-mini            (opcional)
 *   AI_BASE_URL=https://api.openai.com/v1   (opcional; qualquer API compatível)
 */
import { createServerFn } from "@tanstack/react-start";
import { addDays, format, parseISO } from "date-fns";
import type { Absence, Holiday, Person, Project, Sprint, Team } from "@/data/types";
import { DEFAULT_HOLIDAYS, mapAgileState, type WorkItemType } from "@/data/agile";
import type { Item, Source } from "@/services/capacity";

const API = "api-version=7.1";
const env = (k: string) => process.env[k]?.trim() || "";

function azureConfig() {
  const org = env("ADO_ORG");
  const project = env("ADO_PROJECT");
  const pat = env("ADO_PAT");
  const team = env("ADO_TEAM") || `${project} Team`;
  const ok = !!org && !!project && !!pat && !pat.startsWith("cole-");
  return { ok, org, project, team, pat };
}

async function ado<T>(path: string, init?: RequestInit): Promise<T> {
  const c = azureConfig();
  const res = await fetch(`https://dev.azure.com/${encodeURIComponent(c.org)}/${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${btoa(`:${c.pat}`)}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Azure DevOps respondeu ${res.status} em ${path.split("?")[0]}`);
  return (await res.json()) as T;
}

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : undefined);
const COLORS = ["--color-primary", "--color-brand-cyan", "--color-brand-turquoise", "--color-highlight", "--color-critical"];

interface AdoIteration { id: string; name: string; path: string; attributes: { startDate?: string; finishDate?: string; timeFrame?: string } }
interface AdoMember { teamMember: { id: string; displayName: string; uniqueName: string }; activities: { capacityPerDay: number; name: string | null }[]; daysOff: { start: string; end: string }[] }

/** Busca work items, sprints, capacidade e folgas no Azure e devolve no formato das telas. */
export const getAzureSource = createServerFn({ method: "GET" }).handler(async (): Promise<Source | null> => {
  const c = azureConfig();
  if (!c.ok) return null; // sem configuração: o front usa os dados de exemplo

  const proj = encodeURIComponent(c.project);
  const team = encodeURIComponent(c.team);
  const today = format(new Date(), "yyyy-MM-dd");
  const horizonEnd = format(addDays(new Date(), 60), "yyyy-MM-dd");

  // 1) Sprints do time
  const its = await ado<{ value: AdoIteration[] }>(`${proj}/${team}/_apis/work/teamsettings/iterations?${API}`);
  const iterations = its.value.filter((i) => i.attributes.startDate && i.attributes.finishDate);
  const sprints: Sprint[] = iterations.map((i) => ({ id: i.id, name: i.name, start: day(i.attributes.startDate)!, end: day(i.attributes.finishDate)! }) as Sprint);
  const current = iterations.find((i) => i.attributes.timeFrame === "current") ?? iterations.find((i) => day(i.attributes.startDate)! <= today && day(i.attributes.finishDate)! >= today);
  const relevant = iterations.filter((i) => day(i.attributes.finishDate)! >= today && day(i.attributes.startDate)! <= horizonEnd);

  // 2) Capacidade e folgas de cada sprint relevante
  const people = new Map<string, Person>();
  const absences: Absence[] = [];
  const holidays: Holiday[] = DEFAULT_HOLIDAYS.map((h) => ({ ...h }) as Holiday);
  const hoursPerDay = 8;
  for (const it of relevant) {
    const cap = await ado<{ teamMembers?: AdoMember[]; value?: AdoMember[] }>(`${proj}/${team}/_apis/work/teamsettings/iterations/${it.id}/capacities?${API}`).catch((): { teamMembers?: AdoMember[]; value?: AdoMember[] } => ({ teamMembers: [] }));
    for (const m of cap.teamMembers ?? cap.value ?? []) {
      const id = m.teamMember.uniqueName.toLowerCase();
      const perDay = m.activities.reduce((s, a) => s + (a.capacityPerDay || 0), 0);
      if (!people.has(id) || it.id === current?.id) {
        people.set(id, {
          id,
          name: m.teamMember.displayName,
          role: m.activities.find((a) => a.name)?.name ?? "Desenvolvimento",
          teamId: c.team,
          dedication: perDay > 0 ? Math.min(1, perDay / hoursPerDay) : 1,
        } as Person);
      }
      for (const d of m.daysOff) absences.push({ personId: id, start: day(d.start)!, end: day(d.end)!, type: "Folga" as string } as Absence);
    }
    const off = await ado<{ daysOff: { start: string; end: string }[] }>(`${proj}/${team}/_apis/work/teamsettings/iterations/${it.id}/teamdaysoff?${API}`).catch(() => ({ daysOff: [] }));
    for (const d of off.daysOff) {
      for (let x = parseISO(day(d.start)!); format(x, "yyyy-MM-dd") <= day(d.end)!; x = addDays(x, 1)) {
        const date = format(x, "yyyy-MM-dd");
        if (!holidays.some((h) => h.date === date)) holidays.push({ date, name: "Folga do time" } as Holiday);
      }
    }
  }

  // 3) Work items do processo Agile
  const wiql = {
    query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project
            AND [System.WorkItemType] IN ('Epic','Feature','User Story','Task','Bug','Issue')
            AND [System.State] <> 'Removed' ORDER BY [System.ChangedDate] DESC`,
  };
  const ids = (await ado<{ workItems: { id: number }[] }>(`${proj}/_apis/wit/wiql?${API}`, { method: "POST", body: JSON.stringify(wiql) })).workItems.map((w) => w.id);
  const raw: { id: number; fields: Record<string, unknown> }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = await ado<{ value: typeof raw }>(`${proj}/_apis/wit/workitems?ids=${ids.slice(i, i + 200).join(",")}&${API}`);
    raw.push(...batch.value);
  }

  const projects = new Map<string, Project>();
  const items: Item[] = raw.map((w) => {
    const f = w.fields;
    const str = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
    const num = (k: string) => (typeof f[k] === "number" ? (f[k] as number) : undefined);
    const type = str("System.WorkItemType") as WorkItemType;
    const assigned = f["System.AssignedTo"] as { uniqueName?: string; displayName?: string } | undefined;
    const assigneeId = assigned?.uniqueName?.toLowerCase() ?? null;
    if (assigneeId && !people.has(assigneeId)) {
      people.set(assigneeId, { id: assigneeId, name: assigned?.displayName ?? assigneeId, role: "Desenvolvimento", teamId: c.team, dedication: 1 } as Person);
    }
    const area = (str("System.AreaPath") ?? c.project).split("\\").at(-1)!;
    if (!projects.has(area)) projects.set(area, { id: area, name: area, code: area.slice(0, 4).toUpperCase(), colorVar: COLORS[projects.size % COLORS.length]! } as Project);
    const iterPath = str("System.IterationPath");
    const sprint = iterations.find((i) => i.path === iterPath);
    const tags = (str("System.Tags") ?? "").toLowerCase();
    const blocked = str("Microsoft.VSTS.CMMI.Blocked") === "Yes" || tags.includes("blocked") || tags.includes("bloqueado");
    const start = day(str("Microsoft.VSTS.Scheduling.StartDate")) ?? day(sprint?.attributes.startDate) ?? day(str("System.CreatedDate")) ?? today;
    const endRaw =
      day(str("Microsoft.VSTS.Scheduling.TargetDate")) ??
      day(str("Microsoft.VSTS.Scheduling.FinishDate")) ??
      day(str("Microsoft.VSTS.Scheduling.DueDate")) ??
      day(sprint?.attributes.finishDate) ??
      start;
    const hours = type === "Task" || type === "Bug" ? (num("Microsoft.VSTS.Scheduling.RemainingWork") ?? num("Microsoft.VSTS.Scheduling.OriginalEstimate") ?? null) : null;
    return {
      id: w.id,
      title: str("System.Title") ?? `#${w.id}`,
      type,
      azureState: str("System.State"),
      state: mapAgileState(str("System.State") ?? "New", blocked),
      priority: num("Microsoft.VSTS.Common.Priority") ?? 2,
      assigneeId,
      projectId: area,
      sprintId: sprint?.id ?? null,
      estimateHours: hours,
      start,
      end: endRaw < start ? start : endRaw,
      lastUpdated: day(str("System.ChangedDate")) ?? today,
      parentId: num("System.Parent") ?? null,
    } as Item;
  });

  // 4) Burndown aproximado: só o ponto de hoje (o Azure não guarda o histórico diário aqui)
  const burnRatio: (number | undefined)[] = [];
  if (current) {
    const total = items.filter((w) => w.sprintId === current.id && (w.type === "Task" || w.type === "Bug")).reduce((s, w) => s + (w.estimateHours ?? 0), 0);
    const original = raw
      .filter((w) => items.find((i) => i.id === w.id)?.sprintId === current.id)
      .reduce((s, w) => s + ((w.fields["Microsoft.VSTS.Scheduling.OriginalEstimate"] as number) ?? 0), 0);
    let idx = 0;
    for (let x = parseISO(day(current.attributes.startDate)!); format(x, "yyyy-MM-dd") < today; x = addDays(x, 1)) if (x.getDay() % 6 !== 0) idx++;
    if (original > 0) burnRatio[idx] = total / original;
  }

  return {
    origin: "azure",
    today,
    currentSprintId: current?.id ?? sprints[0]?.id ?? "",
    people: [...people.values()],
    projects: [...projects.values()],
    sprints,
    teams: [{ id: c.team, name: c.team } as Team],
    workItems: items,
    absences,
    holidays,
    burnRatio,
  };
});

/** Muda o responsável de um work item no Azure (ou só valida, com validateOnly). */
export const reassignWorkItem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; assignee: string | null; validateOnly?: boolean }) => d)
  .handler(async ({ data }) => {
    const c = azureConfig();
    if (!c.ok) throw new Error("Azure DevOps não configurado no .env");
    const body = [{ op: "add", path: "/fields/System.AssignedTo", value: data.assignee ?? "" }];
    await ado(`${encodeURIComponent(c.project)}/_apis/wit/workitems/${data.id}?${API}${data.validateOnly ? "&validateOnly=true" : ""}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json-patch+json" },
    });
    return { ok: true };
  });

/** Pede à IA uma explicação curta do aviso, usando só os números fornecidos. */
export const explainAlertAI = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; description: string; action: string; why: string }) => d)
  .handler(async ({ data }) => {
    const key = env("AI_API_KEY");
    if (!key || key.startsWith("cole-")) return { text: null as string | null };
    const prompt = `Você é um gestor de projetos experiente ajudando uma equipe de software que usa Azure DevOps (processo Agile).
Explique o aviso abaixo em até 4 frases curtas, em português do Brasil, para alguém que não é especialista:
1) o que está acontecendo, citando os números; 2) por que isso importa para a entrega; 3) o conceito de gestão envolvido (ex.: capacidade, WIP, impedimento); 4) a ação recomendada.
Use APENAS os dados abaixo. Não invente números, nomes ou datas.

Aviso: ${data.title}
Detalhes: ${data.description}
Contexto: ${data.why}
Ação sugerida pelo sistema: ${data.action}`;
    const res = await fetch(`${env("AI_BASE_URL") || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env("AI_MODEL") || "gpt-4o-mini", temperature: 0.3, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`IA respondeu ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { text: json.choices?.[0]?.message?.content?.trim() ?? null };
  });
