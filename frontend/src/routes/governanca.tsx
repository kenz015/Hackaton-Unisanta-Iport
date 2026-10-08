import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/governanca")({
  head: () => ({
    meta: [
      { title: "Governança do board · iCrew" },
      { name: "description", content: "Score de saúde do board e listas acionáveis." },
      { property: "og:title", content: "Governança do board · iCrew" },
      { property: "og:description", content: "Score de saúde do board e listas acionáveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ComingSoon title="Governança do board" items={['Score 0–100 com decomposição por critério', 'Listas de itens sem estimativa, responsável, iteração ou data', 'Evolução do score por sprint e ranking de projetos']} />,
});
