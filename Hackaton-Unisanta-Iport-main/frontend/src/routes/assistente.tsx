import { createFileRoute } from "@tanstack/react-router";

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
  component: () => (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-6 text-sm text-muted-foreground">
      Use o chat do Créu no canto inferior direito da tela.
    </div>
  ),
});