import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Database, Gauge, Save, Settings2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { PageHeader } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSnapshot } from "@/services/api";
import { defaultConfig } from "@/services/config";

type SettingsState = {
  hoursPerDay: number;
  attentionLimit: number;
  overloadLimit: number;
  staleDays: number;
  holidayUF: string;
  autoSync: boolean;
  aiAssist: boolean;
  criticalAlerts: boolean;
  attentionAlerts: boolean;
};

function ConfiguracoesPage() {
  const { data, warning } = useSnapshot();
  const cfg = data?.config ?? defaultConfig;

  const [settings, setSettings] = useState<SettingsState>({
    hoursPerDay: cfg.hoursPerDay,
    attentionLimit: cfg.attentionLimit,
    overloadLimit: cfg.overloadLimit,
    staleDays: cfg.staleDays,
    holidayUF: cfg.holidayUF,
    autoSync: true,
    aiAssist: true,
    criticalAlerts: true,
    attentionAlerts: true,
  });

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      hoursPerDay: cfg.hoursPerDay,
      attentionLimit: cfg.attentionLimit,
      overloadLimit: cfg.overloadLimit,
      staleDays: cfg.staleDays,
      holidayUF: cfg.holidayUF,
    }));
  }, [cfg]);

  const handleNumberChange = (key: "hoursPerDay" | "attentionLimit" | "overloadLimit" | "staleDays", value: string) => {
    const next = Number(value);
    setSettings((prev) => ({ ...prev, [key]: Number.isFinite(next) ? next : 0 }));
  };

  const handleSwitch = (key: "autoSync" | "aiAssist" | "criticalAlerts" | "attentionAlerts") => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sourceLabel = data?.origin === "azure" ? "Azure DevOps" : "Dados de demonstração";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Ajuste os limites da operação, integrações e alertas que orientam a rotina do time."
        actions={
          <Button className="rounded-xl">
            <Save className="mr-2 size-4" aria-hidden />
            Salvar alterações
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-brand-cyan" aria-hidden />
                <CardTitle>Capacidade e limites</CardTitle>
              </div>
              <CardDescription>Parâmetros usados para calcular carga, risco e atenção da equipe.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Horas padrão por dia</label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={settings.hoursPerDay}
                    onChange={(event) => handleNumberChange("hoursPerDay", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">UF dos feriados</label>
                  <Input
                    value={settings.holidayUF}
                    onChange={(event) => setSettings((prev) => ({ ...prev, holidayUF: event.target.value.toUpperCase() }))}
                    maxLength={2}
                    className="uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Limite de atenção (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.attentionLimit}
                    onChange={(event) => handleNumberChange("attentionLimit", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Limite de sobrecarga (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    value={settings.overloadLimit}
                    onChange={(event) => handleNumberChange("overloadLimit", event.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground">Dias para item parado</label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={settings.staleDays}
                    onChange={(event) => handleNumberChange("staleDays", event.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand-cyan" aria-hidden />
                <CardTitle>Automação e IA</CardTitle>
              </div>
              <CardDescription>Definições que ajudam a operação a agir antes e com contexto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <div>
                  <p className="font-medium text-foreground">Sincronização automática</p>
                  <p className="text-sm text-muted-foreground">Atualiza o snapshot sem intervenção manual.</p>
                </div>
                <Switch checked={settings.autoSync} onCheckedChange={() => handleSwitch("autoSync")} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <div>
                  <p className="font-medium text-foreground">Assistente de IA</p>
                  <p className="text-sm text-muted-foreground">Sugestões para explicar risco e priorização.</p>
                </div>
                <Switch checked={settings.aiAssist} onCheckedChange={() => handleSwitch("aiAssist")} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="size-4 text-brand-cyan" aria-hidden />
                <CardTitle>Integração Azure DevOps</CardTitle>
              </div>
              <CardDescription>Conexão ativa e origem dos dados usados no painel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Origem</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-medium text-foreground">{sourceLabel}</span>
                  <span className="rounded-full bg-status-available px-2 py-1 text-[10px] font-semibold text-status-available-foreground">Online</span>
                </div>
              </div>

              <div className="grid gap-3">
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Organização</span>
                  <Input defaultValue="unisantagroup" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Projeto</span>
                  <Input defaultValue="Porto Digital" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Time</span>
                  <Input defaultValue="Operations" />
                </label>
              </div>

              {warning && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                  {warning}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand-cyan" aria-hidden />
                <CardTitle>Alertas</CardTitle>
              </div>
              <CardDescription>Notificações por nível de criticidade.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <div>
                  <p className="font-medium text-foreground">Críticos</p>
                  <p className="text-sm text-muted-foreground">Bloqueios, risco alto e sobrecarga extrema.</p>
                </div>
                <Switch checked={settings.criticalAlerts} onCheckedChange={() => handleSwitch("criticalAlerts")} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <div>
                  <p className="font-medium text-foreground">Atenção</p>
                  <p className="text-sm text-muted-foreground">Uso acima do limite de atenção da equipe.</p>
                </div>
                <Switch checked={settings.attentionAlerts} onCheckedChange={() => handleSwitch("attentionAlerts")} />
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · iCrew" },
      { name: "description", content: "Ajuste de capacidade, alertas e integração com o Azure DevOps." },
      { property: "og:title", content: "Configurações · iCrew" },
      { property: "og:description", content: "Ajuste de capacidade, alertas e integração com o Azure DevOps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConfiguracoesPage,
});
