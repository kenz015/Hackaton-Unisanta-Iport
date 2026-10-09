import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSnapshot } from "@/services/api";
import { applyOverrides, buildSnapshot, peakFor, type Item } from "@/services/capacity";
import { defaultConfig } from "@/services/config";
import { reassignWorkItem } from "@/services/azure-fns";
import { getAccessToken } from "@/integrations/supabase";
import { useAppState } from "./app-state";
import { UtilizationBadge } from "./status";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { Avatar } from "./ui-bits";

const NONE = "__none__";

/**
 * Simulador de realocação: escolhe um novo responsável para o item e mostra
 * a utilização antes/depois das duas pessoas, antes de aplicar.
 */
export function ReallocateDialog({ item, open, onOpenChange }: { item: Item | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, source } = useSnapshot();
  const { overrides, reassign } = useAppState();
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const from = item?.assigneeId ?? null;

  // Candidatos ordenados por quem tem mais folga no período do item
  const candidates = useMemo(() => {
    if (!data || !item) return [];
    return data.people
      .filter((p) => p.person.id !== from)
      .map((p) => ({ pc: p, peak: peakFor(data, p.person.id, item) }))
      .sort((a, b) => (a.peak?.utilization ?? 9) - (b.peak?.utilization ?? 9));
  }, [data, item, from]);

  // Snapshot simulado com a mudança
  const simulated = useMemo(() => {
    if (!source || !item || !target) return null;
    const to = target === NONE ? null : target;
    return buildSnapshot(defaultConfig, applyOverrides(source, { ...overrides, [item.id]: to }));
  }, [source, item, target, overrides]);

  if (!item || !data) return null;
  const nameOf = (id: string | null) => (id ? (data.people.find((p) => p.person.id === id)?.person.name ?? id) : "Sem responsável");
  const toId = target === NONE ? null : target || undefined;

  const row = (personId: string | null) => {
    if (!personId) return null;
    const before = peakFor(data, personId, item);
    const after = simulated ? peakFor(simulated, personId, item) : null;
    return (
      <div key={personId} className="flex items-center gap-3 rounded-xl border border-border p-3">
        <Avatar name={nameOf(personId)} />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{nameOf(personId)}</p>
        {before && <UtilizationBadge util={before.utilization} status={before.status} />}
        {after && (
          <>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            <UtilizationBadge util={after.utilization} status={after.status} />
          </>
        )}
      </div>
    );
  };

  const apply = async () => {
    if (toId === undefined) return;
    reassign(item.id, toId);
    const label = `#${item.id} agora está com ${nameOf(toId)}`;
    if (source?.origin === "azure") {
      setSaving(true);
      try {
        // O Azure grava o responsável pelo e-mail; o id da pessoa pode ser o GUID do Azure
        const toPerson = toId ? data.people.find((p) => p.person.id === toId)?.person : undefined;
        const toEmail = toId ? (toPerson?.email || toId) : null;
        await reassignWorkItem({ data: { id: item.id, assignee: toEmail, accessToken: await getAccessToken() } });
        toast.success(`${label} (gravado no Azure DevOps)`);
      } catch (e) {
        toast.error(`Aplicado no painel, mas não gravou no Azure: ${e instanceof Error ? e.message : "erro"}`);
      } finally {
        setSaving(false);
      }
    } else {
      toast.success(`${label} (simulação com dados de demonstração)`);
    }
    setTarget("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setTarget(""); onOpenChange(o); }}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="title-caps flex items-center gap-2 text-base"><Shuffle className="size-4 text-brand-cyan" /> Realocar item</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1">
              <div className="flex items-center gap-2"><WorkItemTypeBadge item={item} /> <span>#{item.id} · P{item.priority} · {item.estimateHours ?? "?"}h</span></div>
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="text-xs">{format(parseISO(item.start), "dd/MM")} a {format(parseISO(item.end), "dd/MM")} · hoje com {nameOf(from)}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-muted-foreground" htmlFor="realocar-para">Mover para</label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="realocar-para" className="rounded-lg"><SelectValue placeholder="Escolha quem vai receber o item" /></SelectTrigger>
            <SelectContent>
              {candidates.map(({ pc, peak }) => (
                <SelectItem key={pc.person.id} value={pc.person.id}>
                  {pc.person.name} · {peak?.utilization == null ? "ausente" : `${Math.round(peak.utilization * 100)}%`} no período
                </SelectItem>
              ))}
              {from && <SelectItem value={NONE}>Deixar sem responsável</SelectItem>}
            </SelectContent>
          </Select>
          {candidates[0] && !target && (
            <p className="text-xs text-muted-foreground">Sugestão: <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setTarget(candidates[0]!.pc.person.id)}>{candidates[0].pc.person.name}</button> é quem tem mais folga nesse período.</p>
          )}

          <p className="pt-1 text-xs font-semibold text-muted-foreground">Utilização no período do item {simulated ? "(antes → depois)" : ""}</p>
          <div className="space-y-2">
            {row(from)}
            {toId ? row(toId) : null}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={apply} disabled={toId === undefined || saving}>
            {saving ? "Gravando…" : source?.origin === "azure" ? "Aplicar e gravar no Azure" : "Aplicar realocação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
