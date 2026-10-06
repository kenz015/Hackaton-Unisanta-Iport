import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · iCrew" },
      { name: "description", content: "Limites de capacidade e integração com o Azure DevOps." },
      { property: "og:title", content: "Configurações · iCrew" },
      { property: "og:description", content: "Limites de capacidade e integração com o Azure DevOps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ComingSoon title="Configurações" items={['Capacidade padrão (8 h/dia), limites de atenção (85%) e sobrecarga (100%)', 'Dias para item parado (5) e UF dos feriados (SP)', 'Integração Azure DevOps: organização, projetos e status']} />,
});
