import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/pessoas")({
  head: () => ({
    meta: [
      { title: "Pessoas · iCrew" },
      { name: "description", content: "Capacidade semanal, ausências e itens de cada pessoa." },
      { property: "og:title", content: "Pessoas · iCrew" },
      { property: "og:description", content: "Capacidade semanal, ausências e itens de cada pessoa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ComingSoon title="Pessoas" items={['Cards e tabela com cargo, equipe, capacidade semanal e utilização atual', 'Sparkline das próximas 6 semanas e próxima ausência', "Detalhe com calendário de ausências, histórico de carga e 'disponível a partir de'"]} />,
});
