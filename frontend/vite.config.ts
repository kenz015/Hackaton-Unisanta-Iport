import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const env = process.env as Record<string, string | undefined>;

export default defineConfig({
  vite: {
    server: {
      host: true,
      // 8080 é o endereço cadastrado no Supabase (links de confirmação e de nova senha).
      port: 8080,
      strictPort: true,
      proxy: {
        // Chatbot Créu (backend/app.py). Única rota do backend liberada para o navegador;
        // o app.py exige o token de login em cada mensagem.
        "/api/chatbot": {
          target: env["CHATBOT_BACKEND_URL"] || "http://127.0.0.1:5001",
          changeOrigin: true,
        },
        // As outras rotas da API (backend/api.py) NÃO passam por aqui de propósito:
        // o próprio servidor do site fala com elas, e o navegador nunca acessa direto.
      },
    },
  },
});
