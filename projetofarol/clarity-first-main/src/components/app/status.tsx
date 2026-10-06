import { AlertOctagon, AlertTriangle, CheckCircle2, CircleDashed, Info, Plane, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Severity, UtilStatus } from "@/services/capacity";
import { pct } from "@/services/capacity";

export const statusMeta: Record<UtilStatus, { label: string; cls: string; Icon: typeof Info }> = {
  available: { label: "Disponível", cls: "bg-status-available text-status-available-foreground", Icon: CircleDashed },
  healthy: { label: "Saudável", cls: "bg-status-healthy text-status-healthy-foreground", Icon: CheckCircle2 },
  attention: { label: "Atenção", cls: "bg-status-attention text-status-attention-foreground", Icon: AlertTriangle },
  overload: { label: "Sobrecarga", cls: "bg-status-overload text-status-overload-foreground", Icon: AlertOctagon },
  absent: { label: "Ausente", cls: "bg-status-absent text-status-absent-foreground hatch-absent", Icon: Plane },
  conflict: { label: "Conflito", cls: "bg-status-overload text-status-overload-foreground hatch-absent", Icon: Zap },
};

export function UtilizationBadge({ util, status, className }: { util: number | null; status: UtilStatus; className?: string }) {
  const m = statusMeta[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", m.cls, className)}
      title={m.label}
    >
      <m.Icon className="size-3" aria-hidden />
      {util === null ? m.label : pct(util)}
      <span className="sr-only">{m.label}</span>
    </span>
  );
}

export const severityMeta: Record<Severity, { label: string; cls: string; dot: string; Icon: typeof Info }> = {
  critical: { label: "Crítico", cls: "bg-critical-soft text-critical", dot: "bg-critical", Icon: AlertOctagon },
  attention: { label: "Atenção", cls: "bg-highlight-soft text-highlight-foreground dark:text-highlight", dot: "bg-highlight", Icon: AlertTriangle },
  info: { label: "Informativo", cls: "bg-info-soft text-primary", dot: "bg-brand-cyan", Icon: Info },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const m = severityMeta[severity];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", m.cls)}>
      <m.Icon className="size-3" aria-hidden />
      {m.label}
    </span>
  );
}

export function Legend() {
  const order: UtilStatus[] = ["available", "healthy", "attention", "overload", "absent"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {order.map((s) => {
        const m = statusMeta[s];
        return (
          <span key={s} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", m.cls)}>
            <m.Icon className="size-3" aria-hidden /> {m.label}
          </span>
        );
      })}
    </div>
  );
}
