/**
 * Regras do processo Agile do Azure DevOps usadas pelo iCrew.
 *
 * Hierarquia: Epic → Feature → User Story → Task / Bug.  Issue = impedimento.
 * Só Task e Bug têm horas (Remaining Work / Original Estimate), então só eles
 * entram no cálculo de capacidade. Epic e Feature são acompanhados por progresso.
 */

export type WorkItemType = "Epic" | "Feature" | "User Story" | "Task" | "Bug" | "Issue";

/** Campos extras que o Azure traz e que os dados de exemplo podem não ter. */
export interface AgileFields {
  type?: WorkItemType;
  parentId?: number | null;
  azureState?: string;
}

/** Tipos destacados no processo do projeto (os que aparecem nos filtros). */
export const WORK_ITEM_TYPES: WorkItemType[] = ["Epic", "Feature", "User Story", "Task", "Bug", "Issue"];

/** Tipos que consomem horas das pessoas. */
export const CAPACITY_TYPES: WorkItemType[] = ["Task", "Bug"];

/** Tipos que agrupam outros itens (acompanhados por progresso, não por horas). */
export const CONTAINER_TYPES: WorkItemType[] = ["Epic", "Feature"];

/** Item sem tipo (dados de exemplo antigos) é tratado como Task. */
export const typeOf = (w: AgileFields) => w.type ?? "Task";
export const countsForCapacity = (w: AgileFields) => CAPACITY_TYPES.includes(typeOf(w));

/** Estados do Agile → estados usados nas telas. */
export function mapAgileState(state: string, blocked: boolean): "Novo" | "Ativo" | "Em revisão" | "Bloqueado" | "Concluído" {
  if (state === "Closed" || state === "Removed") return "Concluído";
  if (blocked) return "Bloqueado";
  if (state === "Resolved") return "Em revisão";
  if (state === "Active") return "Ativo";
  return "Novo";
}

export const typeMeta: Record<WorkItemType, { label: string; color: string; description: string }> = {
  Epic: { label: "Epic", color: "#FF7B00", description: "Grande objetivo, dividido em Features" },
  Feature: { label: "Feature", color: "#773B93", description: "Funcionalidade entregue ao usuário" },
  "User Story": { label: "User Story", color: "#009CCC", description: "Necessidade do usuário, dividida em Tasks" },
  Task: { label: "Task", color: "#C9A000", description: "Trabalho a ser feito, com horas estimadas" },
  Bug: { label: "Bug", color: "#CC293D", description: "Defeito a ser corrigido" },
  Issue: { label: "Issue", color: "#B4009E", description: "Impedimento que trava o progresso" },
};

/** Feriados nacionais (e de SP) no período do projeto. */
export const DEFAULT_HOLIDAYS = [
  { date: "2026-10-12", name: "Nossa Senhora Aparecida" },
  { date: "2026-11-02", name: "Finados" },
  { date: "2026-11-20", name: "Consciência Negra" },
  { date: "2026-12-25", name: "Natal" },
];
