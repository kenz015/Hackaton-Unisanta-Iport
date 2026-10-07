import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline de alocação · iCrew" },
      { name: "description", content: "Visão tipo Gantt da alocação de cada pessoa por dia, semana ou sprint." },
      { property: "og:title", content: "Timeline de alocação · iCrew" },
      { property: "og:description", content: "Visão tipo Gantt da alocação de cada pessoa por dia, semana ou sprint." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ComingSoon title="Timeline de alocação" items={["Linhas por pessoa, colunas por dia, semana ou sprint","Barras coloridas por projeto, ausências hachuradas e feriados destacados","Linha de hoje, sobreposições em vermelho e detalhes ao passar o mouse"]} />,
});
