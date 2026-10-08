import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Config oficial do Lovable/TanStack Start (NAO troque por defineConfig do "vite" puro,
// senao o app deixa de funcionar e abre endereco/pagina errada).
//
// Front: http://localhost:8081   |   Chatbot (Flask app.py): http://localhost:8080
// O proxy abaixo encaminha /api/chatbot do front para o Flask, sem CORS e sem IP fixo.
export default defineConfig({
  vite: {
    server: {
      host: true,
      port: 8081,
      strictPort: true,
      proxy: {
        "/api/chatbot": {
          target: (process.env as Record<string, any>)['CHATBOT_BACKEND_URL'] || "http://127.0.0.1:8080",
          changeOrigin: true,
        },
      },
    },
  },
});