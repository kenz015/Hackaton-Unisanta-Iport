import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { CalendarRange, Check, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Alert } from "@/services/capacity";
import { SeverityBadge, severityMeta } from "./status";
import { useAppState } from "./app-state";

const explain: Record<Alert["type"], string> = {
  sobrecarga: "A carga planejada (horas estimadas distribuídas pelos dias úteis dos itens) passa da capacidade da pessoa na semana. Mover 1 ou 2 itens de menor prioridade para quem tem folga resolve sem atrasar a sprint.",
  ausencia: "O item tem dias de execução que caem dentro de uma ausência registrada. Sem reatribuição, o trabalho fica parado nesse período.",
  feriado: "O item está agendado para um dia sem expediente. A capacidade desse dia é zero.",
  sobreposicao: "Dois itens de prioridade máxima disputam os mesmos dias da mesma pessoa. Sequenciar evita que ambos atrasem.",
  "sem-responsavel": "Itens sem responsável não entram no cálculo de capacidade de ninguém, então o risco fica invisível.",
  "sem-estimativa": "Sem horas estimadas, o item conta como zero na carga. A utilização real da pessoa provavelmente é maior que a exibida.",
  "sem-iteracao": "Item fora de sprint não aparece no planejamento e tende a ser esquecido ou feito sem visibilidade.",
  parado: "O item está em andamento sem atualização além do limite configurado. Pode estar bloqueado sem registro.",
  "sprint-risco": "O trabalho restante está bem acima da linha ideal do burndown. No ritmo atual, parte do escopo não será entregue.",
  ociosa: "A pessoa tem capacidade livre consistente nas próximas semanas. É uma oportunidade de aliviar quem está sobrecarregado.",
  dependencia: "Todo o trabalho crítico do projeto depende de uma pessoa. Uma ausência dela paralisa as entregas.",
};

export function AlertCard({ alert, compact }: { alert: Alert; compact?: boolean }) {
  const { alertStatus, setAlertStatus, setFilter } = useAppState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const status = alertStatus[alert.id] ?? "Aberto";

  const goTimeline = () => {
    if (alert.personId) setFilter("person", alert.personId);
    navigate({ to: "/timeline" });
  };

  return (
    <article className={cn("relative rounded-xl border border-border bg-card p-3 pl-4", status !== "Aberto" && "opacity-60")}>
      <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", severityMeta[alert.severity].dot)} aria-hidden />
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} />
        <h3 className="text-sm font-semibold text-foreground">{alert.title}</h3>
        {!compact && <span className="ml-auto text-xs text-muted-foreground">{format(parseISO(alert.date), "dd/MM/yyyy")}</span>}
        {status !== "Aberto" && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{status}</span>}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{alert.description}</p>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-1">
          {alert.entities.map((e) => (
            <span key={e} className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">{e}</span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs font-semibold text-primary">→ {alert.action}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={goTimeline}>
          <CalendarRange className="size-3" /> Ver na timeline
        </Button>
        <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => setOpen(true)}>
          <Sparkles className="size-3" /> Explicar com IA
        </Button>
        {!compact && status === "Aberto" && (
          <>
            <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => { setAlertStatus(alert.id, "Resolvido"); toast.success("Aviso marcado como resolvido"); }}>
              <Check className="size-3" /> Marcar como resolvido
            </Button>
            <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => { setAlertStatus(alert.id, "Ignorado"); toast("Aviso ignorado"); }}>
              <EyeOff className="size-3" /> Ignorar
            </Button>
          </>
        )}
        {!compact && status !== "Aberto" && (
          <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => setAlertStatus(alert.id, "Aberto")}>Reabrir</Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="title-caps flex items-center gap-2 text-base"><Sparkles className="size-4 text-brand-cyan" /> Explicação da IA</DialogTitle>
            <DialogDescription>{alert.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-accent p-3">
              <p className="mb-1 text-xs font-bold uppercase text-primary">O que está acontecendo</p>
              <p className="text-foreground">{alert.description}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Por que importa</p>
              <p className="text-foreground">{explain[alert.type]}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Sugestão</p>
              <p className="font-medium text-foreground">{alert.action}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">Resposta simulada nesta etapa.</p>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
