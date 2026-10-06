import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/assistente")({
  head: () => ({
    meta: [
      { title: "Assistente IA · iCrew" },
      { name: "description", content: "Perguntas rápidas sobre capacidade e realocação." },
      { property: "og:title", content: "Assistente IA · iCrew" },
      { property: "og:description", content: "Perguntas rápidas sobre capacidade e realocação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ComingSoon title="Assistente IA" items={['Chat com perguntas prontas em chips', 'Respostas em cards: resumo, riscos e sugestões de/para', 'Impacto da realocação na utilização']} />,
});
