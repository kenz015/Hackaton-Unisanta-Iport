import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { snapshotQuery } from "@/services/api";
import type { AlertType, Severity } from "@/services/capacity";
import { useAppState, type AlertStatus } from "@/components/app/app-state";
import { AlertCard } from "@/components/app/AlertCard";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/app/ui-bits";
import { severityMeta } from "@/components/app/status";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/avisos")({
  head: () => ({
    meta: [
      { title: "Central de avisos · iCrew" },
      { name: "description", content: "Sobrecargas, conflitos de ausência, itens parados e riscos de sprint com ação sugerida." },
      { property: "og:title", content: "Central de avisos · iCrew" },
      { property: "og:description", content: "Todos os avisos de capacidade e governança em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Avisos,
});

const typeLabels: Record<AlertType, string> = {
  sobrecarga: "Sobrecarga", ausencia: "Item em ausência", feriado: "Item em feriado", sobreposicao: "Sobreposição",
  "sem-responsavel": "Sem responsável", "sem-estimativa": "Sem estimativa", "sem-iteracao": "Sem iteração", parado: "Item parado",
  "sprint-risco": "Sprint em risco", ociosa: "Pessoa ociosa", dependencia: "Dependência única",
};

function Avisos() {
  const { data, isLoading } = useQuery(snapshotQuery);
  const { alertStatus, filters } = useAppState();
  const [sev, setSev] = useState<Severity | "all">("all");
  const [type, setType] = useState<AlertType | "all">("all");
  const [status, setStatus] = useState<AlertStatus | "all">("Aberto");
  if (isLoading || !data) return <PageSkeleton />;

  const base = data.alerts.filter((a) => filters.person === "all" || a.personId === filters.person);
  const list = base.filter(
    (a) => (sev === "all" || a.severity === sev) && (type === "all" || a.type === type) && (status === "all" || (alertStatus[a.id] ?? "Aberto") === status),
  );
  const counts = (s: Severity) => base.filter((a) => a.severity === s && (alertStatus[a.id] ?? "Aberto") === "Aberto").length;

  return (
    <div>
      <PageHeader title="Central de avisos" subtitle="Cada aviso traz números, quem está envolvido e o que fazer." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "critical", "attention", "info"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSev(s)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", sev === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent")}
          >
            {s === "all" ? "Todas severidades" : `${severityMeta[s].label} (${counts(s)})`}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Select value={type} onValueChange={(v) => setType(v as AlertType | "all")}>
            <SelectTrigger className="h-8 w-48 rounded-lg text-xs" aria-label="Tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os tipos</SelectItem>
              {Object.entries(typeLabels).map(([k, l]) => <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as AlertStatus | "all")}>
            <SelectTrigger className="h-8 w-36 rounded-lg text-xs" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "Aberto", "Resolvido", "Ignorado"].map((s) => <SelectItem key={s} value={s} className="text-xs">{s === "all" ? "Todos status" : s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="surface-card p-4">
        {list.length === 0 ? (
          <EmptyState title="Nenhum aviso com esses filtros" text="Experimente mudar a severidade, o tipo ou o status." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">{list.map((a) => <AlertCard key={a.id} alert={a} />)}</div>
        )}
      </div>
    </div>
  );
}
