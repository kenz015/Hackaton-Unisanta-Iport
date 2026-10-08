import { BookOpen, Bug, CircleAlert, ClipboardCheck, Crown, Trophy, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { typeMeta, typeOf, type AgileFields, type WorkItemType } from "@/data/agile";

const icons: Record<WorkItemType, LucideIcon> = {
  Epic: Crown,
  Feature: Trophy,
  "User Story": BookOpen,
  Task: ClipboardCheck,
  Bug: Bug,
  Issue: CircleAlert,
};

/** Ícone + nome do tipo de work item, nas cores do Azure DevOps. */
export function WorkItemTypeBadge({ item, type, showLabel = true, className }: { item?: AgileFields; type?: WorkItemType; showLabel?: boolean; className?: string }) {
  const t = type ?? (item ? typeOf(item) : "Task");
  const Icon = icons[t];
  const m = typeMeta[t];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", className)} title={`${m.label}: ${m.description}`}>
      <Icon className="size-3.5 shrink-0" style={{ color: m.color }} aria-hidden />
      {showLabel ? <span className="text-foreground">{m.label}</span> : <span className="sr-only">{m.label}</span>}
    </span>
  );
}
