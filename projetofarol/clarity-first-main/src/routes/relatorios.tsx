import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Resumos e relatórios · iCrew" },
      { name: "description", content: "Resumo semanal e por sprint." },
      { property: "og:title", content: "Resumos e relatórios · iCrew" },
      { property: "og:description", content: "Resumo semanal e por sprint." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ComingSoon title="Resumos e relatórios" items={['Principais números, riscos e decisões sugeridas', 'Exportar PDF', 'Copiar resumo']} />,
});
