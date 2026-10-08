import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="title-caps text-2xl text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ title, icon: Icon, actions, children, className }: { title: string; icon?: LucideIcon; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("surface-card p-5", className)}>
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="title-caps flex items-center gap-2 text-sm text-foreground">
          {Icon && <Icon className="size-4 text-brand-cyan" aria-hidden />}
          {title}
        </h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function KpiCard({ label, value, hint, icon: Icon, tone = "default" }: { label: string; value: ReactNode; hint?: string; icon: LucideIcon; tone?: "default" | "critical" | "attention" | "good" }) {
  const toneCls = {
    default: "bg-accent text-primary",
    critical: "bg-critical-soft text-critical",
    attention: "bg-highlight-soft text-highlight-foreground dark:text-highlight",
    good: "bg-status-available text-status-available-foreground",
  }[tone];
  return (
    <div className="surface-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("grid size-8 place-items-center rounded-lg", toneCls)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <div className="text-3xl font-bold tabular-nums text-foreground">{value}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-primary">
        <Inbox className="size-5" aria-hidden />
      </span>
      <p className="font-semibold text-foreground">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary", className)} aria-hidden>
      {initials}
    </span>
  );
}
