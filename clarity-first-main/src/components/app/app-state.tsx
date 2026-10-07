import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Item, PersonCapacity } from "@/services/capacity";
import type { SourceResult } from "@/services/api";
import { typeOf } from "@/data/agile";
import { people } from "@/services/capacity";

export type AlertStatus = "Aberto" | "Resolvido" | "Ignorado";

export interface Filters {
  project: string; // "all" | id
  team: string;
  sprint: string;
  period: "4" | "8";
  person: string;
  type: string; // "all" | WorkItemType
}

interface AppState {
  filters: Filters;
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  resetFilters: () => void;
  alertStatus: Record<string, AlertStatus>;
  setAlertStatus: (id: string, s: AlertStatus) => void;
  /** Realocações feitas no painel: itemId → novo responsável (null = sem responsável). */
  overrides: Record<number, string | null>;
  reassign: (itemId: number, personId: string | null) => void;
  clearOverrides: () => void;
  lastSync: Date;
  syncing: boolean;
  sync: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const defaults: Filters = { project: "all", team: "all", sprint: "all", period: "8", person: "all", type: "all" };
const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(defaults);
  const [alertStatus, setStatus] = useState<Record<string, AlertStatus>>({});
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const [lastSync, setLastSync] = useState(() => new Date());
  const [syncing, setSyncing] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      if (localStorage.getItem("icrew-theme") === "dark") setTheme("dark");
    } catch {
      /* armazenamento indisponível */
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("icrew-theme", theme);
    } catch {
      /* armazenamento indisponível */
    }
  }, [theme]);

  const sync = useCallback(async () => {
    setSyncing(true);
    await qc.refetchQueries({ queryKey: ["snapshot"] });
    const res = qc.getQueryData<SourceResult>(["snapshot"]);
    setLastSync(new Date());
    setSyncing(false);
    if (res?.warning) toast.error(`Não foi possível ler o Azure DevOps: ${res.warning}. Mostrando dados de demonstração.`);
    else if (res?.source.origin === "azure") toast.success(`Sincronizado com o Azure DevOps · ${res.source.workItems.length} work items`);
    else toast("Azure DevOps não configurado. Mostrando dados de demonstração.");
  }, [qc]);

  const value = useMemo<AppState>(
    () => ({
      filters,
      setFilter: (k, v) => setFilters((f) => ({ ...f, [k]: v })),
      resetFilters: () => setFilters(defaults),
      alertStatus,
      setAlertStatus: (id, s) => setStatus((m) => ({ ...m, [id]: s })),
      overrides,
      reassign: (itemId, personId) => setOverrides((o) => ({ ...o, [itemId]: personId })),
      clearOverrides: () => setOverrides({}),
      lastSync,
      syncing,
      sync: () => void sync(),
      theme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    }),
    [filters, alertStatus, overrides, lastSync, syncing, sync, theme],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppState fora do provider");
  return c;
}

/** Item passa pelos filtros globais de projeto, iteração e tipo? */
export function itemMatches(w: Item, f: Filters) {
  return (
    (f.project === "all" || w.projectId === f.project) &&
    (f.sprint === "all" || w.sprintId === f.sprint) &&
    (f.type === "all" || typeOf(w) === f.type)
  );
}

/** Aplica filtros globais (equipe, pessoa, projeto, iteração, tipo) às pessoas. */
export function filterPeople(list: PersonCapacity[], f: Filters, items: Item[]) {
  return list.filter((pc) => {
    if (f.team !== "all" && pc.person.teamId !== f.team) return false;
    if (f.person !== "all" && pc.person.id !== f.person) return false;
    if (f.project !== "all" || f.sprint !== "all" || f.type !== "all") {
      return items.some((w) => w.assigneeId === pc.person.id && itemMatches(w, f));
    }
    return true;
  });
}

/** @deprecated usa os dados de exemplo; prefira data.people do useSnapshot(). */
export function personById(id: string | null | undefined) {
  return people.find((p) => p.id === id);
}
