import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/projetos")({
  head: () => ({
    meta: [
      { title: "Projetos e work items · iCrew" },
      { name: "description", content: "Progresso dos projetos e lista de work items com problemas." },
      { property: "og:title", content: "Projetos e work items · iCrew" },
      { property: "og:description", content: "Progresso dos projetos e lista de work items com problemas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ComingSoon title="Projetos e work items" items={['Lista de projetos com progresso, sprint atual e risco', 'Tabela de work items com filtros, busca e ordenação', 'Badges: sem responsável, sem estimativa, parado']} />,
});
