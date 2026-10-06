import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PersonCapacity } from "@/services/capacity";
import { people, workItems } from "@/services/capacity";

export type AlertStatus = "Aberto" | "Resolvido" | "Ignorado";

export interface Filters {
  project: string; // "all" | id
  team: string;
  sprint: string;
  period: "4" | "8";
  person: string;
}

interface AppState {
  filters: Filters;
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  resetFilters: () => void;
  alertStatus: Record<string, AlertStatus>;
  setAlertStatus: (id: string, s: AlertStatus) => void;
  lastSync: Date;
  syncing: boolean;
  sync: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const defaults: Filters = { project: "all", team: "all", sprint: "all", period: "8", person: "all" };
const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(defaults);
  const [alertStatus, setStatus] = useState<Record<string, AlertStatus>>({});
  const [lastSync, setLastSync] = useState(() => new Date(Date.now() - 12 * 60 * 1000));
  const [syncing, setSyncing] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("icrew-theme");
    if (saved === "dark") setTheme("dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("icrew-theme", theme);
  }, [theme]);

  const sync = useCallback(() => {
    setSyncing(true);
    setTimeout(async () => {
      await qc.invalidateQueries({ queryKey: ["snapshot"] });
      setLastSync(new Date());
      setSyncing(false);
      toast.success("Dados sincronizados com o Azure DevOps (simulação)");
    }, 900);
  }, [qc]);

  const value = useMemo<AppState>(
    () => ({
      filters,
      setFilter: (k, v) => setFilters((f) => ({ ...f, [k]: v })),
      resetFilters: () => setFilters(defaults),
      alertStatus,
      setAlertStatus: (id, s) => setStatus((m) => ({ ...m, [id]: s })),
      lastSync,
      syncing,
      sync,
      theme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    }),
    [filters, alertStatus, lastSync, syncing, sync, theme],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppState fora do provider");
  return c;
}

/** Aplica filtros globais (equipe, pessoa, projeto, iteração) às pessoas. */
export function filterPeople(list: PersonCapacity[], f: Filters) {
  return list.filter((pc) => {
    if (f.team !== "all" && pc.person.teamId !== f.team) return false;
    if (f.person !== "all" && pc.person.id !== f.person) return false;
    if (f.project !== "all" || f.sprint !== "all") {
      return workItems.some(
        (w) =>
          w.assigneeId === pc.person.id &&
          (f.project === "all" || w.projectId === f.project) &&
          (f.sprint === "all" || w.sprintId === f.sprint),
      );
    }
    return true;
  });
}

export function personById(id: string | null | undefined) {
  return people.find((p) => p.id === id);
}
