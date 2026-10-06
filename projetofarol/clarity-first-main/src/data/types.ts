export type WorkItemType = "User Story" | "Task" | "Bug" | "Feature";
export type WorkItemState = "Novo" | "Ativo" | "Em revisão" | "Bloqueado" | "Concluído";

export interface Person {
  id: string;
  name: string;
  role: string;
  teamId: string;
  dedication: number; // 0..1
}

export interface Team {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  colorVar: string; // css var name, e.g. --chart-1
}

export interface Sprint {
  id: string;
  name: string;
  start: string; // yyyy-MM-dd
  end: string;
}

export interface WorkItem {
  id: number;
  title: string;
  type: WorkItemType;
  state: WorkItemState;
  assigneeId: string | null;
  projectId: string;
  sprintId: string | null;
  priority: 1 | 2 | 3 | 4;
  estimateHours: number | null;
  remainingHours: number | null;
  start: string;
  end: string;
  lastUpdated: string;
}

export type AbsenceType = "Férias" | "Folga" | "Licença" | "Treinamento";

export interface Absence {
  personId: string;
  start: string;
  end: string;
  type: AbsenceType;
}

export interface Holiday {
  date: string;
  name: string;
  scope: "Nacional" | "Estadual";
}
