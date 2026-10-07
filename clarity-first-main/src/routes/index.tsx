import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Activity, AlertOctagon, CalendarDays, Gauge, ShieldCheck, Sparkles, UserCheck, Users, TriangleAlert, Bell, Flag } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend as RLegend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useSnapshot } from "@/services/api";
import { countsForCapacity } from "@/data/agile";
import { filterPeople, itemMatches, useAppState } from "@/components/app/app-state";
import { WorkItemTypeBadge } from "@/components/app/WorkItemTypeBadge";
import { EmptyState, KpiCard, PageHeader, PageSkeleton, Panel } from "@/components/app/ui-bits";
import { AlertCard } from "@/components/app/AlertCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão geral · iCrew" },
      { name: "description", content: "Utilização da equipe, sobrecargas, avisos prioritários e saúde do board em um só painel." },
      { property: "og:title", content: "Visão geral · iCrew" },
      { property: "og:description", content: "Utilização da equipe, sobrecargas, avisos prioritários e saúde do board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const axis = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const tooltipStyle = { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12, color: "var(--color-popover-foreground)" };
const statusColor = { available: "var(--color-status-available-foreground)", healthy: "var(--color-status-healthy)", attention: "var(--color-status-attention)", overload: "var(--color-status-overload)", absent: "var(--color-muted)", conflict: "var(--color-status-overload)" };

function Dashboard() {
  const { data, isLoading } = useSnapshot();
  const { filters, alertStatus } = useAppState();
  if (isLoading || !data) return <PageSkeleton />;

  const cfg = data.config;
  const { projects, workItems } = data;
  const list = filterPeople(data.people, filters, workItems);
  const nWeeks = Number(filters.period);
  const withCap = list.filter((p) => p.current.capacity > 0);
  const avgUtil = withCap.length ? withCap.reduce((s, p) => s + p.current.load, 0) / withCap.reduce((s, p) => s + p.current.capacity, 0) : 0;
  const overloaded = list.filter((p) => p.weeks.slice(0, 2).some((w) => w.utilization !== null && w.utilization * 100 > cfg.overloadLimit));
  const available = list.filter((p) => p.current.utilization !== null && p.current.utilization < 0.6);
  const openAlerts = data.alerts.filter((a) => (alertStatus[a.id] ?? "Aberto") === "Aberto");
  const critical = openAlerts.filter((a) => a.severity === "critical");
  const riskItems = new Set(openAlerts.flatMap((a) => a.itemIds ?? [])).size;

  const byPerson = list
    .map((p) => ({ name: p.person.name.split(" ")[0], util: Math.round((p.current.utilization ?? 0) * 100), status: p.current.status }))
    .sort((a, b) => b.util - a.util);
  const byWeek = data.weeks.slice(0, nWeeks).map((w, i) => {
    const cap = list.reduce((s, p) => s + p.weeks[i]!.capacity, 0);
    const load = list.reduce((s, p) => s + p.weeks[i]!.load, 0);
    return { week: format(parseISO(w), "dd/MM"), util: cap ? Math.round((load / cap) * 100) : 0 };
  });
  const ids = new Set(list.map((p) => p.person.id));
  const open = workItems.filter((w) => w.state !== "Concluído" && countsForCapacity(w) && (!w.assigneeId || ids.has(w.assigneeId)) && itemMatches(w, filters));
  const byProject = projects
    .filter((p) => filters.project === "all" || p.id === filters.project)
    .map((p) => ({ name: p.name, value: open.filter((w) => w.projectId === p.id).reduce((s, w) => s + (w.estimateHours ?? 0), 0), color: `var(${p.colorVar})` }))
    .filter((p) => p.value > 0);
  const states = ["Novo", "Ativo", "Em revisão", "Bloqueado", "Concluído"] as const;
  const stateColors = ["var(--color-muted-foreground)", "var(--color-primary)", "var(--color-brand-cyan)", "var(--color-critical)", "var(--color-brand-turquoise)"];
  const byState = projects
    .filter((p) => filters.project === "all" || p.id === filters.project)
    .map((p) => {
      const row: Record<string, string | number> = { name: p.code };
      states.forEach((s) => (row[s] = workItems.filter((w) => w.projectId === p.id && w.state === s && itemMatches(w, filters)).length));
      return row;
    });

  return (
    <div className="space-y-6">
      <PageHeader title="Visão geral" subtitle={`Hoje, ${format(parseISO(data.today), "dd/MM/yyyy")} · limites: atenção ${cfg.attentionLimit}% · sobrecarga ${cfg.overloadLimit}%`} />

      <section className="brand-gradient rounded-2xl p-5 text-primary-foreground shadow-card">
        <h2 className="title-caps mb-3 flex items-center gap-2 text-sm">
          <Sparkles className="size-4" aria-hidden /> Briefing do dia
          <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">calculado a partir do board</span>
        </h2>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          {data.briefing.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-highlight" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Utilização média" value={`${Math.round(avgUtil * 100)}%`} hint="semana atual" icon={Gauge} tone={avgUtil * 100 > cfg.attentionLimit ? "attention" : "default"} />
        <KpiCard label="Em sobrecarga" value={overloaded.length} hint="próximas 2 semanas" icon={AlertOctagon} tone={overloaded.length ? "critical" : "good"} />
        <KpiCard label="Disponíveis" value={available.length} hint="abaixo de 60% hoje" icon={UserCheck} tone="good" />
        <KpiCard label="Itens em risco" value={riskItems} hint="citados em avisos abertos" icon={TriangleAlert} tone="attention" />
        <KpiCard label="Avisos críticos" value={critical.length} hint="abertos" icon={Bell} tone={critical.length ? "critical" : "good"} />
        <KpiCard label="Saúde do board" value={<>{data.healthScore}<span className="text-base text-muted-foreground">/100</span></>} hint="qualidade dos dados" icon={ShieldCheck} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Avisos prioritários" icon={Bell} className="xl:col-span-1" actions={<Link to="/avisos" className="text-xs font-semibold text-primary hover:underline">Ver todos</Link>}>
          {openAlerts.length === 0 ? (
            <EmptyState title="Nenhum aviso aberto" text="Tudo sob controle por aqui." />
          ) : (
            <div className="space-y-3">
              {openAlerts.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} compact />)}
            </div>
          )}
        </Panel>

        <Panel title="Utilização por pessoa" icon={Users} className="xl:col-span-2">
          {byPerson.length === 0 ? (
            <EmptyState title="Ninguém nos filtros atuais" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, byPerson.length * 30)}>
              <BarChart data={byPerson} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" tick={axis} unit="%" domain={[0, (max: number) => Math.max(140, max)]} />
                <YAxis type="category" dataKey="name" tick={axis} width={70} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "Utilização"]} cursor={{ fill: "var(--color-accent)" }} />
                <ReferenceLine x={cfg.overloadLimit} stroke="var(--color-critical)" strokeDasharray="4 4" label={{ value: "limite", position: "top", fontSize: 10, fill: "var(--color-critical)" }} />
                <ReferenceLine x={cfg.attentionLimit} stroke="var(--color-highlight)" strokeDasharray="2 4" />
                <Bar dataKey="util" radius={[0, 6, 6, 0]} label={{ position: "right", fontSize: 11, fill: "var(--color-foreground)", formatter: (v: number) => `${v}%` }}>
                  {byPerson.map((p, i) => <Cell key={i} fill={statusColor[p.status]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title={`Utilização por semana · ${nWeeks} semanas`} icon={Activity} className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={byWeek}>
              <defs>
                <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand-cyan)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-brand-cyan)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="week" tick={axis} />
              <YAxis tick={axis} unit="%" domain={[0, 120]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "Utilização"]} />
              <ReferenceLine y={cfg.overloadLimit} stroke="var(--color-critical)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="util" stroke="var(--color-primary)" strokeWidth={2} fill="url(#ga)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Horas por projeto" icon={Gauge}>
          {byProject.length === 0 ? <EmptyState title="Sem horas abertas" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byProject} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {byProject.map((p, i) => <Cell key={i} fill={p.color} stroke="var(--color-card)" />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}h`, "Horas"]} />
                <RLegend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <Panel title="Epics e Features" icon={Flag} actions={<span className="text-xs text-muted-foreground">progresso pelas Tasks e Bugs filhos</span>}>
        {data.roadmap.length === 0 ? (
          <EmptyState title="Nenhum Epic ou Feature nos dados" text="No Azure DevOps (processo Agile), crie Epics e Features e ligue as User Stories e Tasks a eles." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.roadmap.slice(0, 8).map((r) => (
              <li key={r.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <WorkItemTypeBadge type={r.type} />
                  <span>#{r.id} · {r.state}</span>
                  <span className="ml-auto font-bold text-foreground">{Math.round(r.progress * 100)}%</span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-foreground">{r.title}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(r.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${r.progress * 100}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{r.done} de {r.total} itens concluídos</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Work items por estado" icon={Activity}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byState}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={axis} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} />
              <RLegend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              {states.map((s, i) => <Bar key={s} dataKey={s} stackId="a" fill={stateColors[i]} />)}
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title={`Burndown · ${data.sprintName}`}
          icon={TriangleAlert}
          actions={data.sprintAtRisk && <span className="rounded-full bg-critical-soft px-2 py-0.5 text-[11px] font-bold uppercase text-critical">Em risco</span>}
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.burndown}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="day" tick={axis} />
              <YAxis tick={axis} unit="h" />
              <Tooltip contentStyle={tooltipStyle} />
              <RLegend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
              <Line name="Ideal" dataKey="ideal" stroke="var(--color-muted-foreground)" strokeDasharray="5 5" dot={false} />
              <Line name="Real" dataKey="real" stroke="var(--color-critical)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Próximas ausências e feriados" icon={CalendarDays}>
          {data.upcomingOff.length === 0 ? <EmptyState title="Nada nos próximos 30 dias" /> : (
            <ul className="space-y-2">
              {data.upcomingOff.map((o, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                  <div className="grid w-12 shrink-0 place-items-center rounded-lg bg-accent py-1 text-primary">
                    <span className="text-base font-bold leading-none">{format(parseISO(o.date), "dd")}</span>
                    <span className="text-[10px] uppercase">{format(parseISO(o.date), "MM/yy")}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{o.label}</p>
                    <p className="text-xs text-muted-foreground">{o.kind}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
